import { useState, useEffect } from 'react';
import axios from 'axios';
import { useUser } from '@clerk/clerk-react';
import { useChatContext } from '../context/chatContextStore';
import RestaurantCard, { type Restaurant } from '../components/RestaurantCard';
import MapModal from '../components/MapModal';
import { API_URL } from '../utils/api';
import './FeedPage.css';

const CATEGORIES = ['All', 'Main', 'Dessert', 'Cafe', 'Bar'];
const PRICE_FILTERS = ['All', '$', '$$', '$$$'];

// Demo profiles for personalisation showcase (FYP report use)
const DEMO_PROFILES = [
  { label: '👤 Default', clerkId: '' },
  { label: '💸 User A (Budget)', clerkId: 'user_clerk_a' },
  { label: '💎 User B (Fine Dining)', clerkId: 'user_clerk_b' },
];


export default function FeedPage() {
  const { user } = useUser();
  const { 
    demoProfile, 
    setDemoProfile, 
    userCoords, 
    locationStatus 
  } = useChatContext();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [price, setPrice] = useState('All');
  const [halalOnly, setHalalOnly] = useState(false);
  const [hiddenGemsOnly, setHiddenGemsOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchRestaurants();
  }, [category, price, halalOnly, hiddenGemsOnly, demoProfile, userCoords]);

  async function fetchRestaurants() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (category !== 'All') params.category = category;
      if (price !== 'All') params.priceRange = price;
      if (halalOnly) params.isHalal = 'true';
      if (hiddenGemsOnly) params.hiddenGemsOnly = 'true';

      if (demoProfile.clerkId) {
        params.demoClerkId = demoProfile.clerkId;
      } else if (user?.id) {
        params.clerkId = user.id;
      }

      if (userCoords) {
        params.lat = String(userCoords.lat);
        params.lng = String(userCoords.lng);
      }

      const { data } = await axios.get(`${API_URL}/api/restaurants`, { params });
      setRestaurants(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  // Client-side search filter (name, cuisine, tags, description)
  const filtered = restaurants.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.cuisine.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q) ||
      r.tags?.some((t) => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="feed-page">
      {/* Header */}
      <div className="feed-header">
        <div>
          <h1 className="section-title">Food Near You</h1>
          <p className="section-sub">📍 Malacca City · {filtered.length} spots found</p>
        </div>
      </div>

      {/* Demo Profile Switcher */}
      <div className="demo-profile-switcher">
        <span className="demo-label">🧪 Demo Profile:</span>
        {DEMO_PROFILES.map((p) => (
          <button
            key={p.clerkId}
            id={`profile-${p.clerkId || 'default'}`}
            className={`profile-chip ${demoProfile.clerkId === p.clerkId ? 'profile-active' : ''}`}
            onClick={() => setDemoProfile(p)}
            title={p.clerkId ? `Switch to ${p.label} to see personalised ranking` : 'No personalisation'}
          >
            {p.label}
          </button>
        ))}
        {demoProfile.clerkId && (
          <span className="profile-hint">
            Ranking adjusted for {demoProfile.label.split('(')[1]?.replace(')', '').trim() || 'this profile'}
          </span>
        )}
      </div>

      {/* Search Bar */}
      <div className="feed-search-wrap">
        <div className="feed-search-bar">
          <span className="search-icon">🔍</span>
          <input
            id="feed-search"
            type="text"
            className="feed-search-input"
            placeholder="Search by name, cuisine, or vibe…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear" onClick={() => setSearchQuery('')} title="Clear">✕</button>
          )}
        </div>
      </div>

      {/* Location Warning Banner */}
      {locationStatus === 'out-of-town' && (
        <div className="location-warning-banner info-mode">
          <span>📍 We noticed you are outside Melaka! Using Melaka Center coordinates so you can explore.</span>
        </div>
      )}
      {locationStatus === 'denied' && (
        <div className="location-warning-banner">
          <span>📍 Geolocation access is disabled. Using default Melaka coordinates.</span>
        </div>
      )}
      {/* Filters */}
      <div className="feed-filters">
        <div className="filter-scroll">
          <div className="filter-group">
            {CATEGORIES.map((c) => (
              <button
                key={c}
                id={`cat-${c}`}
                className={`filter-chip ${category === c ? 'active' : ''}`}
                onClick={() => setCategory(c)}
              >
                {c}
              </button>
            ))}
          </div>
          <div className="filter-divider" />
          <div className="filter-group">
            {PRICE_FILTERS.map((p) => (
              <button
                key={p}
                id={`price-${p}`}
                className={`filter-chip ${price === p ? 'active' : ''}`}
                onClick={() => setPrice(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="filter-divider" />
          <button
            id="halal-toggle"
            className={`filter-chip halal-chip ${halalOnly ? 'active-halal' : ''}`}
            onClick={() => setHalalOnly((v) => !v)}
          >
            ✓ Halal
          </button>
          <button
            id="hiddengems-toggle"
            className={`filter-chip hiddengem-chip ${hiddenGemsOnly ? 'active-hiddengem' : ''}`}
            onClick={() => setHiddenGemsOnly((v) => !v)}
          >
            💎 Hidden Gem
          </button>
        </div>
      </div>

      {/* Feed Grid */}
      <div className="feed-content">
        {loading ? (
          <div className="feed-loading">
            {[...Array(6)].map((_, i) => <div key={i} className="skeleton-card" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="feed-empty">
            <span>😕</span>
            <p>
              {searchQuery
                ? `No results for "${searchQuery}". Try a different search term.`
                : 'No restaurants found with these filters.'}
            </p>
          </div>
        ) : (
          <div className="feed-grid">
            {filtered.map((r, i) => (
              <RestaurantCard
                key={r.id}
                restaurant={r}
                index={i}
                onClick={() => setSelectedRestaurant(r)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Map Modal Popup */}
      <MapModal
        restaurant={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
      />
    </div>
  );
}
