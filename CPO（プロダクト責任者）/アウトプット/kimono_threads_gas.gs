// ============================================
// 着物リメイク Threads台本自動生成システム
// 毎日9時にトリガー → Claude API → スプシ反映
// ============================================

const CLAUDE_API_KEY = 'YOUR_CLAUDE_API_KEY'; // 環境変数から取得推奨
const SHEET_ID = 'YOUR_SHEET_ID'; // 対象スプレッドシートID
const CLAUDE_MODEL = 'claude-opus-4-8';

// ============================================
// メイン処理：毎日9時に実行
// ============================================
function generateDailyThreadsPost() {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);

    // 1. 前日までの投稿履歴を取得（過去30日）
    const postHistory = getPost30DayHistory(ss);

    // 2. 今日の情報を取得
    const today = new Date();
    const todayInfo = {
      date: Utilities.formatDate(today, 'JST', 'yyyy-MM-dd'),
      dayOfWeek: getDayOfWeekJA(today),
      contentRatio: getContentRatio(postHistory),
      shouldIncludeCTA: (postHistory.length + 1) % 3 === 0
    };

    // 3. ブランドナレッジを取得
    const brandKnowledge = getBrandKnowledge(ss);

    // 4. Claude APIで台本生成
    const generatedPost = generatePostWithClaude(
      postHistory,
      todayInfo,
      brandKnowledge
    );

    // 5. 品質チェック
    const qualityCheck = runQualityCheck(generatedPost, brandKnowledge);

    if (!qualityCheck.passed) {
      Logger.log('品質チェック不合格: ' + qualityCheck.failures.join(', '));
      // 再度生成する（最大3回まで）
      return retryGeneration(postHistory, todayInfo, brandKnowledge, 2);
    }

    // 6. スプシに追加
    addPostToSheet(ss, generatedPost, qualityCheck);

    // 7. 完了ログ
    Logger.log('✅ ' + todayInfo.date + ' 台本生成完了');
    Logger.log('カテゴリー: ' + generatedPost.category);
    Logger.log('投稿形式: ' + generatedPost.postType);

  } catch (error) {
    Logger.log('❌ エラー: ' + error);
    sendErrorNotification(error);
  }
}

// ============================================
// 過去30日の投稿履歴を取得
// ============================================
function getPost30DayHistory(ss) {
  const historySheet = ss.getSheetByName('投稿履歴');
  const data = historySheet.getDataRange().getValues();

  // ヘッダー行をスキップ
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const filteredData = data.slice(1).filter(row => {
    const postDate = new Date(row[0]);
    return postDate >= thirtyDaysAgo;
  });

  return filteredData.map(row => ({
    date: row[0],
    category: row[1],
    theme: row[2],
    hook: row[3],
    postType: row[4]
  }));
}

// ============================================
// コンテンツ比率の計算（今日優先すべきカテゴリーを判定）
// ============================================
function getContentRatio(postHistory) {
  const categories = {
    '共感・感情系': 0,
    '憧れ・未来系': 0,
    '教育・ノウハウ系': 0,
    '権威性・ストーリー': 0,
    'オファー・導線': 0
  };

  postHistory.forEach(post => {
    if (categories.hasOwnProperty(post.category)) {
      categories[post.category]++;
    }
  });

  const total = postHistory.length || 1;
  const ratio = {};

  for (let cat in categories) {
    ratio[cat] = ((categories[cat] / total) * 100).toFixed(1);
  }

  // 不足しているカテゴリーを特定
  const target = {
    '共感・感情系': 35,
    '憧れ・未来系': 25,
    '教育・ノウハウ系': 20,
    '権威性・ストーリー': 10,
    'オファー・導線': 10
  };

  const shortage = {};
  for (let cat in target) {
    shortage[cat] = target[cat] - parseFloat(ratio[cat]);
  }

  return {
    current: ratio,
    target: target,
    shortage: shortage,
    priorityCategory: Object.keys(shortage).reduce((a, b) =>
      shortage[a] > shortage[b] ? a : b
    )
  };
}

// ============================================
// ブランドナレッジを取得
// ============================================
function getBrandKnowledge(ss) {
  const settingSheet = ss.getSheetByName('設定');
  const range = settingSheet.getDataRange().getValues();

  // JSONフォーマットで情報を取得
  return {
    brandCore: [
      '思い出', '家族', '母や祖母', '特別な一着', 'ドレス',
      '受け継ぐ', '自己実現', '誰かに喜ばれる', '思い出を未来につなぐ'
    ],
    toAvoid: [
      '節約', 'エコ', 'もったいない', '古布活用', '安さ訴求'
    ],
    hookPatterns: [
      '共感型', '意外性型', '未来型', '感情型', '教育型', 'ストーリー型'
    ],
    ctaTypes: ['弱CTA', '中CTA', '強CTA'],
    postTypes: ['通常投稿', 'ツリー式', '画像付き'],
    tone: '優しく、上品で、温かく、読者に話しかけるように'
  };
}

// ============================================
// Claude APIで台本生成
// ============================================
function generatePostWithClaude(postHistory, todayInfo, brandKnowledge) {
  const systemPrompt = buildSystemPrompt(brandKnowledge, todayInfo);
  const userPrompt = buildUserPrompt(postHistory, todayInfo, brandKnowledge);

  const payload = {
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userPrompt
      }
    ]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-api-key': CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', options);
  const result = JSON.parse(response.getContentText());

  if (result.error) {
    throw new Error('Claude API Error: ' + result.error.message);
  }

  const content = result.content[0].text;

  // JSON を抽出（{ から } までを取得）
  let jsonMatch = content.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    // マークダウンコードブロックを全て削除して再試行
    let cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  }

  if (!jsonMatch) {
    throw new Error('JSON形式の応答が見つかりません: ' + content.substring(0, 200));
  }

  // JSON を整形（改行を削除、トリム）
  let jsonStr = jsonMatch[0].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  // JSONフォーマットでパース
  const parsed = JSON.parse(jsonStr);

  return {
    date: todayInfo.date,
    dayOfWeek: todayInfo.dayOfWeek,
    category: parsed.category,
    objective: parsed.objective,
    postType: parsed.postType,
    hook: parsed.hook,
    body: parsed.body,
    treeInfo: parsed.treeInfo || 'なし',
    imageGuide: parsed.imageGuide || 'なし',
    ctaType: parsed.ctaType,
    offerPeriodFlag: parsed.offerPeriodFlag || false,
    generatedAt: Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd HH:mm:ss')
  };
}

// ============================================
// システムプロンプトの構築
// ============================================
function buildSystemPrompt(brandKnowledge, todayInfo) {
  return `あなたは「着物リメイクアーティスト養成講座」専属の
コピーライター兼SNSマーケターです。

【ブランド中心】
${brandKnowledge.brandCore.join('・')}

【避ける】
${brandKnowledge.toAvoid.join('・')}

【文章トーン】
${brandKnowledge.tone}

【Threadsアルゴリズム理解・昨頭フック7パターン例】
1. 共感型：「母の着物、捨てられないんです」「わかります、その気持ち」
2. 意外性型：「着物リメイクで人生変わるって知ってました？」
3. 未来型：「10年後、娘さんが着てくれる着物にしませんか」
4. 感情型：「思い出の着物を見るたび、胸が痛かった理由」
5. 教育型：「着物リメイクで一番大切なのは〇〇なんです」
6. ストーリー型：「祖母の着物が高級ドレスに変身した話」
7. 質問型：「あなたの着物、どうなってますか？」

スクロール停止の最高フック = 読者が「あ、これ私だ」と共感する一瞬
10時間後のコメント活動が最高効果（3.89倍エンゲージメント）

【投稿構成（必須・メルマガ構成応用）】
1. 昨頭フック（共感）：読者の心を止める1〜2行。必ず「...」で終わる（続きへの期待感）
2. シーン描写（世界観）：「母がタンスから出した着物」「帯の色褪せ」など具体的に
3. 感情・気づき：「あ、そっか」「そんなことあったんだ」という心動かし
4. 夢・憧れ：「だからこんな未来が欲しい」「こういう風になりたい」
5. 自然な導線：LINE登録（無理やり感ゼロ）

【文体・人間らしさ】
- 自然な日本語。敬語と口語体のバランスが大事
- 短文を連発する。読みやすさ優先
- 「そう」「だから」「でもね」など自然な接続詞を使う
- AIっぽい言い回し禁止：「いかがでしょうか」「～と言えるでしょう」はNG
- 絵文字は必須・かならず 1〜3 個。投稿のあちこちに自然に挿入。絵文字がないと不気味なので絶対に入れる
- 最後は「...」など自然な終わり方。機械的な「。」で終わるのは禁止

【重要ルール】
- 最終ゴール：LINE登録（講座販売ではない）
- 「思い出の着物を、自分の手で特別な一着へ生まれ変わらせたい」という憧れを育てる
- 販売投稿よりも、共感・世界観・憧れ・教育・ストーリーを優先
- LINE登録は自然な流れで、強制感なく促す
- 価格・料金は一切言及しない
- ハッシュタグは基本なし
- 説明的にならず、ストーリーで魅せる
- 読者が「私もやってみたい」と思う感情設計

出力形式は必ずJSON形式で。`;
}

// ============================================
// ユーザープロンプトの構築
// ============================================
function buildUserPrompt(postHistory, todayInfo, brandKnowledge) {
  const recentPosts = postHistory.slice(-10).map(p =>
    `${p.date}【${p.category}】${p.hook}`
  ).join('\n');

  const ctaInstruction = todayInfo.shouldIncludeCTA
    ? '【LINE登録リンク】https://utage-system.com/p/81T7Cxws6HPg\n本文の最後に「\nhttps://utage-system.com/p/81T7Cxws6HPg\nからみてみてください☺️」など、リンクを改行で区切って、URL が壊れないように誘導してください。'
    : '【CTA不要】本日はLINE誘導なし。共感と世界観構築に注力。';

  return `【今日の指示】

【日付】${todayInfo.date} (${todayInfo.dayOfWeek})

【優先カテゴリー】${todayInfo.contentRatio.priorityCategory}
（理由：現在${todayInfo.contentRatio.current[todayInfo.contentRatio.priorityCategory]}%、目標${todayInfo.contentRatio.target[todayInfo.contentRatio.priorityCategory]}%）

【直近10投稿の内容】
${recentPosts}

${ctaInstruction}

【必須条件】
- 上記10投稿との重複ゼロ（テーマ・昨頭・具体的な言い回し）
- 1〜2行でスクロール停止する（読者の「あ、これ私だ」）
- 自然な日本語。敬語と口語体のバランスが大事
- 短文連発で読みやすく
- 具体的なシーン描写：抽象的な言葉禁止
- 絵文字は必須・絶対：1〜3個を投稿のあちこちに。絵文字がないと不気味
- 感情または気づきを必ず入れる
- 同じ語尾を連続させない
- 必ず結末・憧れを含める（「だからこんな風に〜したい」など）
- 最後は「...」など自然な終わり。機械的な「。」で終わるのは禁止
- AI的言い回し禁止：「いかがでしょうか」「～と言えるでしょう」はNG

【投稿形式をランダムミックス】
今回は「${getRandomPostType()}」で作成してください。
- 通常投稿：1投稿で完結（昨頭フック→シーン→感情→夢→LINE誘導）
- ツリー式：最大3投稿まで。ランダムに1〜3投稿を選択（「投稿1/3」「投稿2/3」のように記載）
- 画像付き：画像の内容を具体的に指示

【出力JSON形式】
{
  "category": "共感・感情系",
  "objective": "投稿の狙い",
  "postType": "通常投稿|ツリー式|画像付き",
  "hook": "1〜2行（絶対スクロール止まる。必ず『...』で終わる。絵文字1個も含める）",
  "body": "投稿本文全体（絵文字1〜3個を自然に挿入）",
  "treeInfo": "ツリー式の場合は何投稿に分割するか、通常投稿は'なし'",
  "imageGuide": "画像付きの場合は具体的な画像指示、不要な場合は'なし'",
  "ctaType": "弱CTA|中CTA|強CTA"
}`;
}

// ============================================
// ランダムに投稿形式を選択（比率に基づく）
// ============================================
function getRandomPostType() {
  const rand = Math.random() * 100;
  if (rand < 50) return '通常投稿';
  if (rand < 80) return 'ツリー式';
  return '画像付き';
}

// ============================================
// 品質チェック（10項目）
// ============================================
function runQualityCheck(post, brandKnowledge) {
  const checks = [
    {
      name: '感情が動くか',
      test: () => post.body.length > 50
    },
    {
      name: '節約・もったいない訴求に偏っていないか',
      test: () => !post.body.includes('節約') && !post.body.includes('もったいない')
    },
    {
      name: '売り込み臭が強すぎないか',
      test: () => !post.body.includes('今すぐ') && !post.body.includes('限定')
    },
    {
      name: '絵文字が1〜3個含まれているか',
      test: () => {
        const emojiCount = (post.body.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
        return emojiCount >= 1 && emojiCount <= 3;
      }
    },
    {
      name: 'ブランドの上品さを壊していないか',
      test: () => !post.body.includes('！！！') && !post.body.includes('ヤバい')
    }
  ];

  const results = checks.map(check => ({
    name: check.name,
    passed: check.test()
  }));

  const passedCount = results.filter(r => r.passed).length;
  const failures = results.filter(r => !r.passed).map(r => r.name);

  return {
    passed: passedCount >= 4, // 5項目中 4つ以上で合格
    score: (passedCount / 5) * 100,
    failures: failures
  };
}

// ============================================
// 再度生成（品質チェック不合格時）
// ============================================
function retryGeneration(postHistory, todayInfo, brandKnowledge, retriesLeft) {
  if (retriesLeft <= 0) {
    throw new Error('3回の生成試行後も品質チェックに合格できませんでした');
  }

  Logger.log('再度生成試行: ' + retriesLeft);
  const generatedPost = generatePostWithClaude(postHistory, todayInfo, brandKnowledge);
  const qualityCheck = runQualityCheck(generatedPost, brandKnowledge);

  if (!qualityCheck.passed) {
    return retryGeneration(postHistory, todayInfo, brandKnowledge, retriesLeft - 1);
  }

  return { post: generatedPost, check: qualityCheck };
}

// ============================================
// スプシに追加
// ============================================
function addPostToSheet(ss, post, qualityCheck) {
  const sheet = ss.getSheetByName('台本管理');
  const newRow = [
    post.date,
    post.dayOfWeek,
    post.category,
    post.objective,
    post.postType,
    post.hook,
    post.body,
    post.treeInfo,
    post.imageGuide,
    post.ctaType,
    post.offerPeriodFlag,
    true, // 品質チェック完了
    post.generatedAt
  ];

  sheet.appendRow(newRow);

  // 投稿履歴シートにも追加
  const historySheet = ss.getSheetByName('投稿履歴');
  historySheet.appendRow([
    post.date,
    post.category,
    post.objective,
    post.hook,
    post.postType
  ]);
}

// ============================================
// 曜日を日本語で取得
// ============================================
function getDayOfWeekJA(date) {
  const days = ['日', '月', '火', '水', '木', '金', '土'];
  return days[date.getDay()];
}

// ============================================
// エラー通知
// ============================================
function sendErrorNotification(error) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const errorSheet = ss.getSheetByName('エラーログ') || ss.insertSheet('エラーログ');
  errorSheet.appendRow([
    Utilities.formatDate(new Date(), 'JST', 'yyyy-MM-dd HH:mm:ss'),
    error.toString()
  ]);
}

// ============================================
// トリガー設定用（初回のみ手動実行）
// ============================================
function setupDailyTrigger() {
  // 既存トリガーを削除
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'generateDailyThreadsPost') {
      ScriptApp.deleteTrigger(trigger);
    }
  });

  // 毎日9時に実行するトリガーを設定
  ScriptApp.newTrigger('generateDailyThreadsPost')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();

  Logger.log('✅ 毎日9時のトリガーを設定しました');
}