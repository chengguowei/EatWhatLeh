import express from 'express';
import prisma from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// GET /api/users/profile/:clerkId
router.get('/profile/:clerkId', requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = req.auth.userId;
    const role = req.auth.claims?.publicMetadata?.role || 'USER';

    if (req.params.clerkId !== authenticatedUserId && role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: You cannot access other users profiles.' });
    }

    const user = await prisma.user.findUnique({
      where: { clerkId: req.params.clerkId },
      include: { 
        reviews: { orderBy: { createdAt: 'asc' }, include: { restaurant: { select: { name: true, category: true } } } },
        missions: true
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found.' });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch profile.' });
  }
});

// POST /api/users/sync - called after Clerk login to create user if not exists
router.post('/sync', requireAuth, async (req, res) => {
  try {
    const authenticatedUserId = req.auth.userId;
    const { clerkId, name, email } = req.body;
    if (!clerkId || !name || !email) return res.status(400).json({ error: 'Missing fields.' });

    if (clerkId !== authenticatedUserId) {
      return res.status(403).json({ error: 'Forbidden: Cannot sync profile for another user ID.' });
    }

    const user = await prisma.user.upsert({
      where: { clerkId },
      update: { name, email },
      create: { clerkId, name, email, xp: 0, points: 0, level: 1, badges: ['First Bite'] },
    });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to sync user.' });
  }
});

// GET /api/users/leaderboard
router.get('/leaderboard', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { xp: 'desc' },
      take: 20,
      select: { id: true, name: true, xp: true, level: true, badges: true },
    });
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch leaderboard.' });
  }
});

export default router;
