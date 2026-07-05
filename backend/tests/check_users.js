import prisma from '../src/db/prisma.js';

async function main() {
  console.log('=== DATABASE USER AUDIT ===');
  try {
    const users = await prisma.user.findMany({
      include: {
        _count: {
          select: { reviews: true, missions: true }
        }
      }
    });

    console.log(`Total users in PostgreSQL: ${users.length}`);
    console.table(users.map(u => ({
      id: u.id,
      clerkId: u.clerkId,
      name: u.name,
      email: u.email,
      xp: u.xp,
      level: u.level,
      reviewsCount: u._count.reviews,
      missionsCount: u._count.missions,
      badges: u.badges.join(', ')
    })));

    const reviews = await prisma.review.findMany({
      include: {
        user: { select: { name: true } },
        restaurant: { select: { name: true } }
      }
    });
    console.log(`\nTotal reviews in PostgreSQL: ${reviews.length}`);
    console.table(reviews.map(r => ({
      id: r.id,
      userName: r.user?.name || 'unknown',
      restaurantName: r.restaurant?.name || 'unknown',
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt
    })));

  } catch (err) {
    console.error('Audit failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
