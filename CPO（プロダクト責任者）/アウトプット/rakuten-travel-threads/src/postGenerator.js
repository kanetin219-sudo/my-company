const logger = require('./logger');

const EXCLAMATIONS = [
  'えっぐい',
  'ヤッバイ',
  '事件です',
  'ちょっとえぐいんだけど',
  'ヤバい😳',
];

const CLIFFHANGERS = [
  'このホテルもっとやばいのが…',
  'しかもここアレじゃん…',
  'これでこの値段じゃん…',
  'もう他の宿選べんぞ…',
];

const getRandomElement = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

const generateThreadsPost = (hotel) => {
  if (!hotel || !hotel.affiliateUrl) {
    logger.error('Hotel data missing or no affiliate URL', { hotel });
    throw new Error('Invalid hotel data or missing affiliate URL');
  }

  const priceRange = hotel.minPrice && hotel.maxPrice
    ? `${hotel.minPrice.toLocaleString('ja-JP')}円〜${hotel.maxPrice.toLocaleString('ja-JP')}円`
    : hotel.minPrice
      ? `${hotel.minPrice.toLocaleString('ja-JP')}円〜`
      : '要確認';

  const features = hotel.featureKeywords
    ? hotel.featureKeywords.split(',').slice(0, 2).map((f) => f.trim()).filter(Boolean)
    : [];

  const exclamation = getRandomElement(EXCLAMATIONS);
  const cliffhanger = getRandomElement(CLIFFHANGERS);

  let post = '';

  post += `${exclamation}\n\n`;
  post += `${hotel.area}にある ${hotel.hotelName} が\n`;
  post += `${hotel.reviewAverage}⭐(${hotel.reviewCount}件)で ${priceRange}！？！？\n\n`;
  post += `${cliffhanger}\n\n`;
  post += `---\n\n`;

  if (hotel.catchCopy) {
    post += `📍 ${hotel.catchCopy}\n`;
  }

  if (features.length > 0) {
    post += `✨ ${features.join(' / ')}\n`;
  }

  post += `💰 ${priceRange}\n\n`;
  post += `${hotel.affiliateUrl}?pr`;

  logger.info(`Generated post (${post.length}/500 chars)`, { hotelName: hotel.hotelName });

  return post;
};

const truncatePost = (post) => {
  if (post.length <= 300) return post;

  const lines = post.split('\n');
  let truncated = '';
  let charCount = 0;

  for (const line of lines) {
    const testString = truncated + (truncated ? '\n' : '') + line;

    if (testString.length > 300) {
      if (truncated.includes('affiliateUrl') || truncated.includes('http')) {
        return truncated + '\n...';
      }
      break;
    }

    truncated += (truncated ? '\n' : '') + line;
    charCount = testString.length;
  }

  if (!truncated.includes('affiliateUrl') && !truncated.includes('http')) {
    truncated += '\n\n' + '(URL省略)';
  }

  if (!truncated.includes('※PR')) {
    truncated += '\n\n※PR';
  }

  return truncated.slice(0, 300).trim();
};

module.exports = {
  generateThreadsPost,
};
