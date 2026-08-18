// うちの子再現アーティスト養成講座 エントリーコース（3ヶ月）管理システム
// スプレッドシートID: 1j5cNbXt9Oz2B8OwI8XX7N7mVfEyba-KI2UPrcSXkqrI

// ★ 初回のみ実行：管理列を追加する
function addManagementColumns() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0]; // フォームの回答 1

  // A列の後ろに5列挿入
  sheet.insertColumnsAfter(1, 5);

  // ヘッダー設定
  sheet.getRange('B1').setValue('満了日');
  sheet.getRange('C1').setValue('残り日数');
  sheet.getRange('D1').setValue('継続の有無');
  sheet.getRange('E1').setValue('決済方法');
  sheet.getRange('F1').setValue('継続の期日');

  // 数式設定（ARRAYFORMULA）
  sheet.getRange('B2').setFormula('=ARRAYFORMULA(IF(A2:A="","",EDATE(A2:A,3)))');
  sheet.getRange('C2').setFormula('=ARRAYFORMULA(IF(B2:B="","",B2:B-TODAY()))');

  // 継続の有無ドロップダウン
  var dvD = SpreadsheetApp.newDataValidation()
    .requireValueInList(['継続', '退会', '検討中', '未定'], true)
    .build();
  sheet.getRange('D2:D1000').setDataValidation(dvD);

  // 決済方法ドロップダウン
  var dvE = SpreadsheetApp.newDataValidation()
    .requireValueInList(['銀行振込', 'カード決済'], true)
    .build();
  sheet.getRange('E2:E1000').setDataValidation(dvE);

  // 日付形式を設定
  sheet.getRange('B:B').setNumberFormat('yyyy/mm/dd');
  sheet.getRange('F:F').setNumberFormat('yyyy/mm/dd');

  applyColors();
  Logger.log('管理列の追加完了っちゃ！');
}

// ★ 色がズレた時に再適用
function applyColors() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  var lastCol = sheet.getLastColumn();

  // 全列ヘッダー: 紫
  sheet.getRange(1, 1, 1, lastCol)
    .setBackground('#7030a0')
    .setFontColor('#ffffff')
    .setFontWeight('bold');

  // B〜F列ヘッダー: オレンジ上書き
  sheet.getRange(1, 2, 1, 5)
    .setBackground('#ff9900')
    .setFontColor('#ffffff')
    .setFontWeight('bold');
}

// ★ 期日チェック・メール通知（毎日9時自動実行）
function checkExpiryAndNotify() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) return;

  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var alertMessages = [];

  for (var i = 2; i <= lastRow; i++) {
    var timestamp = sheet.getRange(i, 1).getValue(); // A列: タイムスタンプ
    if (!timestamp) continue;

    var continuationStatus = sheet.getRange(i, 4).getValue(); // D列: 継続の有無
    if (continuationStatus === '退会') continue;

    var expiryDate = sheet.getRange(i, 2).getValue();   // B列: 満了日
    var continuationDate = sheet.getRange(i, 6).getValue(); // F列: 継続の期日

    // 継続の期日があればそちらを優先
    var checkDate = (continuationDate instanceof Date && !isNaN(continuationDate))
                    ? continuationDate : expiryDate;
    if (!checkDate || !(checkDate instanceof Date)) continue;

    checkDate.setHours(0, 0, 0, 0);
    var daysLeft = Math.ceil((checkDate - today) / (1000 * 60 * 60 * 24));

    if (daysLeft >= 0 && daysLeft <= 14) {
      var name = sheet.getRange(i, 7).getValue(); // G列: お名前（管理列挿入後）
      alertMessages.push(name + ' さん: あと' + daysLeft + '日（' + Utilities.formatDate(checkDate, 'Asia/Tokyo', 'yyyy/MM/dd') + '）');
    }
  }

  if (alertMessages.length > 0) {
    var subject = '【うちの子再現 エントリーコース】受講期日が近い受講生がいます';
    var body = '以下の受講生の受講期日が14日以内です。\n\n' + alertMessages.join('\n') + '\n\nご確認をお願いします。';
    MailApp.sendEmail({
      to: 'kbbk0718@gmail.com',
      cc: 'mio0513@icloud.com',
      subject: subject,
      body: body
    });
  }
}

// ★ C列フォーマット修正（残り日数が日付表示になった時に実行）
function fixColumnFormat() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheets()[0];
  sheet.getRange('C:C').setNumberFormat('0');
  Logger.log('C列フォーマット修正完了っちゃ！');
}

// ★ 日次トリガー設定（初回のみ実行）
function setDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === 'checkExpiryAndNotify') {
      ScriptApp.deleteTrigger(t);
    }
  });

  ScriptApp.newTrigger('checkExpiryAndNotify')
    .timeBased()
    .atHour(9)
    .everyDays(1)
    .inTimezone('Asia/Tokyo')
    .create();

  Logger.log('日次トリガーをセット完了っちゃ！毎日9時に自動実行されるっちゃ。');
}
