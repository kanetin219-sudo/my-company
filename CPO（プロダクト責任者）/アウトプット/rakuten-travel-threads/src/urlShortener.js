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
    logger.info('Shortening URL via Rakuten Affiliate');
    const browserInstance = await getBrowser();
    const page = await browserInstance.newPage();

    await page.goto('https://affiliate.rakuten.co.jp/', {
      waitUntil: 'networkidle',
      timeout: 60000,
    });

    await page.waitForTimeout(3000);

    // URL入力フィールドを探して入力
    const urlInput = await page.$('input[type="url"], input[type="text"][placeholder*="URL"], input[placeholder*="url"]');
    if (urlInput) {
      await urlInput.fill(longUrl);
      logger.info('URL filled in input field');
      await page.waitForTimeout(1000);
    } else {
      logger.warn('Could not find URL input field');
    }

    // 「リンクを作成」ボタンをクリック
    await page.click('button:has-text("リンクを作成"), button:has-text("作成"), button[type="submit"]');
    logger.info('Create link button clicked');

    // 短縮URL が表示されるまで待機
    await page.waitForTimeout(5000);

    // 複数の方法で短縮URL を抽出
    const shortenedUrl = await page.evaluate(() => {
      // 方法1: a.r10.to/ を含むテキストを検索
      const allText = document.body.innerText;
      const match = allText.match(/https?:\/\/a\.r10\.to\/[^\s\n"')]+/);
      if (match) return match[0];

      // 方法2: input/textarea から探す
      const inputs = document.querySelectorAll('input, textarea');
      for (const el of inputs) {
        const text = el.value || '';
        if (text.includes('a.r10.to/')) {
          return text.match(/https?:\/\/a\.r10\.to\/[^\s"')]+/)?.[0];
        }
      }

      // 方法3: リンク要素から探す
      const links = document.querySelectorAll('a');
      for (const link of links) {
        const href = link.href || '';
        const text = link.textContent || '';
        if (href.includes('a.r10.to/')) return href;
        if (text.includes('a.r10.to/')) {
          return text.match(/https?:\/\/a\.r10\.to\/[^\s"')]+/)?.[0];
        }
      }

      return null;
    });

    await page.close();

    if (shortenedUrl) {
      logger.info(`Shortened URL generated: ${shortenedUrl}`);
      cache[longUrl] = shortenedUrl;
      saveCache(cache);
      return shortenedUrl;
    } else {
      logger.warn('Could not extract shortened URL, using long URL');
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
