# アネラカフェ Supabase版システム Claude Code 指示書

## 概要
同意書デジタル化・トリミング予約システムをSupabaseをバックエンドとして構築する。
GAS・スプレッドシートは使用しない。認証・データ管理・リアルタイム更新をSupabaseで一元管理。

---

## Supabaseプロジェクトのセットアップ手順

### ① プロジェクト作成
1. https://app.supabase.com にログイン
2. 「New Project」をクリック
3. 以下で設定：
   - Project name: `anella-cafe`
   - Database Password: 強力なパスワードを設定（メモしておく）
   - Region: `Northeast Asia (Tokyo)`
4. 「Create new project」をクリック（2〜3分待つ）

### ② 必要な情報を控える
プロジェクト作成後、Settings → API から以下をコピー：
- `Project URL`（例：https://xxxxxxxx.supabase.co）
- `anon public` キー
- `service_role` キー（秘密・絶対に公開しない）

---

## データベース設計

### テーブル①：`consent_forms`（同意書）

```sql
create table consent_forms (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  visit_date date not null,
  adults int not null default 0,
  children int not null default 0,
  preschool int not null default 0,
  visit_count text not null,
  favorite_pet text,
  signatures jsonb not null,
  submitted_at timestamp with time zone default now(),
  device_info text,
  ip_address text,
  pdf_url text
);
```

### テーブル②：`trimming_reservations`（トリミング予約）

```sql
create table trimming_reservations (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default now(),
  reservation_number text unique not null,
  visit_date date not null,
  visit_time time not null,
  staff text not null,
  course text not null,
  breed text not null,
  gender text not null,
  weight text not null,
  matting text not null,
  visit_experience text not null,
  pet_age text not null,
  pet_name text not null,
  vaccine_status text not null,
  staff_note text,
  owner_name text not null,
  phone text not null,
  line_name text,
  email text,
  options jsonb default '[]',
  course_price int not null default 0,
  options_price int not null default 0,
  total_price int not null default 0,
  status text not null default '予約済み',
  staff_memo text,
  reminder1_sent boolean default false,
  reminder2_sent boolean default false,
  review_sent boolean default false
);
```

### テーブル③：`blocked_times`（予約不可時間帯）

```sql
create table blocked_times (
  id uuid default gen_random_uuid() primary key,
  block_date date not null,
  block_time time not null,
  staff text not null,
  reason text
);
```

### Row Level Security（RLS）設定

```sql
-- consent_formsは誰でも挿入可能・読み取りは認証ユーザーのみ
alter table consent_forms enable row level security;
create policy "Anyone can insert" on consent_forms for insert with check (true);
create policy "Auth users can read" on consent_forms for select using (auth.role() = 'authenticated');

-- trimming_reservationsは誰でも挿入可能・読み取りは認証ユーザーのみ
alter table trimming_reservations enable row level security;
create policy "Anyone can insert" on trimming_reservations for insert with check (true);
create policy "Auth users can read" on trimming_reservations for select using (auth.role() = 'authenticated');
create policy "Auth users can update" on trimming_reservations for update using (auth.role() = 'authenticated');

-- blocked_timesは認証ユーザーのみ
alter table blocked_times enable row level security;
create policy "Auth users only" on blocked_times using (auth.role() = 'authenticated');
```

---

## 認証設定

### Supabase Authの設定
- Email/Password認証を使用
- 管理者アカウント：`anellacafeoita@gmail.com`
- Settings → Auth → Email confirmations を無効化（招待制のため）

### スタッフアカウントの作成
Supabase管理画面 → Authentication → Users → 「Invite user」から作成：
- `anellacafeoita@gmail.com`（管理者）
- 必要に応じてスタッフ分追加

---

## ファイル構成

```
anella-cafe/（GitHubリポジトリ）
├── anella-cafe-timer_13.html  （既存：入場管理）
├── consent.html               （新規：同意書・Supabase版）
├── trimming-reserve.html      （新規：予約フォーム・お客様用）
├── trimming-admin.html        （新規：管理画面・スタッフ用）
├── trimming-calendar.html     （新規：予約カレンダー・スタッフ用）
└── supabase-config.js         （Supabase接続設定・共通）
```

### `supabase-config.js` の内容
```javascript
const SUPABASE_URL = 'https://xxxxxxxx.supabase.co'; // 実際のURLに変更
const SUPABASE_ANON_KEY = 'xxxxxxxx'; // 実際のanon keyに変更
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

各HTMLファイルでSupabase CDNと設定ファイルを読み込む：
```html
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<script src="supabase-config.js"></script>
```

---

## デザイン共通仕様

```css
:root {
  --bg: #FDF6EE;
  --surface: #FFFAF4;
  --primary: #C96A3B;
  --primary-light: #E8946A;
  --accent: #4A7C6F;
  --accent-light: #6FA898;
  --text: #2C1F14;
  --text-mid: #6B4F3A;
  --text-soft: #A88870;
  --border: #E8D5C0;
  --shadow: rgba(150, 80, 30, 0.12);
  --warn: #D4502A;
  --warn-bg: #FFF3EE;
}
```
フォント: Noto Sans JP + DM Serif Display（Google Fonts）
対象端末: iPad（Safari）・PC

---

## ① 同意書システム（consent.html）

### 機能
- 来店日：自動で今日の日付を表示（変更不可）
- 来店人数（大人・小学生以上・未就学）：プルダウン選択（0〜10名）
- ご利用回数：プルダウン（初回/2回目/3回目/4回目以上）
- お気に入りの子：テキスト入力（任意）
- 署名：人数分の手書きキャンバス（タッチ対応・iPadで動作）
- 送信時にSupabaseへ保存
- 電子署名の法的有効性のための記録（日時・端末情報）

### 同意書の文言
```
店内での噛みつきや引っ掻きによる怪我や事故、または衣類の損傷等
（犬猫の粗相含む）が発生した場合は、一切の責任が負えないことを
あらかじめご了承ください。滞在中・帰宅後のアレルギーの発症等も
同様となります。靴や上着類、貴重品等はご自身で管理していただき、
盗難・紛失等は一切の責任を追いかねます。

▼ ご利用時の注意事項［お子様同伴時の注意点も含む］に同意します。
※入場者全員のご署名をお願いします
```

### 電子署名の法的有効性
送信時に以下を記録：
```javascript
const deviceInfo = {
  userAgent: navigator.userAgent,
  platform: navigator.platform,
  submittedAt: new Date().toISOString()
};
```

同意書に以下の文言を表示：
```
本同意書への電子署名は、自筆署名と同等の法的効力を持つものとします。
署名日時・端末情報は記録・保管されます。
```

### Supabaseへの保存処理
```javascript
const { data, error } = await supabase
  .from('consent_forms')
  .insert({
    visit_date: today,
    adults: adults,
    children: children,
    preschool: preschool,
    visit_count: visitCount,
    favorite_pet: favoritePet,
    signatures: signatures, // Base64配列
    device_info: JSON.stringify(deviceInfo),
    submitted_at: new Date().toISOString()
  });
```

### セキュリティ
- 送信失敗時はlocalStorageにバックアップ保存・復旧後に再送信
- 空白署名の送信防止
- RLSで認証ユーザーのみ閲覧可能

---

## ② トリミング予約システム

### 全体の流れ
```
① お客様がtrimming-reserve.htmlで予約
        ↓
② Supabaseのtrimming_reservationsに保存
        ↓
③ Supabase Edge FunctionがGmailに通知（即時）
        ↓
④ GASのトリガーが毎日12:00に前日予約にLINEリマインド送信
        ↓
⑤ GASのトリガーが毎日8:00に当日予約にLINEリマインド送信
        ↓
⑥ GASのトリガーが毎日20:00に来店済みに口コミ依頼送信
```

※ LINEリマインドはSupabaseからも送信可能だが、
　 LINE Messaging APIとの連携はGASのトリガーで実装する方がシンプル

### 予約フォーム（trimming-reserve.html）

**STEP形式（戻るボタンあり）**

**STEP 1：希望コース選択**
- シャンプーコース / カットコースを大きいボタンでタップ選択
- 選択したコースの基本内容を表示

**STEP 2：犬種・料金確認**
- 犬種・猫種プルダウン（全リスト）
- 選択と同時に料金を自動表示
- 「その他」選択時は自由入力欄を表示
- カットコース非対応の犬種はシャンプーコースのみ表示

**STEP 3：オプション選択**
- チェックボックスで複数選択可
- 合計金額をリアルタイム表示

**STEP 4：担当者・日時選択**
- 担当者：スタッフA / スタッフB / どちらでも可
- 日付：カレンダーUIで選択（今日から2ヶ月先まで）
- 時間：プルダウン（60分刻み・全日10:00〜15:00）
- Supabaseから予約済み・ブロック時間を取得してグレーアウト

**STEP 5：ペット・お客様情報入力**

| 項目 | 形式 | 必須 |
|------|------|------|
| ② 犬種・猫種 | テキスト | ✅ |
| ③ 性別 | プルダウン（男の子/女の子） | ✅ |
| ④ 体重 | プルダウン（〜3kg/3〜5kg/5〜10kg/10kg〜） | ✅ |
| ⑥ 毛玉の有無 | プルダウン（なし/少しあり/多めにあり） | ✅ |
| ⑦ 利用経験 | プルダウン（初めて/2回目/3回目/4回目以上） | ✅ |
| ⑧ 年齢 | プルダウン（1歳未満/1〜3歳/4〜7歳/8〜10歳/11歳以上） | ✅ |
| ⑨ ペット名 | テキスト | ✅ |
| ⑩ ワクチン接種 | プルダウン（接種済み証明書あり/接種済み証明書なし/未接種） | ✅ |
| ⑪ スタッフへの伝言 | テキスト | - |
| ⑨ 飼い主名 | テキスト | ✅ |
| ⑫ 電話番号 | テキスト | ✅ |
| LINE表示名 | テキスト | - |
| メールアドレス | テキスト | - |

ワクチン未接種・証明書なし選択時に警告表示：
```
⚠️ 接種証明が確認できない場合、ご予約をお断りしております。
必ず証明書をご持参ください。
```

**注意事項チェック欄（必須）**
```
🚗 クレートでのご来店をお願いしております
💉 1年以内の5種混合・狂犬病ワクチン接種証明書の持参が必要です
   ※証明書が確認できない場合はご利用をお断りしております
✂️ 毛玉の状態によって料金が変動する場合があります
⏰ 予約時間から30分以上遅れる場合・連絡が取れない場合は
   自動キャンセルとなります（必ずお電話ください：097-594-9770）
```

**プライバシーポリシー同意チェック（必須）**
```
【個人情報の取り扱いについて】
取得する情報：お名前・電話番号・メールアドレス・LINE表示名・ペット情報・予約内容
利用目的：予約確認・リマインド通知・口コミ依頼
保存場所：Supabase（セキュアなクラウドデータベース）
保管期間：最終来店日から3年間
第三者提供：法令に基づく場合を除き行いません
お問い合わせ：ANELLA CAFE 大分店 TEL：097-594-9770
```

**STEP 6：確認画面**
- 全項目・合計金額を表示
- 「予約を確定する」ボタン
- 送信中はローディング表示

**STEP 7：完了画面**
- 予約番号を表示
- 予約内容サマリー
- 「LINE公式アカウントを友だち追加する」ボタン（必ず表示）

### Supabaseへの保存処理
```javascript
// 予約番号生成
const today = new Date();
const dateStr = today.toISOString().slice(0,10).replace(/-/g,'');

// 当日の予約件数を取得して連番を付ける
const { count } = await supabase
  .from('trimming_reservations')
  .select('*', { count: 'exact' })
  .eq('visit_date', visitDate);

const reservationNumber = `${dateStr}-${String((count||0)+1).padStart(3,'0')}`;

// 予約データを保存
const { data, error } = await supabase
  .from('trimming_reservations')
  .insert({
    reservation_number: reservationNumber,
    visit_date: visitDate,
    visit_time: visitTime,
    staff: staff,
    course: course,
    breed: breed,
    gender: gender,
    weight: weight,
    matting: matting,
    visit_experience: visitExperience,
    pet_age: petAge,
    pet_name: petName,
    vaccine_status: vaccineStatus,
    staff_note: staffNote,
    owner_name: ownerName,
    phone: phone,
    line_name: lineName,
    email: email,
    options: options,
    course_price: coursePrice,
    options_price: optionsPrice,
    total_price: totalPrice
  });
```

---

## ③ 管理画面（trimming-admin.html）

### 認証
- Supabase Authのメール・パスワードでログイン
- ログアウトボタン常時表示

```javascript
// ログイン処理
const { data, error } = await supabase.auth.signInWithPassword({
  email: email,
  password: password
});

// 認証状態の確認
const { data: { session } } = await supabase.auth.getSession();
if (!session) {
  // ログイン画面にリダイレクト
}
```

### 機能
- 予約一覧（日付・担当者でフィルタリング）
- ステータス変更（予約済み → 来店済み / キャンセル）
- スタッフメモの追加・編集
- ブロック時間の設定（休憩・休日など）
- リアルタイム更新（Supabaseのリアルタイム機能を使用）

```javascript
// リアルタイム更新
supabase
  .channel('reservations')
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'trimming_reservations'
  }, (payload) => {
    // 画面を自動更新
    loadReservations();
  })
  .subscribe();
```

---

## ④ カレンダービュー（trimming-calendar.html）

### 認証
- trimming-admin.htmlと同じSupabase Auth

### 機能
- 月表示・週表示・日表示の切り替え
- スタッフA（オレンジ）・スタッフB（グリーン）で色分け
- ステータス別色分け：
  - 予約済み：`var(--primary)`
  - 来店済み：`var(--accent)`
  - キャンセル：グレー
- 予約ブロックをタップで詳細表示
- リアルタイム更新（Supabaseのリアルタイム機能）

---

## Gmail通知（GAS）

SupabaseへのInsert後にGASのWebhookを呼び出してGmailを送信する。

### GASコード（Gmail通知）
```javascript
function doGet(e) {
  var token = e.parameter.token;
  if (token !== 'anella2026secret') {
    return ContentService.createTextOutput('error');
  }

  var data = JSON.parse(decodeURIComponent(e.parameter.data));

  var subject = '【新規予約】' + data.owner_name + '様 / '
    + data.visit_date + ' ' + data.visit_time + ' / ' + data.course;

  var body = [
    '新規予約が入りました。',
    '',
    '━━━━━━━━━━━━━━━',
    '予約番号：' + data.reservation_number,
    '━━━━━━━━━━━━━━━',
    '来店日時：' + data.visit_date + ' ' + data.visit_time,
    '担当者：' + data.staff,
    'コース：' + data.course,
    '犬種：' + data.breed,
    'オプション：' + (data.options || 'なし'),
    '合計金額：¥' + data.total_price.toLocaleString(),
    '',
    '【ペット情報】',
    'お名前：' + data.pet_name,
    '年齢：' + data.pet_age,
    'ワクチン：' + data.vaccine_status,
    '',
    '【お客様情報】',
    'お名前：' + data.owner_name + ' 様',
    '電話番号：' + data.phone,
    'LINE表示名：' + (data.line_name || 'なし'),
    'メール：' + (data.email || 'なし'),
    '━━━━━━━━━━━━━━━',
    '管理画面：https://kanetin219-sudo.github.io/anella-cafe/trimming-admin.html'
  ].join('\n');

  MailApp.sendEmail('anellacafeoita@gmail.com', subject, body);
  return ContentService.createTextOutput('ok');
}
```

---

## LINEリマインド・口コミ依頼（GAS）

Supabaseから予約データを取得してLINE Messaging APIで送信。

### GASトリガー設定
| 関数名 | 実行時間 | 処理内容 |
|--------|---------|---------|
| sendReminder1 | 毎日12:00 | 翌日予約にLINEリマインド |
| sendReminder2 | 毎日8:00 | 当日予約にLINEリマインド |
| sendReviewRequest | 毎日20:00 | 当日来店済みに口コミ依頼 |

### GASからSupabaseへのアクセス
```javascript
var SUPABASE_URL = 'https://xxxxxxxx.supabase.co';
var SUPABASE_SERVICE_KEY = 'xxxxxxxx'; // service_roleキー（GASのスクリプトプロパティに保存）

function getReservations(targetDate, statusFilter) {
  var url = SUPABASE_URL + '/rest/v1/trimming_reservations'
    + '?visit_date=eq.' + targetDate
    + (statusFilter ? '&status=eq.' + statusFilter : '');

  var response = UrlFetchApp.fetch(url, {
    headers: {
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY
    }
  });
  return JSON.parse(response.getContentText());
}
```

---

## 料金表

### 基本コース
| 犬種・種別 | シャンプーコース | カットコース |
|-----------|---------------|------------|
| チワワ | ¥3,000 | ¥4,000 |
| ダックスフンド | ¥3,000 | ¥4,000 |
| パピヨン | ¥3,000 | ¥4,500 |
| ポメラニアン | ¥3,000 | ¥4,500 |
| マルチーズ | ¥3,500 | ¥5,000 |
| シーズー | ¥3,500 | ¥5,000 |
| トイ・プードル | ¥4,000 | ¥5,500 |
| ビションフリーゼ | ¥4,500 | ¥7,000 |
| フレンチ・ブルドッグ | ¥4,000 | ー |
| ビーグル | ¥4,500 | ー |
| コーギー・柴犬 | ¥5,000 | ー |
| シェルティ・ボーダーコリー | ¥5,000 | ー |
| ラブラドールレトリバー | ¥6,500 | ー |
| ゴールデン・レトリバー | ¥7,000 | ¥9,000 |
| 猫（短毛） | ¥7,000 | ー |
| 猫（長毛） | ¥10,000 | ¥13,000 |

### オプション
| メニュー | 料金 |
|---------|------|
| デンタルor肉球ケア | ¥500 |
| 薬用シャンプー | ¥500 |
| 足裏＋足回り | ¥500 |
| 爪切り | ¥500 |
| ひげカット | ¥500 |
| 肛門腺絞り | ¥500 |
| 部分カット | ¥700 |
| 毛玉カット | ¥700 |
| マイクロバブル | ¥1,000 |
| 顔カット | ¥1,500 |
| ハーブパック | ¥2,000 |
| 3点ケアセット | ¥1,200 |

---

## 店舗情報

- **店名**: ANELLA CAFE 大分店
- **電話**: 097-594-9770
- **住所**: 大分県大分市毛井553-1
- **営業時間**: 全日10:00〜18:00（トリミング最終受付15:00）
- **Instagram**: @ANELLA_CAFE_OITA
- **Googleアカウント**: anellacafeoita@gmail.com
- **GitHubリポジトリ**: https://github.com/kanetin219-sudo/anella-cafe

---

## 実装の優先順位

```
① Supabaseプロジェクト作成・テーブル設計
② supabase-config.jsの作成
③ consent.html（同意書）
④ trimming-reserve.html（予約フォーム）
⑤ trimming-admin.html（管理画面・認証あり）
⑥ trimming-calendar.html（カレンダービュー）
⑦ GAS（Gmail通知・LINEリマインド）
```
