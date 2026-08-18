# 旅行アカウント Threads自動化ダッシュボード 設計書

## プロジェクト概要
@hina.mama.otoku のシステムを完全参考に、旅行特化アカウント用のThreads自動投稿ダッシュボードを構築。
- 毎日5〜8ツリー投稿の自動化
- 完全テンプレート化による運用効率化
- 高エンゲージメント確保（お得感＋付加価値）

---

## 1. データベース設計（Supabase）

### テーブル1: `travel_hotels`（ホテル情報マスタ）
```
- id (UUID, Primary Key)
- hotel_name (Text) — ホテル/宿の名前
- region (Text) — 地域（例：「宮城県」）
- catch_copy (Text) — キャッチコピー（例：「朝・夕ビュッフェ付き」）
- merit_text (Text) — メリット詳細（例：「オールインクルーシブでお酒やお菓子にスイーツまで食べ飲み放題」）
- family_size (Integer) — 家族人数（デフォルト4）
- original_price (Integer) — 元の価格
- discount_price (Integer) — 割引後の価格
- screenshot_url (Text) — 予約画面スクショのURL
- created_at (Timestamp)
- updated_at (Timestamp)
```

### テーブル2: `travel_coupons`（クーポンリンク）
```
- id (UUID, Primary Key)
- hotel_id (UUID, Foreign Key → travel_hotels.id)
- coupon_type (Text Enum: 'limited', 'daily', 'regular') — クーポンタイプ
  - 'limited': 「〇月限定クーポン」
  - 'daily': 「0と5のつく日限定クーポン」
  - 'regular': 「予約ページ」
- full_url (Text) — 楽天トラベルの元のURL
- short_url (Text) — 短縮URL（a.r10.to/ 形式）
- display_text (Text) — 表示テキスト（例：「大江戸温泉物語 限定クーポン」）
- created_at (Timestamp)
```

### テーブル3: `travel_queue`（投稿キュー）
```
- id (UUID, Primary Key)
- hotel_id (UUID, Foreign Key → travel_hotels.id)
- thread_text_1 (Text) — 1段目テキスト（自動生成）
- thread_text_2 (Text) — 2段目テキスト（自動生成）
- image_url (Text) — 予約画面スクショURL
- scheduled_time (Timestamp) — 投稿予定時刻
- status (Text Enum: 'pending', 'posted', 'failed') — ステータス
  - 'pending': 投稿待ち
  - 'posted': 投稿済み
  - 'failed': 投稿失敗
- posted_at (Timestamp) — 投稿完了日時
- thread_url (Text) — Threads投稿URL（投稿後に記録）
- created_at (Timestamp)
- updated_at (Timestamp)
```

### テーブル4: `travel_analytics`（エンゲージメント分析）
```
- id (UUID, Primary Key)
- thread_url (Text) — 投稿URL
- hotel_id (UUID, Foreign Key)
- likes_count (Integer)
- replies_count (Integer)
- reposts_count (Integer)
- total_engagement (Integer)
- engagement_rate (Float)
- fetched_at (Timestamp)
- created_at (Timestamp)
```

---

## 2. UI/UX設計

### ページ構成
1. **ダッシュボード** — 本日の投稿予定、過去投稿分析、スケジュール表示
2. **ホテル登録フォーム** — 新しいホテル情報の入力
3. **投稿キュー管理** — 投稿予定一覧、編集、削除、手動投稿
4. **分析ダッシュボード** — エンゲージメント分析、人気投稿ランキング
5. **スケジュール設定** — 投稿間隔設定（3時間おき、2〜4時間等）

### ホテル登録フォーム（ステップフロー）

**ステップ1: ホテル基本情報**
- ホテル名（TextInput）
- 地域（TextInput）
- 家族人数（NumberInput、デフォルト4）

**ステップ2: 価格情報**
- 元の価格（NumberInput）
- 割引後の価格（NumberInput）
- 自動計算：割引率（%）表示

**ステップ3: 画像アップロード**
- 予約画面のスクリーンショット（ImageUpload → Supabase Storage）

**ステップ4: クーポン情報**
- クーポン1タイプ（Select: 限定/日限定/予約）
- クーポン1フルURL（TextInput）
- クーポン1表示テキスト（TextInput）
- [+] ボタン で複数クーポン追加

**ステップ5: メリット情報**
- キャッチコピー（TextInput、例：「朝・夕ビュッフェ付き」）
- メリット詳細（TextArea、例：「オールインクルーシブでお酒やお菓子にスイーツまで食べ飲み放題」）
- [プレビュー] — 自動生成テキストの確認

**ステップ6: 投稿予定確認**
- 1段目テキスト（自動生成、編集可）
- 2段目テキスト（自動生成、編集可）
- 画像プレビュー
- [投稿キューに追加] ボタン

---

## 3. 自動テキスト生成ロジック

### 1段目テキスト生成アルゴリズム

**パターン：**
```
[感嘆詞] + [記号] + [地域]にある[ホテル名]が[キャッチコピー]付きで家族[人数]人でこの値段！？！？ + [クリフハンガー]
```

**感嘆詞（ランダム選択）：**
- えっぐい！！！！！
- ヤッバイ！！！！！
- 事件です！！！！
- ちょっとえぐいんだけど！！！
- やば〜い！！！！

**クリフハンガー（ランダム選択）：**
- このホテルもっとやばいのが、、、
- しかもここアレじゃん、、、
- ってかこれ本当に、、、？
- マジで信じられない、、、

**文字数制限：** 50〜80文字（Twitter/Threads基準）

### 2段目テキスト生成アルゴリズム

**パターン：**
```
[メリット詳細を1～2文で強調]
[クーポンリンク1（短縮URL）] pr
[クーポンリンク2（短縮URL）] pr
宿予約はここ↓
[宿の予約リンク（短縮URL）] pr
```

**文字数制限：** 80〜120文字

### 短縮URL自動生成
- 楽天APIまたは a.r10.to/ 形式への自動変換
- 末尾に「pr」を付与

---

## 4. スケジュール投稿機能

### 投稿スケジュールルール
- **1日の投稿本数：** 5〜8ツリー（設定可能）
- **投稿間隔：** 2〜4時間おき（ランダム、またはユーザー指定）
- **投稿時間帯：**
  - 早朝：07:00 ± 30分
  - 昼間：13:00, 15:00 ± 30分
  - 夜間：22:00 ± 30分
  - 深夜：03:00 ± 30分

### 投稿キュー管理画面
| ホテル名 | 地域 | 投稿予定時刻 | ステータス | アクション |
|---------|------|-----------|----------|---------|
| TAOYA秋保 | 宮城県 | 2026-07-01 07:15 | pending | 編集 / 削除 / 今すぐ投稿 |
| ハウステンボス | 長崎県 | 2026-07-01 13:30 | pending | 編集 / 削除 / 今すぐ投稿 |

---

## 5. 実装技術スタック

### フロントエンド
- **HTML5 + Vanilla JavaScript**
- **Supabase JS SDK** — DB操作、認証
- **Google Apps Script** — 自動投稿トリガー

### バックエンド
- **Supabase** — PostgreSQL + Real-time
- **Supabase Storage** — スクショ画像保存

### 外部連携
- **Threads API** または **Meta Sharing API** — 投稿
- **楽天API** — URL短縮（または a.r10.to/）

### デプロイ
- **GitHub Pages** — ダッシュボード公開
- **Google Apps Script** — 自動投稿スケジューラー

---

## 6. 実装フェーズ

### Phase 1: Supabaseスキーマ構築（1時間）
- テーブル作成（4テーブル）
- RLS設定
- 初期データ投入

### Phase 2: ダッシュボートHTML実装（2〜3時間）
- ホテル登録フォーム（ステップフロー）
- 投稿キュー管理画面
- 分析ダッシュボード

### Phase 3: 自動テキスト生成機能（1〜2時間）
- Claude APIまたはローカルテンプレート
- 感嘆詞・クリフハンガー のランダム選択
- 短縮URL自動変換

### Phase 4: GAS自動投稿スクリプト（2〜3時間）
- Threads API連携
- スケジュール投稿ロジック
- エラーハンドリング

### Phase 5: テスト＆調整（1〜2時間）
- 投稿内容の確認
- タイミング調整
- エンゲージメント監視

---

## 7. 今後の拡張案

- **AI投稿提案：** Claudeで複数パターン自動生成
- **A/Bテスト：** 異なるフック・メリット での比較
- **競合分析：** 他の旅行アカウント との比較
- **楽天API連携：** 新着ホテル/キャンペーン自動取得
- **SNS連携：** Instagram Reels / TikTok への自動投稿

---

## 8. URL・アカウント情報

**旅行アカウント：** @[旅行アカウント名]  
**楽天ルーム：** room.rakuten.co.jp/room_[ユーザー]/items  
**Supabaseプロジェクト：** [プロジェクトID]  
**デプロイURL（ダッシュボード）：** https://[username].github.io/[repo]/

---

**作成日：** 2026-07-01  
**ステータス：** 設計完了 → Phase 1実装開始予定
