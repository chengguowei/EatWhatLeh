import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import mockDb from './mockDb.js';

dotenv.config();

// Default to mock mode (true) unless USE_MOCK_DB is explicitly set to 'false'
const useMock = process.env.USE_MOCK_DB !== 'false';

let prisma;

if (useMock) {
  console.log('🔌 Using in-memory Mock Database (No PostgreSQL connection required)');
  prisma = mockDb;
} else {
  console.log('🗄️ Connecting to PostgreSQL database...');
  try {
    // Prisma 7 requires a driver adapter to connect to PostgreSQL at runtime
    const { PrismaPg } = await import('@prisma/adapter-pg');
    const pgModule = await import('pg');
    const pg = pgModule.default || pgModule;
    
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      family: 4,
    });
    const adapter = new PrismaPg(pool);
    
    prisma = new PrismaClient({ adapter });
  } catch (err) {
    console.warn('\n⚠️  PrismaClientInitializationError:');
    console.warn(err);
    console.warn('💡 Falling back to Mock Database to keep the server running!\n');
    prisma = mockDb;
  }
}

export default prisma;
