import express from 'express';

const router = express.Router();

// Simple in-memory cache
const cache = new Map();

// Simple queue for rate limiting (1 request per second)
const queue = [];
let isProcessing = false;

const processQueue = async () => {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  const { lat, lon, resolve, reject } = queue.shift();

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'TranspoPilotAI/1.0 (contact@transpopilotai.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`Nominatim error: ${response.status}`);
    }

    const data = await response.json();
    resolve(data);
  } catch (error) {
    reject(error);
  }

  // Wait 1 second before processing the next request
  setTimeout(() => {
    isProcessing = false;
    processQueue();
  }, 1000); // 1 request per second
};

router.get('/geocode/reverse', async (req, res) => {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: 'lat and lon are required' });
  }

  // Round coordinates to ~11 meters (4 decimal places) for caching
  const roundedLat = parseFloat(lat).toFixed(4);
  const roundedLon = parseFloat(lon).toFixed(4);
  const cacheKey = `${roundedLat},${roundedLon}`;

  if (cache.has(cacheKey)) {
    return res.json(cache.get(cacheKey));
  }

  return new Promise((resolve, reject) => {
    queue.push({
      lat,
      lon,
      resolve: (data) => {
        cache.set(cacheKey, data);
        res.json(data);
        resolve(data);
      },
      reject: (error) => {
        res.status(500).json({ error: error.message });
        resolve(null);
      }
    });
    processQueue();
  });
});

export default router;
