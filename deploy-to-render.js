#!/usr/bin/env node

const https = require('https');

// 環境変数から取得
const RENDER_API_KEY = process.env.RENDER_API_KEY || 'YOUR_RENDER_API_KEY';
const GITHUB_REPO = 'https://github.com/kanetin219-sudo/my-company';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'YOUR_OPENAI_API_KEY';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'YOUR_SUPABASE_KEY';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://abeekodehorlwsmnhoza.supabase.co';

// 先に owner ID を取得
function getOwnerId() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.render.com',
      path: '/v1/owners',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + RENDER_API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.owners && result.owners.length > 0) {
            resolve(result.owners[0].id);
          } else {
            reject(new Error('No owners found'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

// Render.com API にサービスを作成
function createService(ownerId) {
  return new Promise((resolve, reject) => {
    const payload = {
      name: 'my-company-api',
      type: 'web_service',
      ownerId: ownerId,
      repoUrl: GITHUB_REPO,
      branch: 'main',
      buildCommand: 'npm install',
      startCommand: 'node transcribe-server.js',
      healthCheckPath: '/health',
      envVars: [
        {
          key: 'OPENAI_API_KEY',
          value: OPENAI_API_KEY,
          isFile: false
        },
        {
          key: 'SUPABASE_URL',
          value: SUPABASE_URL,
          isFile: false
        },
        {
          key: 'SUPABASE_SERVICE_ROLE_KEY',
          value: SUPABASE_SERVICE_ROLE_KEY,
          isFile: false
        }
      ],
      plan: 'free'
    };

    const options = {
      hostname: 'api.render.com',
      path: '/v1/services',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RENDER_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(payload))
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (res.statusCode === 201 || res.statusCode === 200) {
            console.log('✅ Render.com にサービスを作成しました！');
            console.log('🔗 URL: ' + (result.serviceDetails?.url || 'デプロイ中...'));
            console.log('📊 ID: ' + result.id);
            resolve(result);
          } else {
            console.error(`❌ エラー (${res.statusCode}):`, result);
            reject(new Error(`API Error: ${res.statusCode}`));
          }
        } catch (e) {
          console.error('❌ レスポンス解析エラー:', data);
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(JSON.stringify(payload));
    req.end();
  });
}

// 実行
console.log('🚀 Render.com へのデプロイを開始します...');
getOwnerId()
  .then((ownerId) => {
    console.log('📌 Owner ID: ' + ownerId);
    return createService(ownerId);
  })
  .then(() => {
    console.log('\n✨ デプロイ完了！');
    console.log('📱 顧問管理アプリで API URL を設定してください：');
    console.log('   1. https://kanetin219-sudo.github.io/komon-app/ を開く');
    console.log('   2. 「⚙ API設定」をクリック');
    console.log('   3. Render の URL を入力');
  })
  .catch((err) => {
    console.error('\n❌ デプロイに失敗しました:', err.message);
    process.exit(1);
  });
