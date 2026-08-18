# Vercel へのデプロイ手順

## 概要
Vercel API が GitHub に push されました。Vercel と GitHub を連携させて、自動デプロイするだけです。

---

## ⚡ 5分で完了

### Step 1: Vercel にログイン

1. https://vercel.com にアクセス
2. GitHub アカウントでログイン（または新規作成）

### Step 2: リポジトリをインポート

1. Vercel ダッシュボードで「New Project」をクリック
2. 「Import Git Repository」を選択
3. GitHub のリポジトリ `kanetin219-sudo/anella-cafe` を検索・選択

### Step 3: デプロイ設定

1. 以下を確認：
   - **Project Name**: `anella-cafe` （自動入力）
   - **Root Directory**: `./` （デフォルト OK）
   - **Framework Preset**: Other （Node.js）
   - **Build Command**: （空白 OK）
   - **Output Directory**: （空白 OK）

2. 「Deploy」をクリック

### Step 4: デプロイ完了

1. 数分待つ
2. `https://anella-cafe.vercel.app` が自動生成される
3. その URL が Claude API プロキシエンドポイント

---

## ✅ デプロイ後の確認

### API が動作しているか確認

ブラウザコンソール（F12）で以下を実行：

```javascript
fetch('https://anella-cafe.vercel.app/api/claude-proxy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    images: ['iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='],
    prompt: 'テスト',
    apiKey: 'sk-YOUR_API_KEY_HERE'
  })
}).then(r => r.json()).then(d => console.log(d))
```

**期待結果**: JSON レスポンス（または API キーエラー）が返される

---

## 🔄 今後の更新

GitHub に push すると、Vercel が自動デプロイするようになります。

```bash
git push origin main
# → Vercel が自動検出・デプロイ
# → 数分で https://anella-cafe.vercel.app が更新される
```

---

## 🚨 トラブルシューティング

### ❌ "Deployment failed" が出た場合

1. Vercel の Deployments タブで詳細を確認
2. エラーログを読む
3. 通常は `package.json` または `vercel.json` の問題

### ❌ API が 404 を返す場合

1. URL が `https://anella-cafe.vercel.app/api/claude-proxy` か確認
2. Vercel ダッシュボードで「Deployments」が「Ready」状態か確認

### ❌ CORS エラーが出る場合

1. API はすでに CORS ヘッダーを返しているはず
2. ブラウザキャッシュをクリア（Cmd+Shift+Delete）
3. それでも出たら、ブラウザコンソールのエラーメッセージをチェック

---

## 📝 その他

- **カスタムドメイン**: Vercel ダッシュボイン > Settings > Domains で設定可能
- **環境変数**: 必要に応じて Settings > Environment Variables で追加可能（現在は不要）

---

**最終更新**: 2026年6月25日
