// 8月シフト表 HTML生成（7月PDFと同形式・A4横）
const fs = require('fs');
const { staff, dow, HOLIDAY } = require('./shift_data.js');

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

function cell(s, d) {
  const p = s.shifts[d];
  if (!p) return '<td class="cell off"><span class="chip">所定休日</span></td>';
  const dayType = d === HOLIDAY ? '山の日' : '平日';
  const chipCls = d === HOLIDAY ? 'chip holiday' : 'chip work';
  return `<td class="cell"><span class="${chipCls}">${dayType}</span><div class="time">${p[0]}-${p[1]}</div><div class="pat">${esc(p[3])}</div></td>`;
}

function page(from, to, pageNo, totalPages) {
  const days = [];
  for (let d = from; d <= to; d++) days.push(d);
  const header = days.map(d => {
    const w = dow(d);
    const cls = d === HOLIDAY ? 'hd holiday' : w === '土' ? 'hd sat' : w === '日' ? 'hd sun' : 'hd';
    return `<th class="${cls}"><span class="dnum">${d}</span><span class="dw">${w}</span></th>`;
  }).join('');
  const rows = staff.map(s => `
    <tr>
      <th class="name"><div class="sid">${s.id}</div><div>${esc(s.name)}</div></th>
      ${days.map(d => cell(s, d)).join('')}
    </tr>`).join('');
  return `
  <section class="sheet">
    <div class="head">
      <div>
        <div class="corp">株式会社かねちん</div>
        <div class="title">2026/08/${String(from).padStart(2, '0')}〜2026/08/${String(to).padStart(2, '0')} シフト表</div>
      </div>
      <div class="pageno">${pageNo}/${totalPages}</div>
    </div>
    <table>
      <colgroup><col class="namecol">${days.map(() => '<col>').join('')}</colgroup>
      <thead><tr><th class="name corner"></th>${header}</tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </section>`;
}

// 集計ページ
const conds = {
  '平迫 孝子': '正社員・休み10日',
  '須崎 琴絵': '正社員・休み10日',
  '末光 愛': '毎週 金曜＋土日どちらか（週2回）',
  '牧 璃子': '7月と同様',
  '今本 沙織': '7月と同様',
  '三浦 萌華': '50時間程度',
  '篠田 葉月': '50時間程度',
  '池田 百花': '160〜170時間',
  '椛田 恵美': '76時間',
};
const sumRows = staff.map(s => {
  const days = Object.keys(s.shifts).length;
  const hours = Object.values(s.shifts).reduce((a, p) => a + p[2], 0);
  return `<tr><td>${s.id}</td><td class="l">${esc(s.name)}</td><td>${s.type}</td><td>${days}日</td><td>${31 - days}日</td><td><b>${hours}h</b></td><td class="l">${conds[s.name] || ''}</td></tr>`;
}).join('');
const partTotal = staff.filter(s => s.type === 'パート')
  .reduce((a, s) => a + Object.values(s.shifts).reduce((x, p) => x + p[2], 0), 0);

const summary = `
<section class="sheet">
  <div class="head">
    <div>
      <div class="corp">株式会社かねちん</div>
      <div class="title">2026年8月 シフト集計</div>
    </div>
    <div class="pageno">3/3</div>
  </div>
  <table class="sum">
    <thead><tr><th>No</th><th>氏名</th><th>区分</th><th>出勤</th><th>休み</th><th>総労働時間</th><th>条件</th></tr></thead>
    <tbody>${sumRows}</tbody>
  </table>
  <div class="notes">
    <p><b>■ 検証済みポイント</b></p>
    <ul>
      <li>パート合計（平迫・須崎除く）: <b>${partTotal}時間</b>（目標500時間程度）</li>
      <li>人員配置: 全31日で毎日<b>4人以上</b>出勤（最少4人）</li>
      <li>正社員（平迫・須崎）が毎日1名以上出勤、両名の休みは同日に重ならない</li>
      <li>8/11（火・山の日）: 平迫 休み／須崎 出勤 9-18（7月の海の日と同じ扱い）</li>
      <li>後藤: 8月は全休のためシフトなし</li>
      <li>牧: パート合計500時間の枠内に収めるため7月（約113h）より少ない84h</li>
    </ul>
  </div>
</section>`;

const html = `<!DOCTYPE html>
<html lang="ja"><head><meta charset="utf-8">
<style>
  @page { size: A4 landscape; margin: 7mm 7mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Noto Sans CJK JP', sans-serif; color: #1a1a1a; }
  .sheet { page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  .head { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 3mm; }
  .corp { font-size: 8px; color: #444; }
  .title { font-size: 15px; font-weight: 700; }
  .pageno { font-size: 10px; color: #444; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .namecol { width: 22mm; }
  th, td { border: 0.5px solid #999; vertical-align: top; }
  thead th { padding: 1.2mm 0.5mm; text-align: center; background: #f2f2f2; }
  thead th.sat { background: #e8f0fa; }
  thead th.sun, thead th.holiday { background: #faeaea; }
  .dnum { font-size: 11px; font-weight: 700; }
  .dw { font-size: 8px; margin-left: 1px; color: #555; }
  th.name { background: #f7f7f7; padding: 1.5mm 1mm; text-align: left; font-size: 9px; font-weight: 600; }
  .sid { font-size: 7px; color: #777; }
  .cell { height: 17mm; padding: 0.8mm 0.5mm; font-size: 7px; }
  .cell.off { background: #f5f5f5; }
  .chip { display: inline-block; font-size: 6px; border: 0.5px solid #888; padding: 0 1px; color: #333; background: #fff; }
  .chip.holiday { background: #fdeaea; border-color: #c66; }
  .cell.off .chip { background: transparent; }
  .time { font-size: 7.5px; font-weight: 700; margin-top: 0.6mm; }
  .pat { font-size: 6px; color: #555; margin-top: 0.3mm; }
  /* 集計 */
  table.sum { table-layout: auto; margin-top: 2mm; }
  table.sum th, table.sum td { padding: 1.6mm 2.5mm; font-size: 10px; text-align: center; }
  table.sum td.l { text-align: left; }
  table.sum thead th { background: #f2f2f2; }
  .notes { margin-top: 5mm; font-size: 10px; line-height: 1.7; }
  .notes ul { margin-left: 6mm; }
</style></head><body>
${page(1, 16, 1, 3)}
${page(17, 31, 2, 3)}
${summary}
</body></html>`;

fs.writeFileSync(__dirname + '/shift_august.html', html);
console.log('written: shift_august.html');
