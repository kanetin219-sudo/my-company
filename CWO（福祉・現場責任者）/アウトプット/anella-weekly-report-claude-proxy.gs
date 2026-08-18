// アネラカフェ週報生成 - Claude API プロキシ
// Google Apps Script で使用
//
// セットアップ手順：
// 1. https://script.google.com を開く
// 2. 「新規プロジェクト」を作成
// 3. このコード全体をコピー＆ペースト
// 4. 「デプロイ」→「新しいデプロイ」→「タイプ: ウェブアプリ」
// 5. 「実行形式」: 現在のユーザーとして実行
// 6. 「アクセス権限」: 全員
// 7. デプロイして、Web App URL をコピー
// 8. weekly-report.html の設定画面に URL を貼り付け

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const { images, prompt, apiKey } = data;

    if (!apiKey) {
      return sendResponse({ error: "API key is required" }, 401);
    }

    if (!images || images.length === 0) {
      return sendResponse({ error: "At least one image is required" }, 400);
    }

    // Claude API に画像を送信
    const imageContents = images.map(base64 => ({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/jpeg",
        data: base64
      }
    }));

    const payload = {
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          ...imageContents,
          { type: "text", text: prompt }
        ]
      }]
    };

    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch("https://api.anthropic.com/v1/messages", options);
    const responseCode = response.getResponseCode();

    if (responseCode !== 200) {
      const error = JSON.parse(response.getContentText());
      return sendResponse(
        { error: error.error?.message || "Claude API error" },
        responseCode
      );
    }

    const result = JSON.parse(response.getContentText());
    const text = result.content[0].text;

    // JSON を抽出
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return sendResponse(
        { error: "Failed to parse JSON from Claude response" },
        400
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return sendResponse(parsed, 200);

  } catch (error) {
    Logger.log(error);
    return sendResponse(
      { error: error.toString() },
      500
    );
  }
}

function sendResponse(data, code) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
