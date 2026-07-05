import express from 'express';
import prisma from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// GET /api/admin/fraud-detection - Admin Only: Scan users and detect review/XP farming anomalies
router.get('/fraud-detection', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: { restaurant: { select: { name: true } } }
        }
      }
    });

    const flaggedUsers = [];
    const now = Date.now();

    for (const u of users) {
      const reasons = [];

      // Check 1: Review count per hour (XP farming check)
      const lastHourReviews = u.reviews.filter(
        r => now - new Date(r.createdAt).getTime() < 3600 * 1000
      );
      if (lastHourReviews.length > 3) {
        reasons.push(`XP Farming: Submitted ${lastHourReviews.length} reviews in the last hour.`);
      }

      // Check 2: Speed submission anomaly (reviews submitted within 60 seconds of each other)
      for (let i = 0; i < u.reviews.length - 1; i++) {
        const t1 = new Date(u.reviews[i].createdAt).getTime();
        const t2 = new Date(u.reviews[i + 1].createdAt).getTime();
        const diff = Math.abs(t1 - t2);
        if (diff < 60 * 1000) {
          reasons.push(`Velocity Anomaly: Multiple review submissions within ${(diff / 1000).toFixed(0)} seconds.`);
          break;
        }
      }

      // Check 3: Identical/duplicate comments
      const comments = u.reviews.map(r => r.comment.trim().toLowerCase());
      const uniqueComments = new Set(comments);
      if (comments.length !== uniqueComments.size) {
        reasons.push(`Content Duplicate Anomaly: Identical review descriptions submitted across different eateries.`);
      }

      if (reasons.length > 0) {
        flaggedUsers.push({
          id: u.id,
          name: u.name,
          email: u.email,
          xp: u.xp,
          level: u.level,
          reasons,
          recentReviews: u.reviews.slice(0, 5)
        });
      }
    }

    res.json(flaggedUsers);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to scan for fraud.' });
  }
});

// POST /api/admin/users/:id/freeze - Admin Only: Reset/freeze flagged user XP
router.post('/users/:id/freeze', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    // Reset XP, points, level, and clear badges as penalty for farming
    const updated = await prisma.user.update({
      where: { id },
      data: {
        xp: 0,
        points: 0,
        level: 1,
        badges: ['First Bite']
      }
    });

    res.json({ message: 'User XP has been reset to zero successfully.', user: updated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to freeze/reset user.' });
  }
});

// GET /api/admin/tag-conflicts - Admin Only: Get restaurant tags with consensus conflicts (high downvote ratio)
router.get('/tag-conflicts', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const votes = await prisma.tagVote.findMany({
      include: {
        restaurant: { select: { name: true, tags: true } }
      }
    });

    const groupings = {};

    votes.forEach(v => {
      const key = `${v.restaurantId}-${v.tag}`;
      if (!groupings[key]) {
        groupings[key] = {
          restaurantId: v.restaurantId,
          restaurantName: v.restaurant?.name || 'Unknown',
          restaurantTags: v.restaurant?.tags || [],
          tag: v.tag,
          upvotes: 0,
          downvotes: 0,
          total: 0
        };
      }
      if (v.isPositive) {
        groupings[key].upvotes += 1;
      } else {
        groupings[key].downvotes += 1;
      }
      groupings[key].total += 1;
    });

    // Filter to conflicts: any tag with downvotes where negative consensus is >= 40%
    const conflicts = Object.values(groupings).filter(g => {
      const negativeRatio = g.downvotes / g.total;
      return g.downvotes > 0 && negativeRatio >= 0.40;
    });

    res.json(conflicts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tag conflicts.' });
  }
});

// POST /api/admin/resolve-tag - Admin Only: Confirm or delete tag with votes
router.post('/resolve-tag', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { restaurantId, tag, action } = req.body; // action: 'keep' | 'delete'

    if (!restaurantId || !tag || !action) {
      return res.status(400).json({ error: 'Missing required parameters.' });
    }

    if (action === 'delete') {
      const restaurant = await prisma.restaurant.findUnique({ where: { id: restaurantId } });
      if (restaurant) {
        // Remove tag from tags list
        const newTags = restaurant.tags.filter(t => t.toLowerCase() !== tag.toLowerCase());
        await prisma.restaurant.update({
          where: { id: restaurantId },
          data: { tags: newTags }
        });
      }
    }

    // Delete tag votes after resolution
    await prisma.tagVote.deleteMany({
      where: {
        restaurantId,
        tag: { equals: tag, mode: 'insensitive' }
      }
    });

    res.json({ message: `Successfully resolved tag "${tag}" with action "${action}".` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to resolve tag conflict.' });
  }
});

export default router;
