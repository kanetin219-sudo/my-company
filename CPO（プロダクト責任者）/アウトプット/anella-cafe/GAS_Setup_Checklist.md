# Google Apps Script セットアップ・チェックリスト

**作成日：** 2026-08-16  
**対象：** anellacafeoita@gmail.com  
**所要時間：** 10分

---

## 📋 やること

### ① Supabase API キーを取得（1分）

1. ブラウザで開く
   ```
   https://supabase.com/dashboard/project/abeekodehorlwsmnhoza/settings/api
   ```

2. **「Project API keys」** セクションで
   - **「Anonymous (public)」** キーをコピー
   - 例：`eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

3. メモに貼り付けておく

### ② Google Apps Script にアクセス（2分）

1. ブラウザで開く
   ```
   https://script.google.com
   ```

2. 既存プロジェクトを探す
   - トリミング予約システムのプロジェクト
   - または新規作成

3. プロジェクト名：`アネラカフェ トリミング予約システム`

### ③ コードを貼り付け（3分）

1. **エディタのコード全部を削除**
   ```
   Ctrl+A → Delete
   ```

2. **新しいコードをコピー**
   - ファイル：`/Users/nakurashun/Desktop/my-company/CPO（プロダクト責任者）/アウトプット/anella-cafe/GAS_Code_Ready_To_Deploy.gs`
   - 全文コピー（Ctrl+A → Ctrl+C）

3. **GAS に貼り付け**
   ```
   Ctrl+V
   ```

4. **保存**
   ```
   Ctrl+S
   ```

### ④ スクリプトプロパティを設定（3分）

1. **左上の歯車アイコン** → 「プロジェクト設定」

2. **「スクリプトプロパティを表示」をクリック**

3. 以下を確認・追加：

| プロパティ名 | 値 |
|--------|-----|
| `SPREADSHEET_ID` | （既に設定済み、変更不要） |
| `LINE_TOKEN` | （既に設定済み、変更不要） |
| `GOOGLE_REVIEW_URL` | （既に設定済み、変更不要） |
| **`SUPABASE_KEY`** | ① で取得したキーを貼り付け |

4. **「保存」をクリック**

### ⑤ トリガー設定（2分）

1. **左メニューの「トリガー」アイコン**（時計マーク）

2. **「トリガーを作成」をクリック**

3. 以下のように設定：
   ```
   関数を選択：dailyCalendarSync
   イベントのタイプ：時間ベース
   時間の種類：毎日
   時刻：18:00 ～ 19:00
   ```

4. **「保存」をクリック**

---

## ✅ テスト実行（2分）

1. **GAS エディタに戻る**

2. **関数を選択** → `dailyCalendarSync`

3. **「実行」ボタン（再生マーク）をクリック**

4. **「実行ログ」タブを確認**

5. **期待される出力：**
   ```
   ✅ Calendar Sync Complete: X events
   ```

6. **エラーが出た場合：**
   ```
   ❌ SUPABASE_KEY not configured
   → スクリプトプロパティを確認

   📡 HTTP 401
   → Supabase API キーが正しいか確認
   ```

---

## 📝 確認チェック

実施後、以下をチェックしてください：

- [ ] Supabase API キーをコピーした
- [ ] GAS のコードを新しいコードに置き換えた
- [ ] SUPABASE_KEY をスクリプトプロパティに追加した
- [ ] トリガー「dailyCalendarSync」を 18:00 に設定した
- [ ] 手動実行で「✅ Calendar Sync Complete」が表示された

---

## 🚀 完了

これで毎日 18:00 に Googleカレンダーが自動同期されます。

エラーが出た場合は、下記を確認してください：

1. Supabase API キー → 正しいか？
2. Supabase プロジェクト ID → `abeekodehorlwsmnhoza` か？
3. Googleカレンダー ID → `a128bd52fb2a34107729297df1b940c6f213749ff3e786f5dd11f1f35a253ac2@group.calendar.google.com` か？

---

**作成者：Claude AI**  
**最終更新：2026-08-17**
