# Google Apps Script デプロイ手順（DELETE禁止対応）

**作成日：** 2026-08-16  
**対象：** アネラカフェ トリミング予約システム GAS  
**作業内容：** Calendar 同期関数を UPSERT パターンに修正・デプロイ

---

## 📋 準備物

1. **修正済み GAS コード**
   - ファイル：`/Users/nakurashun/Desktop/my-company/CPO（プロダクト責任者）/アウトプット/アネラカフェ_トリミング予約_GAS_Code.gs`

2. **Supabase API キー**
   - プロジェクト：abeekodehorlwsmnhoza
   - キータイプ：anon (Anonymous) キー
   - 取得方法：https://supabase.com/dashboard/project/abeekodehorlwsmnhoza/settings/api

3. **Google アカウント**
   - anellacafeoita@gmail.com

---

## 🚀 デプロイ手順

### ステップ 1：Google Apps Script を開く

1. **Google ドライブ** にアクセス
   ```
   https://drive.google.com
   ```

2. **既存の GAS プロジェクト** を探す
   - キャンペーン：「アネラカフェ」「トリミング」で検索
   - または、スプレッドシートから「拡張機能 > Apps Script」で開く

3. **または新規作成** の場合
   - https://script.google.com
   - 新しいプロジェクト作成

### ステップ 2：コードを貼り付ける

1. Apps Script エディタで **すべてのコードを選択・削除**
   ```
   Ctrl+A → Delete
   ```

2. **修正済みコードをコピー**
   ```
   /Users/nakurashun/Desktop/my-company/CPO（プロダクト責任者）/アウトプット/アネラカフェ_トリミング予約_GAS_Code.gs
   ```
   全文をコピー

3. **GAS エディタに貼り付け**
   ```
   Ctrl+V
   ```

4. **保存**
   ```
   Ctrl+S
   ```

### ステップ 3：スクリプトプロパティを設定

1. **「プロジェクト設定」をクリック**
   - 左上の歯車アイコン

2. **「スクリプトプロパティを表示」をクリック**

3. **以下を追加**

| プロパティ名 | 値 | 説明 |
|--------|-----|------|
| `SPREADSHEET_ID` | スプシのID | 既に設定済みならそのまま |
| `LINE_TOKEN` | LINE チャンネルトークン | 既に設定済みならそのまま |
| `GOOGLE_REVIEW_URL` | Googleマップレビューリンク | 既に設定済みならそのまま |
| `SUPABASE_KEY` | Supabase API キー（anon） | **新規追加** |

**SUPABASE_KEY の取得方法：**
```
1. https://supabase.com/dashboard にログイン
2. プロジェクト「abeekodehorlwsmnhoza」を選択
3. Settings → API → Public ANON key をコピー
   （例：eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...）
```

### ステップ 4：デプロイ

1. **「デプロイ」をクリック**
   - 右上のボタン

2. **「新しいデプロイ」**
   - タイプ：Web アプリ
   - 新しいバージョン作成：チェック
   - 実行対象：anellacafeoita@gmail.com
   - アクセス権限：全員

3. **デプロイ ID をコピー** して保存
   ```
   デプロイ ID: AKfycbz70c8M8x7u69_r2y7Ibh1JkMZIsJEYYLdRcRuRAxnhX_ekQclzDQL6RBNHhnzxyvy7_A
   ↑ このような形式
   ```

### ステップ 5：トリガーを設定

1. **「トリガー」をクリック**
   - 左メニューの時計アイコン

2. **「トリガーを作成」**

3. 以下のように設定：
   - 関数名：`dailyCalendarSync`
   - イベントのタイプ：時間ベース
   - 時間の種類：毎日
   - 時刻：18:00 ～ 19:00（アネラの営業後）

4. **「保存」**

---

## ✅ テスト実行

### 手動テスト

1. **GAS エディタで実行**
   ```
   関数を選択：dailyCalendarSync
   実行ボタン（再生マーク）をクリック
   ```

2. **実行ログを確認**
   ```
   下部の「実行ログ」タブを見る
   ✅ Calendar Sync Complete: X events
   が表示されれば成功
   ```

3. **エラーが出た場合**
   ```
   ❌ SUPABASE_KEY not configured
   → スクリプトプロパティを確認
   
   ❌ Calendar not found
   → カレンダー ID を確認（a128bd52...）
   
   📡 HTTP 401 / 403
   → Supabase API キーを確認
   ```

### Supabase で確認

```sql
-- 同期されたデータを確認
SELECT COUNT(*) FROM trimming_reservations 
WHERE data_source = 'google_calendar';

-- GC- 接頭辞のデータを確認
SELECT reservation_number, owner_name, pet_name 
FROM trimming_reservations 
WHERE reservation_number LIKE 'GC-%' 
LIMIT 10;
```

---

## 🔄 定期実行確認

毎日 18:00 に自動実行されます。

### 実行履歴を確認

1. **GAS エディタ**
2. **「実行ログ」タブ**
3. 日時ごとの実行結果を確認

---

## 🚨 トラブルシューティング

| エラー | 原因 | 対応 |
|--------|------|------|
| `SUPABASE_KEY not configured` | API キーが設定されていない | スクリプトプロパティで追加 |
| `Calendar not found` | カレンダー ID が間違っている | ID を確認して修正 |
| `HTTP 401` | API キーが無効 | 新しいキーをコピー |
| `HTTP 409` | 重複キー（onConflict 失敗） | Supabase スキーマを確認 |
| タイムアウト | カレンダーイベント数が多い | イベント数を制限 |

---

## 📞 確認事項

- [ ] SUPABASE_KEY をスクリプトプロパティに追加した
- [ ] トリガー「dailyCalendarSync」を 18:00 に設定した
- [ ] 手動実行で「✅ Calendar Sync Complete」が表示された
- [ ] Supabase で `GC-` 接頭辞のデータが確認できた

---

**作成者：Claude AI**  
**最終更新：2026-08-16**
