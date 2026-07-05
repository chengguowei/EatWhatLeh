import express from 'express';
import prisma from '../db/prisma.js';
import { parseUserPrompt, generateXAIExplanation, generateConversationalReply } from '../services/gemini.js';
import { buildDiningSet, filterByRadius } from '../services/diningSet.js';
import { getUserPricePreference } from '../services/personalization.js';

const router = express.Router();

// Malacca city center as default simulated location
const DEFAULT_LAT = 2.1896;
const DEFAULT_LNG = 102.2501;

// Helper to calculate distance in km using Haversine formula
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

// Calculate recommendation match score (0-100) based on proximity, cuisine, rating, and user preferences
function calculateMatchScore(restaurant, parsedIntent, userLat, userLng, pricePref) {
  const { cuisine, priceRange, isHalal, keywords } = parsedIntent;
  
  let totalScore = 0;
  let maxPossibleScore = 0;
  const matchDetails = {};

  // 1. Proximity (Always active: max 30)
  maxPossibleScore += 30;
  let proximityScore = 0;
  let proximityLabel = "Proximity Check";
  
  let dist = restaurant.distance !== undefined ? restaurant.distance : null;
  if (dist === null && restaurant.distanceFromPrev !== undefined) {
    dist = restaurant.distanceFromPrev;
  }
  if (dist === null) {
    dist = haversineDistance(userLat, userLng, restaurant.lat, restaurant.lng);
  }

  if (dist <= 1.0) {
    proximityScore = 30;
    proximityLabel = "Excellent Proximity (≤1km)";
  } else if (dist <= 3.0) {
    proximityScore = 25;
    proximityLabel = "Good Proximity (1-3km)";
  } else if (dist <= 5.0) {
    proximityScore = 20;
    proximityLabel = "Moderate Proximity (3-5km)";
  } else if (dist <= 10.0) {
    proximityScore = 12;
    proximityLabel = "Acceptable Proximity (5-10km)";
  } else {
    proximityScore = Math.max(0, Math.round(30 - dist * 1.5));
    proximityLabel = `Far Proximity (${dist.toFixed(1)}km)`;
  }
  
  totalScore += proximityScore;
  matchDetails.proximityScore = proximityScore;
  matchDetails.proximityMax = 30;
  matchDetails.proximityLabel = proximityLabel;

  // 2. Rating Score (Always active: max 25)
  maxPossibleScore += 25;
  const ratingScore = Math.round(restaurant.rating * 5);
  const ratingLabel = `Stellar rating (${restaurant.rating}★)`;
  
  totalScore += ratingScore;
  matchDetails.ratingScore = ratingScore;
  matchDetails.ratingMax = 25;
  matchDetails.ratingLabel = ratingLabel;

  // 3. Cuisine Match (Active only if requested: max 25)
  if (cuisine) {
    maxPossibleScore += 25;
    let cuisineScore = 0;
    let cuisineLabel = "";
    const requestedCuisine = cuisine.toLowerCase();
    const rCuisine = restaurant.cuisine.toLowerCase();
    if (rCuisine.includes(requestedCuisine) || requestedCuisine.includes(rCuisine)) {
      cuisineScore = 25;
      cuisineLabel = `Matches requested cuisine "${cuisine}"`;
    } else {
      const hasWord = restaurant.tags.some(t => t.toLowerCase().includes(requestedCuisine)) || 
                      restaurant.description.toLowerCase().includes(requestedCuisine);
      if (hasWord) {
        cuisineScore = 15;
        cuisineLabel = `Partial match "${cuisine}" (in tags/details)`;
      } else {
        cuisineScore = 5;
        cuisineLabel = `Different cuisine (Requested: "${cuisine}")`;
      }
    }
    totalScore += cuisineScore;
    matchDetails.cuisineScore = cuisineScore;
    matchDetails.cuisineMax = 25;
    matchDetails.cuisineLabel = cuisineLabel;
  }

  // 4. Halal Preference (Active only if requested: max 10)
  if (isHalal !== null && isHalal !== undefined) {
    maxPossibleScore += 10;
    let preferenceScore = 0;
    let preferenceLabel = "";
    if (isHalal === restaurant.isHalal) {
      preferenceScore = 10;
      preferenceLabel = isHalal ? "Halal Verified" : "Non-Halal Match";
    } else {
      preferenceScore = 0;
      preferenceLabel = isHalal ? "Non-Halal (Requested Halal)" : "Halal (Requested Non-Halal)";
    }
    
    totalScore += preferenceScore;
    matchDetails.preferenceScore = (matchDetails.preferenceScore || 0) + preferenceScore;
    matchDetails.preferenceMax = (matchDetails.preferenceMax || 0) + 10;
    matchDetails.preferenceLabel = matchDetails.preferenceLabel 
      ? `${matchDetails.preferenceLabel}, ${preferenceLabel}`
      : preferenceLabel;
  }

  // 5. Price Preference (Active only if requested: max 10)
  if (priceRange) {
    maxPossibleScore += 10;
    let preferenceScore = 0;
    let preferenceLabel = "";
    if (priceRange === restaurant.priceRange) {
      preferenceScore = 10;
      preferenceLabel = "Price Match";
    } else {
      const lenDiff = Math.abs(priceRange.length - restaurant.priceRange.length);
      if (lenDiff === 1) {
        preferenceScore = 5;
        preferenceLabel = "Close Price Tier";
      } else {
        preferenceScore = 0;
        preferenceLabel = "Different Price Tier";
      }
    }
    
    totalScore += preferenceScore;
    matchDetails.preferenceScore = (matchDetails.preferenceScore || 0) + preferenceScore;
    matchDetails.preferenceMax = (matchDetails.preferenceMax || 0) + 10;
    matchDetails.preferenceLabel = matchDetails.preferenceLabel 
      ? `${matchDetails.preferenceLabel}, ${preferenceLabel}`
      : preferenceLabel;
  }

  // 6. Taste Profile Personalization (Scaled to 8% of maxPossibleScore)
  const tasteMax = Math.round(maxPossibleScore * 0.08); // Usually 4pts if base is 55, 8pts if base is 100
  let tasteScore = 0;
  let tasteLabel = "";
  
  if (pricePref === 'CHEAP') {
    if (restaurant.priceRange === '$') {
      tasteScore = tasteMax;
      tasteLabel = "Boosted for budget preference";
    } else if (restaurant.priceRange === '$$$') {
      tasteScore = -tasteMax;
      tasteLabel = "Penalized outside budget preference";
    }
  } else if (pricePref === 'EXPENSIVE') {
    if (restaurant.priceRange === '$$$') {
      tasteScore = tasteMax;
      tasteLabel = "Boosted for premium preference";
    } else if (restaurant.priceRange === '$') {
      tasteScore = -tasteMax;
      tasteLabel = "Penalized for budget food";
    }
  }
  
  if (tasteScore !== 0) {
    totalScore += tasteScore;
    matchDetails.tasteScore = tasteScore;
    matchDetails.tasteMax = tasteMax;
    matchDetails.tasteLabel = tasteLabel;
  }

  const matchPercentage = Math.min(100, Math.max(0, Math.round((totalScore / maxPossibleScore) * 100)));

  return {
    matchPercentage,
    matchDetails
  };
}

router.post('/', async (req, res) => {
  try {
    let { message, userLat = DEFAULT_LAT, userLng = DEFAULT_LNG, history = [], lastRestaurants = [], demoClerkId, clerkId } = req.body;
    console.log(`[Chat Debug] Received coordinates from frontend: lat=${userLat}, lng=${userLng}`);

    if (!message?.trim()) {
      return res.status(400).json({ error: 'Message is required.' });
    }

    // Check if the user is too far from Malacca (e.g., developer testing from another city)
    const distFromMelaka = haversineDistance(userLat, userLng, DEFAULT_LAT, DEFAULT_LNG);
    if (distFromMelaka > 80) {
      console.log(`⚠️ User is ${distFromMelaka.toFixed(1)}km from Malacca center. Falling back to default coordinates to prevent empty results.`);
      userLat = DEFAULT_LAT;
      userLng = DEFAULT_LNG;
    }

    // Resolve user price preference for personalisation
    // demoClerkId takes priority (switcher), fallback to real clerkId
    const pricePref = await getUserPricePreference(demoClerkId || clerkId || null);

    // 1. Parse user intent via Gemini (with conversation history for follow-up awareness)
    const parsed = await parseUserPrompt(message, history);
    const { isConversational, categories, cuisine, priceRange, isHalal, keywords, isItinerary, findHiddenGems } = parsed;

    // Strip generic/proximity words from keywords so they don't filter out valid restaurants.
    // If ALL keywords are generic (e.g. "food near me"), filteredKeywords becomes [] and
    // where.OR is never added — the DB returns all nearby candidates for proximity ranking.
    const GENERIC_WORDS = new Set([
      'food', 'foods', 'restaurant', 'restaurants', 'near', 'me', 'nearby',
      'closest', 'nearest', 'around', 'here', 'get', 'find', 'place',
      'places', 'show', 'recommend', 'eat', 'eating', 'spot', 'spots',
      'good', 'best', 'top', 'great', 'nice', 'any', 'some', 'want',
      'looking', 'search', 'hungry', 'craving', 'something', 'anything'
    ]);
    const filteredKeywords = (keywords || []).filter(kw => {
      // Split phrase into individual words and keep only if NONE are generic
      const words = kw.toLowerCase().split(/\s+/);
      return words.length > 0 && !words.every(w => GENERIC_WORDS.has(w));
    });
    console.log('[Chat Debug] Raw keywords:', keywords, '→ Filtered keywords:', filteredKeywords);

    // ── Conversational path: user is asking a follow-up Q&A, not searching ──
    if (isConversational) {
      const reply = await generateConversationalReply(message, history, lastRestaurants);
      return res.json({ reply, restaurants: lastRestaurants, isItinerary: false, isConversational: true });
    }

    // 2. Build DB filter for restaurant search
    const where = {};
    if (cuisine) where.cuisine = { contains: cuisine, mode: 'insensitive' };
    if (priceRange) where.priceRange = priceRange;
    if (isHalal !== null && isHalal !== undefined) where.isHalal = isHalal;
    if (categories?.length) where.category = { in: categories };
    if (findHiddenGems) {
      where.rating = { gte: 4.0 };
    }

    // Only apply keyword DB filter when there are meaningful (non-generic) keywords
    if (filteredKeywords.length > 0) {
      where.OR = filteredKeywords.map((kw) => ({
        OR: [
          { tags: { has: kw } },
          { description: { contains: kw, mode: 'insensitive' } },
          { name: { contains: kw, mode: 'insensitive' } },
        ],
      }));
    }
    console.log('[Chat Debug] DB where clause keys:', Object.keys(where), where.OR ? `(${where.OR.length} keyword filters)` : '(no keyword filter)');

    const useMock = process.env.USE_MOCK_DB !== 'false';
    let restaurants = [];

    const includeReviewsUser = {
      reviews: {
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { name: true, level: true } } }
      }
    };

    if (useMock) {
      // In-memory mock path (offline testing)
      let candidateRestaurants = await prisma.restaurant.findMany({ where, take: 40, include: includeReviewsUser });
      if (findHiddenGems) {
        candidateRestaurants = candidateRestaurants.filter(r => (r.reviews ? r.reviews.length : 0) <= 10);
      }
      if (candidateRestaurants.length === 0 && filteredKeywords.length > 0) {
        const fallbackWhere = { ...where };
        delete fallbackWhere.OR;
        candidateRestaurants = await prisma.restaurant.findMany({ where: fallbackWhere, take: 40, include: includeReviewsUser });
        if (findHiddenGems) {
          candidateRestaurants = candidateRestaurants.filter(r => (r.reviews ? r.reviews.length : 0) <= 10);
        }
      }
      if (candidateRestaurants.length === 0 && categories?.length) {
        candidateRestaurants = await prisma.restaurant.findMany({ where: { category: { in: categories } }, take: 40, include: includeReviewsUser });
        if (findHiddenGems) {
          candidateRestaurants = candidateRestaurants.filter(r => (r.reviews ? r.reviews.length : 0) <= 10);
        }
      }
      restaurants = filterByRadius(candidateRestaurants, userLat, userLng, 15);
    } else {
      // Real PostgreSQL + PostGIS path
      // 1. Fetch nearby restaurant IDs and calculated distances using PostGIS (15km radius)
      const nearby = await prisma.$queryRaw`
        SELECT id, (ST_DistanceSphere(ST_SetSRID(ST_MakePoint(lng, lat), 4326), ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)) / 1000) AS distance
        FROM "Restaurant"
        WHERE ST_DWithin(
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography,
          15000 -- 15 km in meters
        )
      `;

      // Sort by distance so we always pick the CLOSEST restaurants, not random DB insertion order
      nearby.sort((a, b) => a.distance - b.distance);
      const nearbyIds = nearby.slice(0, 40).map(r => r.id);
      console.log(`[Chat Debug] PostGIS found ${nearby.length} restaurants within 15km. Using closest ${nearbyIds.length}.`);
      if (nearby.length > 0) {
        console.log(`[Chat Debug] Closest: ${nearby[0].distance.toFixed(3)} km, Farthest included: ${nearby[Math.min(39, nearby.length - 1)].distance.toFixed(3)} km`);
      }

      if (nearbyIds.length > 0) {
        let candidateRestaurants = await prisma.restaurant.findMany({
          where: { id: { in: nearbyIds }, ...where },
          include: includeReviewsUser
        });
        if (findHiddenGems) {
          candidateRestaurants = candidateRestaurants.filter(r => (r.reviews ? r.reviews.length : 0) <= 10);
        }

        // 2b. Keyword soft-fallback
        if (candidateRestaurants.length === 0 && filteredKeywords.length > 0) {
          const fallbackWhere = { ...where };
          delete fallbackWhere.OR;
          candidateRestaurants = await prisma.restaurant.findMany({
            where: { id: { in: nearbyIds }, ...fallbackWhere },
            include: includeReviewsUser
          });
          if (findHiddenGems) {
            candidateRestaurants = candidateRestaurants.filter(r => (r.reviews ? r.reviews.length : 0) <= 10);
          }
        }

        // 2c. Last resort category fallback
        if (candidateRestaurants.length === 0 && categories?.length) {
          candidateRestaurants = await prisma.restaurant.findMany({
            where: { id: { in: nearbyIds }, category: { in: categories } },
            include: includeReviewsUser
          });
          if (findHiddenGems) {
            candidateRestaurants = candidateRestaurants.filter(r => (r.reviews ? r.reviews.length : 0) <= 10);
          }
        }

        // Attach computed distances and sort by distance
        restaurants = candidateRestaurants.map(r => {
          const match = nearby.find(nr => nr.id === r.id);
          return { ...r, distance: match ? parseFloat(match.distance.toFixed(2)) : 0 };
        }).sort((a, b) => a.distance - b.distance);
      }
    }

    let selectedRestaurants = [];

    if (isItinerary && categories?.length > 1) {
      // 4a. Build a Dining Set (sequential itinerary — attaches distanceFromPrev + walkMinutes)
      const pools = {};
      for (const cat of categories) {
        pools[cat] = restaurants.filter((r) => r.category === cat);
        if (!pools[cat].length) {
          // Broaden per-category if radius filter wiped the pool
          let broadPool = [];
          if (useMock) {
            const tempPool = await prisma.restaurant.findMany({ where: { category: cat }, take: 5 });
            broadPool = filterByRadius(tempPool, userLat, userLng, 50); // wider radius fallback
            if (!broadPool.length) broadPool = tempPool;
          } else {
            // PostGIS 50km query for this category
            const nearby50 = await prisma.$queryRaw`
              SELECT id, (ST_DistanceSphere(ST_SetSRID(ST_MakePoint(lng, lat), 4326), ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)) / 1000) AS distance
              FROM "Restaurant"
              WHERE ST_DWithin(
                ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
                ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography,
                50000 -- 50 km in meters
              )
            `;
            if (nearby50.length > 0) {
              const ids50 = nearby50.map(r => r.id);
              const matched50 = await prisma.restaurant.findMany({
                where: { id: { in: ids50 }, category: cat },
                take: 5
              });
              broadPool = matched50.map(r => {
                const match = nearby50.find(nr => nr.id === r.id);
                return { ...r, distance: match ? parseFloat(match.distance.toFixed(2)) : 0 };
              });
            }
            if (broadPool.length === 0) {
              // No distance constraints
              broadPool = await prisma.restaurant.findMany({ where: { category: cat }, take: 5 });
            }
          }
          pools[cat] = broadPool;
        }
      }
      selectedRestaurants = buildDiningSet(categories, pools, userLat, userLng);
    }
    let finalRestaurants = [];

    if (isItinerary && categories?.length > 1) {
      if (selectedRestaurants.length > 0) {
        finalRestaurants = selectedRestaurants.map(r => {
          const scoreData = calculateMatchScore(r, parsed, userLat, userLng, pricePref);
          const hasExpertEndorsement = r.reviews ? r.reviews.some(rev => (rev.user?.level || 1) >= 4) : false;
          const slicedReviews = r.reviews ? r.reviews.slice(0, 3) : [];
          return {
            ...r,
            reviews: slicedReviews,
            matchPercentage: scoreData.matchPercentage,
            matchDetails: scoreData.matchDetails,
            hasExpertEndorsement,
            pricePref
          };
        });
      }
    } else {
      // 4b. Simple recommendations: calculate match score for all candidates
      if (restaurants.length > 0) {
        const mappedCandidates = restaurants.map(r => {
          const scoreData = calculateMatchScore(r, parsed, userLat, userLng, pricePref);
          const hasExpertEndorsement = r.reviews ? r.reviews.some(rev => (rev.user?.level || 1) >= 4) : false;
          const slicedReviews = r.reviews ? r.reviews.slice(0, 3) : [];
          return {
            ...r,
            reviews: slicedReviews,
            matchPercentage: scoreData.matchPercentage,
            matchDetails: scoreData.matchDetails,
            hasExpertEndorsement,
            pricePref
          };
        });

        // Sort by distance ascending to get the closest matches (Prompt/proximity based)
        const closestCandidates = [...mappedCandidates].sort((a, b) => (a.distance || 0) - (b.distance || 0));
        
        // 1. Take top 3 based on prompt/proximity
        const primaryResults = closestCandidates.slice(0, 3).map(r => ({
          ...r,
          recommendationType: 'prompt'
        }));
        
        // 2. Take top 3 based on preferences from the remaining pool (no overlap)
        // If there's no active taste profile (budget pref or specific search parameters), we hide/skip this section completely.
        const hasTasteProfile = (pricePref && pricePref !== 'NONE') || cuisine || priceRange || (isHalal !== null && isHalal !== undefined);
        const remainingForPrefs = mappedCandidates.filter(r => !primaryResults.some(pr => pr.id === r.id));
        remainingForPrefs.sort((a, b) => b.matchPercentage - a.matchPercentage);
        
        const preferenceResults = hasTasteProfile
          ? remainingForPrefs.slice(0, 3).map(r => ({
              ...r,
              recommendationType: 'preference'
            }))
          : [];
        
        // 3. Take 1 hidden gem from the remaining pool (excluding both primary and preference results)
        const remainingForGem = remainingForPrefs.filter(r => !preferenceResults.some(pr => pr.id === r.id));
        const gemCandidates = remainingForGem.filter(r => (r.reviews?.length || 0) <= 10 && r.rating >= 4.0);
        gemCandidates.sort((a, b) => b.matchPercentage - a.matchPercentage);
        const hiddenGemResult = gemCandidates.slice(0, 1).map(r => ({
          ...r,
          recommendationType: 'gem'
        }));
        
        finalRestaurants = [...primaryResults, ...preferenceResults, ...hiddenGemResult];

        // Debug: log final selection for live diagnosis
        console.log('[Chat Debug] Final selection:');
        finalRestaurants.forEach((r, i) => {
          let label = "Prompt Result";
          if (i >= primaryResults.length && i < primaryResults.length + preferenceResults.length) {
            label = "Preference Result";
          } else if (i >= primaryResults.length + preferenceResults.length) {
            label = "Hidden Gem";
          }
          console.log(`  ${i + 1}. [${label}] ${r.name} — dist: ${(r.distance || 0).toFixed(3)} km, match: ${r.matchPercentage}%`);
        });
      }
    }

    if (finalRestaurants.length === 0) {
      return res.json({
        reply: "Hmm, I couldn't find anything matching that in Melaka right now. Try broadening your search lah! 😊",
        restaurants: [],
        isItinerary: false,
      });
    }

    // 5. Generate XAI explanation (distance info is included in restaurant summaries)
    const reply = await generateXAIExplanation(message, finalRestaurants, isItinerary, parsed, pricePref);

    res.json({ reply, restaurants: finalRestaurants, isItinerary, parsedIntent: parsed.intent });
  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

export default router;
