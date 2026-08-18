// ============================================================
// don__wd Note自動執筆システム v3.0 スプレッドシート版
// アカウント: @don__wd（しょうこ）卒花嫁・先輩花嫁
// 2日に1回、Claude AIがnote記事を自動生成してスプレッドシートに保存
// ============================================================
//
// 【スクリプトプロパティ設定項目】
//   CLAUDE_API_KEY    - Claude APIキー
//   NOTE_SHEET_ID     - 記事保存先スプレッドシートID
//   DISCORD_WEBHOOK   - Discord通知用URL（任意）
//   ARTICLE_INDEX     - （自動更新）テーマインデックス
//
// 【セットアップ手順】
//   1. スクリプトプロパティを設定
//   2. createNoteSheet() で記事用スプレッドシート作成
//   3. testGenerateNote() で記事生成テスト
//   4. setupNoteTrigger() で2日おき自動実行スタート
// ============================================================

const CLAUDE_MODEL = 'claude-sonnet-4-6';

// ============================================================
// システムプロンプト（ナレッジ完全組み込み）
// ============================================================
const SYSTEM_PROMPT = `あなたは卒花嫁・先輩花嫁「しょうこ（@don__wd）」として、
プレ花嫁向けnote記事を執筆します。

## アカウント概要
- ポジション：卒花嫁・先輩花嫁
- ターゲット：婚約〜結婚式まで1年以内のプレ花嫁
- 読者の悩み：費用が高い／後悔したくない／失敗したくない／
  見積もりが上がるのが怖い／何から準備すればいいか分からない

## 最重要原則
noteはノウハウ販売ではなく「卒花の本音」を売る。
情報ではなく体験談。チェックリストだけでは売れない。感情が必要。

プレ花嫁が買う理由は「節約したい」ではない。
「失敗したくない」である。これが全ての根本。

## 絶対NG
- 第1章/第2章/第3章という章立て
- 「この章で学べること」「読者メリット」「まとめ」「結論」というビジネス記事構成
- **太字**の多用
- �条書き連発
- です・ますの機械的な連続

## 文章の書き方
「説明しない、語る」

悪い例：ウェルカムスペースは不要でした。

良い例：
準備中の私はPinterestばかり見ていました。
おしゃれなミラー。ドライフラワー。キャンドル。
気づけば参考画像が何十枚も保存されていました。
でも結婚式が終わってみると、
友達からウェルカムスペースの話をされたことはほとんどありませんでした。

必ず「当時どう思ったか → なぜそうしたか → 何が起きたか → 今どう思うか」で書く。

## 推奨記事構成
タイトル → はじめに → 体験談 → 後悔 → 気づき →
読者へのメッセージ → 有料導線 → 有料パート → プレ花嫁の私へ伝えたいこと

## 有料導線ルール
NG：「続きは有料です」「気になる人は購入してください」

OK例：
ここまで読んで「じゃあ私は何を削ればいいの？」と思った方もいるかもしれません。
実は私が本当に伝えたいのは、削ったものではなく残したものです。
ここからは実際にお金をかけて良かったものを紹介します。

## 強いテーマ優先順位
①後悔 ②節約 ③知らないと損 ④卒花の本音 ⑤DIY ⑥テンプレート

## 強いワード
知らないと損 / プランナーさんが教えてくれない / 卒花の本音 /
後悔 / 節約 / 保存版 / 永久保存版 / 〇選 / 〇ステップ`;

// ============================================================
// テーマリスト（優先度順・シリーズ設計）
// ============================================================
const ARTICLE_THEMES = [
  // ① 後悔系（最強）
  { title: '卒花の私が今でも後悔していること20選', type: '後悔談', price: 500, minChars: 8000 },
  { title: 'ドレス選びで後悔したこと、全部話します', type: '後悔談', price: 300, minChars: 4000 },
  { title: '式場選びで絶対やっておけばよかった5つのこと', type: '後悔談', price: 300, minChars: 4000 },
  { title: 'しなくてよかったこと15選【卒花の本音】', type: '後悔談', price: 500, minChars: 8000 },
  { title: 'プランナーさんに最初から伝えておけばよかったこと', type: '後悔談', price: 300, minChars: 4000 },
  // ② 節約系
  { title: 'お金をかけなくてよかったこと15選', type: '節約', price: 500, minChars: 8000 },
  { title: 'プランナーさんが教えてくれない節約術', type: '節約', price: 500, minChars: 8000 },
  { title: '見積もりが上がるポイント全部公開', type: '節約', price: 500, minChars: 8000 },
  { title: '結婚式の費用を100万円削った具体的な方法', type: '節約', price: 980, minChars: 10000 },
  // ③ 知らないと損系
  { title: '式場スタッフが教えてくれない裏話10選', type: '知識', price: 500, minChars: 8000 },
  { title: 'ブライダルフェアで値引きに成功した話', type: '知識', price: 500, minChars: 8000 },
  { title: 'ドレスショップで知らないと損すること', type: '知識', price: 300, minChars: 4000 },
  // ④ 感情エッセイ系
  { title: '結婚式前夜、花嫁がひとりで泣いた話', type: 'エッセイ', price: 0, minChars: 3000 },
  { title: 'ウエディングハイってこういうことか、と気づいた話', type: 'エッセイ', price: 0, minChars: 3000 },
  { title: '結婚式当日のリアル。感動より先に来たもの', type: 'エッセイ', price: 0, minChars: 3000 },
  { title: '式後しばらく虚無感があった話。ポスト婚式ブルーについて', type: 'エッセイ', price: 0, minChars: 3000 },
];

// ============================================================
// メイン実行（2日おきのトリガーで呼び出される）
// ============================================================
function generateNoteArticle() {
  try {
    const props = PropertiesService.getScriptProperties();
    let idx = parseInt(props.getProperty('ARTICLE_INDEX') || '0');
    const theme = ARTICLE_THEMES[idx % ARTICLE_THEMES.length];

    Logger.log(`📝 テーマ: ${theme.title}（${theme.type}）`);

    // STEP1: 目次生成
    Logger.log('STEP1: 目次生成中...');
    const toc = generateTableOfContents(theme);
    Logger.log('目次生成完了');

    // STEP2: 本文生成
    Logger.log('STEP2: 本文生成中...');
    const article = generateFullArticle(theme, toc);
    Logger.log(`本文生成完了: ${article.body.length}文字`);

    // STEP3: スプレッドシートに保存
    Logger.log('STEP3: スプレッドシートに保存中...');
    const rowNum = saveToSpreadsheet(article.title, article.body, article.tags, theme);
    Logger.log(`保存完了: ${rowNum}行目`);

    // インデックス更新
    props.setProperty('ARTICLE_INDEX', String(idx + 1));

    // Discord通知
    const webhook = props.getProperty('DISCORD_WEBHOOK');
    if (webhook) {
      notifyDiscord(webhook, article.title, theme.type, theme.price, article.body.length, rowNum);
    }

    Logger.log(`✅ 完了！「${article.title}」をスプレッドシートに保存しました`);
    return { title: article.title, chars: article.body.length, row: rowNum };

  } catch (e) {
    Logger.log('❌ エラー: ' + e.message + '\n' + e.stack);
    const webhook = PropertiesService.getScriptProperties().getProperty('DISCORD_WEBHOOK');
    if (webhook) {
      notifyDiscord(webhook, 'エラー: ' + e.message, 'ERROR', 0, 0, 0);
    }
    throw e;
  }
}

// ============================================================
// STEP1: 目次生成
// ============================================================
function generateTableOfContents(theme) {
  const isFree = theme.price === 0;
  const chapterStructure = isFree
    ? '4〜5章構成（全て無料）'
    : '6章構成（無料4章 + 有料2章）';

  const prompt = `以下のテーマでnote記事の目次を生成してください。

【記事タイトル】${theme.title}
【テーマ種別】${theme.type}
【価格】${theme.price === 0 ? '無料' : theme.price + '円'}
【文字数目安】${theme.minChars.toLocaleString()}〜${Math.floor(theme.minChars * 1.3).toLocaleString()}文字
【構成】${chapterStructure}

【出力形式】
===TITLE===
（最終タイトル1案。読みたくなるもの）

===TOC===
（章立て。各章タイトルと「この章で得られること1行」を記載。${isFree ? '' : '有料パートは「▼ここから有料パート」で区切る'}）

===INTRO===
（記事導入文 150文字以内。読者の悩みに強く共感し、この記事で解決できる未来を示す）`;

  return callClaude(SYSTEM_PROMPT, prompt, 2000);
}

// ============================================================
// STEP2: 目次をベースに全文生成
// ============================================================
function generateFullArticle(theme, toc) {
  const isFree = theme.price === 0;
  const paidNote = isFree ? '' : `
【有料パートについて】
- 無料パートの最後で「ここからが本番」と感じさせる自然な有料導線を入れる
- 有料パートはより具体的な手順・数字・実体験を盛り込む
- 価格は${theme.price}円なので、その価値を感じさせる濃さで書く`;

  const prompt = `以下の目次をベースに、note記事の本文を全て書いてください。

【目次・構成】
${toc}

【執筆ルール】
- 必ず${theme.minChars.toLocaleString()}文字以上書く（重要）
- 「説明しない、語る」スタイルで書く
- 「当時どう思ったか → なぜそうしたか → 何が起きたか → 今どう思うか」の流れを意識
- 段落は短め（3〜4行で改行）
- 太字は最小限。箇条書きは必要な時だけ
- 読んでいて感情が動く文章にする${paidNote}

【出力形式】
===TITLE===
（タイトル）

===BODY===
（本文全体。Markdown使用可。ただし###見出しは使わず、章タイトルは太字1行で区切る程度に留める）

===TAGS===
プレ花嫁,結婚式,（テーマに合うタグ5〜8個をカンマ区切り）`;

  const text = callClaude(SYSTEM_PROMPT, prompt, 12000);

  // パース
  const titleMatch = text.match(/===TITLE===\s*\n([\s\S]*?)===BODY===/);
  const bodyMatch = text.match(/===BODY===\s*\n([\s\S]*?)===TAGS===/);
  const tagsMatch = text.match(/===TAGS===\s*\n([\s\S]*)$/);

  const title = titleMatch ? titleMatch[1].trim() : theme.title;
  const body = bodyMatch ? bodyMatch[1].trim() : text;
  const tags = tagsMatch
    ? tagsMatch[1].trim().split(',').map(t => t.trim().replace(/^#/, '')).filter(t => t)
    : ['プレ花嫁', '結婚式', '卒花'];

  Logger.log(`文字数: ${body.length}文字`);
  if (body.length < theme.minChars * 0.8) {
    Logger.log('⚠️ 文字数不足。追加生成するっちゃ...');
    return extendArticle(theme, title, body, tags);
  }

  return { title, body, tags };
}

// ============================================================
// 文字数不足時の追加生成
// ============================================================
function extendArticle(theme, title, body, tags) {
  const needed = theme.minChars - body.length;
  const prompt = `以下のnote記事の続きを${needed}文字以上追加してください。
自然につながるよう、最後の段落から続きとして書いてください。

【現在の本文末尾】
${body.slice(-500)}

===CONTINUE===
（追加分のみ出力）`;

  const addition = callClaude(SYSTEM_PROMPT, prompt, 6000);
  const contMatch = addition.match(/===CONTINUE===\s*\n([\s\S]*)/);
  const addText = contMatch ? contMatch[1].trim() : addition;
  return { title, body: body + '\n\n' + addText, tags };
}

// ============================================================
// Claude API呼び出し
// ============================================================
function callClaude(system, userMessage, maxTokens = 4000) {
  const claudeKey = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!claudeKey) throw new Error('CLAUDE_API_KEY が設定されとらんっちゃ');

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': claudeKey,
      'anthropic-version': '2023-06-01',
    },
    payload: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: userMessage }]
    }),
    muteHttpExceptions: true,
  });

  const data = JSON.parse(response.getContentText());
  if (data.error) throw new Error('Claude API: ' + data.error.message);
  return data.content[0].text;
}

// ============================================================
// STEP3: スプレッドシートに保存
// ============================================================
function saveToSpreadsheet(title, body, tags, theme) {
  const props = PropertiesService.getScriptProperties();
  const sheetId = props.getProperty('NOTE_SHEET_ID');
  if (!sheetId) throw new Error('NOTE_SHEET_ID が設定されとらんっちゃ');

  const ss = SpreadsheetApp.openById(sheetId);
  let sheet = ss.getSheetByName('記事');

  // シートなければ作成
  if (!sheet) {
    sheet = ss.insertSheet('記事', 0);
    sheet.appendRow([
      '公開日',
      'タイトル',
      '本文',
      'タグ',
      'テーマ',
      '価格',
      '文字数',
      '状態',
      '作成日時'
    ]);
  }

  // データ追加
  const rowNum = sheet.getLastRow() + 1;
  sheet.appendRow([
    '',  // 公開日（後で手動入力）
    title,
    body,
    tags.join('、'),
    theme.type,
    theme.price === 0 ? '無料' : theme.price + '円',
    body.length,
    '下書き中',
    new Date()
  ]);

  return rowNum;
}

// ============================================================
// Discord通知
// ============================================================
function notifyDiscord(webhookUrl, title, type, price, chars, rowNum) {
  const priceStr = price === 0 ? '無料' : `${price}円`;
  const message = {
    content: [
      '📝 **note記事が自動生成されました！**',
      '',
      `**タイトル**: ${title}`,
      `**種別**: ${type}　**価格**: ${priceStr}　**文字数**: ${chars.toLocaleString()}文字`,
      `**保存位置**: スプレッドシート ${rowNum}行目`,
      '',
      'スプレッドシートで確認して、noteにコピペしてくださいっちゃ🌸'
    ].filter(l => l !== null).join('\n')
  };
  UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(message),
    muteHttpExceptions: true,
  });
}

// ============================================================
// スプレッドシート作成
// ============================================================
function createNoteSheet() {
  const ss = SpreadsheetApp.create('don__wd note 記事管理');
  const sheetId = ss.getId();

  // プロパティに保存
  PropertiesService.getScriptProperties().setProperty('NOTE_SHEET_ID', sheetId);

  Logger.log('✅ スプレッドシート作成完了！');
  Logger.log('URL: ' + ss.getUrl());
  Logger.log('ID: ' + sheetId);
  Logger.log('↑ このIDをスクリプトプロパティ NOTE_SHEET_ID に設定してください（自動済み）');
}

// ============================================================
// トリガー設定
// ============================================================
function setupNoteTrigger() {
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'generateNoteArticle') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('generateNoteArticle').timeBased().everyDays(2).atHour(10).create();
  Logger.log('✅ トリガー設定完了！2日おき10時に自動執筆するっちゃ');
}

// ============================================================
// テスト用関数
// ============================================================
function testGenerateNote() {
  Logger.log('=== テスト実行開始っちゃ ===');
  const result = generateNoteArticle();
  Logger.log('=== 完了！' + JSON.stringify(result));
}

// 特定テーマで即テスト
function testSpecificTheme() {
  const theme = ARTICLE_THEMES[0]; // 「後悔20選」
  Logger.log('テーマ: ' + theme.title);
  const toc = generateTableOfContents(theme);
  Logger.log('目次:\n' + toc.slice(0, 300));
  const article = generateFullArticle(theme, toc);
  Logger.log('タイトル: ' + article.title);
  Logger.log('文字数: ' + article.body.length);
  Logger.log('本文（先頭300文字）:\n' + article.body.slice(0, 300));
}
