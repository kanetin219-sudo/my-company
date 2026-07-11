// 8月シフト 制約検証スクリプト
const { staff, dow, HOLIDAY } = require('./shift_data.js');

let ok = true;
const fail = (msg) => { ok = false; console.log('❌ ' + msg); };
const pass = (msg) => console.log('✅ ' + msg);

// 個人別集計
const totals = {};
for (const s of staff) {
  const days = Object.keys(s.shifts).map(Number);
  const hours = days.reduce((a, d) => a + s.shifts[d][2], 0);
  totals[s.name] = { days: days.length, hours };
}

// 1. 個人別時間チェック
const expect = {
  '平迫 孝子': { days: 21, hours: 168, offDays: 10 },
  '須崎 琴絵': { days: 21, hours: 168, offDays: 10 },
  '池田 百花': { days: 21, hours: 168 },
  '椛田 恵美': { hours: 76 },
  '三浦 萌華': { hoursRange: [48, 53] },
  '篠田 葉月': { hoursRange: [48, 53] },
  '今本 沙織': { hoursRange: [36, 44] },
  '牧 璃子': { hoursRange: [80, 90] },
};
for (const [name, e] of Object.entries(expect)) {
  const t = totals[name];
  if (!t) { fail(`${name} がデータにいない`); continue; }
  if (e.days !== undefined && t.days !== e.days) fail(`${name}: 出勤${t.days}日 (期待${e.days})`);
  if (e.hours !== undefined && t.hours !== e.hours) fail(`${name}: ${t.hours}h (期待${e.hours})`);
  if (e.hoursRange && (t.hours < e.hoursRange[0] || t.hours > e.hoursRange[1]))
    fail(`${name}: ${t.hours}h (期待${e.hoursRange[0]}-${e.hoursRange[1]})`);
  if (e.offDays !== undefined && (31 - t.days) !== e.offDays) fail(`${name}: 休み${31 - t.days}日 (期待${e.offDays})`);
}
pass('個人別時間: ' + Object.entries(totals).map(([n, t]) => `${n.split(' ')[0]}=${t.hours}h/${t.days}日`).join(', '));

// 2. パート合計500h程度
const partTotal = staff.filter(s => s.type === 'パート').reduce((a, s) => a + totals[s.name].hours, 0);
if (partTotal < 490 || partTotal > 510) fail(`パート合計 ${partTotal}h (期待≈500h)`);
else pass(`パート合計 = ${partTotal}h`);

// 3. 毎日4人以上 + 正社員1名以上
let minCount = 99;
for (let d = 1; d <= 31; d++) {
  const onDuty = staff.filter(s => s.shifts[d]);
  minCount = Math.min(minCount, onDuty.length);
  if (onDuty.length < 4) fail(`8/${d}(${dow(d)}): 出勤${onDuty.length}人 (${onDuty.map(s => s.name.split(' ')[0]).join(',')})`);
  if (!onDuty.some(s => s.type === '正社員')) fail(`8/${d}: 正社員が不在`);
}
pass(`毎日の出勤人数: 最少${minCount}人 (基準4人以上)`);

// 4. 正社員の休み重複なし
for (let d = 1; d <= 31; d++) {
  const fw = staff.filter(s => s.type === '正社員' && s.shifts[d]);
  if (fw.length === 0) fail(`8/${d}: 平迫・須崎とも休み`);
}
pass('平迫・須崎の休み重複なし');

// 5. 末光: 毎週 金曜1回 + 土日1回（8/1週は日のみ）
const suemitsu = staff.find(s => s.name === '末光 愛');
const sDays = Object.keys(suemitsu.shifts).map(Number);
const weeks = [[1, 2], [3, 9], [10, 16], [17, 23], [24, 30]];
weeks.forEach(([a, b], i) => {
  const wd = sDays.filter(d => d >= a && d <= b);
  const fri = wd.filter(d => dow(d) === '金').length;
  const wknd = wd.filter(d => ['土', '日'].includes(dow(d))).length;
  if (i === 0) { // 8/1-2: 金曜は7月側
    if (wknd !== 1 || fri !== 0) fail(`末光 第${i}週(8/${a}-${b}): 金${fri}・土日${wknd} (期待 土日1のみ)`);
  } else {
    if (fri !== 1 || wknd !== 1) fail(`末光 第${i}週(8/${a}-${b}): 金${fri}・土日${wknd} (期待 各1)`);
  }
});
if (sDays.includes(31)) fail('末光が8/31(月)に出勤');
pass('末光: 毎週 金曜+土日どちらか1回');

// 6. 平迫は日曜休み・土曜9-18・平日8-17 / 須崎の祝日出勤
const hirasako = staff.find(s => s.name === '平迫 孝子');
for (const [d, p] of Object.entries(hirasako.shifts)) {
  if (dow(+d) === '日') fail(`平迫が日曜8/${d}に出勤`);
  if (dow(+d) === '土' && p[0] !== '09:00') fail(`平迫 土曜8/${d}が9-18でない`);
  if (!['土'].includes(dow(+d)) && p[0] !== '08:00') fail(`平迫 平日8/${d}が8-17でない`);
}
const suzaki = staff.find(s => s.name === '須崎 琴絵');
if (!suzaki.shifts[HOLIDAY]) fail('須崎が山の日(8/11)に休み (7月は祝日出勤)');
if (hirasako.shifts[HOLIDAY]) fail('平迫が山の日(8/11)に出勤 (7月は祝日休み)');
pass('正社員の曜日パターン・祝日の扱いが7月と一致');

// 日別サマリ表示
console.log('\n--- 日別出勤 ---');
for (let d = 1; d <= 31; d++) {
  const onDuty = staff.filter(s => s.shifts[d]);
  const h = d === HOLIDAY ? '祝' : '';
  console.log(`8/${String(d).padStart(2)}(${dow(d)}${h}) ${onDuty.length}人: ${onDuty.map(s => s.name.split(' ')[0] + s.shifts[d][0].slice(0, 2)).join(' ')}`);
}

console.log(ok ? '\n=== 全チェック合格 ===' : '\n=== 失敗あり ===');
process.exit(ok ? 0 : 1);
