// ============================================================
// Threads 自動投稿スクリプト（Claude AI生成）
// アカウント: @anella_cafe_oita（ANELLA CAFE 大分店）
// ============================================================
//
// 【スクリプトプロパティに設定する項目】
//   THREADS_USER_ID    - ThreadsのユーザーID（getMyUserId()で確認）
//   THREADS_APP_ID     - MetaデベロッパーのApp ID
//   THREADS_APP_SECRET - MetaデベロッパーのApp Secret
//   CLAUDE_API_KEY     - Claude APIキー（Anthropic）
//   SPREADSHEET_ID     - 管理用スプレッドシートのID
//   ※ THREADS_ACCESS_TOKEN は認証後に自動保存されます
//
// 【初回セットアップ手順】
//   1. 新しいGoogleスプレッドシートを作成 → IDをスクリプトプロパティに設定
//   2. このスクリプトをGASにコピーして「ウェブアプリとしてデプロイ」
//   3. デプロイURLをMetaのコールバックURLに登録
//   4. getAuthUrl() を実行 → 表示されたURLをブラウザで開く
//   5. アネラカフェのアカウントでログイン → 自動でトークン保存完了
//   6. getMyUserId() を実行してUserIDをスクリプトプロパティに設定
//   7. setupTriggers() を実行
//
// 【トリガー設定】
//   runScheduledPosts     - 毎日 9:00 / 21:00（投稿実行）
//   generateWeeklyPosts   - 毎週月曜 8:00（週次生成）
//   refreshLongLivedToken - 毎月1日（トークン更新）
// ============================================================

function getConfig() {
  const p = PropertiesService.getScriptProperties();
  return {
    accessToken  : p.getProperty('THREADS_ACCESS_TOKEN'),
    userId       : p.getProperty('THREADS_USER_ID'),
    appId        : p.getProperty('THREADS_APP_ID'),
    appSecret    : p.getProperty('THREADS_APP_SECRET'),
    claudeApiKey : p.getProperty('CLAUDE_API_KEY'),
    spreadsheetId: p.getProperty('SPREADSHEET_ID'),
  };
}

// ============================================================
// OAuth コールバック受け口
// ============================================================
function doGet(e) {
  const code  = e.parameter.code;
  const error = e.parameter.error;

  // ===== ダッシュボードAPIアクション =====
  const action = e.parameter.action;

  if (action === 'getQueue') {
    try {
      const status = e.parameter.status || null;
      const ss = SpreadsheetApp.openById(getConfig().spreadsheetId);
      const queueSheet = ss.getSheetByName('投稿キュー');
      if (!queueSheet || queueSheet.getLastRow() < 2) {
        return ContentService.createTextOutput(JSON.stringify({ success: true, data: [] })).setMimeType(ContentService.MimeType.JSON);
      }
      const data = queueSheet.getDataRange().getValues();
      const rows = [];
      for (let i = 1; i < data.length; i++) {
        const rowStatus = data[i][2];
        if (status && status !== 'all' && rowStatus !== status) continue;
        rows.push({ row: i+1, scheduledAt: data[i][0] ? new Date(data[i][0]).toISOString() : '', text: data[i][1]||'', status: rowStatus||'', postId: data[i][3]||'', generatedAt: data[i][4] ? new Date(data[i][4]).toISOString() : '', treeGroup: data[i][5]||'', treePos: data[i][6]||'' });
      }
      return ContentService.createTextOutput(JSON.stringify({ success: true, data: rows })).setMimeType(ContentService.MimeType.JSON);
    } catch(err) { return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON); }
  }

  if (action === 'deleteQueueItem') {
    try {
      const row = parseInt(e.parameter.row);
      if (!row || row < 2) return ContentService.createTextOutput(JSON.stringify({ success: false, error: '行番号無効' })).setMimeType(ContentService.MimeType.JSON);
      SpreadsheetApp.openById(getConfig().spreadsheetId).getSheetByName('投稿キュー').deleteRow(row);
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    } catch(err) { return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON); }
  }

  if (action === 'updateQueueItem') {
    try {
      const row = parseInt(e.parameter.row);
      if (!row || row < 2) return ContentService.createTextOutput(JSON.stringify({ success: false, error: '行番号無効' })).setMimeType(ContentService.MimeType.JSON);
      const sheet = SpreadsheetApp.openById(getConfig().spreadsheetId).getSheetByName('投稿キュー');
      if (e.parameter.text !== undefined) sheet.getRange(row, 2).setValue(e.parameter.text);
      if (e.parameter.scheduledAt) sheet.getRange(row, 1).setValue(new Date(e.parameter.scheduledAt));
      return ContentService.createTextOutput(JSON.stringify({ success: true })).setMimeType(ContentService.MimeType.JSON);
    } catch(err) { return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON); }
  }

  if (action === 'addToQueue') {
    try {
      const text = e.parameter.text || '';
      if (!text) return ContentService.createTextOutput(JSON.stringify({ success: false, error: 'text is empty' })).setMimeType(ContentService.MimeType.JSON);
      const ss = SpreadsheetApp.openById(getConfig().spreadsheetId);
      let queueSheet = ss.getSheetByName('投稿キュー');
      if (!queueSheet) { queueSheet = ss.insertSheet('投稿キュー'); queueSheet.appendRow(['投稿予定日時','本文','ステータス','投稿ID','生成日','ツリーグループ','ツリー順番']); }
      const scheduledAt = e.parameter.scheduledAt ? new Date(e.parameter.scheduledAt) : getNextAvailableSlot_(queueSheet);
      queueSheet.appendRow([scheduledAt, text, '待機中', '', new Date(), '', '']);
      return ContentService.createTextOutput(JSON.stringify({ success: true, message: '追加しました', scheduledAt })).setMimeType(ContentService.MimeType.JSON);
    } catch(err) { return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON); }
  }
  // ===== ここまでAPIアクション =====

  if (error) return HtmlService.createHtmlOutput(`<h2>❌ エラー: ${error}</h2>`);
  if (!code) return HtmlService.createHtmlOutput('<h2>コードが見つかりません</h2>');

  try {
    const config      = getConfig();
    const redirectUri = ScriptApp.getService().getUrl();

    const tokenRes  = UrlFetchApp.fetch('https://graph.threads.net/oauth/access_token', {
      method            : 'POST',
      payload           : { client_id: config.appId, client_secret: config.appSecret, code, redirect_uri: redirectUri, grant_type: 'authorization_code' },
      muteHttpExceptions: true
    });
    const tokenData = JSON.parse(tokenRes.getContentText());
    if (!tokenData.access_token) throw new Error(JSON.stringify(tokenData));

    const longRes  = UrlFetchApp.fetch(
      `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${config.appSecret}&access_token=${tokenData.access_token}`,
      { muteHttpExceptions: true }
    );
    const longData = JSON.parse(longRes.getContentText());
    if (!longData.access_token) throw new Error(JSON.stringify(longData));

    const userRes  = UrlFetchApp.fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${longData.access_token}`, { muteHttpExceptions: true });
    const userData = JSON.parse(userRes.getContentText());

    PropertiesService.getScriptProperties().setProperties({
      'THREADS_ACCESS_TOKEN': longData.access_token,
      'THREADS_USER_ID'     : userData.id || ''
    });

    return HtmlService.createHtmlOutput(`
      <h2>✅ 認証完了！</h2>
      <p>アカウント: @${userData.username}</p>
      <p>長期トークン（${Math.round(longData.expires_in / 86400)}日間有効）を保存しました。</p>
    `);
  } catch (err) {
    return HtmlService.createHtmlOutput(`<h2>❌ 失敗: ${err.message}</h2>`);
  }
}

function getAuthUrl() {
  const config      = getConfig();
  const redirectUri = encodeURIComponent(ScriptApp.getService().getUrl());
  const scope       = 'threads_basic,threads_content_publish';
  const url = `https://www.threads.net/oauth/authorize?client_id=${config.appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code`;
  Logger.log('👇 このURLをブラウザで開いて！');
  Logger.log(url);
}

// ============================================================
// トークン更新
// ============================================================
function refreshLongLivedToken() {
  const config = getConfig();
  const res    = UrlFetchApp.fetch(`https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${config.accessToken}`, { muteHttpExceptions: true });
  const data   = JSON.parse(res.getContentText());
  if (!data.access_token) throw new Error('トークン更新失敗: ' + JSON.stringify(data));
  PropertiesService.getScriptProperties().setProperty('THREADS_ACCESS_TOKEN', data.access_token);
  Logger.log('✅ トークンを更新しました');
}

// ============================================================
// 過去投稿を取得してスプレッドシートに保存
// ============================================================
function fetchAndSavePastPosts() {
  const config = getConfig();
  const res    = UrlFetchApp.fetch(`https://graph.threads.net/v1.0/${config.userId}/threads?fields=id,text,timestamp,media_type&limit=50&access_token=${config.accessToken}`, { muteHttpExceptions: true });
  const data   = JSON.parse(res.getContentText());

  const ss    = SpreadsheetApp.openById(config.spreadsheetId);
  let sheet   = ss.getSheetByName('過去投稿');
  if (!sheet) sheet = ss.insertSheet('過去投稿');
  sheet.clearContents();
  sheet.appendRow(['投稿日', 'テキスト', 'メディアタイプ', 'ID']);
  sheet.getRange(1, 1, 1, 4).setFontWeight('bold');

  (data.data || []).forEach(post => {
    sheet.appendRow([(post.timestamp || '').substring(0, 10), post.text || '', post.media_type || 'TEXT', post.id || '']);
  });

  Logger.log(`✅ 過去投稿 ${(data.data || []).length} 件を保存`);
  return data.data || [];
}

// ============================================================
// Claude AI で今週の投稿を生成（週14本 / 1日2投稿 × 7日）
// ============================================================
function generateWeeklyPosts() {
  const config = getConfig();

  // 過去投稿を参照用に取得
  const ss        = SpreadsheetApp.openById(config.spreadsheetId);
  const pastSheet = ss.getSheetByName('過去投稿');
  let pastTexts   = '';

  if (pastSheet && pastSheet.getLastRow() > 1) {
    const rows = pastSheet.getRange(2, 2, Math.min(pastSheet.getLastRow() - 1, 20), 1).getValues();
    pastTexts  = rows.map(r => r[0]).filter(t => t).join('\n\n---\n\n');
  } else {
    const posts = fetchAndSavePastPosts();
    pastTexts   = posts.slice(0, 20).map(p => p.text).filter(t => t).join('\n\n---\n\n');
  }

  // PDCAデータを読み込む
  let pdcaSection = '';
  const metricsSheet = ss.getSheetByName('メトリクス');
  if (metricsSheet && metricsSheet.getLastRow() > 1) {
    const mData = metricsSheet.getRange(2, 1, metricsSheet.getLastRow() - 1, 8).getValues();
    const mRows = mData
      .filter(r => r[2] > 0)
      .map(r => ({ text: String(r[1]), views: r[2], likes: r[3], replies: r[4], reposts: r[5], engRate: parseFloat(r[7]) || 0 }))
      .sort((a, b) => b.engRate - a.engRate);

    if (mRows.length >= 3) {
      const top3    = mRows.slice(0, 3);
      const bottom3 = mRows.slice(-3).reverse();
      pdcaSection = '【過去の実績データ（PDCA）】\n'
        + '▼ エンゲージメントが高かった投稿パターン（このトーン・形式を参考にする）:\n'
        + top3.map((r, i) => `${i + 1}. [エンゲージ率${r.engRate}% / views${r.views}]\n   "${r.text}"`).join('\n')
        + '\n\n▼ エンゲージメントが低かった投稿パターン（このトーン・形式は避ける）:\n'
        + bottom3.map((r, i) => `${i + 1}. [エンゲージ率${r.engRate}% / views${r.views}]\n   "${r.text}"`).join('\n')
        + '\n\n';
    }
  }

  const prompt = `あなたはANELLA CAFE（アネラカフェ）大分店の公式Threadsアカウントの投稿を作成します。

【アネラカフェ大分店について】
- 就労継続支援B型事業所が運営する、ペット同伴OKのカフェ
- 障がいのある方がスタッフとして活躍している
- 保護犬・保護猫が常駐しており、お客さんと触れ合える
- 大分市にある地域密着型のカフェ
- コーヒーを飲みながら動物と癒しの時間が過ごせる

【絶対禁止事項】
- ハッシュタグ（#記号）は完全禁止
- 堅い敬語・ビジネス文章（「〜でございます」「〜させていただきます」など）
- 「AI」「自動生成」を感じさせる整いすぎた文章
- 箇条書きだらけの投稿

${pdcaSection}【過去の投稿例】
${pastTexts || '（まだデータなし）'}

---

上記の投稿スタイルを参考に、今週のThreads投稿を14本作成してください。

【キャラクター設定】
- 語り手：カフェのスタッフ（自然体・親しみやすい・温かい）
- 一人称：私 or （使わなくてもいい）
- 読者：大分在住の方、ペット好き、動物に関心のある人、カフェ好き、福祉・地域活動に興味のある人

【ルール（全投稿共通）】
- #記号は絶対に使わない
- 短い文節・改行を多めに使う（Threads向けの読みやすいレイアウト）
- 各投稿は120〜220文字程度
- 絵文字は必ず1〜3個使う（文末・感情が動く箇所・動物の話題など自然な場所に）
- 14本でテーマが被らないようにバラけさせる

【人間らしい文章にするための必須ルール】
- タメ口・友達言葉は使わない（「〜だよね」「〜じゃない？」「なんか」「すごく」などはNG）
- 丁寧語（です・ます調）だけど、固すぎない温かみのある文体にする
- 「今日は、」「実は、」「正直なところ、」など自然な書き出しを使う
- 体験した瞬間の感情を素直に書く（「胸があたたかくなりました」「思わず笑顔になりました」）
- 読んでいる人に語りかけるような文体（「〜ではないでしょうか」「〜かもしれません」）
- 文章が整いすぎないこと（完璧なPR文ではなく、スタッフが書いたような自然さ）
- 同じ語尾・同じ文末パターンが連続しないようにする

【投稿テーマのバリエーション（14本でバランスよく使う）】
A. 動物エピソード（「今日のあの子」「こんなことがあった」的な体験談）
B. カフェの雰囲気・日常の一コマ（スタッフ目線の話）
C. 保護犬猫の紹介・里親募集への想い
D. お客さんとのほっこりエピソード（個人情報なし・フィクションOK）
E. 就労支援・スタッフの成長・やりがいにまつわる話（重くなりすぎず）
F. 季節・天気・日常の話題に絡めたカフェの情報
G. 来店を誘う投稿（宣伝感を出さず「来てほしい」気持ちが伝わる形で）

【投稿フォーマット（4パターンをバランスよく使う）】
パターンA：体験談・エピソード形式（「今日ね、」「ある日のこと、」から始まる）
パターンB：気づき・発見形式（「知ってた？」「こんな場所があるんだって」）
パターンC：問いかけ形式（「動物が好きな人に聞きたいんだけど、」「疲れた日、どうしてる？」コメント促進）
パターンD：想い・メッセージ形式（「ここに来る人たちを見てると、」「正直に言うと、」）

【来店誘導（14本中2〜3本）】
- ゴリゴリの宣伝NG
- 「気が向いたらぜひ」「一度来てみてほしい」くらいの温かい誘い方で
- 最後に店名や住所は書かない（自然な締めくくりで終わる）

【出力形式（厳守）】
投稿1:
[本文]

投稿2:
[本文]

（投稿14まで同様に）`;

  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method            : 'POST',
    headers           : { 'Content-Type': 'application/json', 'x-api-key': config.claudeApiKey, 'anthropic-version': '2023-06-01' },
    payload           : JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 8192, messages: [{ role: 'user', content: prompt }] }),
    muteHttpExceptions: true
  });

  const result = JSON.parse(res.getContentText());
  if (!result.content || !result.content[0]) throw new Error('Claude API失敗: ' + res.getContentText());
  const generatedText = result.content[0].text;

  // 投稿キューシートに保存
  let queueSheet = ss.getSheetByName('投稿キュー');
  if (!queueSheet) {
    queueSheet = ss.insertSheet('投稿キュー');
    queueSheet.appendRow(['投稿予定日時', '本文', 'ステータス', '投稿ID', '生成日']);
    queueSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    queueSheet.setColumnWidth(2, 400);
  }

  // 既存の「待機中」行を削除（重複防止）
  const existingData = queueSheet.getDataRange().getValues();
  for (let i = existingData.length - 1; i >= 1; i--) {
    if (existingData[i][2] === '待機中') queueSheet.deleteRow(i + 1);
  }

  // 生成テキストをパース
  const postRegex = /投稿(\d+):\n([\s\S]*?)(?=投稿\d+:|$)/g;
  let match;
  let count = 0;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  while ((match = postRegex.exec(generatedText)) !== null) {
    const text = match[2].trim()
      .replace(/\n*-{3,}\s*$/, '')
      .replace(/#\S+/g, '')
      .replace(/[^\S\n]{2,}/g, ' ')
      .trim();
    if (!text) continue;

    // 1日2本（9時・21時）
    const dayOffset    = Math.floor(count / 2);
    const hour         = [9, 21][count % 2];
    const scheduledDate = new Date(tomorrow);
    scheduledDate.setDate(tomorrow.getDate() + dayOffset);
    scheduledDate.setHours(hour, 0, 0, 0);

    queueSheet.appendRow([scheduledDate, text, '待機中', '', new Date()]);
    count++;
  }

  // ステータス列にプルダウンを自動設定
  if (count > 0 && queueSheet.getLastRow() >= 2) {
    const dropRange = queueSheet.getRange(2, 3, queueSheet.getLastRow() - 1, 1);
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(['待機中', '承認済み', 'スキップ', '投稿済み'], true)
      .setAllowInvalid(false)
      .build();
    dropRange.setDataValidation(rule);
  }

  Logger.log('完了: ' + count + ' 本の投稿を生成・キューに追加');
  return count;
}

// ============================================================
// Threadsに投稿する
// ============================================================
function postToThreads_(text) {
  const config = getConfig();

  if (text.length > 500) {
    text = text.substring(0, 497) + '…';
    Logger.log('⚠️ テキストが500文字を超えていたため切り詰めました');
  }

  const createRes = UrlFetchApp.fetch(
    `https://graph.threads.net/v1.0/${config.userId}/threads`,
    { method: 'POST', payload: { media_type: 'TEXT', text, access_token: config.accessToken }, muteHttpExceptions: true }
  );
  const createData = JSON.parse(createRes.getContentText());
  if (!createData.id) throw new Error('コンテナ作成失敗: ' + JSON.stringify(createData));

  Utilities.sleep(5000);

  const publishRes = UrlFetchApp.fetch(
    `https://graph.threads.net/v1.0/${config.userId}/threads_publish`,
    { method: 'POST', payload: { creation_id: createData.id, access_token: config.accessToken }, muteHttpExceptions: true }
  );
  const publishData = JSON.parse(publishRes.getContentText());
  if (!publishData.id) throw new Error('公開失敗: ' + JSON.stringify(publishData));

  return publishData.id;
}

// ============================================================
// スケジュール実行（毎日9時・21時）
// ※「承認済み」になった投稿のみ投稿する
// ============================================================
function runScheduledPosts() {
  const config = getConfig();
  const ss     = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet  = ss.getSheetByName('投稿キュー');
  if (!sheet || sheet.getLastRow() < 2) return;

  const now  = new Date();
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const scheduledTime = data[i][0];
    const text          = data[i][1];
    const status        = data[i][2];

    if (status !== '承認済み') continue;  // 承認済みのみ投稿
    if (!scheduledTime || new Date(scheduledTime) > now) continue;

    try {
      const postId = postToThreads_(text);
      sheet.getRange(i + 1, 3).setValue('投稿済み');
      sheet.getRange(i + 1, 4).setValue(postId);
      Logger.log(`✅ 投稿完了 ID: ${postId}`);
    } catch (e) {
      sheet.getRange(i + 1, 3).setValue('エラー: ' + e.message);
      Logger.log('❌ 投稿失敗: ' + e.message);
    }
    Utilities.sleep(10000);
  }
}

// ============================================================
// 週次メトリクス取得（PDCA用）
// ============================================================
function fetchWeeklyMetrics() {
  const config     = getConfig();
  const ss         = SpreadsheetApp.openById(config.spreadsheetId);
  const queueSheet = ss.getSheetByName('投稿キュー');
  if (!queueSheet || queueSheet.getLastRow() < 2) return;

  let metricsSheet = ss.getSheetByName('メトリクス');
  if (!metricsSheet) {
    metricsSheet = ss.insertSheet('メトリクス');
    metricsSheet.appendRow(['投稿日時', '本文（先頭50字）', 'views', 'likes', 'replies', 'reposts', 'quotes', 'エンゲージ率(%)', '投稿ID']);
    metricsSheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    metricsSheet.setColumnWidth(2, 320);
  }

  const now    = new Date();
  const cutoff = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const data   = queueSheet.getDataRange().getValues();

  const existingIds = new Set();
  if (metricsSheet.getLastRow() > 1) {
    metricsSheet.getRange(2, 9, metricsSheet.getLastRow() - 1, 1).getValues().forEach(r => { if (r[0]) existingIds.add(String(r[0])); });
  }

  for (const row of data.slice(1)) {
    const [scheduledTime, text, status, postId] = row;
    if (status !== '投稿済み' || !postId) continue;
    if (new Date(scheduledTime) < cutoff) continue;
    if (existingIds.has(String(postId))) continue;

    try {
      const res  = UrlFetchApp.fetch(`https://graph.threads.net/v1.0/${postId}/insights?metric=views,likes,replies,reposts,quotes&access_token=${config.accessToken}`, { muteHttpExceptions: true });
      const json = JSON.parse(res.getContentText());
      if (!json.data) continue;

      const m = {};
      json.data.forEach(item => { m[item.name] = item.total_value ? item.total_value.value : (item.values && item.values[0] ? item.values[0].value : 0); });

      const views   = m.views   || 0;
      const likes   = m.likes   || 0;
      const replies = m.replies || 0;
      const reposts = m.reposts || 0;
      const quotes  = m.quotes  || 0;
      const engRate = views > 0 ? ((likes + replies + reposts) / views * 100).toFixed(2) : '0.00';

      metricsSheet.appendRow([scheduledTime, text.substring(0, 50), views, likes, replies, reposts, quotes, engRate, postId]);
      Utilities.sleep(500);
    } catch (e) {
      Logger.log(`❌ ID:${postId} エラー: ${e.message}`);
    }
  }
  Logger.log('メトリクス取得完了');
}

// ============================================================
// トリガー設定
// ============================================================
function setupTriggers() {
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('runScheduledPosts').timeBased().atHour(9).everyDays(1).create();
  ScriptApp.newTrigger('runScheduledPosts').timeBased().atHour(21).everyDays(1).create();
  ScriptApp.newTrigger('generateWeeklyPosts').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  ScriptApp.newTrigger('fetchWeeklyMetrics').timeBased().onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(22).create();
  ScriptApp.newTrigger('refreshLongLivedToken').timeBased().onMonthDay(1).atHour(3).create();

  Logger.log('✅ トリガー設定完了（9時・21時投稿 / 月曜8時生成）');
}

// ============================================================
// スプシのステータス列にプルダウンを設定
// ============================================================
function setupStatusDropdown() {
  const config = getConfig();
  const ss     = SpreadsheetApp.openById(config.spreadsheetId);
  const sheet  = ss.getSheetByName('投稿キュー');
  if (!sheet || sheet.getLastRow() < 2) return;

  const lastRow = sheet.getLastRow();
  const range   = sheet.getRange(2, 3, lastRow - 1, 1); // C列（ステータス）2行目以降

  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['待機中', '承認済み', 'スキップ', '投稿済み'], true)
    .setAllowInvalid(false)
    .build();

  range.setDataValidation(rule);
  Logger.log('✅ プルダウン設定完了');
}

// ============================================================
// ユーザーID確認（初回セットアップ時に実行）
// ============================================================
function getMyUserId() {
  const config = getConfig();
  const res = UrlFetchApp.fetch(`https://graph.threads.net/v1.0/me?fields=id,username&access_token=${config.accessToken}`, { muteHttpExceptions: true });
  Logger.log(res.getContentText());
}

// ============================================================
// テスト投稿（手動実行用）
// ============================================================
function testPost() {
  const testText = 'テスト投稿です🐾\nANELLA CAFE 大分店の自動投稿システムが動いています！';
  const postId   = postToThreads_(testText);
  Logger.log('✅ テスト投稿完了 ID: ' + postId);
}
