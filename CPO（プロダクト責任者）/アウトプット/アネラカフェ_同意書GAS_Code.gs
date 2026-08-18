// ===== ANELLA CAFE 同意書 GAS =====
// 新しいGASプロジェクトにこのコードを貼り付けてデプロイしてください

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    // フォルダ構造を作成・取得
    const parts = data.date.split('-'); // ['2026','04','25']
    const yearLabel  = parts[0] + '年';
    const monthLabel = parts[1] + '月';
    const dayLabel   = data.date; // '2026-04-25'

    const root      = getOrCreate(DriveApp.getRootFolder(), 'アネラカフェ 同意書');
    const yearDir   = getOrCreate(root,  yearLabel);
    const monthDir  = getOrCreate(yearDir, monthLabel);
    const dayDir    = getOrCreate(monthDir, dayLabel);

    // 連番（既存ファイル数 + 1）
    const files = dayDir.getFiles();
    let count = 0;
    while (files.hasNext()) { files.next(); count++; }
    const seq      = String(count + 1).padStart(3, '0');
    const fileName = `同意書_${data.date}_${seq}`;

    // PDF生成 → Drive保存
    const pdf = buildPDF(data, fileName);
    dayDir.createFile(pdf);

    return respond({ success: true, file: fileName + '.pdf' });
  } catch (err) {
    return respond({ success: false, error: err.message });
  }
}

function doGet(e) {
  return respond({ status: 'ok' });
}

// ---- ヘルパー ----

function getOrCreate(parent, name) {
  const it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function respond(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function buildPDF(data, fileName) {
  const doc  = DocumentApp.create('_tmp_' + Date.now());
  const body = doc.getBody();

  // スタイル設定
  const style = {};
  style[DocumentApp.Attribute.FONT_FAMILY] = 'Arial';
  style[DocumentApp.Attribute.FONT_SIZE]   = 11;
  body.setAttributes(style);

  // タイトル
  const t = body.appendParagraph('ANELLA CAFE　ご利用時の注意事項同意書');
  t.setHeading(DocumentApp.ParagraphHeading.HEADING1);
  t.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  body.appendParagraph('');

  // 来店情報テーブル
  const d   = new Date(data.date + 'T00:00:00+09:00');
  const ymd = `${d.getFullYear()}年${String(d.getMonth()+1).padStart(2,'0')}月${String(d.getDate()).padStart(2,'0')}日`;

  const rows = [
    ['来店日',     ymd],
    ['来店人数',   `大人 ${data.adults}名 ・ 小学生以上 ${data.children}名 ・ 未就学 ${data.preschool}名`],
    ['ご利用回数', data.visitCount],
    ['お気に入りの子', data.favoritePet || '―'],
    ['記録日時',   Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss')],
  ];

  const tbl = body.appendTable(rows);
  tbl.setBorderWidth(1);
  for (let r = 0; r < rows.length; r++) {
    tbl.getCell(r, 0).setBackgroundColor('#F5EFE6').setBold(true);
  }

  body.appendParagraph('');

  // 同意書本文
  body.appendParagraph('【同意書本文】').setBold(true);
  body.appendParagraph(
    '店内での噛みつきや引っ掻きによる怪我や事故、または衣類の損傷等（犬猫の粗相含む）が発生した場合は、' +
    '一切の責任が負えないことをあらかじめご了承ください。滞在中・帰宅後のアレルギーの発症等も同様となります。' +
    '靴や上着類、貴重品等はご自身で管理していただき、盗難・紛失等は一切の責任を追いかねます。'
  );
  body.appendParagraph('');
  body.appendParagraph('▼ ご利用時の注意事項 [お子様同伴時の注意点も含む] に同意します。').setBold(true);
  body.appendParagraph('');

  // 署名
  body.appendParagraph('【署名】').setBold(true);

  data.signatures.forEach((sig, i) => {
    if (!sig || !sig.startsWith('data:image')) return;
    body.appendParagraph(`署名 ${i + 1}`).setBold(true);
    const blob = Utilities.newBlob(
      Utilities.base64Decode(sig.split(',')[1]),
      'image/png',
      `sig${i}.png`
    );
    body.appendImage(blob).setWidth(280).setHeight(100);
    body.appendParagraph('');
  });

  doc.saveAndClose();

  const pdf = DriveApp.getFileById(doc.getId())
    .getAs('application/pdf')
    .setName(fileName + '.pdf');

  DriveApp.getFileById(doc.getId()).setTrashed(true);

  return pdf;
}
