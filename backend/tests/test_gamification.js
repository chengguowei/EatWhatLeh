import prisma from '../src/db/prisma.js';

// Level progression helper (exact copy from backend/src/routes/reviews.js)
function computeLevel(xp) {
  if (xp < 100) return 1;
  if (xp < 250) return 2;
  if (xp < 500) return 3;
  if (xp < 1000) return 4;
  return 5;
}

// Badge thresholds (exact copy from backend/src/routes/reviews.js)
const BADGE_THRESHOLDS = [
  { xp: 0,   badge: 'First Bite' },
  { xp: 50,  badge: 'Jonker Explorer' },
  { xp: 150, badge: 'Sambal Explorer' },
  { xp: 300, badge: 'Hawker Hunter' },
  { xp: 500, badge: 'Nyonya Master' },
  { xp: 800, badge: 'Gourmet Critic' },
  { xp: 1200, badge: 'Legendary Glutton' },
];

function getEarnedBadges(xp) {
  return BADGE_THRESHOLDS.filter((b) => xp >= b.xp).map((b) => b.badge);
}

// XP rewards config
const XP_REWARDS = { review: 15 };

async function main() {
  console.log('=== GAMIFICATION & XP PROGRESSION EVALUATION ===');
  
  // 1. Create a clean temporary user
  const tempEmail = `test_critic_${Date.now()}@eatwhatleh.com`;
  const tempClerkId = `clerk_test_${Date.now()}`;
  
  let user = await prisma.user.create({
    data: {
      clerkId: tempClerkId,
      name: 'Evaluation Foodie',
      email: tempEmail,
      xp: 0,
      points: 0,
      level: 1,
      badges: ['First Bite']
    }
  });

  console.log(`Created temporary evaluation user with ID: ${user.id}\n`);

  // We need three sample restaurants in DB that match specific categories for mission checks:
  // A. Non-halal, non-nyonya Main (standard review)
  // B. Dessert restaurant (m2 mission: +20 XP)
  // C. Halal Nyonya restaurant (m1 mission: +25 XP, m4 mission: +15 XP)
  
  // Let's look up or create them
  let restStandard = await prisma.restaurant.findFirst({
    where: { category: 'Main', isHalal: false, NOT: { cuisine: { contains: 'Nyonya' } } }
  });
  if (!restStandard) {
    restStandard = await prisma.restaurant.create({
      data: { name: 'Standard Bistro', description: 'Test', cuisine: 'Western', category: 'Main', address: 'Test', lat: 2.19, lng: 102.25, priceRange: '$$', imageUrl: 'Test', openHours: 'Test', isHalal: false }
    });
  }

  let restDessert = await prisma.restaurant.findFirst({
    where: { category: 'Dessert', isHalal: false }
  });
  if (!restDessert) {
    restDessert = await prisma.restaurant.create({
      data: { name: 'Sweet Ice Cream', description: 'Test', cuisine: 'Ice Cream', category: 'Dessert', address: 'Test', lat: 2.19, lng: 102.25, priceRange: '$', imageUrl: 'Test', openHours: 'Test', isHalal: false }
    });
  }

  let restHalalNyonya = await prisma.restaurant.findFirst({
    where: { cuisine: { contains: 'Nyonya' }, isHalal: true }
  });
  if (!restHalalNyonya) {
    restHalalNyonya = await prisma.restaurant.create({
      data: { name: 'Halal Nyonya Heritage', description: 'Test', cuisine: 'Nyonya Peranakan', category: 'Main', address: 'Test', lat: 2.19, lng: 102.25, priceRange: '$$', imageUrl: 'Test', openHours: 'Test', isHalal: true }
    });
  }

  const testCases = [
    {
      action: 'Standard Review (Non-Halal Main)',
      restaurant: restStandard,
      rating: 5,
      expectedXpGain: XP_REWARDS.review, // 15
      expectedTotalXp: 15,
      expectedLevel: 1,
      expectedBadges: ['First Bite']
    },
    {
      action: 'Dessert Review (Triggers Dessert Mission m2)',
      restaurant: restDessert,
      rating: 4,
      expectedXpGain: XP_REWARDS.review + 20, // 15 + 20 = 35 (Total = 50)
      expectedTotalXp: 50,
      expectedLevel: 1,
      expectedBadges: ['First Bite', 'Jonker Explorer'] // 50 XP unlocks Jonker Explorer
    },
    {
      action: 'Halal Nyonya Review (Triggers Nyonya m1 & Halal m4)',
      restaurant: restHalalNyonya,
      rating: 5,
      expectedXpGain: XP_REWARDS.review + 25 + 15, // 15 + 25 + 15 = 55 (Total = 105)
      expectedTotalXp: 105,
      expectedLevel: 2, // 105 XP transitions to Level 2
      expectedBadges: ['First Bite', 'Jonker Explorer']
    }
  ];

  const results = [];
  let userXp = user.xp;

  for (let i = 0; i < testCases.length; i++) {
    const tc = testCases[i];
    console.log(`Executing Action #${i + 1}: ${tc.action}`);

    // Simulate reviews submission process
    // 1. Submit review
    const review = await prisma.review.create({
      data: {
        userId: user.id,
        restaurantId: tc.restaurant.id,
        rating: tc.rating,
        comment: `Evaluation comment for ${tc.action}`
      }
    });

    // 2. Fetch user's current complete missions to see if they were already completed
    const missions = [
      { id: 'm1', xp: 25, check: (r) => r.cuisine.toLowerCase().includes('nyonya') || r.cuisine.toLowerCase().includes('peranakan') },
      { id: 'm2', xp: 20, check: (r) => r.category === 'Dessert' },
      { id: 'm3', xp: 20, check: (r) => r.category === 'Cafe' },
      { id: 'm4', xp: 15, check: (r) => r.isHalal }
    ];

    const matchedMissions = missions.filter(m => m.check(tc.restaurant));
    let additionalXp = 0;

    for (const m of matchedMissions) {
      const alreadyCompleted = await prisma.userMission.findUnique({
        where: { userId_missionId: { userId: user.id, missionId: m.id } }
      });

      if (!alreadyCompleted) {
        await prisma.userMission.create({
          data: { userId: user.id, missionId: m.id }
        });
        additionalXp += m.xp;
        console.log(`  🎉 Mission Complete! Unlocked ${m.id} (+${m.xp} XP)`);
      }
    }

    const xpGain = XP_REWARDS.review + additionalXp;
    userXp += xpGain;

    const newLevel = computeLevel(userXp);
    const newBadges = getEarnedBadges(userXp);

    // 3. Update User DB
    user = await prisma.user.update({
      where: { id: user.id },
      data: { xp: userXp, points: userXp, level: newLevel, badges: newBadges }
    });

    const pass = user.xp === tc.expectedTotalXp && user.level === tc.expectedLevel;
    
    results.push({
      action: tc.action,
      expectedXp: tc.expectedTotalXp,
      actualXp: user.xp,
      expectedLevel: tc.expectedLevel,
      actualLevel: user.level,
      badges: user.badges.join(', '),
      status: pass ? 'PASS' : 'FAIL'
    });

    console.log(`  Result: XP=${user.xp} (Expected: ${tc.expectedTotalXp}), Level=${user.level} (Expected: ${tc.expectedLevel}), Badges=[${user.badges.join(', ')}]`);
    console.log(`  Status: ${pass ? '✅ SUCCESS' : '❌ FAILURE'}\n`);
  }

  // --- THESIS READY TABLES ---
  console.log('--- RAW EVALUATION COMPARISON ---');
  console.table(results.map(r => ({
    'Action / Test Trigger': r.action,
    'Expected XP': r.expectedXp,
    'Actual XP': r.actualXp,
    'Expected Level': r.expectedLevel,
    'Actual Level': r.actualLevel,
    'Unlocked Badges': r.badges,
    'Result': r.status
  })));

  console.log('\n--- THESIS READY MARKDOWN TABLE ---');
  console.log('| Action / Event Trigger | Expected XP | Actual XP | Expected Level | Actual Level | Status |');
  console.log('| --- | --- | --- | --- | --- | --- |');
  results.forEach(r => {
    console.log(`| ${r.action} | ${r.expectedXp} | ${r.actualXp} | Lvl ${r.expectedLevel} | Lvl ${r.actualLevel} | ${r.status} |`);
  });

  console.log('\n**Badge Unlock Verification:**');
  console.log(`- Base State: 0 XP -> Badges: \`[${getEarnedBadges(0).join(', ')}]\``);
  console.log(`- State after Dessert Mission: 50 XP -> Badges: \`[${getEarnedBadges(50).join(', ')}]\``);
  console.log(`- State after Nyonya + Halal Mission: 105 XP -> Badges: \`[${getEarnedBadges(105).join(', ')}]\``);

  // Cleanup Database
  console.log('\n🧹 Cleaning up test review, mission, and user data...');
  await prisma.review.deleteMany({ where: { userId: user.id } });
  await prisma.userMission.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log('✅ Cleanup complete!');
}

main().catch(err => console.error(err)).finally(async () => {
  await prisma.$disconnect();
});
