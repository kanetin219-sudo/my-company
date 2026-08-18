


// ── リマインドメール ──────────────────────────────

function sendReminder1() {
  var tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  var targetDate = Utilities.formatDate(tomorrow, 'Asia/Tokyo', 'yyyy-MM-dd');

  var url = 'https://abeekodehorlwsmnhoza.supabase.co/rest/v1/trimming_reservations';
  var query = '?visit_date=eq.' + targetDate + '&status=eq.予約済み&reminder1_sent=eq.false&select=id,*';

  var response = UrlFetchApp.fetch(url + query, {
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZWVrb2RlaG9ybHdzbW5ob3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzAzMTksImV4cCI6MjA5Mjc0NjMxOX0.ZgOB2TUuBBRNV8pejae_UOX9kXIiFb-CS7X0alRX1uU',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZWVrb2RlaG9ybHdzbW5ob3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzAzMTksImV4cCI6MjA5Mjc0NjMxOX0.ZgOB2TUuBBRNV8pejae_UOX9kXIiFb-CS7X0alRX1uU'
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() === 200) {
    var data = JSON.parse(response.getContentText());
    Logger.log('Reminder1 対象: ' + data.length + '件 (' + targetDate + ')');
    data.forEach(function(r) {
      if (r.email) {
        sendReminderEmail(r, '明日');
        updateReminderFlag(r.id, 'reminder1_sent');
      }
    });
  }
}

function sendReminder2() {
  var today = new Date();
  var targetDate = Utilities.formatDate(today, 'Asia/Tokyo', 'yyyy-MM-dd');

  var url = 'https://abeekodehorlwsmnhoza.supabase.co/rest/v1/trimming_reservations';
  var query = '?visit_date=eq.' + targetDate + '&status=eq.予約済み&reminder2_sent=eq.false&select=id,*';

  var response = UrlFetchApp.fetch(url + query, {
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZWVrb2RlaG9ybHdzbW5ob3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzAzMTksImV4cCI6MjA5Mjc0NjMxOX0.ZgOB2TUuBBRNV8pejae_UOX9kXIiFb-CS7X0alRX1uU',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZWVrb2RlaG9ybHdzbW5ob3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzAzMTksImV4cCI6MjA5Mjc0NjMxOX0.ZgOB2TUuBBRNV8pejae_UOX9kXIiFb-CS7X0alRX1uU'
    },
    muteHttpExceptions: true
  });

  if (response.getResponseCode() === 200) {
    var data = JSON.parse(response.getContentText());
    Logger.log('Reminder2 対象: ' + data.length + '件 (' + targetDate + ')');
    data.forEach(function(r) {
      if (r.email) {
        sendReminderEmail(r, '本日');
        updateReminderFlag(r.id, 'reminder2_sent');
      }
    });
  }
}

function updateReminderFlag(id, field) {
  var url = 'https://abeekodehorlwsmnhoza.supabase.co/rest/v1/trimming_reservations';
  var updateData = {};
  updateData[field] = true;

  UrlFetchApp.fetch(url + '?id=eq.' + id, {
    method: 'PATCH',
    headers: {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZWVrb2RlaG9ybHdzbW5ob3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzAzMTksImV4cCI6MjA5Mjc0NjMxOX0.ZgOB2TUuBBRNV8pejae_UOX9kXIiFb-CS7X0alRX1uU',
      'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiZWVrb2RlaG9ybHdzbW5ob3phIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxNzAzMTksImV4cCI6MjA5Mjc0NjMxOX0.ZgOB2TUuBBRNV8pejae_UOX9kXIiFb-CS7X0alRX1uU',
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(updateData),
    muteHttpExceptions: true
  });
}

function sendReminderEmail(r, dayLabel) {
  var optNames = r.options && r.options.length > 0
    ? r.options.map(function(o) { return o.name; }).join('、')
    : 'なし';

  var subject = '【' + dayLabel + 'のトリミングご予約確認】' + r.visit_time.slice(0,5) + ' ' + r.pet_name + 'ちゃん — ' + STORE_NAME;

  var body = [
    '【' + dayLabel + 'のトリミングご予約確認】',
    '',
    r.owner_name + ' 様',
    '',
    dayLabel + 'のご予約内容をお知らせします。',
    '',
    '▼ ご予約内容',
    '日時  ：' + r.visit_date + ' ' + r.visit_time.slice(0, 5),
    '担当  ：' + r.staff,
    'コース：' + r.course,
    'オプション：' + optNames,
    'ペット：' + r.pet_name + 'ちゃん',
    '',
    '▼ ご来店時のお願い',
    '・クレートでのご来店をお願いします',
    '・ワクチン接種証明書をご持参ください',
    '',
    'ご不明な点はお電話ください。'
  ].join('\n');

  GmailApp.sendEmail(r.email, subject, body, {
    from: NOTIFY_EMAIL,
    name: STORE_NAME
  });

  Logger.log('Reminder sent to: ' + r.email);
}
