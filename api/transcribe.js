import axios from 'axios';
import FormData from 'form-data';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import { promisify } from 'util';

const execPromise = promisify(exec);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Supabase クライアント
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ネクストアクション抽出関数
async function extractNextActions(summary) {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたはMTG議事録から具体的なネクストアクションを抽出する専門家です。'
          },
          {
            role: 'user',
            content: `以下のMTG要約からネクストアクション（TODO）を抽出してください。
JSON形式で以下の構造で返してください：
{
  "actions": [
    {"text": "〇〇さんが〇〇を△月△日までに実施する", "priority": "high"},
    ...
  ]
}

要約：
${summary}`
          }
        ],
        temperature: 0.5,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const content = response.data.choices[0].message.content;
    const parsed = JSON.parse(content);
    return parsed.actions || [];
  } catch (error) {
    console.error('❌ ネクストアクション抽出エラー:', error.message);
    return [];
  }
}

export default async function handler(req, res) {
  // CORS 設定
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return res.json({ status: 'ok', endpoint: '/api/transcribe' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ファイルアップロードの処理（Vercel では複雑なため、簡略化）
    // 実際には multipart/form-data の処理が必要

    // 代替案：ユーザーが音声ファイルをアップロード URL として渡す
    const { videoUrl, clientId } = req.body;

    if (!videoUrl) {
      return res.status(400).json({ error: 'videoUrl が必要です' });
    }

    console.log('🎬 動画をダウンロード中...');

    // 動画をダウンロード
    const videoPath = `/tmp/${Date.now()}.mp4`;
    const audioPath = `/tmp/${Date.now()}.mp3`;

    const videoResponse = await axios.get(videoUrl, { responseType: 'arraybuffer' });
    fs.writeFileSync(videoPath, videoResponse.data);

    console.log('✅ ダウンロード完了');
    console.log('🎬 動画から音声を抽出中...');

    // FFmpeg で音声抽出
    await execPromise(`ffmpeg -i "${videoPath}" -q:a 9 -n "${audioPath}" 2>&1`);

    console.log('✅ 音声抽出完了');
    console.log('🤖 OpenAI Whisper で文字起こし中...');

    // OpenAI Whisper API に送信
    const audioStream = fs.createReadStream(audioPath);
    const formData = new FormData();
    formData.append('file', audioStream);
    formData.append('model', 'whisper-1');
    formData.append('language', 'ja');

    const whisperResponse = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    const transcript = whisperResponse.data.text;
    console.log('✅ 文字起こし完了');
    console.log('📝 GPT で内容をまとめ中...');

    // GPT で内容をまとめる
    const summaryResponse = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'あなたはビジネス会議の議事録作成の専門家です。以下の文字起こしテキストを、簡潔で分かりやすい議事録にまとめてください。セクション分けやポイント番号付けなど、読みやすくしてください。'
          },
          {
            role: 'user',
            content: `以下のMTG音声の文字起こしテキストを、簡潔な議事録にまとめてください：\n\n${transcript}`
          }
        ],
        temperature: 0.7,
        max_tokens: 1500
      },
      {
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const summary = summaryResponse.data.choices[0].message.content;
    console.log('✅ 要約完了');

    // ネクストアクション抽出
    console.log('✨ ネクストアクション抽出中...');
    const nextActions = await extractNextActions(summary);
    console.log(`✅ ${nextActions.length}個のネクストアクション抽出完了`);

    // Supabase に保存
    const mtgDate = new Date().toISOString().slice(0, 10);
    let savedToDatabase = false;

    if (clientId) {
      try {
        console.log(`💾 Supabase に保存中... (顧問先: ${clientId})`);

        const { data, error } = await supabase
          .from('komon_clients')
          .select('client_data')
          .eq('id', clientId)
          .single();

        if (error) {
          console.error('❌ Supabase 取得エラー:', error.message);
        } else if (data) {
          const clientData = data.client_data || {};

          if (!clientData.mtgs) clientData.mtgs = [];
          clientData.mtgs.push({
            date: mtgDate,
            content: summary,
            actions: nextActions.map(a => ({ text: a.text, done: false }))
          });

          const { error: updateError } = await supabase
            .from('komon_clients')
            .update({
              client_data: clientData,
              updated_at: new Date().toISOString()
            })
            .eq('id', clientId);

          if (updateError) {
            console.error('❌ Supabase 更新エラー:', updateError.message);
          } else {
            console.log('✅ Supabase に保存完了');
            savedToDatabase = true;
          }
        }
      } catch (error) {
        console.error('❌ Supabase 保存処理エラー:', error.message);
      }
    }

    // クリーンアップ
    try {
      fs.unlinkSync(videoPath);
      fs.unlinkSync(audioPath);
    } catch (e) {
      // 削除失敗は無視
    }

    return res.json({
      success: true,
      transcript: transcript,
      summary: summary,
      nextActions: nextActions,
      date: mtgDate,
      clientId: clientId,
      savedToDatabase: savedToDatabase
    });

  } catch (error) {
    console.error('❌ エラー:', error.message);
    if (error.response) {
      console.error('API エラー:', error.response.data);
    }
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
