# 旅行 Threads 自動投稿ダッシュボード - 引き継ぎ資料

## 【問題】初期表示時に「未認証」「登録ホテル数 0」が数秒間表示されてから「認証済み」「100」に切り替わる

### 【現象詳細】
ページを再読み込みすると、直後の数秒間だけ：
- ヘッダーバッジが「未認証」（オレンジ）
- 統計情報の「登録ホテル数」が 0
- ホテル選択セレクトボックスがグレーアウト

その後、データ取得完了で自動的に「認証済み」「100」に切り替わる

### 【原因推測】
Supabase からのデータ取得（`loadDashboard()` の実行）が非同期で、
その処理が完了する前に初期値（未認証・0件）で描画されている

### 【これまでの修正内容】
1. ~~「読み込み中...」のローディングテキストを表示~~ → 効果なし
2. ~~`display: none` で初期値を非表示~~ → 効果なし（レイアウトが変わる）
3. 現在：`visibility: hidden` で初期値を隠す

### 【求める修正】
「未取得状態」と「取得結果が0件」を区別する仕組みにする
- 取得完了フラグが立つまで、統計情報・認証バッジは確定値を表示しない
- コード上で状態を明確に分ける

---

## 【プロジェクト情報】

### GitHub
- リポジトリ: https://github.com/kanetin219-sudo/travel-threads-dashboard
- デプロイ: https://kanetin219-sudo.github.io/travel-threads-dashboard/

### Supabase
- プロジェクト ID: `ygqmevyetdwyebvgqcbo`
- URL: https://ygqmevyetdwyebvgqcbo.supabase.co
- テーブル:
  - `travel_hotels` (100件のホテルデータが投入済み)
  - `travel_queue` (投稿キュー)
  - `travel_analytics` (最近作成)

### ローカルパス
- プロジェクト: `/Users/nakurashun/Desktop/my-company/travel-threads-dashboard/`
- HTML: `index.html`
- JS: `js/app.js`, `js/supabase.js`, `js/config.js`
- CSS: `css/style.css`

---

## 【ファイル構成】
```
travel-threads-dashboard/
├── index.html
├── css/style.css
├── js/
│   ├── app.js (メインロジック)
│   ├── supabase.js (Supabase 連携)
│   ├── config.js (設定)
│   ├── queue.js
│   ├── form.js
│   └── analytics.js
├── README.md
└── .gitignore
```

---

## 【重要な実装部分】

### app.js の `loadDashboard()` 関数（76行目付近）
ここでデータを非同期取得しているが、この処理が完了するまでは
HTML の初期値が表示されている

### HTML の初期状態（index.html）
- auth-status: `visibility: hidden` で隠しているが、
  Supabase 未接続時に見えないままになる可能性
- stats-content: `visibility: hidden` で隠しているが、
  loadDashboard() 完了時に `visibility: visible` に変更

---

## 【修正の方向性】
1. **状態管理の明確化**
   - `isDataLoaded` フラグで「取得中」「取得完了」を区別

2. **初期表示の工夫**
   - 「未取得」と「0件」の見せ方を分ける
   - スケルトン表示またはスピナーで「読み込み中」を明示

3. **Supabase 認証チェック**
   - `supabaseClient` が存在しない状態を明確にハンドル

---

## 【最後に試したコード】
```javascript
// app.js の loadDashboard() 内
document.getElementById('auth-status').style.visibility = 'visible';
document.getElementById('queue-count').style.visibility = 'visible';
```

しかし、初期値が長く見えているのを防げていない。
