/**
 * demoSeed.js — Demo Data Seeder for FYP Report Validation
 *
 * Creates controlled test data to prove edge cases:
 *   - User A  (CheapFoodPriest): exclusively reviews cheap ($) restaurants
 *   - User B  (EliteGourmand):   exclusively reviews expensive ($$$) restaurants
 *   - 3 explicit Hidden Gem restaurants (rating >= 4.8, <= 3 reviews each)
 *
 * Run with: node src/db/demoSeed.js
 * (Safe to re-run: skips records that already exist)
 */

import prisma from './prisma.js';

// ─── XP / Level Helpers (mirrors backend reviews.js logic) ───────────────────
function computeLevel(xp) {
  if (xp < 100) return 1;
  if (xp < 250) return 2;
  if (xp < 500) return 3;
  if (xp < 1000) return 4;
  return 5;
}

// ─── Hidden Gem Restaurant Definitions ───────────────────────────────────────
// These are real Melaka eateries seeded with explicit low review counts
// to prove the Hidden Gem discovery algorithm.
const HIDDEN_GEMS = [
  {
    name: 'Restoran Kak Jah Asam Pedas',
    description:
      'A humble family-run stall tucked off the main road in Bukit Baru. The asam pedas here rivals any fine-dining Malay eatery — rich tamarind broth, ultra-fresh ikan tenggiri, and a regulars-only vibe that keeps it blissfully uncrowded.',
    cuisine: 'Malay',
    category: 'Main',
    address: 'Jalan Bukit Baru, Bukit Baru, 75460 Melaka',
    lat: 2.2052,
    lng: 102.2387,
    priceRange: '$',
    tags: ['Malay', 'Asam Pedas', 'Halal', 'Local Secret', 'Hidden Gem'],
    rating: 4.9,
    imageUrl: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?w=600',
    openHours: '10am – 3pm (Mon–Sat)',
    isHalal: true,
  },
  {
    name: "Baba Low's 486",
    description:
      'A restored Peranakan shophouse cafe on Jalan Tengkera serving traditional Nyonya kuih, Baba-style coffee, and heirloom rice porridge recipes passed down four generations. Almost never appears in tourist guides.',
    cuisine: 'Nyonya / Peranakan',
    category: 'Cafe',
    address: '486, Jalan Tengkera, 75100 Melaka',
    lat: 2.2018,
    lng: 102.2427,
    priceRange: '$$',
    tags: ['Nyonya', 'Peranakan', 'Heritage', 'Café', 'Hidden Gem'],
    rating: 4.8,
    imageUrl: 'https://images.unsplash.com/photo-1445116572660-236099ec97a0?w=600',
    openHours: '8am – 1pm (Tue–Sun)',
    isHalal: false,
  },
  {
    name: 'Jonker Hawker Dessert Corner',
    description:
      'An unassuming dessert corner behind Jonker Walk operated by a retired teacher. Specialises in pulut hitam, chendol with house-made gula melaka, and refreshing air batu campur. No sign — just follow the locals.',
    cuisine: 'Dessert / Local Sweets',
    category: 'Dessert',
    address: 'Lorong Hang Jebat, Jonker Walk, 75200 Melaka',
    lat: 2.1938,
    lng: 102.2458,
    priceRange: '$',
    tags: ['Dessert', 'Cendol', 'Halal', 'Hawker', 'Hidden Gem'],
    rating: 4.8,
    imageUrl: 'https://images.unsplash.com/photo-1541518763669-27fef04b14ea?w=600',
    openHours: '12pm – 7pm (Fri–Wed)',
    isHalal: true,
  },
];

// ─── Review comment pools ─────────────────────────────────────────────────────
const CHEAP_COMMENTS = [
  'Amazing value for money! Definitely coming back again. Best cheap eats in Melaka lah!',
  'Incredible price-to-quality ratio. A real budget gem — portion big, taste superb.',
  'Wallet-friendly and absolutely delicious. Cannot believe this costs so little!',
  'Perfect for students like me. Cheap, fast, and the taste is on par with fancy places.',
  'Affordable price but taste is 5-star! This is what local hidden gem means lah.',
];

const EXPENSIVE_COMMENTS = [
  'Worth every ringgit! The premium dining experience here is truly exceptional.',
  'Exquisite presentation and refined flavours. Fine dining at its best in Melaka.',
  'A sophisticated culinary journey. The attention to detail justifies the price.',
  'Remarkable quality and impeccable service. Exactly what you expect at this price tier.',
  'An indulgent treat. The premium ingredients and execution make it memorable.',
];

const GEM_COMMENTS = [
  'Absolutely hidden treasure! Found this by accident and it completely blew me away.',
  'Cannot believe this place is not more well-known. Seriously underrated spot!',
  'First time here and I am already planning my return. A local secret for a reason!',
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('\n🌱 EatWhatLeh Demo Seeder Starting...\n');

  // ── Step 1: Upsert Hidden Gem Restaurants ──────────────────────────────────
  console.log('💎 Upserting 3 Hidden Gem restaurants...');
  const gemRestaurants = [];
  for (const gem of HIDDEN_GEMS) {
    const existing = await prisma.restaurant.findFirst({ where: { name: gem.name } });
    if (existing) {
      console.log(`   ⚡ Already exists: "${gem.name}" — using existing record.`);
      gemRestaurants.push(existing);
    } else {
      const created = await prisma.restaurant.create({ data: gem });
      console.log(`   ✅ Created: "${gem.name}"`);
      gemRestaurants.push(created);
    }
  }

  // ── Step 2: Upsert User A (cheap preference) ──────────────────────────────
  console.log('\n👤 Upserting User A — CheapFoodPriest (cheap food preference)...');
  let userA = await prisma.user.findUnique({ where: { clerkId: 'user_clerk_a' } });
  if (!userA) {
    userA = await prisma.user.create({
      data: {
        clerkId: 'user_clerk_a',
        name: 'CheapFoodPriest',
        email: 'cheapfood@eatwhatleh.com',
        xp: 75,
        points: 75,
        level: 1,
        badges: ['First Bite'],
      },
    });
    console.log('   ✅ Created User A (CheapFoodPriest)');
  } else {
    console.log('   ⚡ User A already exists — skipping creation.');
  }

  // ── Step 3: Upsert User B (expensive preference) ──────────────────────────
  console.log('👤 Upserting User B — EliteGourmand (expensive food preference)...');
  let userB = await prisma.user.findUnique({ where: { clerkId: 'user_clerk_b' } });
  if (!userB) {
    userB = await prisma.user.create({
      data: {
        clerkId: 'user_clerk_b',
        name: 'EliteGourmand',
        email: 'elite@eatwhatleh.com',
        xp: 75,
        points: 75,
        level: 1,
        badges: ['First Bite'],
      },
    });
    console.log('   ✅ Created User B (EliteGourmand)');
  } else {
    console.log('   ⚡ User B already exists — skipping creation.');
  }

  // ── Step 4: Seed User A reviews — top 5 cheap ($) restaurants ─────────────
  console.log('\n📝 Seeding User A review history on cheap ($) restaurants...');
  const cheapRestaurants = await prisma.restaurant.findMany({
    where: { priceRange: '$' },
    take: 5,
    orderBy: { rating: 'desc' },
  });

  let userAReviewCount = 0;
  for (let i = 0; i < Math.min(5, cheapRestaurants.length); i++) {
    const rest = cheapRestaurants[i];
    const alreadyReviewed = await prisma.review.findFirst({
      where: { userId: userA.id, restaurantId: rest.id },
    });
    if (alreadyReviewed) {
      console.log(`   ⚡ User A already reviewed "${rest.name}" — skipping.`);
      continue;
    }
    await prisma.review.create({
      data: {
        userId: userA.id,
        restaurantId: rest.id,
        rating: 5,
        comment: CHEAP_COMMENTS[i % CHEAP_COMMENTS.length],
      },
    });
    console.log(`   ✅ User A → "${rest.name}" (${rest.priceRange}) ⭐⭐⭐⭐⭐`);
    userAReviewCount++;
  }

  // ── Step 5: Seed User B reviews — top 5 expensive ($$$) restaurants ────────
  console.log('\n📝 Seeding User B review history on expensive ($$$) restaurants...');
  let expensiveRestaurants = await prisma.restaurant.findMany({
    where: { priceRange: '$$$' },
    take: 5,
    orderBy: { rating: 'desc' },
  });

  // Fallback: if no $$$ restaurants exist, use $$ so User B still has a review history
  if (expensiveRestaurants.length === 0) {
    console.log('   ⚠️  No $$$ restaurants found — using $$ as fallback for User B.');
    expensiveRestaurants = await prisma.restaurant.findMany({
      where: { priceRange: '$$' },
      take: 5,
      orderBy: { rating: 'desc' },
    });
  }

  let userBReviewCount = 0;
  for (let i = 0; i < Math.min(5, expensiveRestaurants.length); i++) {
    const rest = expensiveRestaurants[i];
    const alreadyReviewed = await prisma.review.findFirst({
      where: { userId: userB.id, restaurantId: rest.id },
    });
    if (alreadyReviewed) {
      console.log(`   ⚡ User B already reviewed "${rest.name}" — skipping.`);
      continue;
    }
    await prisma.review.create({
      data: {
        userId: userB.id,
        restaurantId: rest.id,
        rating: 5,
        comment: EXPENSIVE_COMMENTS[i % EXPENSIVE_COMMENTS.length],
      },
    });
    console.log(`   ✅ User B → "${rest.name}" (${rest.priceRange}) ⭐⭐⭐⭐⭐`);
    userBReviewCount++;
  }

  // ── Step 6: Seed Hidden Gem reviews (small, specific counts) ──────────────
  console.log('\n💎 Seeding Hidden Gem reviews (2–3 reviews each)...');
  // Gem target review counts: Kak Jah=2, Baba Low=3, Jonker Corner=1
  const gemReviewCounts = [2, 3, 1];
  const gemReviewers = [userA, userB];
  let gemReviewTotal = 0;

  for (let gi = 0; gi < gemRestaurants.length; gi++) {
    const gem = gemRestaurants[gi];
    const target = gemReviewCounts[gi];
    const existing = await prisma.review.findMany({ where: { restaurantId: gem.id } });
    const toAdd = Math.max(0, target - existing.length);

    for (let ri = 0; ri < toAdd; ri++) {
      const reviewer = gemReviewers[ri % gemReviewers.length];
      await prisma.review.create({
        data: {
          userId: reviewer.id,
          restaurantId: gem.id,
          rating: 5,
          comment: GEM_COMMENTS[ri % GEM_COMMENTS.length],
        },
      });
      gemReviewTotal++;
    }
    const total = existing.length + toAdd;
    console.log(`   💎 "${gem.name}" → ${toAdd} new review(s) added (total: ${total}/${target})`);
  }

  // ── Step 7: Recalculate weighted ratings for all affected restaurants ───────
  console.log('\n📊 Recalculating weighted ratings (User-Level weighted average)...');
  const affectedIds = [
    ...cheapRestaurants.map((r) => r.id),
    ...expensiveRestaurants.map((r) => r.id),
    ...gemRestaurants.map((r) => r.id),
  ];
  const uniqueIds = [...new Set(affectedIds)];

  for (const restId of uniqueIds) {
    const reviews = await prisma.review.findMany({
      where: { restaurantId: restId },
      include: { user: { select: { level: true } } },
    });
    if (reviews.length === 0) continue;

    // Weighted average: higher user level = higher weight on their rating
    let totalWeight = 0;
    let weightedSum = 0;
    for (const rev of reviews) {
      const weight = rev.user?.level || 1;
      weightedSum += rev.rating * weight;
      totalWeight += weight;
    }
    const avg = parseFloat((weightedSum / totalWeight).toFixed(1));
    await prisma.restaurant.update({ where: { id: restId }, data: { rating: avg } });
  }

  // ── Step 8: Update XP for User A and User B ───────────────────────────────
  const BASE_XP = 15;
  const XP_PER_REVIEW = 15;
  const userAXp = BASE_XP + userAReviewCount * XP_PER_REVIEW;
  const userBXp = BASE_XP + userBReviewCount * XP_PER_REVIEW;
  await prisma.user.update({
    where: { id: userA.id },
    data: { xp: userAXp, points: userAXp, level: computeLevel(userAXp) },
  });
  await prisma.user.update({
    where: { id: userB.id },
    data: { xp: userBXp, points: userBXp, level: computeLevel(userBXp) },
  });

  console.log('\n✅ ─────────────────────────────────────────────────────────────');
  console.log('   Demo Seed Complete!');
  console.log(`   👤 User A (CheapFoodPriest): ${userAReviewCount} cheap ($) reviews`);
  console.log(`   👤 User B (EliteGourmand):   ${userBReviewCount} expensive reviews`);
  console.log(`   💎 Hidden Gems: ${gemReviewTotal} gem reviews across 3 restaurants`);
  console.log('   → Switch demo profiles on the Feed Page to see personalised ranking!');
  console.log('─────────────────────────────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error('❌ Demo seeder failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
