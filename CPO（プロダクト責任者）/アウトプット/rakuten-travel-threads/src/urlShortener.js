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
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    const urlInputs = await page.$$('input');
    for (const input of urlInputs) {
      const type = await input.evaluate(el => el.type);
      if (type === 'text' || type === 'url') {
        await input.fill(longUrl);
        break;
      }
    }

    const buttons = await page.$$('button');
    for (const button of buttons) {
      const text = await button.evaluate(el => el.textContent);
      if (text.includes('リンクを作成') || text.includes('作成')) {
        await button.click();
        break;
      }
    }

    await page.waitForTimeout(3000);

    const shortenedUrl = await page.evaluate(() => {
      const elements = document.querySelectorAll('input, textarea, a');
      for (const el of elements) {
        const text = el.value || el.textContent || el.href || '';
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
