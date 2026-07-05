import { buildDiningSet } from '../src/services/diningSet.js';
import prisma from '../src/db/prisma.js';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log(`======================================================================`);
  console.log(`             EATWHATLEH - DINING SET PATHFINDING TEST                 `);
  console.log(`======================================================================`);
  
  // Starting point: Malacca City Center
  const startLat = 2.1896;
  const startLng = 102.2501;
  const categories = ['Main', 'Dessert', 'Cafe'];

  console.log(`Starting Position: [Lat: ${startLat}, Lng: ${startLng}] (Malacca Center)`);
  console.log(`Requested Itinerary Flow: Main ➔ Dessert ➔ Cafe\n`);

  try {
    // 1. Fetch candidate restaurants from database
    const restaurants = await prisma.restaurant.findMany();
    
    // Group candidate pools
    const pools = {
      'Main': restaurants.filter(r => r.category === 'Main'),
      'Dessert': restaurants.filter(r => r.category === 'Dessert'),
      'Cafe': restaurants.filter(r => r.category === 'Cafe')
    };

    console.log(`Candidates Found in Database:`);
    console.log(` - Main Dishes: ${pools.Main.length} eateries`);
    console.log(` - Desserts:    ${pools.Dessert.length} eateries`);
    console.log(` - Cafes:       ${pools.Cafe.length} eateries`);

    // 2. Build the sequential Dining Set
    const itinerary = buildDiningSet(categories, pools, startLat, startLng);

    console.log(`\n=================== GENERATED ITINERARY PATH ===================`);
    console.table(itinerary.map((stop, index) => ({
      'Stop #': index + 1,
      'Category': stop.category,
      'Restaurant Name': stop.name,
      'Rating': `${stop.rating}★`,
      'Price': stop.priceRange,
      'Dist from Prev (km)': `${stop.distanceFromPrev} km`,
      'Est. Walk Time': `${stop.walkMinutes} mins`
    })));

    console.log(`\nPath Validation Summary:`);
    let totalDist = 0;
    let totalWalkTime = 0;
    
    itinerary.forEach((stop, index) => {
      totalDist += stop.distanceFromPrev;
      totalWalkTime += stop.walkMinutes;
      console.log(`Stop #${index + 1} (${stop.category}): ${stop.name} is ${stop.distanceFromPrev} km away. Walk: ~${stop.walkMinutes} mins.`);
    });
    
    console.log(`\nTotal Itinerary Travel Distance: ${totalDist.toFixed(2)} km`);
    console.log(`Total Est. Walking Duration:     ${totalWalkTime} minutes`);
    console.log(`======================================================================`);

  } catch (err) {
    console.error("Error generating dining set itinerary:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
