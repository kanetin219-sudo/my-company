const SUPABASE_URL = 'https://abeekodehorlwsmnhoza.supabase.co';
const SUPABASE_KEY = '';
const USER_EMAIL = 'kanetin219@gmail.com';
const NOTIFICATION_EMAIL = 'kbbk0718@gmail.com';

function processSaisonCard() {
  try {
    Logger.log('Start processing Saison card');

    const saisonMail = getSaisonCardEmail();
    if (!saisonMail) {
      sendAlert('Saison email not found');
      return;
    }

    Logger.log('Email found: ' + saisonMail.getSubject());

    const csvContent = extractCSVFromEmail(saisonMail);
    if (!csvContent) {
      sendAlert('CSV extraction failed');
      return;
    }

    const result = calculateZappi(csvContent);
    sendDetailedReport(result);
    logProcessing(result);

    Logger.log('Processing complete');

  } catch (e) {
    Logger.log('Error: ' + e.toString());
    sendAlert('Error: ' + e.toString());
  }
}

function getSaisonCardEmail() {
  const threads = GmailApp.search('from:saison');
  if (threads.length === 0) {
    return null;
  }
  const messages = threads[0].getMessages();
  return messages[messages.length - 1];
}

function extractCSVFromEmail(message) {
  const attachments = message.getAttachments();
  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i];
    if (att.getFileName().endsWith('.csv')) {
      return att.getDataAsString();
    }
  }
  return null;
}

function calculateZappi(csvContent) {
  const lines = csvContent.split('\n');
  const targets = {
    'SERIA': { pattern: /セリア/, total: 0, items: [] },
    'DRUG': { pattern: /(ツルハドラッグ|ドラッグイレブン)/, total: 0, items: [] },
    'JASS': { pattern: /(JASSポ|JASS)/, total: 0, items: [] },
    'SUPER': { pattern: /スーパーコンボ/, total: 0, items: [] },
    'VET': { pattern: /動物病院/, total: 0, items: [] }
  };

  let grandTotal = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim() || line.includes('利用日') || line.includes('ご利用店名')) {
      continue;
    }

    const parts = line.split(',');
    if (parts.length < 6) continue;

    const shopName = parts[1] || '';
    const amount = parseInt(parts[5]) || 0;

    if (amount === 0) continue;

    for (const [key, data] of Object.entries(targets)) {
      if (data.pattern.test(shopName)) {
        data.total += amount;
        data.items.push({ shop: shopName.substring(0, 30), amount: amount });
        grandTotal += amount;
        break;
      }
    }
  }

  return {
    date: new Date(),
    targets: targets,
    grandTotal: grandTotal,
    yearMonth: Utilities.formatDate(new Date(), 'JST', 'yyyy-MM')
  };
}

function sendDetailedReport(result) {
  let body = 'Saison card processed.\n\n';
  body += 'Date: ' + Utilities.formatDate(result.date, 'JST', 'yyyy/MM/dd HH:mm:ss') + '\n\n';

  body += '--- Details ---\n';

  const labels = {
    'SERIA': 'Seria',
    'DRUG': 'Drug Store',
    'JASS': 'JASS Port',
    'SUPER': 'Super Combo',
    'VET': 'Animal Hospital'
  };

  for (const [key, data] of Object.entries(result.targets)) {
    if (data.total > 0) {
      body += '\n' + labels[key] + ': ' + formatYen(data.total) + '\n';
      for (const item of data.items) {
        body += '  - ' + item.shop + ': ' + formatYen(item.amount) + '\n';
      }
    }
  }

  body += '\n--- Total ---\n';
  body += 'Zappi: ' + formatYen(result.grandTotal) + '\n\n';

  body += 'Please confirm and update Supabase if OK.\n';
  body += 'Year-Month: ' + result.yearMonth + '\n';
  body += 'Amount: ' + result.grandTotal + '\n';

  GmailApp.sendEmail(
    NOTIFICATION_EMAIL,
    'Saison Card Report - ' + result.yearMonth,
    body
  );
}

function formatYen(amount) {
  return '¥' + amount.toLocaleString();
}

function logProcessing(result) {
  Logger.log('Logged: ' + JSON.stringify(result));
}

function sendAlert(message) {
  GmailApp.sendEmail(
    NOTIFICATION_EMAIL,
    'Saison Card Error',
    message
  );
}

function testSaisonProcessing() {
  processSaisonCard();
}

function setupTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (let i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'processSaisonCard') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  ScriptApp.newTrigger('processSaisonCard')
    .timeBased()
    .onMonthDay(1)
    .atHour(9)
    .inTimezone('Asia/Tokyo')
    .create();

  Logger.log('Trigger set: Every 1st day of month at 9:00 AM JST');
}
