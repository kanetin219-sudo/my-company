# Render.com へのデプロイ手順

## 前提条件
- GitHub アカウント
- Render.com アカウント（https://render.com で登録）

## デプロイ手順

### 1. GitHub に最新のコードをプッシュ
```bash
git push origin main
```

### 2. Render.com にログイン
https://dashboard.render.com にアクセス

### 3. 新しいサービスを作成
- 「New +」 → 「Web Service」をクリック
- 「Connect a repository」でこのリポジトリを選択
- リポジトリ: `kanetin219-sudo/my-company`

### 4. サービス設定
| 項目 | 値 |
|-----|-----|
| Name | `komon-mtg-api` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `node transcribe-server.js` |

### 5. 環境変数を設定
以下の環境変数を追加：

| Key | Value |
|-----|-------|
| `OPENAI_API_KEY` | `sk-proj-...` (OpenAI API キー) |
| `SUPABASE_URL` | `https://abeekodehorlwsmnhoza.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | `THAA...` (Supabase キー) |

### 6. デプロイ開始
「Create Web Service」をクリック

### 7. デプロイ完了待機
ダッシュボードで「Live」になるまで待つ（3-5分）

### 8. API URL を確認
デプロイ完了後、URL は以下の形式：
```
https://komon-mtg-api.onrender.com
```

### 9. 顧問管理アプリで API URL を設定
1. https://kanetin219-sudo.github.io/komon-app/ を開く
2. ヘッダーの「⚙ API設定」をクリック
3. API URL を入力：
   ```
   https://komon-mtg-api.onrender.com
   ```
4. 保存

### 10. テスト
1. 顧問先を選択
2. 動画ファイルをアップロード
3. 自動で文字起こし・要約・ネクストアクション抽出されることを確認

---

## トラブルシューティング

### デプロイが失敗する
- ログを確認：ダッシュボード → 「Logs」タブ
- 環境変数が正しく設定されているか確認
- 必要なパッケージがインストールされているか確認（package.json）

### API が動作しない
- API URL が正しいか確認
- ブラウザの開発者ツール（F12）でエラーを確認
- CORS エラーが出ていないか確認

### アップロード失敗
- ファイルサイズを確認（大きすぎないか）
- OpenAI API のクォータを確認
- Supabase の接続を確認

---

## 注意事項
- 無料プランでは「15分以上リクエストがないと自動停止」される
- 初回アップロード時は処理に時間がかかることがある
- OpenAI API のクォータに注意
