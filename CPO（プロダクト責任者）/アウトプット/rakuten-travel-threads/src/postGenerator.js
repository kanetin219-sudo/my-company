const logger = require('./logger');

const EXCLAMATIONS = [
  'えっぐい',
  'ぎゃあああああ',
  'ヤッバイ',
  '事件です',
  'ちょっとえぐいんだけど',
];

const CATCHPHRASES = [
  'しかもお酒もお菓子も食べ放飲み放題？？？',
  'しかも朝タビュッフェ付き？？？',
  'しかも温泉も付き？？？',
  'しかも家族向け設備充実？？？',
  'しかも眺望最高？？？',
];

const CLOSINGLINES = [
  'この価格は破格！',
  '夏季はプールもやってるしゃん！',
  'ここは安すぎるよ、、、',
  '絶対お得！',
  'これはお手頃価格！',
];

const getRandomElement = (array) => {
  return array[Math.floor(Math.random() * array.length)];
};

const generateThreadsPostPart1 = (hotel) => {
  if (!hotel) {
    logger.error('Hotel data missing', { hotel });
    throw new Error('Invalid hotel data');
  }

  const exclamation = getRandomElement(EXCLAMATIONS);
  const catchphrase = getRandomElement(CATCHPHRASES);

  let post = `${exclamation}！！！！！\n\n`;
  post += `${hotel.area}にある ${hotel.hotelName} が\n`;
  post += `この値段？？？\n\n`;
  post += `${catchphrase}\n\n`;
  post += `もっとやばいのが…`;

  logger.info(`Generated thread part 1 (${post.length}/500 chars)`, { hotelName: hotel.hotelName });

  return post;
};

const generateThreadsPostPart2 = (hotel) => {
  if (!hotel || !hotel.affiliateUrl) {
    logger.error('Hotel data missing or no affiliate URL', { hotel });
    throw new Error('Invalid hotel data or missing affiliate URL');
  }

  const priceRange = hotel.minPrice && hotel.maxPrice
    ? `${hotel.minPrice.toLocaleString('ja-JP')}円〜${hotel.maxPrice.toLocaleString('ja-JP')}円`
    : hotel.minPrice
      ? `${hotel.minPrice.toLocaleString('ja-JP')}円〜`
      : '要確認';

  const closingline = getRandomElement(CLOSINGLINES);

  let post = '';
  post += `${hotel.hotelName}\n\n`;
  post += `📍 ${hotel.area}\n`;
  post += `🏘️ ${hotel.catchCopy.substring(0, 30)}...\n\n`;
  post += `料金帯：${priceRange}\n\n`;
  post += `---\n\n`;

  post += `${hotel.catchCopy}\n\n`;
  post += `${closingline}\n\n`;
  const separator = hotel.affiliateUrl.includes('?') ? '&' : '?';
  post += `${hotel.affiliateUrl}${separator}pr`;

  logger.info(`Generated thread part 2 (${post.length}/500 chars)`, { hotelName: hotel.hotelName });

  return post;
};

module.exports = {
  generateThreadsPostPart1,
  generateThreadsPostPart2,
};
