import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import prisma from './db/prisma.js';
import restaurantRoutes from './routes/restaurants.js';
import chatRoutes from './routes/chat.js';
import reviewRoutes from './routes/reviews.js';
import userRoutes from './routes/users.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5180',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5180'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like Postman or mobile apps)
    if (!origin) return callback(null, true);
    
    const isLocal = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:');
    const isGitHubDev = origin.includes('.github.dev');
    const isDevTunnel = origin.includes('.devtunnels.ms');
    
    if (isLocal || isGitHubDev || isDevTunnel || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`🚨 CORS Blocked Origin: ${origin}`);
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true
}));
app.use(express.json());

app.use('/api/restaurants', restaurantRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (_req, res) => res.json({ status: 'ok', app: 'EatWhatLeh' }));

app.listen(PORT, async () => {
  console.log(`🍽️  EatWhatLeh API running on http://localhost:${PORT}`);
  
  // Pruning garbage collection: Remove expired tiles and unreviewed cached OSM restaurants
  try {
    console.log('🧹 Running database cleanup garbage collection...');
    
    // 1. Delete tile caches older than 24 hours
    const expiredTiles = await prisma.osmTileCache.deleteMany({
      where: {
        createdAt: { lte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
      }
    });
    if (expiredTiles.count > 0) {
      console.log(`🧹 Deleted ${expiredTiles.count} expired tile cache bounds.`);
    }

    // 2. Delete restaurants from OSM that are older than 7 days AND have no user reviews
    const expiredRestaurants = await prisma.restaurant.deleteMany({
      where: {
        osmId: { not: null },
        createdAt: { lte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        reviews: { none: {} }
      }
    });
    if (expiredRestaurants.count > 0) {
      console.log(`🧹 Pruned ${expiredRestaurants.count} unreviewed cached restaurants.`);
    }
    
    console.log('✅ Database footprint cleanup complete!');
  } catch (gcErr) {
    console.warn('⚠️ Database pruning warning:', gcErr.message);
  }
});
