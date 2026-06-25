# 📋 顧問管理アプリ MTG自動記録機能

動画/音声ファイルをアップロード → 自動で文字起こし → 要約 → ネクストアクション抽出 → Supabase に自動保存

## 🚀 クイックスタート

### クラウド版（推奨）
[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/kanetin219-sudo/my-company)

**手順：**
1. 上のボタンをクリック
2. Render.com ログイン（GitHub アカウント使用）
3. 環境変数を入力：
   - `OPENAI_API_KEY`: OpenAI の API キー
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase のサービスロールキー
4. 「Create Web Service」をクリック
5. デプロイ完了後、API URL を顧問管理アプリで設定

### ローカル版
```bash
cd /Users/nakurashun/Desktop/my-company
node transcribe-server.js
```

ブラウザで https://kanetin219-sudo.github.io/komon-app/ を開く
→ 「⚙ API設定」で `http://localhost:3000` と入力

## 📖 詳細ドキュメント

- [RENDER_SETUP_FINAL.md](RENDER_SETUP_FINAL.md) — Render.com セットアップ手順
- [DEPLOY_LINK.md](DEPLOY_LINK.md) — デプロイリンクと使い方

## 🛠️ 技術スタック

- **フロント:** 顧問管理アプリ.html（GitHub Pages）
- **バックエンド:** Node.js + Express
- **音声処理:** FFmpeg + OpenAI Whisper
- **AI:** GPT-4o-mini（要約・ネクストアクション抽出）
- **DB:** Supabase
- **デプロイ:** Render.com / ローカル

## 📱 使い方

1. 顧問先を選択
2. 動画/音声ファイルをアップロード
3. 自動で処理開始
4. 完了後、MTGリストに自動保存

## 🔧 カスタマイズ

API URL は localStorage で管理されています。
「⚙ API設定」ボタンでいつでも変更可能です。

---

**GitHub:** https://github.com/kanetin219-sudo/my-company  
**顧問管理アプリ:** https://kanetin219-sudo.github.io/komon-app/
