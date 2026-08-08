const { chromium } = require('playwright');
const logger = require('./logger');
const fs = require('fs');
const path = require('path');

const CACHE_FILE = path.join(__dirname, '../.url-cache.json');

const loadCache = () => {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = fs.readFileSync(CACHE_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.warn('Failed to load URL cache', { error: error.message });
  }
  return {};
};

const saveCache = (cache) => {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    logger.warn('Failed to save URL cache', { error: error.message });
  }
};

let browser = null;

const getBrowser = async () => {
  if (!browser) {
    logger.info('Launching Playwright browser');
    browser = await chromium.launch({ headless: true });
  }
  return browser;
};

const shortenUrl = async (longUrl) => {
  const cache = loadCache();

  if (cache[longUrl]) {
    logger.info(`Using cached shortened URL for ${longUrl}`);
    return cache[longUrl];
  }

  try {
    logger.info('Shortening URL via Rakuten Affiliate (Playwright)');
    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage({ viewport: { width: 1280, height: 720 } });

    // Rakuten Affiliate のリンク短縮ツール
    await page.goto('https://affiliate.rakuten.co.jp/', {
      waitUntil: 'load',
      timeout: 60000,
    });

    await page.waitForTimeout(2000);

    // URL入力フィールドを見つけて入力
    const urlInputSelector = 'input[type="text"][placeholder*="URL"], input[type="url"], input[name*="url"]';
    await page.fill(urlInputSelector, longUrl, { timeout: 10000 });
    logger.info('URL input filled');
    await page.waitForTimeout(1000);

    // 「リンクを作成」ボタンをクリック
    const buttonSelector = 'button:has-text("リンクを作成")';
    await page.click(buttonSelector, { timeout: 10000 });
    logger.info('Create link button clicked');

    // 結果が表示されるまで待機
    await page.waitForTimeout(8000);

    // 短縮URL を取得
    const shortenedUrl = await page.evaluate(() => {
      // ページ全体のテキストから a.r10.to を探す
      const pageText = document.body.innerText;
      const match = pageText.match(/https?:\/\/a\.r10\.to\/[^\s\n"')]+/);
      if (match) return match[0];

      // input 要素から探す
      const inputs = document.querySelectorAll('input, textarea');
      for (const el of inputs) {
        const text = el.value || el.textContent || '';
        if (text.includes('a.r10.to/')) {
          const urlMatch = text.match(/https?:\/\/a\.r10\.to\/[^\s"')]+/);
          if (urlMatch) return urlMatch[0];
        }
      }

      // リンク要素から探す
      const links = document.querySelectorAll('a');
      for (const link of links) {
        if (link.href.includes('a.r10.to/')) return link.href;
        if (link.textContent.includes('a.r10.to/')) {
          const match = link.textContent.match(/https?:\/\/a\.r10\.to\/[^\s"')]+/);
          if (match) return match[0];
        }
      }

      return null;
    });

    await page.close();

    if (shortenedUrl && shortenedUrl.includes('a.r10.to/')) {
      logger.info(`Shortened URL generated: ${shortenedUrl}`);
      cache[longUrl] = shortenedUrl;
      saveCache(cache);
      return shortenedUrl;
    } else {
      logger.warn('Could not extract shortened URL from Rakuten Affiliate, using long URL');
      return longUrl;
    }
  } catch (error) {
    logger.error('URL shortener error', { error: error.message });
    return longUrl;
  }
};

const closeBrowser = async () => {
  if (browser) {
    await browser.close();
    browser = null;
  }
};

module.exports = {
  shortenUrl,
  closeBrowser,
};
