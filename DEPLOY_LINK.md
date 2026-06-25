# 🚀 Render.com へのワンクリックデプロイ

以下のリンクをクリックして、Render.com にデプロイします。

## デプロイリンク
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kanetin219-sudo/my-company)

または、このリンクをコピーしてブラウザで開く：
```
https://render.com/deploy?repo=https://github.com/kanetin219-sudo/my-company
```

## デプロイ後の手順

### 1. 環境変数を入力

デプロイ画面で、以下の環境変数を入力してください：

| 変数名 | 値 |
|-------|-----|
| `OPENAI_API_KEY` | （ユーザーの OpenAI API キー） |
| `SUPABASE_SERVICE_ROLE_KEY` | （ユーザーの Supabase キー） |

### 2. デプロイ完了待機

「Deploy」をクリック → ダッシュボードで「Live」になるまで待つ（3-5分）

### 3. API URL を確認

デプロイ完了後、Render のダッシュボードに以下の形式で URL が表示されます：
```
https://my-company.onrender.com
```

### 4. 顧問管理アプリで API URL を設定

1. https://kanetin219-sudo.github.io/komon-app/ を開く
2. ヘッダーの「⚙ API設定」をクリック
3. API URL を入力：
   ```
   https://my-company.onrender.com
   ```
4. 「✅ 保存」をクリック

### 5. テスト

1. 顧問先を選択
2. 動画ファイルをアップロード
3. 自動で文字起こし・要約・ネクストアクション抽出されることを確認

---

## ✅ 完了！

リンク版（GitHub Pages）でも、ローカル版でも、どこからでも動画アップロード → 自動処理が使えるようになったっちゃ！

---

## トラブルシューティング

### デプロイが失敗する場合
- 環境変数が正しく設定されているか確認
- Render のダッシュボードでログを確認

### API が動作しない場合
- ブラウザのコンソール（F12）でエラーを確認
- API URL が正しいか確認

### アップロード失敗
- OpenAI API のクォータを確認（クレジット追加が必要かもしれません）
