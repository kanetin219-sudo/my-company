# Google Calendar 同期修正ガイド（DELETE禁止ルール対応）

**作成日：** 2026-08-16  
**対象：** アネラカフェ トリミング予約システム  
**課題：** Googleカレンダー同期で「全削除→再投入」パターンが使われており、8/15データ消失の原因となった

---

## 🚨 問題の原因

### 8/15 事故の記録

```
18:02:35〜41  既存データを全削除（6秒間で30件以上）
18:03:35      Googleカレンダーから112件を投入（削除の1分後）

同期処理が「全削除 → 再投入」方式だったため、
Webフォーム由来の予約36件が巻き込まれて消えた。
```

### ❌ 禁止パターン

```javascript
// 【現在のコード】全削除→再投入（絶対にやらない）
await supabase.from('trimming_reservations').delete().neq('id', 0);  // 全削除
await supabase.from('trimming_reservations').insert(calendarData);   // 再投入
```

**理由：** Googleカレンダーから同期されたデータだけでなく、
Webフォーム入力のデータもすべて消えてしまう。

---

## ✅ 正しい実装：UPSERT パターン

### 実装コード

```javascript
// 【正しい】UPSERT で既存データを上書き
await supabase
  .from('trimming_reservations')
  .upsert(calendarData, { 
    onConflict: 'reservation_number'  // 予約番号で既存データを更新
  });
```

### ポイント

1. **削除ではなく更新**：`DELETE` の代わりに `upsert` を使う
2. **キー指定**：`reservation_number`（予約番号）を主キーとして使用
3. **出所区別**：Googleカレンダー由来は接頭辞「GC-」を使用

---

## 📊 データの出所を区別するルール

| 接頭辞 | 出所 | 例 |
|--------|------|------|
| なし | Googleカレンダー（従来） | `20260826-001` |
| `R-` | Gmail記録からの復旧分 | `R-20260826-001` |
| `GC-` | Googleカレンダー（新方式） | `GC-20260826-001` |

**今後の実装：** すべてのカレンダー同期データに `GC-` を付けて、
Webフォーム由来のデータと区別する。

---

## 🔧 修正実装テンプレート

### Google Calendar → Supabase 同期（GAS または Edge Function）

```javascript
async function syncCalendarToSupabase() {
  try {
    // 1. Googleカレンダーのイベントを取得
    const calendarId = 'a128bd52fb2a34107729297df1b940c6f213749ff3e786f5dd11f1f35a253ac2@group.calendar.google.com';
    const calendar = CalendarApp.getCalendarById(calendarId);
    const events = calendar.getEvents(new Date('2026-08-01'), new Date('2026-12-31'));

    // 2. イベントをトリミング予約フォーマットに変換
    const calendarData = events.map(event => {
      const title = event.getTitle();
      const dateTime = event.getStartTime();
      
      return {
        reservation_number: `GC-${Utilities.formatDate(dateTime, 'Asia/Tokyo', 'yyyyMMdd')}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        visit_date: Utilities.formatDate(dateTime, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
        owner_name: title.split(' - ')[0] || '',
        pet_name: title.split(' - ')[1] || '',
        // その他のカラムは DEFAULT 値または event.getDescription() から抽出
        status: 'カレンダー同期済み',
        data_source: 'google_calendar',
        synced_at: new Date().toISOString()
      };
    });

    // 3. ✅ UPSERT で同期（削除ではなく更新）
    const { error } = await supabase
      .from('trimming_reservations')
      .upsert(calendarData, { 
        onConflict: 'reservation_number'
      });

    if (error) {
      throw error;
    }

    console.log(`✅ 同期完了：${calendarData.length}件`);
    return { success: true, synced: calendarData.length };

  } catch (err) {
    console.error('❌ 同期エラー:', err);
    throw err;
  }
}
```

---

## 📋 実装チェックリスト

デプロイ前に確認してください：

- [ ] `.delete()` を使っていないか（`upsert` を使う）
- [ ] `onConflict: 'reservation_number'` を指定しているか
- [ ] `GC-` 接頭辞でカレンダー由来データを区別しているか
- [ ] Webフォーム由来データに触れていないか（SELECT で出所を区別）
- [ ] エラーハンドリングで失敗時のログを記録しているか

---

## 🚀 実装場所

### Option 1: GAS スクリプト内
- ファイル：`/Users/nakurashun/Desktop/my-company/CPO（プロダクト責任者）/アウトプット/アネラカフェ_トリミング予約_GAS_Code.gs`
- 関数：`syncCalendarToSupabase()` を追加
- トリガー：毎日 18:00 に実行（Googleカレンダー同期）

### Option 2: Edge Function（Supabase）
- ファイル：新規作成 `supabase/functions/sync-calendar/index.ts`
- HTTP トリガー：POST `/sync-calendar`
- トークン認証：必須

### Option 3: HTML ボタン（管理画面）
- ファイル：`/Users/nakurashun/Desktop/my-company/docs/anella-cafe/trimming-admin.html`
- ボタン：「Googleカレンダー同期」（管理者用）

---

## 🧪 テスト手順

1. **テストデータ作成**
   - Googleカレンダーに新しいイベント追加（テスト用）
   - 例：`テスト太郎 - テスト犬 2026-09-01 10:00`

2. **同期実行**
   - `syncCalendarToSupabase()` を手動実行

3. **データ確認**
   ```sql
   SELECT COUNT(*) FROM trimming_reservations 
   WHERE data_source = 'google_calendar';
   ```

4. **重複確認**
   ```sql
   SELECT reservation_number, COUNT(*) 
   FROM trimming_reservations 
   WHERE reservation_number LIKE 'GC-%'
   GROUP BY reservation_number HAVING COUNT(*) > 1;
   ```

5. **ロールバック**
   - テストデータの `deleted_at` を設定して論理削除

---

## 📞 不明な点

- Googleカレンダーのイベントフォーマットが不明→イベント内容を確認
- Supabase API キー不明→[管理パネル](https://supabase.com/dashboard)で確認
- GAS スクリプト ID 不明→[Google Apps Script](https://script.google.com)で確認

---

**作成者：Claude AI**  
**参照：** `/Users/nakurashun/Desktop/my-company/DATA_PROTECTION_RULES.md`

