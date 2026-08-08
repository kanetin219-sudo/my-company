const axios = require('axios');
const logger = require('./logger');

const GRAPH_API_BASE = 'https://graph.threads.net';
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const getRetryDelay = (retryCount) => RETRY_DELAYS[retryCount] || 10000;

const createThreadsContainer = async (text, threadsUserId, accessToken) => {
  if (!threadsUserId || !accessToken) {
    logger.error('Missing Threads API credentials');
    throw new Error('THREADS_USER_ID or THREADS_ACCESS_TOKEN not set');
  }

  if (!text || text.length === 0) {
    logger.error('Post text is empty');
    throw new Error('Post text cannot be empty');
  }

  if (text.length > 500) {
    logger.error('Post text exceeds 500 character limit', { length: text.length });
    throw new Error('Post text exceeds maximum length (500 characters)');
  }

  let lastError;

  for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
    try {
      logger.info(`Creating Threads container (Retry: ${retryCount}/${MAX_RETRIES})`);

      const url = `${GRAPH_API_BASE}/${threadsUserId}/threads`;
      const response = await axios.post(
        url,
        { text },
        {
          params: { access_token: accessToken },
          timeout: 10000,
        }
      );

      if (!response.data || !response.data.id) {
        logger.error('Invalid response from Threads API (container creation)', { response: response.data });
        throw new Error('No container ID returned from Threads API');
      }

      logger.info(`Container created successfully: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      lastError = error;

      const statusCode = error.response?.status;
      const errorData = error.response?.data;

      if (statusCode === 401) {
        logger.error('Threads API authentication error (401)', {
          message: error.message,
          errorData
        });
        throw error;
      }

      if (statusCode === 403) {
        logger.error('Threads API permission denied (403)', {
          message: error.message,
          errorData
        });
        throw error;
      }

      if (statusCode === 429) {
        logger.warn(`Rate limited by Threads API. Retrying after delay...`);
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          logger.info(`Waiting ${delay}ms before retry...`);
          await sleep(delay);
          continue;
        }
      }

      if (statusCode >= 500) {
        logger.warn(`Threads API server error (${statusCode}). Retrying...`, { errorData });
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

      logger.error('Threads container creation error', {
        statusCode,
        message: error.message,
        retry: retryCount,
        errorData
      });
    }
  }

  logger.error(`Failed to create container after ${MAX_RETRIES} retries`, {
    lastError: lastError?.message
  });

  throw lastError;
};

const publishThreadsPost = async (containerId, threadsUserId, accessToken) => {
  if (!containerId) {
    logger.error('Container ID is missing');
    throw new Error('Container ID is required for publishing');
  }

  if (!threadsUserId || !accessToken) {
    logger.error('Missing Threads API credentials for publishing');
    throw new Error('THREADS_USER_ID or THREADS_ACCESS_TOKEN not set');
  }

  let lastError;

  for (let retryCount = 0; retryCount <= MAX_RETRIES; retryCount++) {
    try {
      logger.info(`Publishing Threads post (Retry: ${retryCount}/${MAX_RETRIES})`);

      const url = `${GRAPH_API_BASE}/${threadsUserId}/threads_publish`;
      const response = await axios.post(
        url,
        { creation_id: containerId },
        {
          params: { access_token: accessToken },
          timeout: 10000,
        }
      );

      if (!response.data || !response.data.id) {
        logger.error('Invalid response from Threads API (publishing)', { response: response.data });
        throw new Error('No post ID returned from Threads API');
      }

      logger.success(`Post published successfully: ${response.data.id}`);
      return response.data.id;
    } catch (error) {
      lastError = error;

      const statusCode = error.response?.status;
      const errorData = error.response?.data;

      if (statusCode === 401 || statusCode === 403) {
        logger.error(`Threads API auth error (${statusCode})`, { errorData });
        throw error;
      }

      if (statusCode === 429) {
        logger.warn(`Rate limited by Threads API. Retrying...`);
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          await sleep(delay);
          continue;
        }
      }

      if (statusCode >= 500) {
        logger.warn(`Threads API server error (${statusCode}). Retrying...`);
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          await sleep(delay);
          continue;
        }
      }

      if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || error.code === 'ENOTFOUND') {
        logger.warn(`Network error: ${error.code}. Retrying...`);
        if (retryCount < MAX_RETRIES) {
          const delay = getRetryDelay(retryCount);
          await sleep(delay);
          continue;
        }
      }

      logger.error('Threads publishing error', {
        containerId,
        statusCode,
        message: error.message,
        retry: retryCount,
        errorData
      });
    }
  }

  logger.error(`Failed to publish after ${MAX_RETRIES} retries`, {
    containerId,
    lastError: lastError?.message
  });

  throw lastError;
};

const postToThreads = async (text, threadsUserId, accessToken) => {
  try {
    const containerId = await createThreadsContainer(text, threadsUserId, accessToken);
    const postId = await publishThreadsPost(containerId, threadsUserId, accessToken);
    return postId;
  } catch (error) {
    logger.error('Failed to post to Threads', { error: error.message });
    throw error;
  }
};

module.exports = {
  createThreadsContainer,
  publishThreadsPost,
  postToThreads,
};
