require('dotenv').config();
const express = require('express');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const upload = multer({ dest: '/tmp/uploads' });

// CORS 設定
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY が設定されていません');
  process.exit(1);
}

// Supabase クライアント
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// ネクストアクション抽出関数（GPT で実装）
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

// CORS 設定
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());
app.use(express.static('/Users/nakurashun/Desktop/my-company'));

// 動画をアップロードして文字起こし
app.post('/api/transcribe', upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'ファイルがアップロードされていません' });
    }

    const videoPath = req.file.path;
    const audioPath = `/tmp/${Date.now()}.mp3`;

    console.log('🎬 動画から音声を抽出中...');
    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .output(audioPath)
        .audioCodec('libmp3lame')
        .audioFrequency(16000)
        .audioChannels(1)
        .on('end', () => {
          console.log('✅ 音声抽出完了');
          resolve();
        })
        .on('error', (err) => {
          console.error('❌ ffmpeg エラー:', err.message);
          reject(err);
        })
        .run();
    });

    // OpenAI Whisper API に送信
    console.log('🤖 OpenAI Whisper で文字起こし中...');
    const audioStream = fs.createReadStream(audioPath);
    const formData = new FormData();
    formData.append('file', audioStream);
    formData.append('model', 'whisper-1');
    formData.append('language', 'ja');

    const response = await axios.post(
      'https://api.openai.com/v1/audio/transcriptions',
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        }
      }
    );

    const transcript = response.data.text;
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

    // Claude でネクストアクション抽出
    console.log('✨ ネクストアクション抽出中...');
    const nextActions = await extractNextActions(summary);
    console.log(`✅ ${nextActions.length}個のネクストアクション抽出完了`);

    // clientId を取得
    const clientId = req.body.clientId || req.query.clientId;
    const mtgDate = new Date().toISOString().slice(0, 10);

    // Supabase に保存
    let savedToDatabase = false;
    if (clientId) {
      try {
        console.log(`💾 Supabase に保存中... (顧問先: ${clientId})`);

        // 既存のクライアント データを取得
        const { data, error } = await supabase
          .from('komon_clients')
          .select('client_data')
          .eq('id', clientId)
          .single();

        if (error) {
          console.error('❌ Supabase 取得エラー:', error.message);
        } else if (data) {
          const clientData = data.client_data || {};

          // MTG記録を追加
          if (!clientData.mtgs) clientData.mtgs = [];
          clientData.mtgs.push({
            date: mtgDate,
            content: summary,
            actions: nextActions.map(a => ({ text: a.text, done: false }))
          });

          // Supabase に更新
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
    fs.unlinkSync(videoPath);
    fs.unlinkSync(audioPath);

    res.json({
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
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ヘルスチェック
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 サーバー起動: http://localhost:${PORT}`);
  console.log(`📝 POST http://localhost:${PORT}/api/transcribe に動画をアップロードしてください`);
});
