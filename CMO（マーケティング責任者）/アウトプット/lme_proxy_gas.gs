/**
 * ============================================================
 *  L Message カレンダープロキシ - Google Apps Script Web App
 *  kaimonロードマップ作成会（calendar_salon_id=23653）用
 *  【キャッシュ方式 v2】
 * ============================================================
 *
 * 【アーキテクチャ】
 * L Message の laravel_session は HttpOnly Cookie のため GAS から直接取得不可。
 * そのため「ブラウザで取得 → GAS に保存 → ウィジェットが読む」キャッシュ方式を採用。
 *
 * 【セットアップ手順】
 * 1. script.google.com で新規プロジェクト作成
 *    （プロジェクト名: "kaimonカレンダープロキシ"）
 * 2. このコードを貼り付け（コード.gsを全部置き換え）
 * 3. ウェブアプリとしてデプロイ
 *    → 「デプロイ」→「新しいデプロイ」→ 種類:「ウェブアプリ」
 *    → 次のユーザーとして実行: 「自分」
 *    → アクセスできるユーザー: 「全員」
 * 4. スクリプトプロパティに BOOKED_DATA を設定（同期ブックマークレットで自動更新）
 *
 * 【予約データ同期方法】
 * → lme_sync_bookmarklet.html を step.lme.jp のカレンダー画面で開いて「同期」ボタンを押す
 * → BOOKED_DATA と UPDATED_AT が自動更新される
 *
 * 【GAS URL】
 * https://script.google.com/macros/s/AKfycbwr2GucgYR7LQOca33a1ptV8DzieOAebnPouD1fhcUM99PrCpSUf_sb3Jr5dAN4fYBygA/exec
 * ============================================================
 */

var ALL_SLOTS = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00'];
var SLOT_HOURS = 2;
var SYNC_SECRET = 'kaimon2026sync';

function doGet(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var bookedJson = props.getProperty('BOOKED_DATA') || '{}';
    var booked = JSON.parse(bookedJson);
    var updatedAt = props.getProperty('UPDATED_AT') || '未同期';
    return jsonResponse({
      success: true,
      booked: booked,
      all_slots: ALL_SLOTS,
      slot_hours: SLOT_HOURS,
      updated_at: updatedAt,
      mode: 'cache'
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function doPost(e) {
  try {
    var params = JSON.parse(e.postData.contents);
    if (params.secret !== SYNC_SECRET) {
      return jsonResponse({ success: false, error: 'Unauthorized' });
    }
    var props = PropertiesService.getScriptProperties();
    props.setProperty('BOOKED_DATA', JSON.stringify(params.booked));
    props.setProperty('UPDATED_AT',
      Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss'));
    return jsonResponse({
      success: true,
      message: '同期完了',
      booking_count: Object.keys(params.booked).length
    });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() });
  }
}

function jsonResponse(obj) {
  var output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
