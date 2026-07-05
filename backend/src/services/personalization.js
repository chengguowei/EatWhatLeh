import prisma from '../db/prisma.js';

/**
 * Determine a user's price preference from their review history.
 * Returns 'CHEAP' if >= 60% of their past reviews are on ($) restaurants.
 * Returns 'EXPENSIVE' if >= 60% are on ($$$) restaurants.
 * Returns 'NONE' otherwise.
 */
export async function getUserPricePreference(clerkId) {
  if (!clerkId) return 'NONE';
  try {
    const user = await prisma.user.findUnique({
      where: { clerkId },
      include: {
        reviews: {
          include: { restaurant: { select: { priceRange: true } } },
        },
      },
    });
    if (!user || user.reviews.length === 0) return 'NONE';

    const total = user.reviews.length;
    const cheap = user.reviews.filter(r => r.restaurant?.priceRange === '$').length;
    const expensive = user.reviews.filter(r => r.restaurant?.priceRange === '$$$').length;

    if (cheap / total >= 0.6) return 'CHEAP';
    if (expensive / total >= 0.6) return 'EXPENSIVE';
    return 'NONE';
  } catch (err) {
    console.error('Error determining user price preference:', err);
    return 'NONE';
  }
}
