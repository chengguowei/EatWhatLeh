import express from 'express';
import prisma from '../db/prisma.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

// XP rewards per action
const XP_REWARDS = { review: 15 };

const BACKEND_MISSIONS = [
  {
    id: 'm1',
    xp: 25,
    check: (r) =>
      r.cuisine.toLowerCase().includes('nyonya') ||
      r.cuisine.toLowerCase().includes('peranakan'),
  },
  {
    id: 'm2',
    xp: 20,
    check: (r) => r.category === 'Dessert',
  },
  {
    id: 'm3',
    xp: 20,
    check: (r) => r.category === 'Cafe',
  },
  {
    id: 'm4',
    xp: 15,
    check: (r) => r.isHalal,
  },
  {
    id: 'm5',
    xp: 30,
    check: (r, rating) => rating >= 4 && (r.reviews ? r.reviews.length : 0) <= 9,
  },
];

// Badge definitions: unlocked at certain XP thresholds
const BADGE_THRESHOLDS = [
  { xp: 0,   badge: 'First Bite' },
  { xp: 50,  badge: 'Jonker Explorer' },
  { xp: 150, badge: 'Sambal Explorer' },
  { xp: 300, badge: 'Hawker Hunter' },
  { xp: 500, badge: 'Nyonya Master' },
  { xp: 800, badge: 'Gourmet Critic' },
  { xp: 1200, badge: 'Legendary Glutton' },
];

function computeLevel(xp) {
  if (xp < 100) return 1;
  if (xp < 250) return 2;
  if (xp < 500) return 3;
  if (xp < 1000) return 4;
  return 5;
}

function getEarnedBadges(xp) {
  return BADGE_THRESHOLDS.filter((b) => xp >= b.xp).map((b) => b.badge);
}

// Haversine formula: returns distance in km between two lat/lng points
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// POST /api/reviews
router.post('/', requireAuth, async (req, res) => {
  try {
    const { restaurantId, rating, comment, imageUrl, lat, lng } = req.body;
    const clerkId = req.auth.userId;

    if (!clerkId || !restaurantId || !rating || !comment) {
      return res.status(400).json({ error: 'Missing required fields.' });
    }

    // Upsert user by clerkId (in case they haven't been created yet)
    let user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found. Please log in.' });
    }

    // Check for duplicate reviews to prevent unique constraint violation
    const existingReview = await prisma.review.findFirst({
      where: { userId: user.id, restaurantId }
    });
    if (existingReview) {
      return res.status(400).json({ error: 'You have already submitted a review for this restaurant!' });
    }

    // Fetch restaurant coordinates to verify proximity check
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: restaurantId },
      include: { reviews: true }
    });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found.' });
    }

    // Location integrity check
    if (lat === undefined || lat === null || lng === undefined || lng === null) {
      return res.status(400).json({ error: 'User location is required to verify review integrity.' });
    }
    const userLat = parseFloat(lat);
    const userLng = parseFloat(lng);
    if (isNaN(userLat) || isNaN(userLng)) {
      return res.status(400).json({ error: 'Invalid user location coordinates.' });
    }

    const distanceKm = haversineDistance(userLat, userLng, restaurant.lat, restaurant.lng);
    const distanceMeters = distanceKm * 1000;

    // Enforce 200m limit
    if (distanceMeters > 200) {
      return res.status(403).json({
        error: `Location verification failed: You are too far from this restaurant (${Math.round(distanceMeters)}m away, limit is 200m) to submit a review.`
      });
    }

    // Create review
    const review = await prisma.review.create({
      data: { userId: user.id, restaurantId, rating: parseInt(rating), comment, imageUrl },
    });

    // Update XP, level, badges based on review + matching incomplete database missions
    const matchedMissions = BACKEND_MISSIONS.filter(m => m.check(restaurant, parseInt(rating)));
    let additionalXp = 0;
    
    for (const mission of matchedMissions) {
      const alreadyCompleted = await prisma.userMission.findUnique({
        where: {
          userId_missionId: { userId: user.id, missionId: mission.id }
        }
      });

      if (!alreadyCompleted) {
        await prisma.userMission.create({
          data: { userId: user.id, missionId: mission.id }
        });
        additionalXp += mission.xp;
      }
    }

    const newXp = user.xp + XP_REWARDS.review + additionalXp;
    const newLevel = computeLevel(newXp);
    const newBadges = getEarnedBadges(newXp);

    await prisma.user.update({
      where: { id: user.id },
      data: { xp: newXp, points: newXp, level: newLevel, badges: newBadges },
    });

    // Update restaurant average rating (Weighted by User Level)
    const allReviews = await prisma.review.findMany({
      where: { restaurantId },
      include: { user: { select: { level: true } } }
    });
    
    let totalWeight = 0;
    let weightedSum = 0;
    allReviews.forEach(r => {
      const weight = r.user?.level || 1;
      weightedSum += r.rating * weight;
      totalWeight += weight;
    });
    const avgRating = totalWeight > 0 ? weightedSum / totalWeight : 0;

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { rating: Math.round(avgRating * 10) / 10 },
    });

    const allCompletedMissions = await prisma.userMission.findMany({
      where: { userId: user.id }
    });

    res.json({
      review,
      xpEarned: XP_REWARDS.review + additionalXp,
      newXp,
      newLevel,
      newBadges,
      completedMissions: allCompletedMissions.map(um => um.missionId)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit review.' });
  }
});

// GET /api/reviews - Admin Only: Get all reviews (includes user level for weighting display)
router.get('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { name: true, level: true } },
        restaurant: { select: { name: true } }
      }
    });
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// GET /api/reviews/:restaurantId
router.get('/:restaurantId', async (req, res) => {
  try {
    const reviews = await prisma.review.findMany({
      where: { restaurantId: req.params.restaurantId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { name: true, level: true } } },
    });
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch reviews.' });
  }
});

// DELETE /api/reviews/:id - Admin Only: Delete review and recalculate rating
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    // Find the review to get the restaurantId
    // Note: mockDb.review doesn't support findUnique, but we can search using findMany
    const reviewList = await prisma.review.findMany({ where: { id } });
    if (reviewList.length === 0) {
      return res.status(404).json({ error: 'Review not found.' });
    }
    const review = reviewList[0];
    const { restaurantId } = review;

    // Delete review
    // Note: mockDb doesn't support prisma.review.delete, but we added a custom delete method inside mockDb.js
    await prisma.review.delete({ where: { id } });

    // Recalculate average rating (Weighted by User Level)
    const remaining = await prisma.review.findMany({
      where: { restaurantId },
      include: { user: { select: { level: true } } }
    });
    
    let totalWeight = 0;
    let weightedSum = 0;
    remaining.forEach(r => {
      const weight = r.user?.level || 1;
      weightedSum += r.rating * weight;
      totalWeight += weight;
    });
    const avgRating = totalWeight > 0 ? weightedSum / totalWeight : 0;

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { rating: Math.round(avgRating * 10) / 10 }
    });

    res.json({ message: 'Review moderated successfully.', deletedId: id, newRating: Math.round(avgRating * 10) / 10 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to moderate review.' });
  }
});

export default router;
