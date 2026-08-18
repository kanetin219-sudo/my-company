# Supabase 緊急対応ガイド - データ削除問題

**対応日**: 2026-08-16
**プロジェクト**: abeekodehorlwsmnhoza (anella-cafe)
**担当**: CFO（財務責任者）

---

## 1. 問題の現状確認

### 削除されたテーブル
- `anella_income` - 0 rows（売上記録が全削除）
- `anella_expense` - 0 rows（支出記録が全削除）
- `anella_salary` - 0 rows（給与記録が全削除）
- `anella_fixed_cost` - 0 rows（固定費記録が全削除）

### 影響範囲
- 財務管理システム（company-finance）の計算基盤が失われた
- 月次決算データの整合性が失われた

---

## 2. 緊急復旧手順（ユーザー実行）

### ステップ1: Supabaseダッシュボードでバックアップから復旧

1. **Supabase Admin Dashboard にアクセス**
   - URL: https://supabase.com/dashboard
   - プロジェクト: abeekodehorlwsmnhoza

2. **Settings > Backups をクリック**

3. **PITR（Point-in-Time Recovery）を使用**
   - 削除前の日時を選択（過去7日以内）
   - リカバリーボタンをクリック

4. **リカバリー対象テーブルの確認**
   ```
   - public.anella_income
   - public.anella_expense
   - public.anella_salary
   - public.anella_fixed_cost
   ```

---

## 3. データ保護対策の実装

### ステップ2: RLS（Row Level Security）の強化

**A. DELETE 操作を管理者のみに制限**

Supabase SQL Editor で以下を実行：

```sql
-- anella_income テーブル
DROP POLICY IF EXISTS "Admin only can delete" ON anella_income;
CREATE POLICY "Admin only can delete"
  ON anella_income FOR DELETE
  USING (auth.email() = 'anellacafeoita@gmail.com'::text);

-- anella_expense テーブル
DROP POLICY IF EXISTS "Admin only can delete" ON anella_expense;
CREATE POLICY "Admin only can delete"
  ON anella_expense FOR DELETE
  USING (auth.email() = 'anellacafeoita@gmail.com'::text);

-- anella_salary テーブル
DROP POLICY IF EXISTS "Admin only can delete" ON anella_salary;
CREATE POLICY "Admin only can delete"
  ON anella_salary FOR DELETE
  USING (auth.email() = 'anellacafeoita@gmail.com'::text);

-- anella_fixed_cost テーブル
DROP POLICY IF EXISTS "Admin only can delete" ON anella_fixed_cost;
CREATE POLICY "Admin only can delete"
  ON anella_fixed_cost FOR DELETE
  USING (auth.email() = 'anellacafeoita@gmail.com'::text);
```

---

### ステップ3: 論理削除の実装

**B. 各テーブルに `deleted_at` カラムを追加**

```sql
-- anella_income に deleted_at を追加
ALTER TABLE anella_income 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- anella_expense に deleted_at を追加
ALTER TABLE anella_expense 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- anella_salary に deleted_at を追加
ALTER TABLE anella_salary 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;

-- anella_fixed_cost に deleted_at を追加
ALTER TABLE anella_fixed_cost 
ADD COLUMN deleted_at timestamp with time zone DEFAULT NULL;
```

**C. SELECT で削除されたデータをフィルタリング**

```sql
-- anella_income 用セキュアビュー
CREATE OR REPLACE VIEW anella_income_active AS
SELECT * FROM anella_income
WHERE deleted_at IS NULL;

-- 以下同様に他のテーブルも作成
```

**D. UPDATE ポリシーで論理削除を実装**

```sql
-- anella_income の UPDATE ポリシー例
CREATE POLICY "Users can update but not delete"
  ON anella_income FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- アプリから実行時：
-- UPDATE anella_income SET deleted_at = now() WHERE id = 'xxx'
```

---

### ステップ4: 監査ログの有効化

**E. 監査ログテーブルの確認**

```sql
-- 既存の監査ログテーブルを確認
SELECT * FROM security_audit_log ORDER BY changed_at DESC LIMIT 20;
```

**F. 自動監査ログの設定**

```sql
-- トリガーファンクションで自動監査ログを記録
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO security_audit_log (table_name, operation, row_data, changed_at)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE WHEN TG_OP = 'DELETE' THEN row_to_json(OLD) ELSE row_to_json(NEW) END,
    now()
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- 各テーブルにトリガーを関連付け
CREATE TRIGGER audit_anella_income
  AFTER INSERT OR UPDATE OR DELETE ON anella_income
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_anella_expense
  AFTER INSERT OR UPDATE OR DELETE ON anella_expense
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_anella_salary
  AFTER INSERT OR UPDATE OR DELETE ON anella_salary
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();

CREATE TRIGGER audit_anella_fixed_cost
  AFTER INSERT OR UPDATE OR DELETE ON anella_fixed_cost
  FOR EACH ROW EXECUTE FUNCTION audit_log_trigger();
```

---

### ステップ5: 自動バックアップ設定

**G. Supabase 設定で確認**

Settings > Backups タブ：
- ✅ **Daily Backups**: 有効化
- ✅ **Backup Retention**: 30日以上に設定
- ✅ **PITR**: 有効化

---

## 4. アプリ側の対応

### ステップ6: finance.html の修正

finance.html の DELETE 操作を UPDATE に変更：

```javascript
// 削除前（危険）
// await supabase.from('anella_income').delete().eq('id', recordId);

// 削除後（安全）
await supabase
  .from('anella_income')
  .update({ deleted_at: new Date().toISOString() })
  .eq('id', recordId);
```

### ステップ7: SELECT時の フィルタリング

```javascript
// 削除されたデータを除外して取得
const { data, error } = await supabase
  .from('anella_income')
  .select('*')
  .is('deleted_at', null)  // 削除されていないもののみ
  .order('income_date', { ascending: false });
```

---

## 5. 復旧データの確認チェックリスト

- [ ] PITR で復旧したデータを確認
- [ ] 復旧したレコード数が期待値と一致
- [ ] 復旧後のデータが finance.html に正常に表示される
- [ ] RLS ポリシーが正しく機能していることを確認
- [ ] 監査ログが記録されることを確認

---

## 6. 今後の運用ルール

| 項目 | ルール |
|------|-------|
| **DELETE禁止** | 本当の削除（DELETE文）は管理者のみ実行可能 |
| **論理削除** | アプリからは UPDATE で deleted_at を設定 |
| **バックアップ確認** | 毎月1日に PITR が機能することを確認 |
| **監査ログ確認** | 月1回、削除操作ログをレビュー |
| **データ復元テスト** | 四半期ごとにバックアップから復元テストを実施 |

---

## 7. 障害対応手順（今後削除が発生した場合）

1. **即座に PITR で復旧**（データ復旧)
2. **削除操作ログを確認**（security_audit_log テーブルから）
3. **RLS ポリシーを確認**（権限が正しいか）
4. **アプリの DELETE 操作を UPDATE に変更**（コード修正）
5. **影響範囲のユーザーに通知**（必要に応じて）

---

## 8. 連絡先・次のステップ

**CFO 確認項目**：
- [ ] バックアップから復旧完了
- [ ] RLS ポリシー設定完了
- [ ] 論理削除実装完了
- [ ] アプリコード修正完了
- [ ] 監査ログが記録されることを確認

**完了したら、以下ファイルを更新**：
- `/Users/nakurashun/Desktop/my-company/.claude/projects/.../memory/MEMORY.md`
- セクション「全体収支 月次決算システム」に対応状況を記載

---

**作成日**: 2026-08-16
**最終更新**: 2026-08-16
