// ============================================================
// アネラカフェ 請求書自動読み取り → 収支表Supabase更新
// 対象: アネラグループ(ロイヤリティ・物販・システム利用料)
//       ジョイント(利用者食事代)
// 実行: 毎月21日 9時 に時間ベーストリガーで実行
// ============================================================

const SUPABASE_URL = 'https://abeekodehorlwsmnhoza.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZWVrb2RlaG9ybHdzbW5ob3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzAzMTksImV4cCI6MjA5Mjc0NjMxOX0.ZgOB2TUuBBRNV8pejae_UOX9kXIiFb-CS7X0alRX1uU';

// メール送信元
const SENDER_ANELLA = 'seikyu@anella-group.co.jp';
const SENDER_JOINT  = 'seikyuusyo@food-joint.com';

// アネラグループ PDF名キーワード → Supabaseカラム名
// ※ システム利用料の行き先は SYSTEM_COLUMN を確認・変更してください
const SYSTEM_COLUMN = null; // 例: 'smaregi' など。不要なら null のまま
const PDF_COLUMN_MAP = {
  'ロイヤリティ': 'royalty',
  '物販':         'butsuhan_shiire',
  'システム利用料': SYSTEM_COLUMN,
};

// ============================================================
// メイン: トリガーから呼ぶ関数
// ============================================================
function checkInvoiceEmails() {
  processAnellaGroupInvoices();
  processJointInvoices();
}

// ============================================================
// アネラグループ処理
// ============================================================
function processAnellaGroupInvoices() {
  var query = 'from:' + SENDER_ANELLA + ' subject:請求書 is:unread newer_than:14d';
  var threads = GmailApp.search(query);

  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(message) {
      if (!message.isUnread()) return;

      var yearMonth = dateToYearMonth(message.getDate());
      var updates = {};

      message.getAttachments().forEach(function(att) {
        if (att.getContentType() !== 'application/pdf') return;
        var filename = att.getName();
        var column = getColumnByFilename(filename);
        if (!column) {
          Logger.log('⚠️ マッピング未定義: ' + filename);
          return;
        }
        var amount = extractTotalFromPdf(att);
        if (amount !== null) {
          updates[column] = amount;
          Logger.log('✅ ' + filename + ' → ' + column + ' = ' + amount);
        } else {
          Logger.log('❌ 金額取得失敗: ' + filename);
        }
      });

      if (Object.keys(updates).length > 0) {
        upsertSupabase(yearMonth, updates);
        message.markRead();
        Logger.log('Supabase更新完了 (' + yearMonth + '): ' + JSON.stringify(updates));
      }
    });
  });
}

// ============================================================
// ジョイント処理
// ============================================================
function processJointInvoices() {
  var query = 'from:' + SENDER_JOINT + ' subject:請求書 is:unread newer_than:14d';
  var threads = GmailApp.search(query);

  threads.forEach(function(thread) {
    thread.getMessages().forEach(function(message) {
      if (!message.isUnread()) return;

      var yearMonth = dateToYearMonth(message.getDate());
      var updates = {};

      message.getAttachments().forEach(function(att) {
        if (att.getContentType() !== 'application/pdf') return;
        var amount = extractTotalFromPdf(att);
        if (amount !== null) {
          updates['riyosha_shokuhi'] = amount;
          Logger.log('✅ ジョイント請求書 → riyosha_shokuhi = ' + amount);
        } else {
          Logger.log('❌ ジョイント金額取得失敗: ' + att.getName());
        }
      });

      if (Object.keys(updates).length > 0) {
        upsertSupabase(yearMonth, updates);
        message.markRead();
        Logger.log('Supabase更新完了 (' + yearMonth + '): ' + JSON.stringify(updates));
      }
    });
  });
}

// ============================================================
// PDF → テキスト → 金額抽出
// ============================================================
function extractTotalFromPdf(attachment) {
  var fileId = null;
  try {
    var blob = attachment.copyBlob();
    blob.setContentType('application/pdf');

    // DriveにGoogle Doc形式でアップロード (PDF→テキスト自動変換)
    var resource = {
      title: 'tmp_invoice_' + new Date().getTime(),
      mimeType: 'application/vnd.google-apps.document'
    };
    var file = Drive.Files.insert(resource, blob, { convert: true, ocr: true, ocrLanguage: 'ja' });
    fileId = file.id;

    Utilities.sleep(3000); // 変換待機

    var doc = DocumentApp.openById(fileId);
    var text = doc.getBody().getText();
    Logger.log('PDFテキスト(先頭300文字): ' + text.substring(0, 300));

    return parseTotalAmount(text);

  } catch (e) {
    Logger.log('PDF処理エラー: ' + e.message);
    return null;
  } finally {
    if (fileId) {
      try { Drive.Files.trash(fileId); } catch (e2) {}
    }
  }
}

// ============================================================
// テキストから合計金額を抽出
// ============================================================
function parseTotalAmount(text) {
  // 優先順位の高い順にパターンマッチ
  var patterns = [
    /ご請求金額[^\d￥¥]*([0-9,]+)/,
    /請求金額[^\d￥¥]*([0-9,]+)/,
    /合計金額[^\d￥¥]*([0-9,]+)/,
    /税込[^\d￥¥]*([0-9,]+)/,
    /お支払合計[^\d￥¥]*([0-9,]+)/,
    /合計[^\d￥¥]*([0-9,]+)/,
  ];

  for (var i = 0; i < patterns.length; i++) {
    var match = text.match(patterns[i]);
    if (match) {
      var amount = parseInt(match[1].replace(/,/g, ''), 10);
      if (amount >= 100) return amount;
    }
  }

  // フォールバック: 3桁以上の数字を全部抽出して最大値（合計が一番大きいことが多い）
  var amounts = [];
  var re = /([0-9]{1,3}(?:,[0-9]{3})+)/g;
  var m;
  while ((m = re.exec(text)) !== null) {
    amounts.push(parseInt(m[1].replace(/,/g, ''), 10));
  }
  if (amounts.length > 0) {
    return Math.max.apply(null, amounts);
  }

  return null;
}

// ============================================================
// ヘルパー関数
// ============================================================
function dateToYearMonth(date) {
  var y = date.getFullYear();
  var m = String(date.getMonth() + 1).padStart(2, '0');
  return y + '-' + m;
}

function getColumnByFilename(filename) {
  for (var keyword in PDF_COLUMN_MAP) {
    if (filename.indexOf(keyword) !== -1) {
      return PDF_COLUMN_MAP[keyword];
    }
  }
  return null;
}

function upsertSupabase(yearMonth, updates) {
  var url = SUPABASE_URL + '/rest/v1/anella_monthly_finance';
  var headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
    'Prefer': 'resolution=merge-duplicates,return=minimal'
  };

  updates.year_month = yearMonth;
  updates.updated_at = new Date().toISOString();

  var response = UrlFetchApp.fetch(url, {
    method: 'POST',
    headers: headers,
    payload: JSON.stringify(updates),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code !== 200 && code !== 201 && code !== 204) {
    Logger.log('Supabase失敗 (' + code + '): ' + response.getContentText());
  }
}

// ============================================================
// トリガー設定: この関数を一度だけ手動実行してください
// ============================================================
function setupTrigger() {
  // 既存トリガー削除
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'checkInvoiceEmails') {
      ScriptApp.deleteTrigger(t);
    }
  });

  // 毎月21日 09:00 に実行
  ScriptApp.newTrigger('checkInvoiceEmails')
    .timeBased()
    .onMonthDay(21)
    .atHour(9)
    .create();

  Logger.log('トリガー設定完了: 毎月21日9時に実行します');
}
