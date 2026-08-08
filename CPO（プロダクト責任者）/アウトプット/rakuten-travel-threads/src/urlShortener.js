const axios = require('axios');
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

const shortenUrl = async (longUrl) => {
  const cache = loadCache();

  if (cache[longUrl]) {
    logger.info(`Using cached shortened URL for ${longUrl}`);
    return cache[longUrl];
  }

  try {
    logger.info('Shortening URL via TinyURL', { url: longUrl });

    const response = await axios.post('https://tinyurl.com/api/create',
      { url: longUrl },
      {
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      }
    );

    const shortenedUrl = response.data.data?.short_url || response.data;

    if (shortenedUrl && typeof shortenedUrl === 'string' && shortenedUrl.startsWith('https://')) {
      logger.info(`Shortened URL generated: ${shortenedUrl}`);
      cache[longUrl] = shortenedUrl;
      saveCache(cache);
      return shortenedUrl;
    } else {
      logger.warn('Invalid shortened URL received, using long URL', { response: response.data });
      return longUrl;
    }
  } catch (error) {
    logger.error('URL shortener error', {
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    return longUrl;
  }
};

const closeBrowser = async () => {
  // No browser cleanup needed for TinyURL API
};

module.exports = {
  shortenUrl,
  closeBrowser,
};
