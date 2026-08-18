# 楽天トラベル Threads 自動投稿 - URL短縮化実装 指示書

## 🎯 目標

Rakuten Affiliate の URL短縮ツール（a.r10.to/ 形式）を使用して、長いアフィリエイトリンクを短縮URL に変換する機能を実装する。

**現在の問題**: 投稿時に長URL（hb.afl.rakuten.co.jp?...）がそのまま使用されているため、短くて見栄えの良い a.r10.to/ 形式に変換する必要がある。

---

## 📍 関連ファイル

**メインファイル:**
- `/Users/nakurashun/Desktop/my-company/CPO（プロダクト責任者）/アウトプット/rakuten-travel-threads/src/urlShortener.js`

**設定ファイル:**
- `.env` に以下の情報が保存済み：
  - `RAKUTEN_AFFILIATE_ID=56509bd0.96fbfa96.56509bd1.966450a0`
  - `RAKUTEN_APPLICATION_ID`, `RAKUTEN_ACCESS_KEY`

**リファレンス実装:**
- `/Users/nakurashun/Desktop/my-company/CPO（プロダクト責任者）/アウトプット/anella-cafe/threads-autopost.gs`
  - 行660: `if (replyToId) payload.reply_to_id = replyToId;`
  - このプロジェクトでは GAS（Google Apps Script）で Threads API を使用

---

## 🔧 これまでの試行と失敗理由

### 試行1: Playwright で Rakuten Affiliate を自動操作
```javascript
// https://affiliate.rakuten.co.jp/ にアクセス
// URL入力フィールドを探して入力
// 「リンクを作成」ボタンをクリック
// 短縮URL を抽出
```
**失敗理由:**
- セレクター `input[type="text"][placeholder*="URL"]` が見つからない（ページ構造不明）
- ページ読み込み完了後に必要な要素が存在しない
- ユーザーエージェント/ヘッダー認証の問題の可能性

**エラーログ:**
```
page.fill: Timeout 10000ms exceeded.
waiting for locator('input[type="text"][placeholder*="URL"], input[type="url"], input[name*="url"]')
```

### 試行2: TinyURL API
```javascript
// https://tinyurl.com/api-create.php?url=<long-url>
```
**失敗理由:** API 形式が合わない（400 Bad Request）

### 試行3: Rakuten Link Share API 直接呼び出し
```javascript
// https://api.linkshare.rakuten.co.jp/api/createurl
```
**失敗理由:** ドメインが存在しない（ENOTFOUND）

---

## 💡 推奨される解決策

### オプション A: Rakuten 公式短縮ツール（affiliate.rakuten.co.jp）を確実に操作する

**必要な作業:**
1. **ページ構造の確認**
   - Rakuten Affiliate のページを手動でブラウザで開く
   - DevTools で実際の入力フィールドと「リンクを作成」ボタンの要素を特定
   - HTML/CSS セレクターを正確に取得

2. **Playwright コードの改善**
   - 正確なセレクターに更新
   - ページ読み込み完了を確実に待機（`waitForNavigation`, `waitForSelector` など）
   - ボタンクリック後の結果表示まで待機
   - デバッグのため `page.screenshot()` でスクリーンショット取得

### オプション B: Rakuten API ドキュメントを確認

公式の短縮 API が存在する可能性：
- 楽天アフィリエイト API ドキュメント（要: 楽天開発者登録）
- LinkShare のプログラマティック API
- 正しいエンドポイントと認証方法を確認

### オプション C: リダイレクトサービスの活用

短縮効果は劣るが、確実に動作する方法：
- bit.ly API（ただしアフィリエイト効果の確認が必要）
- Google URL Shortener（廃止）
- その他の短縮サービス

---

## 📋 実装要件

**現在の実装位置:** `src/urlShortener.js` の `shortenUrl()` 関数

**入力:** 長いアフィリエイトリンク（例）
```
https://hb.afl.rakuten.co.jp/hgc/56509bd0.96fbfa96.56509bd1.966450a0/?pc=https%3A%2F%2Fimg.travel.rakuten.co.jp%2Fimage%2Ftr%2Fapi%2Fhs%2FcHNRi%2F%3Ff_no%3D179618%26f_flg%3DPLAN
```

**期待される出力:** 短縮 URL（a.r10.to/ 形式）
```
https://a.r10.to/xxxxx
```

**キャッシング:** 同じ URL は `.url-cache.json` にキャッシュして再利用（API呼び出し削減）

**エラーハンドリ:** 短縮失敗時は長 URL をそのまま返す（投稿は続行、ただし見栄えは悪い）

---

## 🚀 テスト方法

修正後、以下でドライラン確認：
```bash
cd /Users/nakurashun/Desktop/my-company/CPO（プロダクト責任者）/アウトプット/rakuten-travel-threads
npm run dry-run
```

**確認ポイント:**
- ログに「Shortened URL generated: https://a.r10.to/」と表示される
- 下書きの投稿内容に短縮 URL が含まれている（`hb.afl.` ではなく `a.r10.to/`）

---

## 📝 その他の参考情報

**現在のシステム構成:**
- Rakuten Travel API で ホテル取得
- 取得した URL を短縮化
- 投稿内容を生成（ファミリーママターゲット）
- Threads Graph API で tree 投稿（reply_to_id 使用）
- 30日重複チェック付き
- 毎日19:00 JST に GitHub Actions で自動実行予定

**その他の既知の問題:**
- Playwright ブラウザ操作のため、GitHub Actions での実行時に追加の依存関係が必要（既に package.json に playwright 記載済み）

---

## 📞 完了後の報告

修正完了後、以下を報告してください：

1. **実装方法:** どの解決策を選択したか
2. **テスト結果:** ドライラン時の短縮 URL 生成成功例
3. **キャッシュ状況:** `.url-cache.json` の内容確認
4. **GitHub Actions との互換性:** Node.js 環境での実行確認

完成後は、投稿システムの本稼働（毎日自動投稿）が開始されます。
