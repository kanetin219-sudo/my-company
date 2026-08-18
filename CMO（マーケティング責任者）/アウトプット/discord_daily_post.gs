// Discord 毎日12時自動投稿スクリプト
// 作成日: 2026-06-08

var WEBHOOK_URL = 'https://ancient-rice-0887.kanetin219.workers.dev/';

function postToDiscord() {
  var now = new Date();
  var dateStr = Utilities.formatDate(now, 'Asia/Tokyo', 'M月d日');
  var message = 'かねちん' + dateStr + '投稿しました！';

  var payload = JSON.stringify({
    content: message,
    username: 'かねちん',
    avatar_url: 'https://i.imgur.com/6YgwEPB.jpeg'
  });

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: payload
  };

  UrlFetchApp.fetch(WEBHOOK_URL, options);
}

// ▼ トリガー設定用関数（初回1回だけ実行する）
function setDailyTrigger() {
  // 既存のトリガーを削除
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'postToDiscord') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 毎日12時のトリガーを設定
  ScriptApp.newTrigger('postToDiscord')
    .timeBased()
    .everyDays(1)
    .atHour(12)
    .create();

  Logger.log('トリガー設定完了！毎日12時に投稿されるっちゃ');
}
