// ===== ANELLA CAFE トリミング予約システム GAS =====
// 新しいGASプロジェクトを作成してこのコードを貼り付けてください
// スクリプトプロパティに以下を設定してください：
//   SPREADSHEET_ID : スプレッドシートのID
//   LINE_TOKEN     : LINEチャンネルアクセストークン
//   GOOGLE_REVIEW_URL : GoogleマップのレビューURL
//   SUPABASE_KEY   : Supabase API キー（Calendar同期用）

const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
const LINE_TOKEN = PropertiesService.getScriptProperties().getProperty('LINE_TOKEN');
const GOOGLE_REVIEW_URL = PropertiesService.getScriptProperties().getProperty('GOOGLE_REVIEW_URL') || 'https://g.page/r/XXXXX/review';
const SUPABASE_KEY = PropertiesService.getScriptProperties().getProperty('SUPABASE_KEY');
const STORE_EMAIL = 'anellacafeoita@gmail.com';
const ADMIN_URL = 'https://kanetin219-sudo.github.io/anella-cafe/trimming-admin.html';

// ===================== エンドポイント =====================

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.action === 'reserve') {
      return saveReservation(data);
    }
    return respond({ success: false, error: 'unknown action' });
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    if (action === 'getSlots')         return getAvailableSlots(e);
    if (action === 'getReservations')  return getReservations(e);
    if (action === 'updateStatus')     return updateStatus(e);
    if (action === 'saveMemo')         return saveMemo(e);
    return respond({ status: 'ok' });
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

// ===================== 予約保存 =====================

function saveReservation(data) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = getOrCreateSheet(ss, '予約データ');
  ensureHeader(sheet);

  const now = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');

  sheet.appendRow([
    data.reservationNo,                          // A: 予約番号
    now,                                          // B: 受付日時
    data.date,                                    // C: 来店希望日
    data.time,                                    // D: 来店希望時間
    data.staff,                                   // E: 担当者
    data.course,                                  // F: コース
    data.breed,                                   // G: 犬種・猫種
    data.petGender,                               // H: 性別
    data.petWeight,                               // I: 体重
    data.petFurballs,                             // J: 毛玉の有無
    data.petVisitCount,                           // K: 利用経験
    data.petAge,                                  // L: 年齢
    data.petName,                                 // M: ペット名
    data.petVaccineRabies || data.vaccine_rabies || '', // N: 狂犬病ワクチン接種
    data.petVaccine5mix   || data.vaccine_5mix   || '', // O: 5種混合ワクチン接種
    data.petMessage || '',                        // P: 伝言
    data.ownerName,                               // Q: 飼い主名
    data.ownerPhone,                              // R: 電話番号
    data.ownerLine || '',                         // S: LINE表示名
    data.ownerEmail || '',                        // T: メール
    data.options || '',                           // U: オプション
    data.coursePrice || 0,                        // V: コース料金
    data.optionsPrice || 0,                       // W: オプション料金
    data.totalPrice || 0,                         // X: 合計金額
    '予約済み',                                   // Y: ステータス
    '',                                           // Z: スタッフメモ
    false,                                        // AA: 前日リマインド済み
    false,                                        // AB: 当日リマインド済み
    false,                                        // AC: 口コミ依頼済み
  ]);

  // メール通知
  sendReservationMail(data);

  return respond({ success: true, reservationNo: data.reservationNo });
}

// ===================== 空き枠取得 =====================

function getAvailableSlots(e) {
  const date = e.parameter.date;
  const staff = e.parameter.staff;
  if (!date) return respond({ booked: [] });

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('予約データ');
  if (!sheet) return respond({ booked: [] });

  const data = sheet.getDataRange().getValues();
  const booked = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const rowDate = String(row[2]).trim();
    const rowStaff = String(row[4]).trim();
    const rowStatus = String(row[24]).trim();
    const rowTime = String(row[3]).trim();

    if (rowStatus === 'キャンセル') continue;
    if (rowDate !== date) continue;

    // どちらでも可 の場合は両スタッフに対してカウント
    if (staff === 'どちらでも可' || staff === '') {
      if (!booked.includes(rowTime)) booked.push(rowTime);
    } else {
      if (rowStaff === staff || rowStaff === 'どちらでも可') {
        if (!booked.includes(rowTime)) booked.push(rowTime);
      }
    }
  }

  return respond({ booked: booked });
}

// ===================== 予約一覧取得 =====================

function getReservations(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('予約データ');
  if (!sheet) return respond({ reservations: [] });

  const filterDate = e.parameter.date;
  const filterFrom = e.parameter.from;
  const filterTo = e.parameter.to;
  const filterStaff = e.parameter.staff;
  const filterStatus = e.parameter.status;

  const rows = sheet.getDataRange().getValues();
  const reservations = [];

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r[0]) continue;

    const rDate = String(r[2]).trim();

    if (filterDate && rDate !== filterDate) continue;
    if (filterFrom && rDate < filterFrom) continue;
    if (filterTo && rDate > filterTo) continue;
    if (filterStaff && String(r[4]).trim() !== filterStaff) continue;
    if (filterStatus && String(r[23]).trim() !== filterStatus) continue;

    reservations.push({
      reservationNo:      r[0],
      receivedAt:         r[1],
      date:               rDate,
      time:               String(r[3]).trim(),
      staff:              String(r[4]).trim(),
      course:             String(r[5]).trim(),
      breed:              String(r[6]).trim(),
      petGender:          String(r[7]).trim(),
      petWeight:          String(r[8]).trim(),
      petFurballs:        String(r[9]).trim(),
      petVisitCount:      String(r[10]).trim(),
      petAge:             String(r[11]).trim(),
      petName:            String(r[12]).trim(),
      petVaccineRabies:   String(r[13]).trim(),
      petVaccine5mix:     String(r[14]).trim(),
      petMessage:         String(r[15]).trim(),
      ownerName:          String(r[16]).trim(),
      ownerPhone:         String(r[17]).trim(),
      ownerLine:          String(r[18]).trim(),
      ownerEmail:         String(r[19]).trim(),
      options:            String(r[20]).trim(),
      coursePrice:        r[21],
      optionsPrice:       r[22],
      totalPrice:         r[23],
      status:             String(r[24]).trim(),
      memo:               String(r[25]).trim(),
    });
  }

  return respond({ reservations: reservations });
}

// ===================== ステータス更新 =====================

function updateStatus(e) {
  const no = e.parameter.no;
  const status = e.parameter.status;
  if (!no || !status) return respond({ success: false, error: 'missing params' });

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('予約データ');
  if (!sheet) return respond({ success: false, error: 'no sheet' });

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === no) {
      sheet.getRange(i + 1, 25).setValue(status); // Y列
      return respond({ success: true });
    }
  }
  return respond({ success: false, error: 'not found' });
}

// ===================== メモ保存 =====================

function saveMemo(e) {
  const no = e.parameter.no;
  const memo = e.parameter.memo || '';

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('予約データ');
  if (!sheet) return respond({ success: false });

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === no) {
      sheet.getRange(i + 1, 26).setValue(memo); // Z列
      return respond({ success: true });
    }
  }
  return respond({ success: false, error: 'not found' });
}

// ===================== メール通知 =====================

function sendReservationMail(data) {
  try {
    const dateJP = formatDateJP(data.date);
    const totalStr = data.totalPrice > 0 ? '¥' + Number(data.totalPrice).toLocaleString() + '〜' : '別途確認';
    const optStr = data.options || 'なし';

    const subject = '【新規予約】' + data.ownerName + '様 / ' + dateJP + ' ' + data.time + ' / ' + data.course;
    const body = `新規予約が入りました。

━━━━━━━━━━━━━━━
予約番号：${data.reservationNo}
━━━━━━━━━━━━━━━
来店日時：${dateJP}（${getDayOfWeek(data.date)}）${data.time}
担当者：${data.staff}
コース：${data.course}
犬種：${data.breed}
オプション：${optStr}
合計金額：${totalStr}

【ペット情報】
お名前：${data.petName}
性別：${data.petGender}
体重：${data.petWeight}
年齢：${data.petAge}
毛玉：${data.petFurballs}
狂犬病ワクチン：${data.petVaccineRabies || data.vaccine_rabies || '未記入'}
5種混合ワクチン：${data.petVaccine5mix || data.vaccine_5mix || '未記入'}
伝言：${data.petMessage || 'なし'}

【お客様情報】
お名前：${data.ownerName} 様
電話番号：${data.ownerPhone}
LINE表示名：${data.ownerLine || '未記入'}
メールアドレス：${data.ownerEmail || '未記入'}
━━━━━━━━━━━━━━━
管理画面：${ADMIN_URL}
`;

    MailApp.sendEmail({
      to: STORE_EMAIL,
      subject: subject,
      body: body,
    });
  } catch (err) {
    Logger.log('メール送信エラー: ' + err.message);
  }
}

// ===================== LINE通知 =====================

// 毎日12:00に実行（GASトリガー設定）
function sendReminder1() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const targetDate = formatDate(tomorrow);

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('予約データ');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    if (String(r[2]).trim() !== targetDate) continue;
    if (String(r[24]).trim() === 'キャンセル') continue;
    if (r[26] === true) continue; // AA列: 前日送信済み

    const lineId = findLineUserId(String(r[18]).trim()); // LINE表示名→UserID
    if (!lineId) continue;

    const msg = buildReminderMsg1(r);
    sendLineMessage(lineId, msg);

    sheet.getRange(i + 1, 27).setValue(true); // AA列
  }
}

// 毎日8:00に実行（GASトリガー設定）
function sendReminder2() {
  const todayStr = formatDate(new Date());

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('予約データ');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    if (String(r[2]).trim() !== todayStr) continue;
    if (String(r[24]).trim() === 'キャンセル') continue;
    if (r[27] === true) continue; // AB列: 当日送信済み

    const lineId = findLineUserId(String(r[18]).trim());
    if (!lineId) continue;

    const msg = buildReminderMsg2(r);
    sendLineMessage(lineId, msg);

    sheet.getRange(i + 1, 28).setValue(true); // AB列
  }
}

// 毎日20:00に実行（GASトリガー設定）
function sendReviewRequest() {
  const todayStr = formatDate(new Date());

  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('予約データ');
  if (!sheet) return;

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const r = data[i];
    if (!r[0]) continue;
    if (String(r[2]).trim() !== todayStr) continue;
    if (String(r[24]).trim() !== '来店済み') continue; // 来店済みのみ
    if (r[28] === true) continue; // AC列: 口コミ済み

    const lineId = findLineUserId(String(r[18]).trim());
    if (!lineId) continue;

    const msg = buildReviewMsg(r);
    sendLineMessage(lineId, msg);

    sheet.getRange(i + 1, 29).setValue(true); // AC列
  }
}

// ===================== LINEメッセージ送信 =====================

function sendLineMessage(userId, message) {
  const token = LINE_TOKEN;
  if (!token || !userId) return;

  const url = 'https://api.line.me/v2/bot/message/push';
  const payload = {
    to: userId,
    messages: [{ type: 'text', text: message }],
  };

  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + token },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

// LINE表示名からUserIDを取得（要：LINEシートで管理）
function findLineUserId(lineName) {
  if (!lineName) return null;
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName('LINE連携');
  if (!sheet) return null;
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === lineName) return String(data[i][1]).trim();
  }
  return null;
}

// ===================== メッセージテンプレート =====================

function buildReminderMsg1(r) {
  const date = r[2], time = r[3], course = r[5], staff = r[4];
  const dateJP = formatDateJP(date);
  return `🐾 アネラカフェ大分店です

明日のトリミング予約のリマインドです✨

━━━━━━━━━━━━━
📅 来店日時
${dateJP}（${getDayOfWeek(date)}） ${time}

✂️ コース
${course}

👤 担当
${staff}
━━━━━━━━━━━━━

ご不明な点はお電話ください📞
097-594-9770

ご来店をお待ちしております🐶🐱
ANELLA CAFE 大分店`;
}

function buildReminderMsg2(r) {
  const time = r[3], course = r[5], staff = r[4];
  return `🐾 アネラカフェ大分店です

本日のトリミング予約日です🎀

━━━━━━━━━━━━━
📅 来店日時
本日 ${time}

✂️ コース
${course}

👤 担当
${staff}
━━━━━━━━━━━━━

お気をつけてお越しください🚗💨

ご不明な点はお電話ください📞
097-594-9770
ANELLA CAFE 大分店`;
}

function buildReviewMsg(r) {
  const petName = r[12];
  return `🐾 アネラカフェ大分店です

本日はご来店ありがとうございました✨
${petName}ちゃん、とても可愛かったです🐶

よろしければ口コミをいただけると
とても励みになります😊

▼ Googleマップで口コミを書く
${GOOGLE_REVIEW_URL}

またのご来店をお待ちしております🐾
ANELLA CAFE 大分店`;
}

// ===================== ヘルパー =====================

function getOrCreateSheet(ss, name) {
  const existing = ss.getSheetByName(name);
  if (existing) return existing;
  return ss.insertSheet(name);
}

function ensureHeader(sheet) {
  if (sheet.getLastRow() > 0) return;
  const headers = [
    '予約番号','受付日時','来店希望日','来店希望時間','担当者',
    'コース','犬種・猫種','性別','体重','毛玉の有無',
    '利用経験','年齢','ペット名','狂犬病ワクチン接種','5種混合ワクチン接種','スタッフへの伝言',
    '飼い主様名','電話番号','LINE表示名','メールアドレス','オプション',
    'コース料金','オプション料金','合計金額','ステータス','スタッフメモ',
    '前日リマインド済み','当日リマインド済み','口コミ依頼済み',
  ];
  sheet.appendRow(headers);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatDate(d) {
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function formatDateJP(str) {
  const d = new Date(str + 'T00:00:00+09:00');
  return d.getFullYear() + '年' +
    String(d.getMonth() + 1).padStart(2, '0') + '月' +
    String(d.getDate()).padStart(2, '0') + '日';
}

function getDayOfWeek(str) {
  const d = new Date(str + 'T00:00:00+09:00');
  return ['日','月','火','水','木','金','土'][d.getDay()];
}

// ===================== Google Calendar 同期（UPSERT パターン）=====================
// ✅ DELETE禁止ルール対応：全削除→再投入ではなく、UPSERTで既存データを上書き

function syncCalendarToSupabase() {
  try {
    // 1. Googleカレンダーのイベントを取得
    const calendarId = 'a128bd52fb2a34107729297df1b940c6f213749ff3e786f5dd11f1f35a253ac2@group.calendar.google.com';
    const calendar = CalendarApp.getCalendarById(calendarId);
    if (!calendar) {
      return respond({ success: false, error: 'Calendar not found' });
    }

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 3, 1);

    const events = calendar.getEvents(startDate, endDate);

    // 2. イベントをトリミング予約フォーマットに変換
    const calendarData = events.map((event, index) => {
      const title = event.getTitle();
      const dateTime = event.getStartTime();
      const parts = title.split(' - ');

      return {
        reservation_number: `GC-${Utilities.formatDate(dateTime, 'Asia/Tokyo', 'yyyyMMdd')}-${String(index + 1).padStart(3, '0')}`,
        visit_date: Utilities.formatDate(dateTime, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'),
        owner_name: parts[0] || 'カレンダー同期',
        pet_name: parts[1] || 'カレンダーイベント',
        phone: '',
        email: '',
        breed: '',
        gender: '',
        weight: '',
        pet_age: '',
        course: parts[2] || 'カット',
        course_price: 0,
        options: '',
        options_price: 0,
        total_price: 0,
        staff: 'カレンダー',
        status: '予約済み',
        staff_memo: `カレンダー同期：${title}`,
        created_at: new Date().toISOString(),
        data_source: 'google_calendar'
      };
    });

    // 3. ✅ UPSERT で同期（削除ではなく更新）
    if (calendarData.length > 0) {
      const supabaseUrl = 'https://abeekodehorlwsmnhoza.supabase.co';
      if (!SUPABASE_KEY) {
        Logger.log('❌ SUPABASE_KEY not configured in script properties');
        return respond({ success: false, error: 'SUPABASE_KEY not configured' });
      }

      // Supabase REST API: UPSERT（onConflict=reservation_number で更新）
      const options = {
        method: 'post',
        headers: {
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates'
        },
        payload: JSON.stringify(calendarData),
        muteHttpExceptions: true
      };

      try {
        const response = UrlFetchApp.fetch(
          `${supabaseUrl}/rest/v1/trimming_reservations?on_conflict=reservation_number`,
          options
        );

        const statusCode = response.getResponseCode();
        const responseText = response.getContentText();

        Logger.log(`📡 Supabase API Response: ${statusCode}`);
        Logger.log(`📊 Response: ${responseText}`);

        if (statusCode === 201 || statusCode === 200) {
          Logger.log(`✅ Calendar Sync Complete: ${calendarData.length} events`);
          return respond({ success: true, synced: calendarData.length });
        } else {
          Logger.log(`⚠️  Sync returned ${statusCode}: ${responseText}`);
          return respond({ success: true, synced: calendarData.length, warning: `HTTP ${statusCode}` });
        }
      } catch (err) {
        Logger.log(`❌ Supabase API Error: ${err.toString()}`);
        throw err;
      }
    }

    return respond({ success: true, synced: 0 });

  } catch (err) {
    Logger.log('❌ Calendar Sync Error: ' + err.toString());
    return respond({ success: false, error: err.toString() });
  }
}

// GAS トリガー設定用：毎日 18:00 に実行
function dailyCalendarSync() {
  syncCalendarToSupabase();
}
