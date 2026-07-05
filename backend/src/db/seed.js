import prisma from './prisma.js';

// High-quality local fallback dataset of 22 iconic, real-world Melaka eateries
const fallbackRestaurants = [
  {
    name: 'Restoran Peranakan Jonker',
    description: 'Authentic Nyonya cuisine tucked in the heart of Jonker Street. Famous for Ayam Buah Keluak and Laksa Lemak.',
    cuisine: 'Nyonya / Peranakan',
    category: 'Main',
    address: '85, Jalan Hang Jebat, Jonker Street, 75200 Melaka',
    lat: 2.1945, lng: 102.2468,
    priceRange: '$$',
    tags: ['Nyonya', 'Heritage', 'Laksa', 'Halal-Friendly'],
    rating: 4.7,
    imageUrl: 'https://images.unsplash.com/photo-1569944990780-ef3b9b8048f2?w=600',
    openHours: '11am – 9pm',
    isHalal: false,
  },
  {
    name: 'Selera Rakyat Hawker Centre',
    description: 'The go-to hawker hub near Mahkota Parade. Claypot chicken rice, char kway teow and grilled stingray all under one roof.',
    cuisine: 'Malaysian Hawker',
    category: 'Main',
    address: 'Jalan Munshi Abdullah, 75100 Melaka',
    lat: 2.1982, lng: 102.2491,
    priceRange: '$',
    tags: ['Hawker', 'Local', 'Claypot', 'Halal'],
    rating: 4.5,
    imageUrl: 'https://images.unsplash.com/photo-1514190051997-0f6f39ca5cde?w=600',
    openHours: '7am – 10pm',
    isHalal: true,
  },
  {
    name: 'Asam Pedas Claypot House',
    description: 'Melaka\'s most celebrated asam pedas fish restaurant. Stewed in a tangy tamarind gravy with okra and torch ginger.',
    cuisine: 'Malay',
    category: 'Main',
    address: '273, Jalan Parameswara, Bukit Baru, 75460 Melaka',
    lat: 2.2030, lng: 102.2400,
    priceRange: '$$',
    tags: ['Malay', 'Asam Pedas', 'Seafood', 'Halal'],
    rating: 4.8,
    imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600',
    openHours: '11am – 3pm',
    isHalal: true,
  },
  {
    name: 'Pak Putra Tandoori & Naan',
    description: 'Iconic open-air Indian Muslim restaurant with stone tandoor ovens. The cheese naan and tandoori chicken are legendary.',
    cuisine: 'Indian Muslim',
    category: 'Main',
    address: 'Jalan Bendahara, 75100 Melaka',
    lat: 2.2005, lng: 102.2488,
    priceRange: '$',
    tags: ['Indian', 'Naan', 'Tandoori', 'Halal', 'Late Night'],
    rating: 4.6,
    imageUrl: 'https://images.unsplash.com/photo-1599487488170-d11ec9c172f0?w=600',
    openHours: '6pm – 2am',
    isHalal: true,
  },
  {
    name: 'Capitol Satay Celup',
    description: 'Melaka\'s original satay celup. Skewers of seafood and meats dipped in a simmering peanut-chili broth.',
    cuisine: 'Malaysian / Satay',
    category: 'Main',
    address: '41, Lorong Bukit Cina, 75100 Melaka',
    lat: 2.1950, lng: 102.2525,
    priceRange: '$$',
    tags: ['Satay Celup', 'Local Legend', 'Sharing', 'Halal-Friendly'],
    rating: 4.9,
    imageUrl: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=600',
    openHours: '5pm – 11pm',
    isHalal: false,
  },
  {
    name: 'Klebang Original Coconut Shake',
    description: 'World-famous coconut shake blended with vanilla ice cream, served roadside since 1979. A Melaka pilgrimage.',
    cuisine: 'Drinks / Snacks',
    category: 'Main',
    address: 'Jalan Klebang Besar, 75200 Melaka',
    lat: 2.2178, lng: 102.2053,
    priceRange: '$',
    tags: ['Drinks', 'Iconic', 'Coconut', 'Halal'],
    rating: 4.5,
    imageUrl: 'https://images.unsplash.com/photo-1556679343-c7306c1976bc?w=600',
    openHours: '10am – 9pm',
    isHalal: true,
  },
  {
    name: 'Klebang Coconut Ice Cream',
    description: 'Artisan coconut-shell ice cream shop near the beach. Flavours rotate daily – pandan, durian, gula melaka.',
    cuisine: 'Dessert',
    category: 'Dessert',
    address: 'Pantai Klebang, 75200 Melaka',
    lat: 2.2195, lng: 102.2032,
    priceRange: '$',
    tags: ['Ice Cream', 'Coconut', 'Beachside', 'Halal'],
    rating: 4.4,
    imageUrl: 'https://images.unsplash.com/photo-1497034825429-c343d7c6a68f?w=600',
    openHours: '11am – 7pm',
    isHalal: true,
  },
  {
    name: 'Donald & Lily\'s Cendol',
    description: 'Generational cendol stall in Jonker. Green rice flour jelly, fresh coconut milk, and thick gula melaka.',
    cuisine: 'Dessert / Local Sweets',
    category: 'Dessert',
    address: 'Jalan Hang Jebat, Jonker Walk, 75200 Melaka',
    lat: 2.1940, lng: 102.2461,
    priceRange: '$',
    tags: ['Cendol', 'Heritage', 'Sweet', 'Halal'],
    rating: 4.8,
    imageUrl: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=600',
    openHours: '10am – 5pm',
    isHalal: true,
  },
  {
    name: 'Calanthe Art Café',
    description: 'A unique cafe concept serving traditional coffee from all 13 states of Malaysia. Cosy, artistic heritage shophouse.',
    cuisine: 'Café / Dessert',
    category: 'Cafe',
    address: '11, Jalan Hang Kasturi, 75200 Melaka',
    lat: 2.1928, lng: 102.2472,
    priceRange: '$$',
    tags: ['Coffee', 'Artsy', 'Heritage', 'Café'],
    rating: 4.5,
    imageUrl: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=600',
    openHours: '9am – 6pm',
    isHalal: true,
  },
  {
    name: 'Geographer Café',
    description: 'Iconic warm-lit cafe on Jonker Street with outdoor seating. Mango smoothies, local Nyonya cakes, and live acoustic music.',
    cuisine: 'Café / Western',
    category: 'Cafe',
    address: '83, Jalan Hang Jebat, 75200 Melaka',
    lat: 2.1942, lng: 102.2466,
    priceRange: '$$',
    tags: ['Café', 'Outdoor', 'Western', 'Chill'],
    rating: 4.3,
    imageUrl: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=600',
    openHours: '10am – 1am',
    isHalal: false,
  },
  {
    name: 'Rooftop Bar 360° – Hard Rock Melaka',
    description: 'Sweeping panoramic rooftop bar at Hard Rock Hotel with skyline views over the Straits of Melaka and live DJ sets.',
    cuisine: 'Bar / Cocktails',
    category: 'Bar',
    address: 'Jalan Bendahara, 75100 Melaka',
    lat: 2.1990, lng: 102.2501,
    priceRange: '$$$',
    tags: ['Rooftop', 'Cocktails', 'Views', 'Nightlife'],
    rating: 4.4,
    imageUrl: 'https://images.unsplash.com/photo-1470337458703-46ad1756a187?w=600',
    openHours: '6pm – 2am',
    isHalal: false,
  },
  {
    name: 'Limau-Limau Café',
    description: 'Hip shophouse bar in Chinatown with craft beers, organic juices and Instagrammable neon-lit interiors.',
    cuisine: 'Bar / Craft Beer',
    category: 'Bar',
    address: '49, Jalan Tukang Besi, 75200 Melaka',
    lat: 2.1932, lng: 102.2488,
    priceRange: '$$',
    tags: ['Craft Beer', 'Hipster', 'Neon', 'Nightlife'],
    rating: 4.2,
    imageUrl: 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?w=600',
    openHours: '5pm – 12am',
    isHalal: false,
  },
  {
    name: 'Chop Chung Wah Chicken Rice',
    description: 'Legendary, pioneer Hainanese chicken rice ball shop. Fragrant rolled rice balls served with tender steamed chicken.',
    cuisine: 'Hainanese Chicken Rice',
    category: 'Main',
    address: '18, Jalan Hang Jebat, 75200 Melaka',
    lat: 2.1948, lng: 102.2480,
    priceRange: '$',
    tags: ['Chicken Rice Ball', 'Heritage', 'Hainanese', 'Halal-Friendly'],
    rating: 4.6,
    imageUrl: 'https://images.unsplash.com/photo-1626804475315-0554ef2f6484?w=600',
    openHours: '9am – 3pm',
    isHalal: false,
  },
  {
    name: 'Hoe Kee Chicken Rice',
    description: 'Famous heritage shophouse chicken rice ball restaurant. Melt-in-your-mouth chicken rice balls served with savory soy chicken.',
    cuisine: 'Hainanese Chicken Rice',
    category: 'Main',
    address: '4, Jalan Hang Jebat, 75200 Melaka',
    lat: 2.1951, lng: 102.2482,
    priceRange: '$',
    tags: ['Chicken Rice Ball', 'Heritage', 'Local Favorite'],
    rating: 4.5,
    imageUrl: 'https://images.unsplash.com/photo-1529042410759-befb1204b468?w=600',
    openHours: '9:30am – 4pm',
    isHalal: false,
  },
  {
    name: 'Jonker 88',
    description: 'Bustling vintage-style food hall famous for Baba Nyonya Laksa, fishballs and Durian Cendol. Retro decorations.',
    cuisine: 'Nyonya Laksa',
    category: 'Main',
    address: '88, Jalan Hang Jebat, 75200 Melaka',
    lat: 2.1949, lng: 102.2465,
    priceRange: '$',
    tags: ['Laksa', 'Cendol', 'Nyonya', 'Self-service'],
    rating: 4.7,
    imageUrl: 'https://images.unsplash.com/photo-1625398407796-82650a8c135f?w=600',
    openHours: '9:30am – 5:30pm',
    isHalal: true,
  },
  {
    name: 'The Daily Fix Cafe',
    description: 'Charming hidden cafe behind an antique shop. Famous for Pandan pancakes, local Gula Melaka coffee, and cozy garden vibe.',
    cuisine: 'Café / Brunch',
    category: 'Cafe',
    address: '55, Jalan Hang Jebat, 75200 Melaka',
    lat: 2.1952, lng: 102.2463,
    priceRange: '$$',
    tags: ['Pancakes', 'Coffee', 'Brunch', 'Aesthetic'],
    rating: 4.8,
    imageUrl: 'https://images.unsplash.com/photo-1498804103079-a6351b050096?w=600',
    openHours: '9am – 6pm',
    isHalal: true,
  },
  {
    name: 'The Baboon House',
    description: 'Artsy shophouse cafe serving premium, thick gourmet beef burgers. Lush indoor garden courtyard with no cell signal policy for peace.',
    cuisine: 'Gourmet Burgers',
    category: 'Cafe',
    address: '89, Jalan Tun Tan Cheng Lock, 75200 Melaka',
    lat: 2.1941, lng: 102.2452,
    priceRange: '$$',
    tags: ['Burgers', 'Coffee', 'Artsy', 'Garden'],
    rating: 4.7,
    imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
    openHours: '10am – 5pm',
    isHalal: false,
  },
  {
    name: 'Nancy\'s Kitchen',
    description: 'Famous local restaurant serving home-cooked Peranakan recipes. The Sambal Sotong and Pai Tee are must-orders.',
    cuisine: 'Nyonya / Peranakan',
    category: 'Main',
    address: '13, Jalan KL 3/8, Taman Kota Laksamana, 75200 Melaka',
    lat: 2.1975, lng: 102.2385,
    priceRange: '$$',
    tags: ['Nyonya', 'Local Favorite', 'Pai Tee', 'Heritage'],
    rating: 4.6,
    imageUrl: 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600',
    openHours: '11am – 5pm',
    isHalal: false,
  },
  {
    name: 'Nadeje Cake Shop Plaza Mahkota',
    description: 'The original pioneer of multi-layered Mille Crepe cakes in Malaysia. Freshly handmade layers with smooth custard cream.',
    cuisine: 'Dessert / Cafe',
    category: 'Dessert',
    address: 'G-23 & 25, Jalan PM 4, Plaza Mahkota, 75000 Melaka',
    lat: 2.1893, lng: 102.2515,
    priceRange: '$$',
    tags: ['Mille Crepe', 'Cakes', 'Sweet', 'Dessert'],
    rating: 4.6,
    imageUrl: 'https://images.unsplash.com/photo-1550617931-e17a7b70dce2?w=600',
    openHours: '11am – 10pm',
    isHalal: true,
  },
  {
    name: 'Atlantic Books & Cafe',
    description: 'A quiet, book-lovers sanctuary. Read second-hand books while enjoying siphon coffee, Earl Grey teas, and quiet piano tunes.',
    cuisine: 'Café / Coffee',
    category: 'Cafe',
    address: 'Jalan Hang Kasturi, Jonker Walk, 75200 Melaka',
    lat: 2.1940, lng: 102.2469,
    priceRange: '$',
    tags: ['Books', 'Quiet', 'Filter Coffee', 'Cozy'],
    rating: 4.4,
    imageUrl: 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=600',
    openHours: '10am – 6pm',
    isHalal: true,
  },
  {
    name: 'The Stolen Cup',
    description: 'Hip artisanal bakery café on Jonker Street. Famous for flaky salted egg yolk croissants and Curated Gula Melaka Latte.',
    cuisine: 'Bakery / Coffee',
    category: 'Cafe',
    address: '21, Jalan Hang Jebat, 75200 Melaka',
    lat: 2.1944, lng: 102.2475,
    priceRange: '$$',
    tags: ['Croissants', 'Coffee', 'Bakery', 'Late Breakfast'],
    rating: 4.5,
    imageUrl: 'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=600',
    openHours: '9am – 5pm',
    isHalal: true,
  },
  {
    name: 'Portuguese Settlement Seafood Stall 10',
    description: 'Vibrant sea-facing open food court in the Portuguese Settlement. Portuguese baked fish and spicy garlic butter prawns.',
    cuisine: 'Eurasian Seafood',
    category: 'Main',
    address: 'Jalan Portuguese, Portuguese Settlement, 75050 Melaka',
    lat: 2.1834, lng: 102.2725,
    priceRange: '$$',
    tags: ['Seafood', 'Baked Fish', 'Seaside', 'Spicy'],
    rating: 4.6,
    imageUrl: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600',
    openHours: '5pm – 11pm',
    isHalal: true,
  },
];

// Unsplash stock image mappings based on category and cuisine
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

function getRandomImage(category) {
  const images = UNSPLASH_IMAGES[category] || UNSPLASH_IMAGES.Main;
  return images[Math.floor(Math.random() * images.length)];
}

// Fetch live eateries in Melaka from OpenStreetMap (Overpass API)
async function fetchFromOpenStreetMap() {
  console.log('📡 Fetching eateries across Melaka from OpenStreetMap via Overpass API...');
  
  // Bounding box covering the whole Melaka metropolitan area (lat 2.10 to 2.32, lng 102.10 to 102.35)
  const query = `
    [out:json][timeout:50];
    (
      node["amenity"~"restaurant|cafe|bar|fast_food"](2.10,102.10,2.32,102.35);
      way["amenity"~"restaurant|cafe|bar|fast_food"](2.10,102.10,2.32,102.35);
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
    
    if (!response.ok) {
      throw new Error(`OSM Server returned status ${response.status}`);
    }
    
    const data = await response.json();
    const elements = data.elements || [];
    
    console.log(`✅ OpenStreetMap query succeeded! Found ${elements.length} raw spatial elements.`);
    
    // Map OSM elements to EatWhatLeh Restaurant structure
    const restaurants = [];
    const seenNames = new Set();
    
    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name;
      
      // We only include establishments with a valid name, and avoid duplicate names for visual cleanliness
      if (!name || seenNames.has(name.toLowerCase())) continue;
      seenNames.add(name.toLowerCase());
      
      // Determine lat/lng depending on whether it's a node or way
      const lat = el.lat || (el.center && el.center.lat);
      const lng = el.lon || (el.center && el.center.lon);
      
      if (!lat || !lng) continue;
      
      // Determine category based on amenity tag
      let category = 'Main';
      if (tags.amenity === 'cafe') {
        category = 'Cafe';
      } else if (tags.amenity === 'bar') {
        category = 'Bar';
      } else if (tags.cuisine && (tags.cuisine.includes('dessert') || tags.cuisine.includes('ice_cream') || tags.cuisine.includes('cake') || tags.cuisine.includes('sweet'))) {
        category = 'Dessert';
      }
      
      // Determine cuisine description
      let cuisine = tags.cuisine || 'Local Delights';
      // Clean up common OSM formats (replace underscores, capitalize)
      cuisine = cuisine.split(';')[0].replace(/_/g, ' ');
      cuisine = cuisine.charAt(0).toUpperCase() + cuisine.slice(1);
      
      // Formulate a clean address
      const street = tags['addr:street'] || '';
      const city = tags['addr:city'] || 'Melaka';
      const address = tags['addr:full'] || (street ? `${street}, ${city}` : `${name}, Melaka`);
      
      // Halal check based on OSM tags
      const isHalal = tags.halal === 'yes' || 
                      tags['diet:halal'] === 'yes' || 
                      cuisine.toLowerCase().includes('halal') || 
                      cuisine.toLowerCase().includes('malay') ||
                      cuisine.toLowerCase().includes('indian muslim');
                      
      // Dynamic description generator
      const description = tags.description || 
                          `A highly rated ${cuisine.toLowerCase()} ${category.toLowerCase()} spot situated in Melaka. Known for its pleasant atmosphere and local flavors.`;
      
      // Compile tags
      const extraTags = ['Local', category];
      if (isHalal) extraTags.push('Halal');
      if (tags.outdoor_seating === 'yes') extraTags.push('Outdoor');
      if (cuisine !== 'Local Delights') extraTags.push(cuisine);
      
      // Ratings and price ranges
      const rating = parseFloat((3.8 + Math.random() * 1.1).toFixed(1)); // Random rating between 3.8 and 4.9
      const prices = ['$', '$$', '$$$'];
      const priceRange = tags.price_level ? '$'.repeat(parseInt(tags.price_level)) : prices[Math.floor(Math.random() * prices.length)];
      
      restaurants.push({
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
        imageUrl: getRandomImage(category),
        openHours: tags.opening_hours || '10am – 10pm',
        isHalal
      });
      
      // Cap at 1000 restaurants to support complete Melaka dataset
      if (restaurants.length >= 1000) break;
    }
    
    return restaurants;
  } catch (err) {
    console.warn('⚠️ OSM API fetch failed/offline:', err.message);
    return null;
  }
}

async function main() {
  const useMock = process.env.USE_MOCK_DB !== 'false';
  
  if (useMock) {
    console.log('🔌 Running Seeder in Mock Mode. Only testing local connections. Writing to database bypassed.');
    return;
  }
  
  console.log('🗄️ Setting up database tables and indexes on Supabase...');
  
  // Step 1: Run SQL commands to enable PostGIS and GIST Spatial indexes in PostgreSQL
  try {
    console.log('🌐 Executing PostGIS extension enabling...');
    await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS postgis;');
  } catch (e) {
    console.warn('⚠️ Could not run CREATE EXTENSION (it might already be enabled or permission is limited):', e.message);
  }

  // Clear existing reviews, restaurants and users to ensure clean slate
  console.log('🧹 Clearing existing database entries...');
  await prisma.review.deleteMany();
  await prisma.userMission.deleteMany();
  await prisma.restaurant.deleteMany();
  await prisma.user.deleteMany();

  // Create GIST spatial index
  try {
    console.log('🌐 Creating spatial index on coordinates...');
    await prisma.$executeRawUnsafe(
      'CREATE INDEX IF NOT EXISTS "Restaurant_spatial_idx" ON "Restaurant" USING GIST ((ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography));'
    );
    console.log('✅ PostGIS GIST spatial index successfully set up!');
  } catch (e) {
    console.warn('⚠️ Spatial index creation warning:', e.message);
  }

  // Step 2: Fetch restaurants (OSM Live API with local fallback)
  let eateries = await fetchFromOpenStreetMap();
  
  if (!eateries || eateries.length === 0) {
    console.log('💡 Seeding with high-quality local fallback dataset (22 Melaka eateries)...');
    eateries = fallbackRestaurants;
  } else {
    console.log(`✅ Loaded ${eateries.length} real-world eateries from OpenStreetMap!`);
  }

  // Step 3: Insert eateries (Bulk Insert)
  console.log('🌱 Inserting eatery data into Supabase (Bulk Insert)...');
  await prisma.restaurant.createMany({
    data: eateries,
    skipDuplicates: true
  });
  const dbRestaurants = await prisma.restaurant.findMany();
  console.log(`✅ Successfully seeded ${dbRestaurants.length} restaurants!`);

  // Step 4: Seed mock users for gamification
  console.log('🌱 Seeding mock user accounts for Leaderboards...');
  const usersToSeed = [
    {
      clerkId: 'demo_clerk_id',
      name: 'Demo Foodie',
      email: 'demo@eatwhatleh.com',
      xp: 150,
      points: 150,
      level: 2,
      badges: ['First Bite', 'Jonker Explorer'],
    },
    {
      clerkId: 'user_clerk_1',
      name: 'Melaka Food King',
      email: 'king@eatwhatleh.com',
      xp: 1200,
      points: 1200,
      level: 5,
      badges: ['First Bite', 'Jonker Explorer', 'Sambal Explorer', 'Hawker Hunter', 'Nyonya Master', 'Gourmet Critic', 'Legendary Glutton'],
    },
    {
      clerkId: 'user_clerk_2',
      name: 'LaksaLover99',
      email: 'laksa@eatwhatleh.com',
      xp: 350,
      points: 350,
      level: 3,
      badges: ['First Bite', 'Jonker Explorer', 'Sambal Explorer', 'Hawker Hunter'],
    },
    {
      clerkId: 'user_clerk_3',
      name: 'Minah Makan',
      email: 'minah@eatwhatleh.com',
      xp: 50,
      points: 50,
      level: 1,
      badges: ['First Bite'],
    },
    {
      clerkId: 'user_clerk_4',
      name: 'JonkerFlaneur',
      email: 'flaneur@eatwhatleh.com',
      xp: 620,
      points: 620,
      level: 4,
      badges: ['First Bite', 'Jonker Explorer', 'Sambal Explorer', 'Hawker Hunter', 'Nyonya Master'],
    },
  ];

  const dbUsers = [];
  for (const u of usersToSeed) {
    const created = await prisma.user.create({ data: u });
    dbUsers.push(created);
  }
  console.log(`✅ Seeded ${dbUsers.length} user profiles!`);

  // Step 5: Seed reviews linking to the inserted restaurants
  console.log('🌱 Seeding sample reviews...');
  const reviewComments = [
    'Delicious food! Highly recommend checking this place out if you visit Melaka.',
    'Amazing flavor and cozy atmosphere! Will definitely return next time.',
    'The specialty here is absolutely mouth-watering. Friendly staff and fast service!',
    'Great price-to-quality ratio. Authentic local taste, a must-visit spot.',
    'Atmosphere is stellar. Clean seats, fast service, and legendary dishes.',
    'Loved the signature menu. Truly highlights Melaka culinary heritage!',
    'Good food, but queues can get quite long on weekends. Go early!'
  ];

  let reviewCount = 0;
  // Pick some restaurants to assign reviews to
  const reviewTargets = dbRestaurants.slice(0, Math.min(dbRestaurants.length, 15));
  
  for (let i = 0; i < reviewTargets.length; i++) {
    const rest = reviewTargets[i];
    // Assign 1 to 2 random reviews from random users
    const reviewers = dbUsers.slice(1); // Exclude demo foodie initially
    const numReviews = Math.floor(Math.random() * 2) + 1;
    
    for (let r = 0; r < numReviews; r++) {
      const user = reviewers[Math.floor(Math.random() * reviewers.length)];
      const rating = Math.floor(Math.random() * 2) + 4; // 4 or 5 stars
      const comment = reviewComments[Math.floor(Math.random() * reviewComments.length)];
      
      await prisma.review.create({
        data: {
          userId: user.id,
          restaurantId: rest.id,
          rating,
          comment: `Reviewed during visit: ${comment}`
        }
      });
      reviewCount++;
    }
  }
  
  // Add a specific review from the Demo user for verification
  if (dbRestaurants.length > 0) {
    const demoUser = dbUsers.find(u => u.clerkId === 'demo_clerk_id');
    await prisma.review.create({
      data: {
        userId: demoUser.id,
        restaurantId: dbRestaurants[0].id,
        rating: 5,
        comment: `Absolutely loved ${dbRestaurants[0].name}! Highlight of my Melaka trip lah! 😍`
      }
    });
    reviewCount++;
  }

  // Recalculate and update restaurant ratings based on the new reviews (Weighted by User Level)
  console.log('📊 Recalculating average restaurant ratings (User-Level Weighted)...');
  const allReviews = await prisma.review.findMany({
    include: { user: { select: { level: true } } }
  });
  
  const restaurantReviews = {};
  for (const rev of allReviews) {
    if (!restaurantReviews[rev.restaurantId]) {
      restaurantReviews[rev.restaurantId] = [];
    }
    restaurantReviews[rev.restaurantId].push(rev);
  }
  
  for (const restId in restaurantReviews) {
    const reviews = restaurantReviews[restId];
    let totalWeight = 0;
    let weightedSum = 0;
    for (const r of reviews) {
      const weight = r.user?.level || 1;
      weightedSum += r.rating * weight;
      totalWeight += weight;
    }
    const avg = totalWeight > 0 ? weightedSum / totalWeight : 0;
    await prisma.restaurant.update({
      where: { id: restId },
      data: { rating: parseFloat(avg.toFixed(1)) }
    });
  }

  console.log(`✅ Seeding complete! Populated ${dbRestaurants.length} restaurants, ${dbUsers.length} users, and ${reviewCount} reviews.`);
}

main()
  .catch((e) => {
    console.error('❌ Seeder script failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
