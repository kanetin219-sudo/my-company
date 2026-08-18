// ============================================================
// Threads 自動投稿スクリプト（Claude AI生成）
// アカウント: don__wd（しょうこ）
// ============================================================
//
// 【スクリプトプロパティに設定する項目】
//   THREADS_USER_ID  - 35307231072224493
//   THREADS_APP_ID   - 1456635602805840
//   THREADS_APP_SECRET - MetaデベロッパーのApp Secret
//   CLAUDE_API_KEY   - Claude APIキー（Anthropic）
//   ※ THREADS_ACCESS_TOKEN は認証後に自動保存されます
//
// 【初回セットアップ手順】
//   1. このスクリプトをGASにコピーして「ウェブアプリとしてデプロイ」
//   2. デプロイURLをMetaのコールバックURLに登録
//   3. getAuthUrl() を実行 → 表示されたURLをブラウザで開く
//   4. プレ花嫁アカウントでログイン → 自動でトークン保存完了
//   5. setupTriggers() を実行
//
// 【トリガー設定】
//   runScheduledPosts     - 毎日 9:00 / 13:00 / 21:00（投稿実行）
//   generateWeeklyPosts   - 毎週月曜 8:00（週次生成）
//   refreshLongLivedToken - 毎月1日（トークン更新）
// ============================================================

// ============================================================
// POSTリクエスト受け口（ManusからのInstagram分析データ受信）
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // 投稿キュー一覧取得
    if (body.action === 'getQueue') {
      const ss = SpreadsheetApp.openById('1LaUjkcp9ZSYLtTmpWGLNqhAOBpqcBoA8Z5sC_L2-Qzc');
      const queueSheet = ss.getSheetByName('投稿キュー');
      if (!queueSheet || queueSheet.getLastRow() < 2) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const data = queueSheet.getDataRange().getValues();
      const statusFilter = body.status || null; // 'all' or null = 全件, '待機中' = 待機中のみ
      const rows = [];
      for (let i = 1; i < data.length; i++) {
        const status = data[i][2];
        if (statusFilter && statusFilter !== 'all' && status !== statusFilter) continue;
        rows.push({
          row: i + 1,
          scheduledAt: data[i][0] ? new Date(data[i][0]).toISOString() : '',
          text: data[i][1] || '',
          status: status || '',
          postId: data[i][3] || '',
          generatedAt: data[i][4] ? new Date(data[i][4]).toISOString() : '',
          treeGroup: data[i][5] || '',
          treePos: data[i][6] || ''
        });
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: rows }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 投稿キューアイテム削除
    if (body.action === 'deleteQueueItem') {
      const row = parseInt(body.row);
      if (!row || row < 2) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: '行番号が無効です' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const ss = SpreadsheetApp.openById('1LaUjkcp9ZSYLtTmpWGLNqhAOBpqcBoA8Z5sC_L2-Qzc');
      const queueSheet = ss.getSheetByName('投稿キュー');
      if (!queueSheet) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: '投稿キューシートが見つかりません' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      queueSheet.deleteRow(row);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 投稿キューアイテム更新（テキスト・予定日時）
    if (body.action === 'updateQueueItem') {
      const row = parseInt(body.row);
      if (!row || row < 2) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: '行番号が無効です' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const ss = SpreadsheetApp.openById('1LaUjkcp9ZSYLtTmpWGLNqhAOBpqcBoA8Z5sC_L2-Qzc');
      const queueSheet = ss.getSheetByName('投稿キュー');
      if (!queueSheet) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: '投稿キューシートが見つかりません' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      if (body.text !== undefined) queueSheet.getRange(row, 2).setValue(body.text);
      if (body.scheduledAt) queueSheet.getRange(row, 1).setValue(new Date(body.scheduledAt));
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // ダッシュボードからの投稿キュー追加
    if (body.action === 'addToQueue') {
      const text = body.text || '';
      if (!text) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'text is empty' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const ss = SpreadsheetApp.openById('1LaUjkcp9ZSYLtTmpWGLNqhAOBpqcBoA8Z5sC_L2-Qzc');
      let queueSheet = ss.getSheetByName('投稿キュー');
      if (!queueSheet) {
        queueSheet = ss.insertSheet('投稿キュー');
        queueSheet.appendRow(['投稿予定日時', '本文', 'ステータス', '投稿ID', '生成日', 'ツリーグループ', 'ツリー順番']);
      }
      // 翌日の次の投稿可能時間帯（9/13/21時）に自動セット
      const scheduledAt = body.scheduledAt || getNextAvailableSlot_(queueSheet);
      queueSheet.appendRow([scheduledAt, text, '待機中', '', new Date(), '', '']);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: '投稿キューに追加しました', scheduledAt }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // 既存：Instagram分析データ受信
    const analysisText = body.analysis || '';
    if (!analysisText) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'analysis field is empty' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    saveInstagramAnalysis(analysisText);
    return ContentService.createTextOutput(JSON.stringify({ success: true, message: 'Instagram分析データを保存しました' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function getNextAvailableSlot_(queueSheet) {
  const slots = [9, 13, 21];
  const now = new Date();
  const jstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  // 既存の待機中投稿の予定日時を取得
  const data = queueSheet.getDataRange().getValues();
  const scheduled = new Set();
  for (let i = 1; i < data.length; i++) {
    if (data[i][2] === '待機中' && data[i][0]) {
      scheduled.add(new Date(data[i][0]).toISOString().slice(0, 13));
    }
  }

  // 明日から7日以内で空いているスロットを探す
  for (let d = 1; d <= 14; d++) {
    for (const h of slots) {
      const candidate = new Date(jstNow);
      candidate.setDate(candidate.getDate() + d);
      candidate.setHours(h, 0, 0, 0);
      const key = new Date(candidate.getTime() - 9 * 60 * 60 * 1000).toISOString().slice(0, 13);
      if (!scheduled.has(key)) {
        return new Date(candidate.getTime() - 9 * 60 * 60 * 1000); // UTC変換
      }
    }
  }
  // フォールバック：翌日9時
  const fallback = new Date(jstNow);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(9, 0, 0, 0);
  return new Date(fallback.getTime() - 9 * 60 * 60 * 1000);
}

// ============================================================
// OAuth コールバック受け口（ウェブアプリとしてデプロイ必須）
// ============================================================
function doGet(e) {
  const code   = e.parameter.code;
  const error  = e.parameter.error;
  const action = e.parameter.action;

  // ===== ダッシュボードAPIアクション（GETで処理・CORS対応）=====
  if (action === 'getQueue') {
    try {
      const status = e.parameter.status || null;
      const ss = SpreadsheetApp.openById('1LaUjkcp9ZSYLtTmpWGLNqhAOBpqcBoA8Z5sC_L2-Qzc');
      const queueSheet = ss.getSheetByName('投稿キュー');
      if (!queueSheet || queueSheet.getLastRow() < 2) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const data = queueSheet.getDataRange().getValues();
      const rows = [];
      for (let i = 1; i < data.length; i++) {
        const rowStatus = data[i][2];
        if (status && status !== 'all' && rowStatus !== status) continue;
        rows.push({
          row: i + 1,
          scheduledAt: data[i][0] ? new Date(data[i][0]).toISOString() : '',
          text: data[i][1] || '',
          status: rowStatus || '',
          postId: data[i][3] || '',
          generatedAt: data[i][4] ? new Date(data[i][4]).toISOString() : '',
          treeGroup: data[i][5] || '',
          treePos: data[i][6] || ''
        });
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: rows }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'deleteQueueItem') {
    try {
      const row = parseInt(e.parameter.row);
      if (!row || row < 2) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: '行番号が無効です' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const ss = SpreadsheetApp.openById('1LaUjkcp9ZSYLtTmpWGLNqhAOBpqcBoA8Z5sC_L2-Qzc');
      const queueSheet = ss.getSheetByName('投稿キュー');
      queueSheet.deleteRow(row);
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'updateQueueItem') {
    try {
      const row = parseInt(e.parameter.row);
      const text = e.parameter.text;
      const scheduledAt = e.parameter.scheduledAt;
      if (!row || row < 2) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: '行番号が無効です' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const ss = SpreadsheetApp.openById('1LaUjkcp9ZSYLtTmpWGLNqhAOBpqcBoA8Z5sC_L2-Qzc');
      const queueSheet = ss.getSheetByName('投稿キュー');
      if (text !== undefined) queueSheet.getRange(row, 2).setValue(text);
      if (scheduledAt) queueSheet.getRange(row, 1).setValue(new Date(scheduledAt));
      return ContentService.createTextOutput(JSON.stringify({ success: true }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }

  if (action === 'addToQueue') {
    try {
      const text = e.parameter.text || '';
      const scheduledAtParam = e.parameter.scheduledAt || null;
      if (!text) {
        return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'text is empty' }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const ss = SpreadsheetApp.openById('1LaUjkcp9ZSYLtTmpWGLNqhAOBpqcBoA8Z5sC_L2-Qzc');
      let queueSheet = ss.getSheetByName('投稿キュー');
      if (!queueSheet) {
        queueSheet = ss.insertSheet('投稿キュー');
        queueSheet.appendRow(['投稿予定日時', '本文', 'ステータス', '投稿ID', '生成日', 'ツリーグループ', 'ツリー順番']);
      }
      const scheduledAt = scheduledAtParam ? new Date(scheduledAtParam) : getNextAvailableSlot_(queueSheet);
      queueSheet.appendRow([scheduledAt, text, '待機中', '', new Date(), '', '']);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: '投稿キューに追加しました', scheduledAt }))
        .setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  // ===== ここまでAPIアクション =====

  if (error) {
    return HtmlService.createHtmlOutput(`<h2>❌ エラー: ${error}</h2>`);
  }

  if (!code) {
    return HtmlService.createHtmlOutput('<h2>コードが見つかりません</h2>');
  }

  try {
    const config      = getConfig();
    const redirectUri = ScriptApp.getService().getUrl();

    // Step1: 認証コード → 短期トークン
    const tokenRes  = UrlFetchApp.fetch('https://graph.threads.net/oauth/access_token', {
      method            : 'POST',
      payload           : {
        client_id    : config.appId,
        client_secret: config.appSecret,
        code         : code,
        redirect_uri : redirectUri,
        grant_type   : 'authorization_code'
      },
      muteHttpExceptions: true
    });
    const tokenData = JSON.parse(tokenRes.getContentText());
    if (!tokenData.access_token) throw new Error(JSON.stringify(tokenData));

    // Step2: 短期トークン → 長期トークン（60日）
    const longRes  = UrlFetchApp.fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${config.appSecret}&access_token=${tokenData.access_token}`,
      { muteHttpExceptions: true }
    );
    const longData = JSON.parse(longRes.getContentText());
    if (!longData.access_token) throw new Error(JSON.stringify(longData));

    // Step3: ユーザーID取得＆保存
    const userRes  = UrlFetchApp.fetch(
      `https://graph.threads.net/v1.0/me?fields=id,username&access_token=${longData.access_token}`,
      { muteHttpExceptions: true }
    );
    const userData = JSON.parse(userRes.getContentText());

    const props = PropertiesService.getScriptProperties();
    props.setProperty('THREADS_ACCESS_TOKEN', longData.access_token);
    props.setProperty('THREADS_USER_ID', userData.id || '');

    return HtmlService.createHtmlOutput(`
      <h2>✅ 認証完了！</h2>
      <p>アカウント: @${userData.username}</p>
      <p>長期トークン（${Math.round(longData.expires_in / 86400)}日間有効）を保存しました。</p>
      <p>このページを閉じてください。</p>
    `);

  } catch (err) {
    return HtmlService.createHtmlOutput(`<h2>❌ 失敗: ${err.message}</h2>`);
  }
}

// 認証URLを生成してログに表示（GASエディタから実行）
function getAuthUrl() {
  const config      = getConfig();
  const redirectUri = encodeURIComponent(ScriptApp.getService().getUrl());
  const scope       = 'threads_basic,threads_content_publish';
  const url = `https://www.threads.net/oauth/authorize?client_id=${config.appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
  Logger.log('👇 このURLをブラウザで開いてっちゃ！');
  Logger.log(url);
}

function getConfig() {
  const p = PropertiesService.getScriptProperties();
  return {
    accessToken : p.getProperty('THREADS_ACCESS_TOKEN'),
    userId      : p.getProperty('THREADS_USER_ID'),
    appId       : p.getProperty('THREADS_APP_ID'),
    appSecret   : p.getProperty('THREADS_APP_SECRET'),
    claudeApiKey: p.getProperty('CLAUDE_API_KEY'),
  };
}

// ============================================================
// 初期セットアップ（最初に1回だけ実行）
// ============================================================
function initialSetup() {
  exchangeForLongLivedToken();
  fetchAndSavePastPosts();
  generateWeeklyPosts();
  setupTriggers();
  Logger.log('✅ 初期セットアップ完了！');
}

// ============================================================
// 長期トークン取得（60日間有効）
// ============================================================
function exchangeForLongLivedToken() {
  const config = getConfig();
  const url = `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${config.appSecret}&access_token=${config.accessToken}`;
  const res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const data = JSON.parse(res.getContentText());

  if (!data.access_token) throw new Error('長期トークン取得失敗: ' + JSON.stringify(data));

  PropertiesService.getScriptProperties().setProperty('THREADS_ACCESS_TOKEN', data.access_token);
  Logger.log(`✅ 長期トークン取得完了（${Math.round(data.expires_in / 86400)}日間有効）`);
  return data.access_token;
}

// ============================================================
// 長期トークン更新（30日ごと推奨）
// ============================================================
function refreshLongLivedToken() {
  const config = getConfig();
  const url  = `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${config.accessToken}`;
  const res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const data = JSON.parse(res.getContentText());

  if (!data.access_token) throw new Error('トークン更新失敗: ' + JSON.stringify(data));

  PropertiesService.getScriptProperties().setProperty('THREADS_ACCESS_TOKEN', data.access_token);
  Logger.log('✅ トークンを更新しました');
}

// ============================================================
// 過去投稿を取得してスプレッドシートに保存
// ============================================================
function fetchAndSavePastPosts() {
  const config = getConfig();
  const url  = `https://graph.threads.net/v1.0/${config.userId}/threads?fields=id,text,timestamp,media_type&limit=50&access_token=${config.accessToken}`;
  const res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const data = JSON.parse(res.getContentText());

  const ss    = SpreadsheetApp.openById('1LaUjkcp9ZSYLtTmpWGLNqhAOBpqcBoA8Z5sC_L2-Qzc');
  let sheet   = ss.getSheetByName('過去投稿');
  if (!sheet) sheet = ss.insertSheet('過去投稿');

  sheet.clearContents();
  sheet.appendRow(['投稿日', 'テキスト', 'メディアタイプ', 'ID']);
  sheet.getRange(1, 1, 1, 4).setFontWeight('bold');

  (data.data || []).forEach(post => {
    sheet.appendRow([
      (post.timestamp || '').substring(0, 10),
      post.text || '',
      post.media_type || 'TEXT',
      post.id || ''
    ]);
  });

  Logger.log(`✅ 過去投稿 ${data.data.length} 件を保存`);
  return data.data || [];
}

// ============================================================
// インスタ分析データをスプレッドシートに保存（Manusデータ貼り付け用）
// ============================================================
function saveInstagramAnalysis(analysisText) {
  const ss = SpreadsheetApp.openById('1LaUjkcp9ZSYLtTmpWGLNqhAOBpqcBoA8Z5sC_L2-Qzc');
  let sheet = ss.getSheetByName('インスタ分析');
  if (!sheet) {
    sheet = ss.insertSheet('インスタ分析');
    sheet.appendRow(['更新日時', '分析データ']);
    sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
    sheet.setColumnWidth(2, 600);
  }

  sheet.clearContents();
  sheet.appendRow(['更新日時', '分析データ']);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  sheet.appendRow([new Date(), analysisText]);
  Logger.log('✅ インスタ分析データを保存しました');
}

// ============================================================
// Claude AI で今週の投稿を生成（14本 / 1日2投稿 × 7日）
// 21本（1日3投稿×7日）うち2本（投稿3・12）はストア誘導ツリー、4本（投稿6・9・15・18）はNote誘導ツリー
// ============================================================
function generateWeeklyPosts() {
  const config    = getConfig();
  const STORE_URL = 'https://don-wd.stores.jp/?utm_source=threads&utm_medium=social&utm_content=link_in_bio&utm_id=97760_v0_s00_e0_tv3_a1denngiixjb3l';
  const NOTE_URL  = 'https://note.com/don__wd/n/n8df39e2c2898';

  // 過去投稿を参照用に取得
  const ss        = SpreadsheetApp.openById('1LaUjkcp9ZSYLtTmpWGLNqhAOBpqcBoA8Z5sC_L2-Qzc');
  const pastSheet = ss.getSheetByName('過去投稿');
  let pastTexts   = '';

  if (pastSheet && pastSheet.getLastRow() > 1) {
    const rows = pastSheet.getRange(2, 2, Math.min(pastSheet.getLastRow() - 1, 20), 1).getValues();
    pastTexts  = rows.map(r => r[0]).filter(t => t).join('\n\n---\n\n');
  } else {
    const posts = fetchAndSavePastPosts();
    pastTexts   = posts.slice(0, 20).map(p => p.text).filter(t => t).join('\n\n---\n\n');
  }

  // メトリクスを先に取得（PDCA用）
  fetchWeeklyMetrics();

  // PDCAデータを読み込む（上位/下位投稿パターン）
  let pdcaSection = '';
  const metricsSheet = ss.getSheetByName('メトリクス');
  if (metricsSheet && metricsSheet.getLastRow() > 1) {
    const mData = metricsSheet.getRange(2, 1, metricsSheet.getLastRow() - 1, 8).getValues();
    const mRows = mData
      .filter(r => r[2] > 0)  // views > 0
      .map(r => ({ text: String(r[1]), views: r[2], likes: r[3], replies: r[4], reposts: r[5], engRate: parseFloat(r[7]) || 0 }))
      .sort((a, b) => b.engRate - a.engRate);

    if (mRows.length >= 3) {
      const top3    = mRows.slice(0, 3);
      const bottom3 = mRows.slice(-3).reverse();
      pdcaSection = '【過去の実績データ（PDCA）】\n'
        + '▼ エンゲージメントが高かった投稿パターン（このトーン・形式を参考にする）:\n'
        + top3.map((r, i) => `${i + 1}. [エンゲージ率${r.engRate}% / views${r.views} / likes${r.likes} / replies${r.replies}]\n   "${r.text}"`).join('\n')
        + '\n\n▼ エンゲージメントが低かった投稿パターン（このトーン・形式は避ける）:\n'
        + bottom3.map((r, i) => `${i + 1}. [エンゲージ率${r.engRate}% / views${r.views}]\n   "${r.text}"`).join('\n')
        + '\n\n';
    }
  }

  // Manusから取得したInstagram分析データを読み込む
  let instagramAnalysis = '';
  const igSheet = ss.getSheetByName('インスタ分析');
  if (igSheet && igSheet.getLastRow() > 1) {
    instagramAnalysis = igSheet.getRange(2, 2).getValue() || '';
  }

  const igSection = instagramAnalysis
    ? '【Instagram競合・参考アカウント分析（Manusデータ）】\n' + instagramAnalysis + '\n\n---\n\n'
    : '';

  const igAnalysisLabel = instagramAnalysis ? 'Instagram分析データと' : '';
  const igBuzzRule = instagramAnalysis
    ? '- Instagram分析で判明したバズりやすいパターンを積極的に取り入れる\n'
    : '';

  const prompt = 'あなたはプレ花嫁（結婚式準備中の女性）向けThreadsアカウント「しょうこ」の投稿を作成します。\n\n'
    + '【絶対禁止事項】\n'
    + '- ハッシュタグ（#記号）は全投稿を通じて完全禁止。本文のどこにも一切使わない。#から始まる単語は書かない。\n\n'
    + pdcaSection
    + igSection
    + '【過去の投稿例】\n'
    + pastTexts
    + '\n\n---\n\n'
    + igAnalysisLabel + '上記の投稿スタイル・テーマ・口調を分析して、新しい投稿を14本作成してください。\n\n'
    + '【ルール（全投稿共通）】\n'
    + '- #記号は絶対に使わない（ハッシュタグ完全禁止）\n'
    + '- プレ花嫁の不安や悩みに寄り添う共感的な文章\n'
    + '- 絵文字を適度に使う（多すぎない）\n'
    + '- 各投稿は150〜250文字程度（短くコンパクトにまとめる・Threads向けの読みやすい長さ）\n'
    + '- テーマが21本でバラけるようにする（後悔・準備スケジュール・演出・費用節約・当日の振る舞い・ゲスト対応・ドレス・ヘアメイクなど）\n'
    + igBuzzRule
    + '- 21本それぞれのトーン・語り口・形式が全部バラバラになるようにする（連続する投稿が同じパターンにならないよう意識する）\n'
    + '- 投稿フォーマットは以下の4パターンをバランスよく使う（毎回違うパターンを使う）\n'
    + '  パターンA：\\ タイトル / ＋ 番号リスト（①②③形式）＋ 締めの一言\n'
    + '  パターンB：「あのとき〜だったな」「実は私も〜で悩んでた」などの体験談・共感ストーリー形式\n'
    + '  パターンC：「〇〇と△△、どっちが正解だと思う？」など読者に問いかける質問型（コメントを促す）\n'
    + '  パターンD：「知らないと損！〇〇のビフォー/アフター」などbefore/after比較形式\n'
    + '- 21本のうち8本以上は「パターンC」か「パターンB」にする\n'
    + '- 質問型（パターンC）の投稿は、最後に「コメントで教えてね💬」「あなたはどっちだった？」などコメントを促す一言を必ず入れる\n'
    + '- 絵文字の種類・数・位置も投稿ごとに変える（全部同じ顔文字で終わるのはNG）\n'
    + '- 最後に短い一言でプレ花嫁さんへのメッセージで締める\n\n'
    + '【ストア誘導ルール（投稿3・投稿12のみ）】\n'
    + '- 投稿テーマに合わせて「このテンプレートが活躍するよ」という流れで紹介する\n'
    + '- ハードな営業感は出さず、友達に教えるような温かいトーンで\n'
    + '- ストア誘導投稿は本文を120文字以内に収める（URLが約130文字あるため合計250文字程度に収める）\n'
    + '- 最後の行に必ず以下を追加: 「→ プロフィールのリンクから無料で見てみてね\n' + STORE_URL + '」\n\n'
    + '【Note記事誘導ルール（投稿6・投稿9・投稿15・投稿18のみ）】\n'
    + '- テーマは必ず「後悔・失敗談・やっておけばよかったこと」に関連させる\n'
    + '- 「私の後悔を全部まとめた有料記事があるよ」という流れで自然に誘導する\n'
    + '- 本文は90文字以内の短めにまとめる（URL込みで140文字程度に収める）\n'
    + '- 煽らず、「同じ後悔をしてほしくない」という気持ちが伝わるトーンで\n'
    + '- 最後の行に必ず以下を追加: 「→ 後悔を減らしたいプレ花嫁さんへ🌸\n' + NOTE_URL + '」\n\n'
    + '【ツリー投稿ルール（投稿3・投稿6・投稿9・投稿12・投稿15・投稿18のみ）】\n'
    + '- これらの投稿はツリー形式（3つの連続した投稿）で作成する\n'
    + '- 出力形式は「投稿3_1:」「投稿3_2:」「投稿3_3:」のように「番号_順番」で出力する\n'
    + '- _1（ルート）：読者を引き込む短いフック（60〜80文字）。「え、どういうこと？」と続きを読みたくなる一言\n'
    + '- _2（本文）：具体的な内容・共感ポイント（80〜120文字）。体験談や具体例を入れる\n'
    + '- _3（締め+誘導）：まとめ＋リンク誘導（80〜100文字＋URL）\n'
    + '- 各パートは独立して読めるが、続きが気になる自然な流れにする\n'
    + '- ストア誘導（投稿3・12）の_3の末尾: 「→ プロフィールのリンクから無料で見てみてね\n' + STORE_URL + '」\n'
    + '- Note誘導（投稿6・9・15・18）の_3の末尾: 「→ 後悔を減らしたいプレ花嫁さんへ🌸\n' + NOTE_URL + '」\n\n'
    + '【出力形式（厳守・投稿番号の形式を必ず守ること）】\n'
    + '投稿1:\n[本文]\n\n投稿2:\n[本文]\n\n投稿3_1:\n[本文]\n\n投稿3_2:\n[本文]\n\n投稿3_3:\n[本文]\n\n投稿4:\n[本文]\n\n投稿5:\n[本文]\n\n'
    + '投稿6_1:\n[本文]\n\n投稿6_2:\n[本文]\n\n投稿6_3:\n[本文]\n\n投稿7:\n[本文]\n\n投稿8:\n[本文]\n\n'
    + '投稿9_1:\n[本文]\n\n投稿9_2:\n[本文]\n\n投稿9_3:\n[本文]\n\n投稿10:\n[本文]\n\n投稿11:\n[本文]\n\n'
    + '投稿12_1:\n[本文]\n\n投稿12_2:\n[本文]\n\n投稿12_3:\n[本文]\n\n投稿13:\n[本文]\n\n投稿14:\n[本文]\n\n'
    + '投稿15_1:\n[本文]\n\n投稿15_2:\n[本文]\n\n投稿15_3:\n[本文]\n\n投稿16:\n[本文]\n\n投稿17:\n[本文]\n\n'
    + '投稿18_1:\n[本文]\n\n投稿18_2:\n[本文]\n\n投稿18_3:\n[本文]\n\n投稿19:\n[本文]\n\n投稿20:\n[本文]\n\n投稿21:\n[本文]';

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method : 'POST',
    headers: {
      'Content-Type'    : 'application/json',
      'x-api-key'       : config.claudeApiKey,
      'anthropic-version': '2023-06-01'
    },
    payload           : JSON.stringify({
      model     : 'claude-sonnet-4-6',
      max_tokens: 8192,
      messages  : [{ role: 'user', content: prompt }]
    }),
    muteHttpExceptions: true
  });

  const result = JSON.parse(res.getContentText());
  if (!result.content || !result.content[0]) throw new Error('Claude API失敗: ' + res.getContentText());
  const generatedText = result.content[0].text;

  // 投稿キューシートに保存
  let queueSheet = ss.getSheetByName('投稿キュー');
  if (!queueSheet) {
    queueSheet = ss.insertSheet('投稿キュー');
    queueSheet.appendRow(['投稿予定日時', '本文', 'ステータス', '投稿ID', '生成日', 'ツリーグループ', 'ツリー順番']);
    queueSheet.getRange(1, 1, 1, 7).setFontWeight('bold');
    queueSheet.setColumnWidth(2, 400);
  }

  // 既存の「待機中」行を削除（重複防止）
  const existingData = queueSheet.getDataRange().getValues();
  for (let i = existingData.length - 1; i >= 1; i--) {
    if (existingData[i][2] === '待機中') {
      queueSheet.deleteRow(i + 1);
    }
  }

  // 生成されたテキストをパース（ツリー形式「投稿X_Y:」にも対応）
  const postRegex = /投稿(\d+)(?:_(\d+))?:\n([\s\S]*?)(?=投稿\d+(?:_\d+)?:|$)/g;
  let match;
  let count = 0;
  const treeRootTimes = {}; // ツリーのルート投稿時刻を記録

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  while ((match = postRegex.exec(generatedText)) !== null) {
    const postNum = match[1];                          // 投稿番号 (例: "3")
    const treePos = match[2] ? parseInt(match[2]) : null; // ツリー順番 (例: 1, 2, 3 or null)
    const text = match[3].trim()
      .replace(/\n*-{3,}\s*$/, '')
      .replace(/#\S+/g, '')           // ハッシュタグ強制除去
      .replace(/[^\S\n]{2,}/g, ' ')  // 改行以外の連続スペース整理（改行は保持）
      .trim();
    if (!text) continue;

    if (treePos && treePos > 1) {
      // ツリー返信 - ルートと同じ時間にスケジュール
      const rootTime = treeRootTimes[postNum];
      if (rootTime) {
        queueSheet.appendRow([rootTime, text, '待機中', '', new Date(), postNum, treePos]);
      }
    } else {
      // 通常投稿 or ツリーのルート（_1）
      const dayOffset = Math.floor(count / 3);
      const hour      = [9, 13, 21][count % 3]; // 9時・13時・21時の3回
      const scheduledDate = new Date(tomorrow);
      scheduledDate.setDate(tomorrow.getDate() + dayOffset);
      scheduledDate.setHours(hour, 0, 0, 0);

      if (treePos === 1) {
        // ツリーのルート投稿
        treeRootTimes[postNum] = scheduledDate;
        queueSheet.appendRow([scheduledDate, text, '待機中', '', new Date(), postNum, 1]);
      } else {
        // 通常の単独投稿
        queueSheet.appendRow([scheduledDate, text, '待機中', '', new Date(), '', '']);
      }
      count++;
    }
  }

  Logger.log('完了: ' + count + ' 本の投稿を生成・キューに追加');
  return count;
}

// ============================================================
// Threadsに投稿する（テキストのみ）
// ============================================================
function postToThreads_(text, replyToId) {
  const config = getConfig();

  // Threads APIの上限は500文字
  if (text.length > 500) {
    text = text.substring(0, 497) + '…';
    Logger.log('⚠️ テキストが500文字を超えていたため切り詰めました');
  }

  // Step1: メディアコンテナ作成（ツリー返信の場合はreply_to_idを付与）
  const payload = { media_type: 'TEXT', text: text, access_token: config.accessToken };
  if (replyToId) payload.reply_to_id = replyToId;

  const createRes = UrlFetchApp.fetch(
    `https://graph.threads.net/v1.0/${config.userId}/threads`,
    {
      method            : 'POST',
      payload           : payload,
      muteHttpExceptions: true
    }
  );
  const createData = JSON.parse(createRes.getContentText());
  if (!createData.id) throw new Error('コンテナ作成失敗: ' + JSON.stringify(createData));

  Utilities.sleep(5000); // 5秒待機

  // Step2: 公開
  const publishRes = UrlFetchApp.fetch(
    `https://graph.threads.net/v1.0/${config.userId}/threads_publish`,
    {
      method            : 'POST',
      payload           : { creation_id: createData.id, access_token: config.accessToken },
      muteHttpExceptions: true
    }
  );
  const publishData = JSON.parse(publishRes.getContentText());
  if (!publishData.id) throw new Error('公開失敗: ' + JSON.stringify(publishData));

  return publishData.id;
}

// ============================================================
// スケジュール実行（毎日9時・13時・21時に起動 → 当日投稿を実行）
// ============================================================
function runScheduledPosts() {
  const ss         = SpreadsheetApp.openById('1LaUjkcp9ZSYLtTmpWGLNqhAOBpqcBoA8Z5sC_L2-Qzc');
  const sheet      = ss.getSheetByName('投稿キュー');
  if (!sheet || sheet.getLastRow() < 2) return;

  const now  = new Date();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const scheduledTime = data[i][0];
    const text          = data[i][1];
    const status        = data[i][2];
    const treeGroup     = data[i][5] ? String(data[i][5]) : '';
    const treePos       = data[i][6] ? parseInt(data[i][6]) : null;

    if (status !== '待機中') continue;
    if (!scheduledTime || new Date(scheduledTime) > now) continue;

    // ツリー返信（順番2以降）はルート投稿処理時にまとめて投稿するのでスキップ
    if (treeGroup && treePos && treePos > 1) continue;

    try {
      const postId = postToThreads_(text);
      sheet.getRange(i + 1, 3).setValue('投稿済み');
      sheet.getRange(i + 1, 4).setValue(postId);
      Logger.log(`✅ 投稿完了 ID: ${postId}`);

      // ツリーのルート投稿の場合、続きを即時チェーン投稿
      if (treeGroup && treePos === 1) {
        let parentId = postId;
        const freshData = sheet.getDataRange().getValues();

        // 同グループの返信を順番に取得
        const replies = [];
        for (let j = 1; j < freshData.length; j++) {
          const rGroup = freshData[j][5] ? String(freshData[j][5]) : '';
          const rPos   = freshData[j][6] ? parseInt(freshData[j][6]) : null;
          const rStatus = freshData[j][2];
          const rText   = freshData[j][1];
          if (rGroup === treeGroup && rPos > 1 && rStatus === '待機中') {
            replies.push({ row: j + 1, text: rText, pos: rPos });
          }
        }
        replies.sort((a, b) => a.pos - b.pos);

        for (const reply of replies) {
          Utilities.sleep(3000);
          try {
            const replyId = postToThreads_(reply.text, parentId);
            sheet.getRange(reply.row, 3).setValue('投稿済み');
            sheet.getRange(reply.row, 4).setValue(replyId);
            parentId = replyId;
            Logger.log(`✅ ツリー返信完了 pos:${reply.pos} ID: ${replyId}`);
          } catch(e2) {
            sheet.getRange(reply.row, 3).setValue('エラー: ' + e2.message);
            Logger.log('❌ ツリー返信失敗: ' + e2.message);
            break;
          }
        }
      }
    } catch (e) {
      sheet.getRange(i + 1, 3).setValue('エラー: ' + e.message);
      Logger.log('❌ 投稿失敗: ' + e.message);
    }

    Utilities.sleep(10000);
  }
}

// ============================================================
// 週次メトリクス取得（PDCA用・投稿済み投稿のインサイトを保存）
// ============================================================
function fetchWeeklyMetrics() {
  const config = getConfig();
  const ss = SpreadsheetApp.openById('1LaUjkcp9ZSYLtTmpWGLNqhAOBpqcBoA8Z5sC_L2-Qzc');
  const queueSheet = ss.getSheetByName('投稿キュー');

  if (!queueSheet || queueSheet.getLastRow() < 2) {
    Logger.log('投稿キューが空です');
    return [];
  }

  // メトリクスシートを準備
  let metricsSheet = ss.getSheetByName('メトリクス');
  if (!metricsSheet) {
    metricsSheet = ss.insertSheet('メトリクス');
    metricsSheet.appendRow(['投稿日時', '本文（先頭50字）', 'views', 'likes', 'replies', 'reposts', 'quotes', 'エンゲージ率(%)', '投稿ID']);
    metricsSheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    metricsSheet.setColumnWidth(2, 320);
    metricsSheet.setColumnWidth(1, 150);
  }

  // 過去14日間の投稿済みデータを取得
  const now    = new Date();
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const data   = queueSheet.getDataRange().getValues();

  const targets = [];
  for (let i = 1; i < data.length; i++) {
    const [scheduledTime, text, status, postId] = data[i];
    if (status !== '投稿済み' || !postId) continue;
    if (new Date(scheduledTime) < cutoff) continue;
    targets.push({ scheduledTime, text, postId: String(postId) });
  }

  if (targets.length === 0) {
    Logger.log('取得対象の投稿がありません（過去14日に投稿済みのものなし）');
    return [];
  }

  // 取得済み投稿IDをキャッシュ（重複防止）
  const existingIds = new Set();
  if (metricsSheet.getLastRow() > 1) {
    metricsSheet.getRange(2, 9, metricsSheet.getLastRow() - 1, 1).getValues()
      .forEach(r => { if (r[0]) existingIds.add(String(r[0])); });
  }

  const results = [];
  for (const { scheduledTime, text, postId } of targets) {
    if (existingIds.has(postId)) continue;

    try {
      const url = `https://graph.threads.net/v1.0/${postId}/insights?metric=views,likes,replies,reposts,quotes&access_token=${config.accessToken}`;
      const res  = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const json = JSON.parse(res.getContentText());

      if (!json.data) {
        Logger.log(`⚠️ メトリクス取得失敗 ID:${postId} → ${res.getContentText().substring(0, 100)}`);
        continue;
      }

      // レスポンス形式を吸収（total_value形式 or values形式）
      const m = {};
      json.data.forEach(item => {
        m[item.name] = item.total_value
          ? item.total_value.value
          : (item.values && item.values[0] ? item.values[0].value : 0);
      });

      const views    = m.views    || 0;
      const likes    = m.likes    || 0;
      const replies  = m.replies  || 0;
      const reposts  = m.reposts  || 0;
      const quotes   = m.quotes   || 0;
      const engRate  = views > 0 ? ((likes + replies + reposts) / views * 100).toFixed(2) : '0.00';

      metricsSheet.appendRow([scheduledTime, text.substring(0, 50), views, likes, replies, reposts, quotes, engRate, postId]);
      existingIds.add(postId);
      results.push({ text: text.substring(0, 30), views, likes, replies, reposts, engRate });

      Logger.log(`✅ ${text.substring(0, 20)}… views:${views} likes:${likes} replies:${replies} eng:${engRate}%`);
      Utilities.sleep(500);

    } catch (e) {
      Logger.log(`❌ ID:${postId} エラー: ${e.message}`);
    }
  }

  Logger.log(`メトリクス取得完了: ${results.length}件追加`);
  return results;
}

// ============================================================
// テスト投稿（手動実行用）
// ============================================================
function testPost() {
  const testText = `＼テスト投稿です／\n\nこれはClaude AIが自動生成した投稿のテストっちゃ！\nうまく動いてたら本番運用開始っどん！`;
  const postId   = postToThreads_(testText);
  Logger.log('✅ テスト投稿完了 ID: ' + postId);
}

// ============================================================
// トリガー自動設定
// ============================================================
function setupTriggers() {
  // 既存トリガー削除
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  // 毎日9時：投稿実行
  ScriptApp.newTrigger('runScheduledPosts')
    .timeBased().atHour(9).everyDays(1).create();

  // 毎日13時：投稿実行
  ScriptApp.newTrigger('runScheduledPosts')
    .timeBased().atHour(13).everyDays(1).create();

  // 毎日21時：投稿実行
  ScriptApp.newTrigger('runScheduledPosts')
    .timeBased().atHour(21).everyDays(1).create();

  // 毎週月曜8時：週次生成
  ScriptApp.newTrigger('generateWeeklyPosts')
    .timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();

  // 毎週日曜22時：メトリクス先取り（月曜生成前にPDCAデータを揃える）
  ScriptApp.newTrigger('fetchWeeklyMetrics')
    .timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(22).create();

  // 毎月1日3時：トークン更新
  ScriptApp.newTrigger('refreshLongLivedToken')
    .timeBased().onMonthDay(1).atHour(3).create();

  Logger.log('✅ トリガー設定完了');
}

// ============================================================
// ユーザーID確認（診断用）
// ============================================================
function getMyUserId() {
  const config = getConfig();
  const res = UrlFetchApp.fetch(
    'https://graph.threads.net/v1.0/me?fields=id,username&access_token=' + config.accessToken,
    { muteHttpExceptions: true }
  );
  Logger.log(res.getContentText());
}
