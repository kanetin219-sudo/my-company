// ============================================
// スプレッドシート初期設定スクリプト
// このスクリプトをApps Scriptで実行してスプシを初期化
// ============================================

function setupAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 既存シートを削除（テンプレートが必要な場合）
  const existingSheets = ss.getSheets();
  existingSheets.forEach(sheet => {
    if (sheet.getName() !== 'シート1') {
      ss.deleteSheet(sheet);
    }
  });

  // 各シートを作成
  createPostManagementSheet(ss);
  createPostHistorySheet(ss);
  createPerformanceSheet(ss);
  createSettingsSheet(ss);

  Logger.log('✅ すべてのシートを初期化しました');
  Logger.log('📌 次のステップ：');
  Logger.log('1. CLAUDE_API_KEY を GAS に設定');
  Logger.log('2. SHEET_ID をこのシートのIDに更新');
  Logger.log('3. setupDailyTrigger() を実行してトリガーを設定');
}

// ============================================
// 台本管理シートの作成
// ============================================
function createPostManagementSheet(ss) {
  const sheet = ss.insertSheet('台本管理', 0);

  const headers = [
    '日付',
    '曜日',
    'カテゴリー',
    '狙い',
    '投稿形式',
    '昨頭',
    '投稿本文',
    'ツリー情報',
    '画像指示',
    'CTAタイプ',
    '募集期間フラグ',
    '品質チェック完了',
    '生成日時'
  ];

  sheet.appendRow(headers);

  // ヘッダーの書式設定
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#1f497d');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');

  // 列幅を設定
  sheet.setColumnWidth(1, 100);  // 日付
  sheet.setColumnWidth(2, 50);   // 曜日
  sheet.setColumnWidth(3, 120);  // カテゴリー
  sheet.setColumnWidth(4, 150);  // 狙い
  sheet.setColumnWidth(5, 100);  // 投稿形式
  sheet.setColumnWidth(6, 250);  // 昨頭
  sheet.setColumnWidth(7, 400);  // 投稿本文
  sheet.setColumnWidth(8, 150);  // ツリー情報
  sheet.setColumnWidth(9, 150);  // 画像指示
  sheet.setColumnWidth(10, 100); // CTAタイプ
  sheet.setColumnWidth(11, 100); // 募集期間フラグ
  sheet.setColumnWidth(12, 120); // 品質チェック完了
  sheet.setColumnWidth(13, 150); // 生成日時

  // サンプル行を追加
  const sampleRow = [
    '2026-08-10',
    '日',
    '共感・感情系',
    '母の着物への思い',
    '通常投稿',
    '母の着物、捨てられないんです',
    'そう話してくださる方は本当に多いです。タンスに眠っている着物は、決して古いものではなく、母の大切な思い出そのもの。だからこそ、捨てることができない。...',
    'なし',
    'なし',
    '弱CTA',
    'FALSE',
    'TRUE',
    '2026-08-10 09:00:00'
  ];
  sheet.appendRow(sampleRow);

  Logger.log('✅ 台本管理シートを作成しました');
}

// ============================================
// 投稿履歴シートの作成
// ============================================
function createPostHistorySheet(ss) {
  const sheet = ss.insertSheet('投稿履歴', 1);

  const headers = [
    '日付',
    'カテゴリー',
    'テーマ',
    '昨頭',
    '投稿形式'
  ];

  sheet.appendRow(headers);

  // ヘッダーの書式設定
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#4472c4');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');

  // 列幅を設定
  sheet.setColumnWidth(1, 100);  // 日付
  sheet.setColumnWidth(2, 120);  // カテゴリー
  sheet.setColumnWidth(3, 200);  // テーマ
  sheet.setColumnWidth(4, 250);  // 昨頭
  sheet.setColumnWidth(5, 100);  // 投稿形式

  Logger.log('✅ 投稿履歴シートを作成しました（毎日GASで自動更新）');
}

// ============================================
// パフォーマンスシートの作成
// ============================================
function createPerformanceSheet(ss) {
  const sheet = ss.insertSheet('パフォーマンス', 2);

  const headers = [
    '日付',
    '投稿本文（最初の50字）',
    'Views',
    'Likes',
    'Replies',
    'Reposts',
    'Follows',
    'Link Clicks',
    '投稿形式',
    '備考'
  ];

  sheet.appendRow(headers);

  // ヘッダーの書式設定
  const headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setBackground('#70ad47');
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');

  // 列幅を設定
  sheet.setColumnWidth(1, 100);  // 日付
  sheet.setColumnWidth(2, 250);  // 投稿本文抜き出し
  sheet.setColumnWidth(3, 80);   // Views
  sheet.setColumnWidth(4, 80);   // Likes
  sheet.setColumnWidth(5, 80);   // Replies
  sheet.setColumnWidth(6, 80);   // Reposts
  sheet.setColumnWidth(7, 80);   // Follows
  sheet.setColumnWidth(8, 100);  // Link Clicks
  sheet.setColumnWidth(9, 100);  // 投稿形式
  sheet.setColumnWidth(10, 150); // 備考

  Logger.log('✅ パフォーマンスシートを作成しました（手入力用）');
}

// ============================================
// 設定シートの作成
// ============================================
function createSettingsSheet(ss) {
  const sheet = ss.insertSheet('設定', 3);

  // タイトル行
  sheet.appendRow(['【ブランド中心】']);
  sheet.appendRow(['思い出', '家族', '母や祖母', '特別な一着', 'ドレス']);
  sheet.appendRow(['受け継ぐ', '自己実現', '誰かに喜ばれる', '思い出を未来につなぐ']);
  sheet.appendRow(['【避けるべき世界観】']);
  sheet.appendRow(['節約', 'エコ', 'もったいない', '古布活用', '安さ訴求']);
  sheet.appendRow(['【コンテンツ比率（目標値）】']);
  sheet.appendRow(['共感・感情系', '35%']);
  sheet.appendRow(['憧れ・未来系', '25%']);
  sheet.appendRow(['教育・ノウハウ系', '20%']);
  sheet.appendRow(['権威性・ストーリー', '10%']);
  sheet.appendRow(['オファー・導線', '10%']);
  sheet.appendRow(['【投稿形式ミックス比率】']);
  sheet.appendRow(['通常投稿', '50%']);
  sheet.appendRow(['ツリー式', '30%']);
  sheet.appendRow(['画像付き', '20%']);
  sheet.appendRow(['【今月の状態】']);
  sheet.appendRow(['状態', '通常期']);
  sheet.appendRow(['【募集情報】']);
  sheet.appendRow(['募集開始予定日', '']);
  sheet.appendRow(['募集終了予定日', '']);
  sheet.appendRow(['【権威性・実績】']);
  sheet.appendRow(['和裁士歴', '19年']);
  sheet.appendRow(['リメイク数', '800着以上']);
  sheet.appendRow(['Instagram フォロワー', '約2万人']);
  sheet.appendRow(['【CTA戦略】']);
  sheet.appendRow(['最終ゴール', 'LINE登録']);
  sheet.appendRow(['LINE誘導タイミング', '思い出と憧れを刺激した後']);
  sheet.appendRow(['LINE登録リンク', 'https://utage-system.com/p/81T7Cxws6HPg']);
  sheet.appendRow(['CTA誘導頻度（日）', '3']);

  // ヘッダー行の書式設定
  const titles = [1, 6, 10, 15, 18, 22, 25];
  titles.forEach(row => {
    const titleRange = sheet.getRange(row, 1, 1, 2);
    titleRange.setBackground('#ffc000');
    titleRange.setFontWeight('bold');
  });

  // 列幅を設定
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 100);

  Logger.log('✅ 設定シートを作成しました');
}

// ============================================
// 初期設定後の確認リスト
// ============================================
function getSetupChecklist() {
  const checklist = `
【🎯 初期設定完了チェックリスト】

□ 1. GAS プロジェクトにこのコードを保存
   └ Apps Script（スプシ右上 > 拡張機能 > Apps Script）

□ 2. Claude API キーを取得
   └ https://console.anthropic.com/
   └ 環境変数として保存するか、コードの冒頭に入力

□ 3. GAS コード内の定数を更新
   const CLAUDE_API_KEY = 'sk-ant-xxxxx';
   const SHEET_ID = 'xxxxx'; // このスプシのID

□ 4. トリガーを設定
   └ GAS プロジェクト左側 > トリガー > 新規作成
   └ または setupDailyTrigger() 関数を実行

□ 5. 権限を許可
   └ 実行すると許可ダイアログが出るので、許可してください

□ 6. テスト投稿を生成
   └ generateDailyThreadsPost() を手動実行
   └ 「台本管理」シートに新しい行が追加されたか確認

【📊 日々の使い方】

毎日9時に自動実行：
1. Claude API が台本を生成
2. 品質チェック（10項目）を自動実行
3. スプシの「台本管理」に反映
4. ユーザーが手動でThreadsに投稿
5. 投稿後に「パフォーマンス」シートに手入力

【🔧 トラブル時】

❌ API キー認証エラー
→ CLAUDE_API_KEY を確認・更新してください

❌ シート ID が見つからない
→ スプシの URL から ID を取得
   例：https://docs.google.com/spreadsheets/d/xxxxx/edit
   → xxxxx の部分がシート ID です

❌ トリガーが動かない
→ Apps Script > トリガー で確認
→ 時刻は「Asia/Tokyo」に設定されているか確認
  `;

  Logger.log(checklist);
  return checklist;
}