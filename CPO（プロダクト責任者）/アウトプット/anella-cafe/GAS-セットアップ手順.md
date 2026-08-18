# GAS セットアップ手順書 — ANELLA CAFE トリミング予約

## ファイル構成

| ファイル | 用途 | GASプロジェクト |
|---------|------|----------------|
| `gas-notification.gs` | 新規予約の Gmail通知（フロントから呼び出し） | プロジェクト①「anella-notification」 |
| `gas-reminders.gs` | LINEリマインド・口コミ依頼（定期実行） | プロジェクト②「anella-reminders」 |

---

## ① gas-notification.gs のデプロイ（Gmail通知）

### 手順

1. [https://script.google.com](https://script.google.com) を開く
2. 「新しいプロジェクト」→ 名前を `anella-notification` に変更
3. `gas-notification.gs` の内容をすべてコピーして貼り付け
4. 保存（Ctrl+S）
5. 「デプロイ」→「新しいデプロイ」
6. 設定：
   - 種類：**ウェブアプリ**
   - 説明：`anella-notification v1`
   - 実行ユーザー：**自分**
   - アクセスできるユーザー：**全員（匿名ユーザーを含む）**
7. 「デプロイ」→ 表示される **ウェブアプリのURL** をコピー

### URL を trimming-reserve.html に設定

`trimming-reserve.html` の以下の行を編集：

```javascript
const GAS_URL = 'https://script.google.com/macros/s/YOUR_GAS_ID/exec';
//                                                   ↑ここを実際のIDに変更
```

### 動作テスト

GASエディタで `testSendEmail` 関数を選択して実行 → `anellacafeoita@gmail.com` にメールが届けばOK

---

## ② gas-reminders.gs のセットアップ（LINEリマインド）

### 事前準備

#### Supabase service_role キーの取得
1. [https://app.supabase.com](https://app.supabase.com) → `anella-cafe` プロジェクト
2. Settings → API → `service_role` キーをコピー（絶対に公開しないこと）

#### LINE Notify トークンの取得（スタッフ通知用）
1. [https://notify-bot.line.me](https://notify-bot.line.me) にアクセス
2. 「マイページ」→「トークンを発行する」
3. トークン名：`ANELLA通知`
4. 通知先：スタッフの LINE グループ（または自分のトーク）
5. 発行されたトークンをコピー

#### LINE Messaging API トークンの取得（将来の個別送信用）
1. [LINE Developers](https://developers.line.biz) にアクセス
2. Provider → Channel → Messaging API
3. Basic settings → Channel access token (long-lived) をコピー

---

### GASプロジェクト作成

1. [https://script.google.com](https://script.google.com) で「新しいプロジェクト」
2. 名前を `anella-reminders` に変更
3. `gas-reminders.gs` の内容をコピーして貼り付け
4. 保存

### スクリプトプロパティを設定

1. GASエディタ左メニュー「プロジェクトの設定」
2. 「スクリプト プロパティ」→「プロパティを追加」
3. 以下を追加：

| プロパティ名 | 値 |
|-------------|-----|
| `SUPABASE_URL` | `https://abeekodehorlwsmnhoza.supabase.co` |
| `SUPABASE_SERVICE_KEY` | SupabaseのserviceRoleキー |
| `LINE_CHANNEL_TOKEN` | LINE Messaging APIトークン |
| `LINE_NOTIFY_TOKEN` | LINE Notifyトークン |

または `setupProperties` 関数に直接貼り付けて一度だけ実行してもOK（実行後はキーを削除すること）

### トリガーを設定

1. GASエディタ左メニュー「トリガー」→「トリガーを追加」
2. 以下の3つを追加：

| 関数名 | イベントのソース | 時間ベースのトリガーのタイプ | 時刻 |
|--------|----------------|--------------------------|------|
| `sendReminder1` | 時間主導型 | 日付ベースのタイマー | 午後12時〜1時 |
| `sendReminder2` | 時間主導型 | 日付ベースのタイマー | 午前8時〜9時 |
| `sendReviewRequest` | 時間主導型 | 日付ベースのタイマー | 午後8時〜9時 |

### 動作テスト

1. `testGetReservations` を実行 → Supabaseから予約が取得できるか確認
2. `testLineNotify` を実行 → LINEグループに通知が届くか確認
3. `testReminder1` を実行 → 翌日の予約があればリマインド送信

---

## LINE 個別メッセージ（将来対応）

現状では `line_user_id` をDBに保存する仕組みがありません。
個別送信を実現するには以下が必要です：

1. LINE Official Account に Webhook URL を設定
2. お客様が友だち追加・メッセージ送信時に `userId` を取得
3. Supabase の `trimming_reservations` に `line_user_id` カラムを追加
4. 予約フォームで電話番号・LINE名でマッチングして `line_user_id` を紐付け

当面は **LINE Notify（スタッフ通知）+ Gmail（お客様通知）** で運用を推奨します。

---

## トラブルシューティング

| 症状 | 確認事項 |
|------|---------|
| Gmail が届かない | GASの実行ログ確認、MailApp の権限確認 |
| Supabase から取得できない | `SUPABASE_SERVICE_KEY` が正しいか確認 |
| LINE Notify が届かない | トークンが正しいか、有効期限確認 |
| doGet が 403 | デプロイ時のアクセス設定が「全員」になっているか確認 |
| 重複送信される | reminder1_sent / reminder2_sent フラグが正しく更新されているか確認 |
