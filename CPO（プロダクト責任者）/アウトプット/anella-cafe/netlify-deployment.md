# Netlify へのデプロイ手順（超簡単）

## 30秒で完了

### Step 1: Netlify にアクセス
https://app.netlify.com

### Step 2: GitHub でログイン
「GitHub で承認する」をクリック

### Step 3: リポジトリを接続
1. 「New site from Git」をクリック
2. GitHub を選択
3. `kanetin219-suo/anella-cafe` を検索・選択

### Step 4: デプロイ設定（そのまま OK）
- Build command: （空白）
- Publish directory: `.`
- Functions directory: `netlify/functions`

### Step 5: 「Deploy」をクリック

---

## ✅ 完了

**API エンドポイント**: デプロイ後、自動で生成される  
例：`https://anella-cafe-abc123.netlify.app`

デプロイから 1 分で完全稼働します！

---

## テスト方法

デプロイ完了後、ツールを開く：
```
https://[your-netlify-domain]/weekly-report.html
```

API 設定 → Claude APIキー・LINE トークン入力 → ログイン → 完成！

---

Netlify は GitHub push と自動で連携するので、コード修正 → 自動デプロイされます。🚀
