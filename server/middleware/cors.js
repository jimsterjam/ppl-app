// server/middleware/cors.js
import cors from 'cors';

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [];

const isDev = process.env.NODE_ENV !== 'production';

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (e.g., mobile apps, server-to-server)
    if (!origin) {
      if (isDev) {
        console.log('[CORS] Request without Origin header (mobile/server) → allowed');
      }
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      if (isDev) {
        console.log(`[CORS] Origin allowed: ${origin}`);
      }
      return callback(null, true);
    } else {
      if (isDev) {
        console.log(`[CORS] Origin denied: ${origin}`);
      }
      return callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

export default cors(corsOptions);
