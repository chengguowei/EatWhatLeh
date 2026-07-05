import express from 'express';
import prisma from '../db/prisma.js';
import { filterByRadius, haversineDistance } from '../services/diningSet.js';
import { getUserPricePreference } from '../services/personalization.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();

const DEFAULT_LAT = 2.1896;
const DEFAULT_LNG = 102.2501;

// ─── Personalized Ranking Helpers ───────────────────────────────────────────

/**
 * Score a restaurant for personalized feed ranking.
 *
 * WEIGHTS (commented for FYP report):
 *   Rating Score   (50 pts max) — Base quality signal: rating × 10
 *   Exposure Score (20 pts max) — Boosts hidden gems (low reviews) or popular spots
 *   Distance Score (30 pts max) — Closer = higher score (drops to 0 at >= 10km)
 *   Price Adjust   (±30 pts)   — Personalization override based on user history
 *
 * A user who has reviewed mostly cheap food (User A) will see cheap restaurants
 * ranked significantly higher even if expensive ones have marginally better ratings.
 */
function computePersonalizedScore(restaurant, distanceKm, pricePref, hiddenGemsMode) {
  const reviewCount = restaurant.reviews ? restaurant.reviews.length : 0;

  // 1. Rating Score (0–50): Core quality indicator
  const ratingScore = restaurant.rating * 10;  // e.g. 4.8 → 48

  // 2. Exposure Score (0–20): Favours gems if hiddenGemsMode, else rewards popularity
  let exposureScore;
  if (hiddenGemsMode) {
    // Hidden gems mode: fewer reviews = more undiscovered = higher score
    exposureScore = Math.max(0, 20 - reviewCount * 1.5);
  } else {
    // Normal mode: more reviews = more established = slightly higher trust
    exposureScore = Math.min(20, reviewCount * 1.0);
  }

  // 3. Distance Score (0–30): Closer restaurants rank higher
  const distanceScore = Math.max(0, 30 - distanceKm * 3.0);

  // 4. Price Preference Adjustment (personalization override)
  // This is the key differentiator between User A and User B
  let priceAdjustment = 0;
  if (pricePref === 'CHEAP') {
    if (restaurant.priceRange === '$')        priceAdjustment = +30;  // Boost cheap
    else if (restaurant.priceRange === '$$$') priceAdjustment = -30;  // Penalise expensive
    // $$ gets 0 adjustment (neutral)
  } else if (pricePref === 'EXPENSIVE') {
    if (restaurant.priceRange === '$$$')      priceAdjustment = +30;  // Boost expensive
    else if (restaurant.priceRange === '$')   priceAdjustment = -15;  // Slight penalty
  }

  const total = ratingScore + exposureScore + distanceScore + priceAdjustment;
  return {
    score: total,
    breakdown: { ratingScore, exposureScore, distanceScore, priceAdjustment },
  };
}

// GET /api/restaurants - get all or filtered restaurants (with personalized ranking)
router.get('/', async (req, res) => {
  try {
    const { category, cuisine, priceRange, isHalal, lat, lng, radius = 15, hiddenGemsOnly, demoClerkId, clerkId } = req.query;

    const where = {};
    if (category) where.category = category;
    if (cuisine) where.cuisine = { contains: cuisine, mode: 'insensitive' };
    if (priceRange) where.priceRange = priceRange;
    if (isHalal !== undefined) where.isHalal = isHalal === 'true';
    if (hiddenGemsOnly === 'true') {
      where.rating = { gte: 4.0 };
    }

    const useMock = process.env.USE_MOCK_DB !== 'false';
    let userLat = parseFloat(lat) || DEFAULT_LAT;
    let userLng = parseFloat(lng) || DEFAULT_LNG;
    const radiusKm = parseFloat(radius);
    const isHiddenGems = hiddenGemsOnly === 'true';

    // Check if the user is too far from Malacca (e.g., developer testing from another city)
    if (lat && lng) {
      const distFromMelaka = haversineDistance(userLat, userLng, DEFAULT_LAT, DEFAULT_LNG);
      if (distFromMelaka > 80) {
        console.log(`⚠️ User is ${distFromMelaka.toFixed(1)}km from Malacca center. Falling back to default coordinates to prevent empty feed.`);
        userLat = DEFAULT_LAT;
        userLng = DEFAULT_LNG;
      }
    }

    // Resolve user price preference for personalisation
    // demoClerkId takes priority (switcher), fallback to real clerkId
    const pricePref = await getUserPricePreference(demoClerkId || clerkId || null);

    let restaurants = [];

    if (useMock) {
      const allRestaurants = await prisma.restaurant.findMany({
        where,
        include: { reviews: { orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, level: true } } } } },
        orderBy: { rating: 'desc' },
      });
      const filtered = filterByRadius(allRestaurants, userLat, userLng, radiusKm);
      const gemFiltered = isHiddenGems ? filtered.filter(r => r.reviews.length <= 10) : filtered;
      restaurants = gemFiltered.map(r => {
        const hasExpertEndorsement = r.reviews.some(rev => (rev.user?.level || 1) >= 4);
        const previewReviews = r.reviews.slice(0, 2);  // top-2 review preview for feed
        const distKm = parseFloat(r.distance.toFixed(2));
        const { score, breakdown } = computePersonalizedScore(r, distKm, pricePref, isHiddenGems);
        return {
          ...r,
          reviews: previewReviews,
          distance: distKm,
          hasExpertEndorsement,
          personalizedScore: score,
          rankingBreakdown: breakdown,
          pricePref,
        };
      }).sort((a, b) => b.personalizedScore - a.personalizedScore);
    } else {
      // Real PostgreSQL + PostGIS spatial search path
      const nearby = await prisma.$queryRaw`
        SELECT id, (ST_DistanceSphere(ST_SetSRID(ST_MakePoint(lng, lat), 4326), ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)) / 1000) AS distance
        FROM "Restaurant"
        WHERE ST_DWithin(
          ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography,
          ST_SetSRID(ST_MakePoint(${userLng}, ${userLat}), 4326)::geography,
          ${radiusKm * 1000}
        )
      `;

      if (nearby.length > 0) {
        const ids = nearby.map(r => r.id);
        const matchedRestaurants = await prisma.restaurant.findMany({
          where: { id: { in: ids }, ...where },
          include: { reviews: { orderBy: { createdAt: 'desc' }, include: { user: { select: { name: true, level: true } } } } },
        });

        const gemFiltered = isHiddenGems
          ? matchedRestaurants.filter(r => r.reviews.length <= 10)
          : matchedRestaurants;

        restaurants = gemFiltered.map(r => {
          const match = nearby.find(nr => nr.id === r.id);
          const distKm = match ? parseFloat(match.distance.toFixed(2)) : 0;
          const hasExpertEndorsement = r.reviews.some(rev => (rev.user?.level || 1) >= 4);
          const previewReviews = r.reviews.slice(0, 2); // top-2 review preview for feed
          const { score, breakdown } = computePersonalizedScore(r, distKm, pricePref, isHiddenGems);
          return {
            ...r,
            reviews: previewReviews,
            distance: distKm,
            hasExpertEndorsement,
            personalizedScore: score,
            rankingBreakdown: breakdown,
            pricePref,
          };
        }).sort((a, b) => b.personalizedScore - a.personalizedScore);
      }
    }

    res.json(restaurants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch restaurants.' });
  }
});

// GET /api/restaurants/search-osm?query=<name>
// Live search: looks up a restaurant name in OSM for Melaka, imports found
// eateries into the DB, and returns matched records. Used by the Review Page
// when users want to review a restaurant not yet in our database.
router.get('/search-osm', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query || query.trim().length < 2) {
      return res.status(400).json({ error: 'Search query must be at least 2 characters.' });
    }

    const sanitized = query.trim();
    console.log(`🔍 Live OSM search for: "${sanitized}"`);

    // Overpass QL: case-insensitive name match within Melaka bounding box
    const overpassQuery = `
      [out:json][timeout:25];
      (
        node["amenity"~"restaurant|cafe|bar|fast_food"]["name"~"${sanitized}",i](2.05,102.05,2.35,102.40);
        way["amenity"~"restaurant|cafe|bar|fast_food"]["name"~"${sanitized}",i](2.05,102.05,2.35,102.40);
      );
      out center;
    `;

    const osmResponse = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body: overpassQuery,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'EatWhatLeh-FYP-App/1.0 (contact: fyp@eatwhatleh.com)',
      },
    });

    if (!osmResponse.ok) throw new Error(`Overpass API returned ${osmResponse.status}`);
    const osmData = await osmResponse.json();
    const elements = osmData.elements || [];

    const newEateries = [];
    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name;
      if (!name) continue;

      const lat = el.lat || el.center?.lat;
      const lng = el.lon || el.center?.lon;
      if (!lat || !lng) continue;

      let category = 'Main';
      if (tags.amenity === 'cafe') category = 'Cafe';
      else if (tags.amenity === 'bar') category = 'Bar';

      let cuisine = tags.cuisine || 'Local Delights';
      cuisine = cuisine.split(';')[0].replace(/_/g, ' ');
      cuisine = cuisine.charAt(0).toUpperCase() + cuisine.slice(1);

      const isHalal = tags.halal === 'yes' ||
        tags['diet:halal'] === 'yes' ||
        cuisine.toLowerCase().includes('malay') ||
        cuisine.toLowerCase().includes('indian muslim');

      const imgList = {
        Cafe: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=600',
        Bar: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600',
        Dessert: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600',
        Main: 'https://images.unsplash.com/photo-1514190051997-0f6f39ca5cde?w=600',
      };

      newEateries.push({
        osmId: `${el.type}/${el.id}`,
        name,
        description: tags.description || `A ${cuisine.toLowerCase()} ${category.toLowerCase()} in Melaka.`,
        cuisine,
        category,
        address: tags['addr:full'] || tags['addr:street'] ? `${tags['addr:street'] || ''}, Melaka` : `${name}, Melaka`,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        priceRange: '$$',
        tags: ['Local', category, ...(isHalal ? ['Halal'] : [])].slice(0, 5),
        rating: 0,
        imageUrl: imgList[category] || imgList.Main,
        openHours: tags.opening_hours || '10am – 10pm',
        isHalal,
      });
    }

    if (newEateries.length > 0) {
      await prisma.restaurant.createMany({ data: newEateries, skipDuplicates: true });
      console.log(`✅ Imported ${newEateries.length} new restaurant(s) from OSM search.`);
    }

    // Return all DB matches for the query name (including existing + newly imported)
    const matched = await prisma.restaurant.findMany({
      where: { name: { contains: sanitized, mode: 'insensitive' } },
      include: { reviews: { orderBy: { createdAt: 'desc' }, take: 2, include: { user: { select: { name: true, level: true } } } } },
      take: 10,
    });

    res.json({ found: matched.length, restaurants: matched });
  } catch (err) {
    console.error('OSM search error:', err);
    res.status(500).json({ error: 'Live restaurant search failed. Please try again.' });
  }
});

// Helper to fetch live eateries in the viewport from OpenStreetMap
async function fetchOsmEateries(minLat, minLng, maxLat, maxLng) {
  const query = `
    [out:json][timeout:30];
    (
      node["amenity"~"restaurant|cafe|bar|fast_food"](${minLat},${minLng},${maxLat},${maxLng});
      way["amenity"~"restaurant|cafe|bar|fast_food"](${minLat},${minLng},${maxLat},${maxLng});
    );
    out center;
  `;
  const url = 'https://overpass-api.de/api/interpreter';
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: query,
      headers: { 
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'EatWhatLeh-FYP-App/1.0 (contact: fyp@eatwhatleh.com)'
      }
    });
    
    if (!response.ok) throw new Error(`OSM Server returned ${response.status}`);
    const data = await response.json();
    const elements = data.elements || [];
    
    const UNSPLASH_IMAGES = {
      Cafe: [
        'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=600',
        'https://images.unsplash.com/photo-1498804103079-a6351b050096?w=600',
        'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=600',
        'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600'
      ],
      Bar: [
        'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600',
        'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600',
        'https://images.unsplash.com/photo-1528605248644-14dd04022da1?w=600',
        'https://images.unsplash.com/photo-1574096079513-d8259312b785?w=600'
      ],
      Dessert: [
        'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600',
        'https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=600',
        'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=600',
        'https://images.unsplash.com/photo-1551024601-bec78aea704b?w=600'
      ],
      Main: [
        'https://images.unsplash.com/photo-1569944990780-ef3b9b8048f2?w=600',
        'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600',
        'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600',
        'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600',
        'https://images.unsplash.com/photo-1514190051997-0f6f39ca5cde?w=600',
        'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600',
        'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600'
      ]
    };
    
    const eateries = [];
    const seenNames = new Set();
    
    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name;
      if (!name || seenNames.has(name.toLowerCase())) continue;
      seenNames.add(name.toLowerCase());
      
      const lat = el.lat || (el.center && el.center.lat);
      const lng = el.lon || (el.center && el.center.lon);
      if (!lat || !lng) continue;
      
      let category = 'Main';
      if (tags.amenity === 'cafe') {
        category = 'Cafe';
      } else if (tags.amenity === 'bar') {
        category = 'Bar';
      } else if (tags.cuisine && (tags.cuisine.includes('dessert') || tags.cuisine.includes('ice_cream') || tags.cuisine.includes('cake') || tags.cuisine.includes('sweet'))) {
        category = 'Dessert';
      }
      
      let cuisine = tags.cuisine || 'Local Delights';
      cuisine = cuisine.split(';')[0].replace(/_/g, ' ');
      cuisine = cuisine.charAt(0).toUpperCase() + cuisine.slice(1);
      
      const street = tags['addr:street'] || '';
      const city = tags['addr:city'] || 'Melaka';
      const address = tags['addr:full'] || (street ? `${street}, ${city}` : `${name}, Melaka`);
      
      const isHalal = tags.halal === 'yes' || 
                      tags['diet:halal'] === 'yes' || 
                      cuisine.toLowerCase().includes('halal') || 
                      cuisine.toLowerCase().includes('malay') ||
                      cuisine.toLowerCase().includes('indian muslim');
                      
      const description = tags.description || 
                          `A popular ${cuisine.toLowerCase()} ${category.toLowerCase()} spot situated in Melaka. Known for its pleasant atmosphere and local flavors.`;
      
      const extraTags = ['Local', category];
      if (isHalal) extraTags.push('Halal');
      if (tags.outdoor_seating === 'yes') extraTags.push('Outdoor');
      if (cuisine !== 'Local Delights') extraTags.push(cuisine);
      
      const numericalId = parseInt(el.id) || 0;
      const rating = parseFloat((3.8 + (numericalId % 12) * 0.1).toFixed(1));
      
      const prices = ['$', '$$', '$$$'];
      const priceRange = tags.price_level ? '$'.repeat(parseInt(tags.price_level)) : prices[numericalId % prices.length];
      
      const imgList = UNSPLASH_IMAGES[category] || UNSPLASH_IMAGES.Main;
      const imageUrl = imgList[numericalId % imgList.length];
      
      eateries.push({
        osmId: `${el.type}/${el.id}`,
        name,
        description,
        cuisine,
        category,
        address,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        priceRange,
        tags: extraTags.slice(0, 5),
        rating,
        imageUrl,
        openHours: tags.opening_hours || '10am – 10pm',
        isHalal
      });
    }
    return eateries;
  } catch (err) {
    console.error('⚠️ Overpass API explore fetch failed:', err.message);
    return [];
  }
}

router.get('/explore', async (req, res) => {
  try {
    const { minLat, minLng, maxLat, maxLng, page = 1, limit = 20, hiddenGemsOnly } = req.query;
    
    if (!minLat || !minLng || !maxLat || !maxLng) {
      return res.status(400).json({ error: 'Viewport boundary coordinates (minLat, minLng, maxLat, maxLng) are required.' });
    }
    
    const parsedMinLat = parseFloat(minLat);
    const parsedMinLng = parseFloat(minLng);
    const parsedMaxLat = parseFloat(maxLat);
    const parsedMaxLng = parseFloat(maxLng);
    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    
    if (isNaN(parsedMinLat) || isNaN(parsedMinLng) || isNaN(parsedMaxLat) || isNaN(parsedMaxLng)) {
      return res.status(400).json({ error: 'Invalid coordinate parameters.' });
    }

    // Look up in database to see if we cached this viewport area in the last 24 hours
    const cacheHit = await prisma.osmTileCache.findFirst({
      where: {
        minLat: { lte: parsedMinLat },
        maxLat: { gte: parsedMaxLat },
        minLng: { lte: parsedMinLng },
        maxLng: { gte: parsedMaxLng },
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // 24-hour TTL
      }
    });

    if (!cacheHit) {
      console.log(`📡 Cache miss for viewport [${parsedMinLat}, ${parsedMinLng} to ${parsedMaxLat}, ${parsedMaxLng}]. Fetching from OSM Overpass...`);
      
      const eateries = await fetchOsmEateries(parsedMinLat, parsedMinLng, parsedMaxLat, parsedMaxLng);
      
      if (eateries.length > 0) {
        // Bulk write to database, skipping duplicates automatically
        await prisma.restaurant.createMany({
          data: eateries,
          skipDuplicates: true
        });
      }
      
      // Save tile coverage bounds in database cache
      await prisma.osmTileCache.create({
        data: {
          minLat: parsedMinLat,
          maxLat: parsedMaxLat,
          minLng: parsedMinLng,
          maxLng: parsedMaxLng
        }
      });
    } else {
      console.log(`⚡ Cache hit! Serving viewport [${parsedMinLat}, ${parsedMinLng} to ${parsedMaxLat}, ${parsedMaxLng}] from database.`);
    }

    const exploreWhere = {
      lat: { gte: parsedMinLat, lte: parsedMaxLat },
      lng: { gte: parsedMinLng, lte: parsedMaxLng }
    };
    if (hiddenGemsOnly === 'true') {
      exploreWhere.rating = { gte: 4.0 };
    }

    let restaurants = [];
    let total = 0;

    if (hiddenGemsOnly === 'true') {
      const allInViewport = await prisma.restaurant.findMany({
        where: exploreWhere,
        include: {
          reviews: {
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { name: true, level: true } } }
          }
        },
        orderBy: { rating: 'desc' }
      });
      
      const filtered = allInViewport.filter(r => r.reviews.length <= 10);
      total = filtered.length;
      restaurants = filtered.slice((parsedPage - 1) * parsedLimit, parsedPage * parsedLimit);
    } else {
      total = await prisma.restaurant.count({
        where: exploreWhere
      });

      restaurants = await prisma.restaurant.findMany({
        where: exploreWhere,
        include: {
          reviews: {
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { name: true, level: true } } }
          }
        },
        skip: (parsedPage - 1) * parsedLimit,
        take: parsedLimit,
        orderBy: { rating: 'desc' }
      });
    }

    const formatted = restaurants.map(r => {
      const hasExpertEndorsement = r.reviews ? r.reviews.some(rev => (rev.user?.level || 1) >= 4) : false;
      const slicedReviews = r.reviews ? r.reviews.slice(0, 3) : [];
      return {
        ...r,
        reviews: slicedReviews,
        hasExpertEndorsement
      };
    });

    res.json({
      total,
      page: parsedPage,
      limit: parsedLimit,
      pages: Math.ceil(total / parsedLimit),
      restaurants: formatted
    });
  } catch (err) {
    console.error('Explore endpoint error:', err);
    res.status(500).json({ error: 'Failed to explore restaurant viewport.' });
  }
});

// GET /api/restaurants/:id - get single restaurant
router.get('/:id', async (req, res) => {
  try {
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: req.params.id },
      include: {
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { name: true, level: true } } },
        },
      },
    });
    if (!restaurant) return res.status(404).json({ error: 'Restaurant not found.' });
    
    const hasExpertEndorsement = restaurant.reviews.some(rev => (rev.user?.level || 1) >= 4);
    res.json({
      ...restaurant,
      hasExpertEndorsement
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch restaurant.' });
  }
});

// POST /api/restaurants - Admin Only: Add new restaurant
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { name, description, cuisine, category, address, lat, lng, priceRange, tags, imageUrl, openHours, isHalal } = req.body;

    if (!name || !description || !cuisine || !category || !address || lat === undefined || lng === undefined || !priceRange || !imageUrl || !openHours) {
      return res.status(400).json({ error: 'Missing required restaurant fields.' });
    }

    const restaurant = await prisma.restaurant.create({
      data: {
        name,
        description,
        cuisine,
        category,
        address,
        lat: parseFloat(lat),
        lng: parseFloat(lng),
        priceRange,
        tags: Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim()),
        imageUrl,
        openHours,
        isHalal: isHalal === true || isHalal === 'true',
        rating: 0.0
      }
    });

    res.status(201).json(restaurant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create restaurant listing.' });
  }
});

// PUT /api/restaurants/:id - Admin Only: Edit restaurant
router.put('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, cuisine, category, address, lat, lng, priceRange, tags, imageUrl, openHours, isHalal } = req.body;

    const existing = await prisma.restaurant.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ error: 'Restaurant not found.' });

    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (cuisine) updateData.cuisine = cuisine;
    if (category) updateData.category = category;
    if (address) updateData.address = address;
    if (lat !== undefined) updateData.lat = parseFloat(lat);
    if (lng !== undefined) updateData.lng = parseFloat(lng);
    if (priceRange) updateData.priceRange = priceRange;
    if (tags) updateData.tags = Array.isArray(tags) ? tags : String(tags).split(',').map(t => t.trim());
    if (imageUrl) updateData.imageUrl = imageUrl;
    if (openHours) updateData.openHours = openHours;
    if (isHalal !== undefined) updateData.isHalal = isHalal === true || isHalal === 'true';

    const restaurant = await prisma.restaurant.update({
      where: { id },
      data: updateData
    });

    res.json(restaurant);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update restaurant listing.' });
  }
});

// POST /api/restaurants/:id/tags/:tag/vote - Auth Required: Vote on tag correctness
router.post('/:id/tags/:tag/vote', requireAuth, async (req, res) => {
  try {
    const { id, tag } = req.params;
    const { isPositive } = req.body; // true = upvote, false = downvote
    const clerkId = req.auth.userId;

    if (isPositive === undefined) {
      return res.status(400).json({ error: 'isPositive value is required.' });
    }

    const user = await prisma.user.findUnique({ where: { clerkId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found.' });
    }

    const tagExists = restaurant.tags.some(t => t.toLowerCase() === tag.toLowerCase());
    if (!tagExists) {
      return res.status(400).json({ error: `Tag "${tag}" does not exist on this restaurant.` });
    }

    const actualTag = restaurant.tags.find(t => t.toLowerCase() === tag.toLowerCase());

    const vote = await prisma.tagVote.upsert({
      where: {
        userId_restaurantId_tag: {
          userId: user.id,
          restaurantId: id,
          tag: actualTag
        }
      },
      update: {
        isPositive: isPositive === true || isPositive === 'true'
      },
      create: {
        userId: user.id,
        restaurantId: id,
        tag: actualTag,
        isPositive: isPositive === true || isPositive === 'true'
      }
    });

    res.json({ message: 'Vote registered successfully.', vote });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit tag vote.' });
  }
});

// GET /api/restaurants/:id/tag-votes - Public: Fetch tag votes summaries
router.get('/:id/tag-votes', async (req, res) => {
  try {
    const { id } = req.params;

    const votes = await prisma.tagVote.findMany({
      where: { restaurantId: id }
    });

    const restaurant = await prisma.restaurant.findUnique({ where: { id } });
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found.' });
    }

    const summary = {};
    restaurant.tags.forEach(tag => {
      summary[tag] = { upvotes: 0, downvotes: 0, total: 0 };
    });

    votes.forEach(v => {
      if (!summary[v.tag]) {
        summary[v.tag] = { upvotes: 0, downvotes: 0, total: 0 };
      }
      if (v.isPositive) {
        summary[v.tag].upvotes += 1;
      } else {
        summary[v.tag].downvotes += 1;
      }
      summary[v.tag].total += 1;
    });

    res.json(summary);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tag votes.' });
  }
});

export default router;
