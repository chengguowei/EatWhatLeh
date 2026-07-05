// Simple in-memory mock of Prisma for running EatWhatLeh without a database.
// This matches the exact queries used in our routes and supports seamless fallback.

const initialRestaurants = [
  {
    id: 'rest_1',
    name: 'Restoran Peranakan Jonker',
    description: 'Authentic Nyonya cuisine tucked in the heart of Jonker Street. Famous for Ayam Buah Keluak and Laksa Lemak.',
    cuisine: 'Nyonya / Peranakan',
    category: 'Main',
    address: '85, Jalan Hang Jebat, Jonker Street, 75200 Melaka',
    lat: 2.1945, lng: 102.2468,
    priceRange: '$$',
    tags: ['Nyonya', 'Halal-Friendly', 'Heritage', 'Laksa'],
    rating: 4.7,
    imageUrl: 'https://images.unsplash.com/photo-1569944990780-ef3b9b8048f2?w=600',
    openHours: '11am – 9pm',
    isHalal: false,
  },
  {
    id: 'rest_2',
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
    id: 'rest_3',
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
    id: 'rest_4',
    name: 'Pak Putra Tandoori & Naan',
    description: 'Iconic open-air Indian Muslim restaurant with stone tandoor ovens. The cheese naan is legendary.',
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
    id: 'rest_5',
    name: 'Capitol Satay Celup',
    description: 'Melaka\'s original satay celup. Skewers dipped in a simmering peanut-chili broth – queues form before opening.',
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
    id: 'rest_6',
    name: 'Klebang Original Coconut Shake',
    description: 'World-famous coconut shake with ice cream, served roadside since 1979. A Melaka pilgrimage.',
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
    id: 'rest_7',
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
    id: 'rest_8',
    name: 'Donald & Lily\'s Cendol',
    description: 'Generational cendol stall in Jonker. Green rice flour jelly, coconut milk, gula melaka – pure Melaka soul.',
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
    id: 'rest_9',
    name: 'Calanthe Art Café',
    description: 'A 13-states coffee concept café serving kopi from every Malaysian state. Cosy, artistic, heritage shophouse.',
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
    id: 'rest_10',
    name: 'Geographer Café',
    description: 'Iconic café on Jonker Street with outdoor seating. Mango smoothies, local cakes, and live music on weekends.',
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
    id: 'rest_11',
    name: 'Rooftop Bar 360° – Hard Rock Melaka',
    description: 'Sweeping panoramic rooftop bar at Hard Rock Hotel with skyline views over the Straits and live DJ sets.',
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
    id: 'rest_12',
    name: 'Limau-Limau Café',
    description: 'Hip shophouse bar in Chinatown with craft beers, natural wines and Instagrammable neon-lit interiors.',
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
];

const dbData = {
  restaurants: [...initialRestaurants],
  users: [
    {
      id: 'user_demo',
      clerkId: 'demo_clerk_id',
      name: 'Demo Foodie',
      email: 'demo@eatwhatleh.com',
      xp: 150,
      points: 150,
      level: 2,
      badges: ['First Bite', 'Jonker Explorer'],
      role: 'ADMIN',
      createdAt: new Date().toISOString(),
    },
  ],
  reviews: [
    {
      id: 'rev_1',
      userId: 'user_demo',
      restaurantId: 'rest_1',
      rating: 5,
      comment: 'Absolutely loved Restoran Peranakan Jonker! A must-try in Melaka.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'rev_2',
      userId: 'user_demo',
      restaurantId: 'rest_2',
      rating: 5,
      comment: 'Absolutely loved Selera Rakyat Hawker Centre! A must-try in Melaka.',
      createdAt: new Date().toISOString(),
    },
    {
      id: 'rev_3',
      userId: 'user_demo',
      restaurantId: 'rest_3',
      rating: 5,
      comment: 'Absolutely loved Asam Pedas Claypot House! A must-try in Melaka.',
      createdAt: new Date().toISOString(),
    },
  ],
  userMissions: [],
  osmTileCaches: [],
};

function matchField(itemVal, condVal) {
  if (condVal === undefined || condVal === null) return true;

  if (typeof condVal === 'object') {
    if (condVal.contains !== undefined) {
      if (!itemVal) return false;
      const term = condVal.contains.toLowerCase();
      return itemVal.toLowerCase().includes(term);
    }
    if (condVal.in !== undefined) {
      if (!itemVal) return false;
      return condVal.in.includes(itemVal);
    }
    if (condVal.has !== undefined) {
      if (!itemVal || !Array.isArray(itemVal)) return false;
      // Case-insensitive partial match: check if any tag contains the search term
      const term = String(condVal.has).toLowerCase();
      return itemVal.some((tag) => String(tag).toLowerCase().includes(term));
    }
    // Support range checks in mock database queries
    let isRange = false;
    if (condVal.gte !== undefined) {
      isRange = true;
      if (itemVal < condVal.gte) return false;
    }
    if (condVal.lte !== undefined) {
      isRange = true;
      if (itemVal > condVal.lte) return false;
    }
    if (condVal.not !== undefined) {
      isRange = true;
      if (condVal.not === null) {
        if (itemVal === null || itemVal === undefined) return false;
      } else {
        if (itemVal === condVal.not) return false;
      }
    }
    if (isRange) return true;
  }

  // Exact match
  return itemVal === condVal;
}

function matchesWhere(item, where) {
  if (!where) return true;

  for (const [key, val] of Object.entries(where)) {
    if (key === 'OR') {
      if (Array.isArray(val)) {
        const matched = val.some((cond) => {
          for (const [orKey, orVal] of Object.entries(cond)) {
            if (orKey === 'OR') {
              if (orVal.some((nestedOr) => matchesWhere(item, nestedOr))) return true;
            } else {
              if (matchField(item[orKey], orVal)) return true;
            }
          }
          return false;
        });
        if (!matched) return false;
      }
    } else if (key === 'reviews' && val && val._count !== undefined) {
      const count = dbData.reviews.filter((r) => r.restaurantId === item.id).length;
      if (val._count.lte !== undefined && count > val._count.lte) return false;
      if (val._count.gte !== undefined && count < val._count.gte) return false;
    } else {
      if (!matchField(item[key], val)) return false;
    }
  }
  return true;
}

const mockDb = {
  restaurant: {
    create: async (args) => {
      const { data } = args;
      const newRest = {
        id: `rest_${Date.now()}`,
        rating: 0,
        createdAt: new Date().toISOString(),
        ...data,
      };
      dbData.restaurants.push(newRest);
      return newRest;
    },
    findMany: async (args = {}) => {
      const { where, include, orderBy, take } = args;
      let list = dbData.restaurants.filter((r) => matchesWhere(r, where));

      if (orderBy) {
        if (orderBy.rating === 'desc') {
          list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        }
      }

      if (take !== undefined) {
        list = list.slice(0, take);
      }

      if (include && include.reviews) {
        list = list.map((r) => {
          let revs = dbData.reviews.filter((rev) => rev.restaurantId === r.id);

          if (include.reviews.orderBy && include.reviews.orderBy.createdAt === 'desc') {
            revs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          }

          if (include.reviews.take !== undefined) {
            revs = revs.slice(0, include.reviews.take);
          }

          if (include.reviews.include && include.reviews.include.user) {
            revs = revs.map((rev) => {
              const userObj = dbData.users.find((u) => u.id === rev.userId);
              const userSelect = include.reviews.include.user.select;
              const userFields = {};
              if (userObj) {
                if (userSelect.name) userFields.name = userObj.name;
                if (userSelect.level) userFields.level = userObj.level;
              }
              return { ...rev, user: userFields };
            });
          }

          return { ...r, reviews: revs };
        });
      }

      return list;
    },

    findUnique: async (args) => {
      const { where, include } = args;
      const restaurant = dbData.restaurants.find((r) => r.id === where.id);
      if (!restaurant) return null;

      const result = { ...restaurant };

      if (include && include.reviews) {
        let revs = dbData.reviews.filter((rev) => rev.restaurantId === restaurant.id);
        if (include.reviews.orderBy && include.reviews.orderBy.createdAt === 'desc') {
          revs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        if (include.reviews.include && include.reviews.include.user) {
          revs = revs.map((rev) => {
            const userObj = dbData.users.find((u) => u.id === rev.userId);
            const userSelect = include.reviews.include.user.select;
            const userFields = {};
            if (userObj) {
              if (userSelect.name) userFields.name = userObj.name;
              if (userSelect.level) userFields.level = userObj.level;
            }
            return { ...rev, user: userFields };
          });
        }
        result.reviews = revs;
      }

      return result;
    },

    update: async (args) => {
      const { where, data } = args;
      const idx = dbData.restaurants.findIndex((r) => r.id === where.id);
      if (idx !== -1) {
        dbData.restaurants[idx] = { ...dbData.restaurants[idx], ...data };
        return dbData.restaurants[idx];
      }
      return null;
    },

    upsert: async (args) => {
      const { where, update, create } = args;
      let idx = -1;
      if (where.osmId) {
        idx = dbData.restaurants.findIndex((r) => r.osmId === where.osmId);
      } else if (where.id) {
        idx = dbData.restaurants.findIndex((r) => r.id === where.id);
      }
      if (idx !== -1) {
        dbData.restaurants[idx] = { ...dbData.restaurants[idx], ...update };
        return dbData.restaurants[idx];
      } else {
        const newRest = {
          id: `rest_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          rating: 0,
          createdAt: new Date().toISOString(),
          ...create,
        };
        dbData.restaurants.push(newRest);
        return newRest;
      }
    },

    createMany: async (args) => {
      const { data } = args;
      const items = Array.isArray(data) ? data : [data];
      const created = [];
      for (const item of items) {
        if (item.osmId && dbData.restaurants.some(r => r.osmId === item.osmId)) {
          continue;
        }
        const newRest = {
          id: `rest_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          rating: 0,
          createdAt: new Date().toISOString(),
          ...item,
        };
        dbData.restaurants.push(newRest);
        created.push(newRest);
      }
      return { count: created.length };
    },

    count: async (args = {}) => {
      const { where } = args;
      let list = dbData.restaurants;
      if (where) {
        list = list.filter((r) => matchesWhere(r, where));
      }
      return list.length;
    },

    deleteMany: async (args = {}) => {
      const { where } = args;
      if (where) {
        dbData.restaurants = dbData.restaurants.filter((r) => {
          if (where.osmId && where.osmId.not === null && r.osmId === null) return true;
          if (where.createdAt && where.createdAt.lte && new Date(r.createdAt) > where.createdAt.lte) return true;
          if (where.reviews && where.reviews.none) {
            const hasReviews = dbData.reviews.some((rev) => rev.restaurantId === r.id);
            if (hasReviews) return true;
          }
          return false;
        });
      } else {
        dbData.restaurants = [];
      }
      return { count: 0 };
    },
  },

  user: {
    findMany: async (args = {}) => {
      const { orderBy, take, select } = args;
      let list = [...dbData.users];

      if (orderBy) {
        if (orderBy.xp === 'desc') {
          list.sort((a, b) => (b.xp || 0) - (a.xp || 0));
        }
      }

      if (take !== undefined) {
        list = list.slice(0, take);
      }

      if (select) {
        list = list.map((u) => {
          const selected = {};
          for (const key of Object.keys(select)) {
            if (select[key]) {
              selected[key] = u[key];
            }
          }
          return selected;
        });
      }

      return list;
    },

    findUnique: async (args) => {
      const { where, include } = args;
      const user = dbData.users.find((u) => {
        if (where.id) return u.id === where.id;
        if (where.clerkId) return u.clerkId === where.clerkId;
        return false;
      });
      if (!user) return null;

      const result = { ...user };

      if (include && include.reviews) {
        let revs = dbData.reviews.filter((rev) => rev.userId === user.id);
        if (include.reviews.orderBy && include.reviews.orderBy.createdAt === 'desc') {
          revs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
        if (include.reviews.take !== undefined) {
          revs = revs.slice(0, include.reviews.take);
        }
        if (include.reviews.include && include.reviews.include.restaurant) {
          revs = revs.map((rev) => {
            const restObj = dbData.restaurants.find((r) => r.id === rev.restaurantId);
            const restSelect = include.reviews.include.restaurant.select;
            const restFields = {};
            if (restObj) {
              if (restSelect.name) restFields.name = restObj.name;
            }
            return { ...rev, restaurant: restFields };
          });
        }
        result.reviews = revs;
      }

      if (include && include.missions) {
        result.missions = dbData.userMissions.filter((um) => um.userId === user.id);
      }

      return result;
    },

    update: async (args) => {
      const { where, data } = args;
      const idx = dbData.users.findIndex((u) => {
        if (where.id) return u.id === where.id;
        if (where.clerkId) return u.clerkId === where.clerkId;
        return false;
      });
      if (idx !== -1) {
        dbData.users[idx] = { ...dbData.users[idx], ...data };
        return dbData.users[idx];
      }
      return null;
    },

    upsert: async (args) => {
      const { where, update, create } = args;
      const idx = dbData.users.findIndex((u) => {
        if (where.id) return u.id === where.id;
        if (where.clerkId) return u.clerkId === where.clerkId;
        return false;
      });

      if (idx !== -1) {
        dbData.users[idx] = { ...dbData.users[idx], ...update };
        return dbData.users[idx];
      } else {
        const newUser = {
          id: `user_${Date.now()}`,
          ...create,
          createdAt: new Date().toISOString(),
        };
        dbData.users.push(newUser);
        return newUser;
      }
    },
  },

  review: {
    delete: async (args) => {
      const { where } = args;
      const idx = dbData.reviews.findIndex((r) => r.id === where.id);
      if (idx !== -1) {
        const deleted = dbData.reviews[idx];
        dbData.reviews.splice(idx, 1);
        return deleted;
      }
      return null;
    },
    create: async (args) => {
      const { data } = args;
      const newReview = {
        id: `rev_${Date.now()}`,
        ...data,
        createdAt: new Date().toISOString(),
      };
      dbData.reviews.push(newReview);
      return newReview;
    },

    findMany: async (args = {}) => {
      const { where, orderBy, include } = args;
      let list = dbData.reviews.filter((rev) => matchesWhere(rev, where));

      if (orderBy) {
        if (orderBy.createdAt === 'desc') {
          list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        }
      }

      if (include && include.user) {
        list = list.map((rev) => {
          const userObj = dbData.users.find((u) => u.id === rev.userId);
          const userSelect = include.user.select;
          const userFields = {};
          if (userObj) {
            if (userSelect.name) userFields.name = userObj.name;
            if (userSelect.level) userFields.level = userObj.level;
          }
          return { ...rev, user: userFields };
        });
      }

      return list;
    },
  },

  userMission: {
    findUnique: async (args) => {
      const { where } = args;
      if (where && where.userId_missionId) {
        const { userId, missionId } = where.userId_missionId;
        const found = dbData.userMissions.find(
          (um) => um.userId === userId && um.missionId === missionId
        );
        return found || null;
      }
      return null;
    },
    create: async (args) => {
      const { data } = args;
      const newUm = {
        id: `um_${Date.now()}`,
        ...data,
        completedAt: new Date().toISOString(),
      };
      dbData.userMissions.push(newUm);
      return newUm;
    },
    deleteMany: async (args = {}) => {
      const { where } = args;
      if (where && where.userId) {
        dbData.userMissions = dbData.userMissions.filter((um) => um.userId !== where.userId);
      } else {
        dbData.userMissions = [];
      }
      return { count: 0 };
    }
  },

  osmTileCache: {
    findFirst: async (args = {}) => {
      const { where } = args;
      if (!where) return null;
      
      const found = dbData.osmTileCaches.find((c) => {
        if (where.minLat && where.minLat.lte && c.minLat > where.minLat.lte) return false;
        if (where.maxLat && where.maxLat.gte && c.maxLat < where.maxLat.gte) return false;
        if (where.minLng && where.minLng.lte && c.minLng > where.minLng.lte) return false;
        if (where.maxLng && where.maxLng.gte && c.maxLng < where.maxLng.gte) return false;
        if (where.createdAt && where.createdAt.gte && new Date(c.createdAt) < where.createdAt.gte) return false;
        return true;
      });
      return found || null;
    },
    create: async (args) => {
      const { data } = args;
      const newCache = {
        id: `cache_${Date.now()}`,
        ...data,
        createdAt: new Date().toISOString(),
      };
      dbData.osmTileCaches.push(newCache);
      return newCache;
    },
    deleteMany: async (args = {}) => {
      const { where } = args;
      if (where && where.createdAt && where.createdAt.lte) {
        dbData.osmTileCaches = dbData.osmTileCaches.filter(
          (c) => new Date(c.createdAt) > where.createdAt.lte
        );
      } else {
        dbData.osmTileCaches = [];
      }
      return { count: 0 };
    }
  }
};

export default mockDb;
