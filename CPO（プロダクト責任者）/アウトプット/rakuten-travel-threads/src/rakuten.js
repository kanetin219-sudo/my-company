const axios = require('axios');
const logger = require('./logger');

const RAKUTEN_API_ENDPOINT = 'https://openapi.rakuten.co.jp/engine/api/Travel/SimpleHotelSearch/20260731';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000];

const REGION_MAPPING = {
  '由布院': { latitude: 33.1307, longitude: 131.3833, searchRadius: 2 },
  '別府': { latitude: 33.2836, longitude: 131.4917, searchRadius: 2 },
  '福岡': { latitude: 33.5904, longitude: 130.4017, searchRadius: 2.5 },
  '熊本': { latitude: 32.7898, longitude: 130.7418, searchRadius: 2.5 },
  '宮崎': { latitude: 31.9111, longitude: 131.4239, searchRadius: 2.5 },
  '鹿児島': { latitude: 31.5960, longitude: 130.5573, searchRadius: 2.5 },
  '子連れ旅行': { latitude: 33.5, longitude: 131.0, searchRadius: 3 },
  '温泉宿': { latitude: 33.0, longitude: 131.0, searchRadius: 3 },
  'グランピング': { latitude: 33.5, longitude: 131.0, searchRadius: 3 },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (retryCount) => RETRY_DELAYS[retryCount] || 10000;

const searchHotels = async (keyword, options = {}) => {
  const {
    applicationId,
    accessKey,
    affiliateId,
    hits = 30,
  } = options;

  if (!applicationId || !accessKey || !affiliateId) {
    logger.error('Missing Rakuten API credentials');
    throw new Error('RAKUTEN_APPLICATION_ID, RAKUTEN_ACCESS_KEY, or RAKUTEN_AFFILIATE_ID not set');
  }

  const regionCoords = REGION_MAPPING[keyword];
  if (!regionCoords) {
    logger.warn(`Unknown region keyword: ${keyword}`);
    return [];
  }

  const params = {
    applicationId,
    accessKey,
    affiliateId,
    latitude: regionCoords.latitude,
    longitude: regionCoords.longitude,
    searchRadius: regionCoords.searchRadius,
    datumType: 1,
    hits,
    format: 'json'
  };

  let lastError;

  for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
    try {
      logger.info(`Searching Rakuten Travel: ${keyword} (Coordinates: ${regionCoords.latitude}, ${regionCoords.longitude}) (Retry: ${retryCount}/${MAX_RETRIES})`);
      logger.debug(`API Parameters:`, params);

      const response = await axios.get(RAKUTEN_API_ENDPOINT, { params, timeout: 10000 });

      logger.debug(`Rakuten API response received for ${keyword}`, { dataKeys: Object.keys(response.data) });

      if (!response.data.hotels || response.data.hotels.length === 0) {
        logger.warn(`No hotels found for keyword: ${keyword}`);
        return [];
      }

      logger.info(`Found ${response.data.hotels.length} hotels for: ${keyword}`);

      return response.data.hotels.map((hotel) => {
        const basicInfo = hotel.hotel[0].hotelBasicInfo;

        return {
          hotelNo: basicInfo.hotelNo,
          hotelName: basicInfo.hotelName,
          hotelAddress: basicInfo.address2,
          area: basicInfo.address1,
          catchCopy: basicInfo.hotelSpecial || '',
          featureKeywords: basicInfo.hotelSpecial || '',
          reviewAverage: parseFloat(basicInfo.reviewAverage) || 0,
          reviewCount: parseInt(basicInfo.reviewCount) || 0,
          images: [
            basicInfo.hotelImageUrl,
            basicInfo.roomImageUrl,
            basicInfo.hotelMapImageUrl,
          ].filter(Boolean),
          minPrice: parseInt(basicInfo.hotelMinCharge) || 0,
          maxPrice: parseInt(basicInfo.hotelMinCharge) || 0,
          reservationUrl: basicInfo.planListUrl || '',
          affiliateUrl: basicInfo.planListUrl || '',
        };
      });
    } catch (error) {
      lastError = error;

      const statusCode = error.response?.status;
      const errorData = error.response?.data;

      if (statusCode === 401 || statusCode === 403) {
        logger.error('Rakuten API authentication error', {
          statusCode,
          message: error.message
        });
        throw error;
      }

      if (statusCode === 429) {
        logger.warn(`Rate limited by Rakuten API. Retrying after delay...`);
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          logger.info(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue;
        }
      }

      if (statusCode >= 500) {
        logger.warn(`Rakuten API server error (${statusCode}). Retrying...`, { errorData });
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          logger.info(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue;
        }
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        logger.warn(`Network error: ${error.code}. Retrying...`);
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          logger.info(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue;
        }
      }

      logger.error('Rakuten API error', {
        statusCode,
        message: error.message,
        retry: retryCount
      });
    }
  }

  logger.error(`Failed to search hotels after ${MAX_RETRIES} retries`, {
    keyword,
    lastError: lastError?.message
  });

  throw lastError;
};

const calculateHotelScore = (hotel, alreadyPosted = false) => {
  if (alreadyPosted) return -1000;

  let score = 0;

  score += hotel.reviewAverage * 20;
  score += Math.log10(hotel.reviewCount + 1) * 10;
  score += hotel.affiliateUrl ? 30 : 0;
  score += hotel.images && hotel.images.length > 0 ? 10 : 0;

  return score;
};

module.exports = {
  searchHotels,
  calculateHotelScore,
};
