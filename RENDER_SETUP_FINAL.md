# 🚀 Render.com セットアップ（最後の3ステップ）

GitHub Actions で自動デプロイが完成するまで、あと3ステップやが。

## ステップ1：Render.com で GitHub を連携（3分）

1. https://dashboard.render.com にアクセス
2. 「New +」 → 「Web Service」をクリック
3. 「Connect a repository」をクリック
4. GitHub リポジトリ `my-company` を選択
5. 以下の設定を入力：

| 項目 | 値 |
|-----|-----|
| Name | `my-company` |
| Runtime | `Node` |
| Build Command | `npm install` |
| Start Command | `node transcribe-server.js` |

6. 環境変数を設定：

| Key | Value |
|-----|-------|
| `OPENAI_API_KEY` | （ユーザーの API キー） |
| `SUPABASE_URL` | `https://abeekodehorlwsmnhoza.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | （ユーザーの キー） |

7. 「Create Web Service」をクリック
8. デプロイ完了待機（3-5分）

## ステップ2：Deploy Hook URL を取得（1分）

1. Render のダッシュボードで `my-company` サービスを選択
2. 「Settings」タブをクリック
3. 左メニューから「Deploy Hook」をクリック
4. URLをコピー（例：`https://api.render.com/deploy/srv-xxx?key=yyy`）

## ステップ3：GitHub Secrets に設定（2分）

1. GitHub → `my-company` リポジトリ
2. 「Settings」タブをクリック
3. 左メニュー「Secrets and variables」→「Actions」
4. 「New repository secret」をクリック
5. 以下を入力：
   - Name: `RENDER_DEPLOY_HOOK_URL`
   - Value: （ステップ2 でコピーした URL）
6. 「Add secret」をクリック

## 完了！🎉

これで全て自動化されたっちゃ！

**以降、GitHub に push する度に：**
```
GitHub push → GitHub Actions 実行 → Render.com 自動デプロイ
```

---

## テスト

1. ローカルでコードを修正
2. GitHub に push
3. GitHub の「Actions」タブで デプロイの進行を確認
4. Render のダッシュボードで「Live」になることを確認
5. https://kanetin219-sudo.github.io/komon-app/ で動作確認

---

## トラブルシューティング

### Deploy が失敗する場合
- GitHub Actions のログを確認（「Actions」タブ）
- Render.com のログを確認（サービスのダッシュボード）

### API が動作しない場合
- Render.com のサービスが「Live」になっているか確認
- 環境変数が正しく設定されているか確認

---

**これで完全自動化が完成やが！**

あとはローカルで開発 → push するだけで、自動的に本番環境に反映されるっちゃ！
