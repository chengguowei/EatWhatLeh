// Haversine formula: returns distance in km between two lat/lng points
export function haversineDistance(lat1, lng1, lat2, lng2) {
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

/**
 * Given pools of restaurants per category and a start coordinate,
 * greedily picks the best-rated restaurant per category whose
 * next stop is nearest to the previous stop.
 *
 * @param {string[]} categories  Ordered array like ["Main","Dessert","Bar"]
 * @param {Record<string, any[]>} pools  Map of category → candidate restaurants
 * @param {number} startLat
 * @param {number} startLng
 * @returns {any[]} Ordered array of selected restaurants
 */
export function buildDiningSet(categories, pools, startLat, startLng) {
  const selected = [];
  let curLat = startLat;
  let curLng = startLng;

  for (const cat of categories) {
    const candidates = pools[cat] || [];
    if (candidates.length === 0) continue;

    // Score = rating * 2 - distance (weighted: prefer quality over proximity slightly)
    const scored = candidates.map((r) => {
      const dist = haversineDistance(curLat, curLng, r.lat, r.lng);
      const score = r.rating * 2 - dist * 0.5;
      return { ...r, _dist: dist, _score: score };
    });

    scored.sort((a, b) => b._score - a._score);
    const pick = scored[0];

    // Attach distance from previous stop and estimated walking time (avg 5 km/h)
    const distFromPrev = parseFloat(pick._dist.toFixed(2));
    const walkMinutes = Math.round((distFromPrev / 5) * 60);

    selected.push({
      ...pick,
      distanceFromPrev: distFromPrev,
      walkMinutes: walkMinutes,
    });

    curLat = pick.lat;
    curLng = pick.lng;
  }

  return selected;
}

/**
 * Filter restaurants by distance from a coordinate.
 */
export function filterByRadius(restaurants, lat, lng, radiusKm = 10) {
  return restaurants
    .map((r) => ({ ...r, distance: haversineDistance(lat, lng, r.lat, r.lng) }))
    .filter((r) => r.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
}
