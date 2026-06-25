require('dotenv').config();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

const API_URL = 'http://localhost:3000';

async function testAPI() {
  console.log('🧪 API テスト開始...\n');

  // 1. Health check
  console.log('1️⃣  Health Check テスト...');
  try {
    const health = await axios.get(`${API_URL}/health`);
    console.log('✅ ヘルスチェック OK:', health.data);
  } catch (error) {
    console.error('❌ ヘルスチェック失敗:', error.message);
    process.exit(1);
  }

  // 2. ファイルアップロード テスト
  console.log('\n2️⃣  ファイルアップロード テスト...');
  try {
    const audioPath = '/tmp/test_audio.mp3';

    if (!fs.existsSync(audioPath)) {
      console.log('⚠️  テスト音声ファイルが見つかりません');
      return;
    }

    const form = new FormData();
    form.append('video', fs.createReadStream(audioPath));
    form.append('clientId', 'test-client-001');

    console.log('📤 ファイルをアップロード中...');
    const response = await axios.post(`${API_URL}/api/transcribe`, form, {
      headers: form.getHeaders(),
      timeout: 60000
    });

    console.log('✅ アップロード成功！');
    console.log('📝 文字起こし:', response.data.transcript.substring(0, 100) + '...');
    console.log('📋 要約:', response.data.summary.substring(0, 100) + '...');
    console.log('✅ ネクストアクション数:', response.data.nextActions?.length || 0);
    console.log('💾 DB保存:', response.data.savedToDatabase ? '成功' : '未設定');
  } catch (error) {
    console.error('❌ アップロード失敗:', error.response?.data || error.message);
  }

  console.log('\n✅ テスト完了！');
}

testAPI();
