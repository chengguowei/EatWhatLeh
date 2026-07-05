import prisma from '../src/db/prisma.js';

// Haversine formula (exact copy from backend/src/services/diningSet.js)
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

async function main() {
  console.log('=== GEOSPATIAL ACCURACY EVALUATION ===');
  try {
    const restaurants = await prisma.restaurant.findMany({ take: 20 });
    if (restaurants.length < 2) {
      console.error('Error: Insufficient restaurants in database to run tests.');
      return;
    }

    console.log(`Loaded ${restaurants.length} restaurants for comparison.`);

    // Create 10 distinct pairs
    const pairs = [];
    for (let i = 0; i < Math.min(10, restaurants.length - 1); i++) {
      pairs.push({
        r1: restaurants[i],
        r2: restaurants[i + 1],
      });
    }

    const results = [];
    let sumVariance = 0;
    let minVariance = Infinity;
    let maxVariance = -Infinity;

    for (let i = 0; i < pairs.length; i++) {
      const { r1, r2 } = pairs[i];

      // Calculate Distance A (Haversine) in meters
      const distA_km = haversineDistance(r1.lat, r1.lng, r2.lat, r2.lng);
      const distA_m = distA_km * 1000;

      // Calculate Distance B (PostGIS ST_DistanceSphere) in meters
      const queryResult = await prisma.$queryRaw`
        SELECT ST_DistanceSphere(
          ST_SetSRID(ST_MakePoint(${r1.lng}, ${r1.lat}), 4326),
          ST_SetSRID(ST_MakePoint(${r2.lng}, ${r2.lat}), 4326)
        ) AS distance;
      `;
      const distB_m = parseFloat(queryResult[0].distance);

      // Variance calculations
      const absVariance = Math.abs(distA_m - distB_m);
      const pctVariance = distB_m > 0 ? (absVariance / distB_m) * 100 : 0;

      results.push({
        pairId: `Pair #${i + 1}`,
        names: `${r1.name} <-> ${r2.name}`,
        haversine: distA_m.toFixed(4),
        postgis: distB_m.toFixed(4),
        variance: absVariance.toFixed(4),
        pctVariance: pctVariance.toFixed(6)
      });

      sumVariance += absVariance;
      if (absVariance < minVariance) minVariance = absVariance;
      if (absVariance > maxVariance) maxVariance = absVariance;
    }

    const avgVariance = sumVariance / pairs.length;

    console.log('\n--- RAW COMPARISON TABLE ---');
    console.table(results.map(r => ({
      'Test Case': r.pairId,
      'Restaurant Connection': r.names,
      'Haversine Dist (m)': r.haversine,
      'PostGIS Dist (m)': r.postgis,
      'Variance (m)': r.variance,
      'Variance (%)': r.pctVariance
    })));

    console.log('\n--- STATISTICAL SUMMARY ---');
    console.log(`Average Variance: ${avgVariance.toFixed(6)} m`);
    console.log(`Minimum Variance: ${minVariance.toFixed(6)} m`);
    console.log(`Maximum Variance: ${maxVariance.toFixed(6)} m`);

    console.log('\n--- THESIS READY MARKDOWN TABLE ---');
    console.log('| Test Case | Haversine Distance (m) | PostGIS Distance (m) | Variance (m) | Variance (%) |');
    console.log('| --- | --- | --- | --- | --- |');
    results.forEach(r => {
      console.log(`| ${r.pairId} | ${parseFloat(r.haversine).toFixed(2)} | ${parseFloat(r.postgis).toFixed(2)} | ${parseFloat(r.variance).toFixed(4)} | ${parseFloat(r.pctVariance).toFixed(4)}% |`);
    });
    console.log(`\n**Geospatial Summary Statistics:**`);
    console.log(`- **Average Distance Variance**: ${avgVariance.toFixed(4)} m`);
    console.log(`- **Minimum Distance Variance**: ${minVariance.toFixed(4)} m`);
    console.log(`- **Maximum Distance Variance**: ${maxVariance.toFixed(4)} m`);

  } catch (err) {
    console.error('Error executing geospatial test:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
