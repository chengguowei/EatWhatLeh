import { useState, useEffect, useRef } from 'react';
import { useUser, SignInButton, useAuth } from '@clerk/clerk-react';
import axios from 'axios';
import { getAuthHeaders } from '../utils/authHelper';
import { uploadPhoto } from '../utils/supabaseClient';
import { API_URL } from '../utils/api';
import './ReviewPage.css';

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  category: string;
  isHalal: boolean;
  lat: number;
  lng: number;
  matchPercentage?: number;
  matchDetails?: any;
}

interface Mission {
  id: string;
  title: string;
  xp: number;
  icon: string;
  check: (r: Restaurant) => boolean;
}

const MISSIONS: Mission[] = [
  {
    id: 'm1',
    title: 'Review a Nyonya restaurant',
    xp: 25,
    icon: '🍜',
    check: (r) =>
      r.cuisine.toLowerCase().includes('nyonya') ||
      r.cuisine.toLowerCase().includes('peranakan'),
  },
  {
    id: 'm2',
    title: 'Try a dessert spot and rate it',
    xp: 20,
    icon: '🍡',
    check: (r) => r.category === 'Dessert',
  },
  {
    id: 'm3',
    title: 'Visit a café and share your thoughts',
    xp: 20,
    icon: '☕',
    check: (r) => r.category === 'Cafe',
  },
  {
    id: 'm4',
    title: 'Rate any Halal restaurant',
    xp: 15,
    icon: '✅',
    check: (r) => r.isHalal,
  },
  {
    id: 'm5',
    title: 'Unearth a Hidden Gem 💎',
    xp: 30,
    icon: '💎',
    check: () => false, // Handled on the backend upon submission
  },
];

const LEVEL_NAMES: Record<number, string> = {
  1: 'Apprentice Foodie',
  2: 'Hawker Hunter',
  3: 'Sambal Explorer',
  4: 'Gourmet Critic',
  5: 'Legendary Glutton',
};

const MIN_COMMENT_LENGTH = 20;
const MAX_COMMENT_LENGTH = 500;

interface LevelUpData {
  level: number;
  badges: string[];
}

interface Toast {
  text: string;
  xp?: number;
  type: 'success' | 'error';
}

// Helper to calculate distance in meters using Haversine formula
function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export default function ReviewPage() {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);

  // Searchable picker state
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const locationRequestRef = useRef(0);

  // Live OSM search state (for restaurants not yet in DB)
  const [osmSearching, setOsmSearching] = useState(false);
  const [osmSearchDone, setOsmSearchDone] = useState(false);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  // Location verification states
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null);
  const [verifyingLocation, setVerifyingLocation] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [locationVerified, setLocationVerified] = useState(false);
  const [distanceToSelected, setDistanceToSelected] = useState<number | null>(null);
  const [mockGpsEnabled, setMockGpsEnabled] = useState(false);

  // Photo upload states
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Gamification tracking
  const [userLevel, setUserLevel] = useState(1);
  const [levelUpData, setLevelUpData] = useState<LevelUpData | null>(null);

  // Mission completion (persisted in backend database)
  const [completedMissions, setCompletedMissions] = useState<Set<string>>(new Set());

  // Already-reviewed restaurant IDs (fetched from profile)
  const [reviewedRestaurantIds, setReviewedRestaurantIds] = useState<Set<string>>(new Set());

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Revoke preview object URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Run location verification logic
  const verifyLocation = (restaurant: Restaurant | null, mockEnabled: boolean) => {
    if (!restaurant) {
      setUserCoords(null);
      setLocationVerified(false);
      setDistanceToSelected(null);
      setLocationError(null);
      return;
    }

    const currentRequestId = ++locationRequestRef.current;

    setVerifyingLocation(true);
    setLocationError(null);
    setLocationVerified(false);
    setDistanceToSelected(null);

    if (mockEnabled) {
      // Simulate user coords slightly offset from the restaurant (~50m away)
      const simulatedLat = restaurant.lat + 0.0003;
      const simulatedLng = restaurant.lng - 0.0004;
      setTimeout(() => {
        if (currentRequestId !== locationRequestRef.current) return;
        const dist = getDistanceInMeters(simulatedLat, simulatedLng, restaurant.lat, restaurant.lng);
        setUserCoords([simulatedLat, simulatedLng]);
        setDistanceToSelected(Math.round(dist));
        setLocationVerified(dist <= 200);
        setVerifyingLocation(false);
      }, 600);
    } else {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (currentRequestId !== locationRequestRef.current) return;
          const { latitude, longitude } = position.coords;
          const dist = getDistanceInMeters(latitude, longitude, restaurant.lat, restaurant.lng);
          setUserCoords([latitude, longitude]);
          setDistanceToSelected(Math.round(dist));
          
          if (dist <= 200) {
            setLocationVerified(true);
            setLocationError(null);
          } else {
            setLocationVerified(false);
            const km = (dist / 1000).toFixed(1);
            setLocationError(`You are too far from this restaurant. You are ${dist > 1000 ? `${km} km` : `${Math.round(dist)} meters`} away (must be within 200m).`);
          }
          setVerifyingLocation(false);
        },
        (error) => {
          if (currentRequestId !== locationRequestRef.current) return;
          console.warn('Geolocation failed:', error);
          setUserCoords(null);
          setLocationVerified(false);
          let errMsg = 'Failed to retrieve your location.';
          if (error.code === error.PERMISSION_DENIED) {
            errMsg = 'Location access denied. Please enable location services in your browser settings to verify you are at the restaurant.';
          } else if (error.code === error.POSITION_UNAVAILABLE) {
            errMsg = 'Location information is unavailable.';
          } else if (error.code === error.TIMEOUT) {
            errMsg = 'Location request timed out. Please try again.';
          }
          setLocationError(errMsg);
          setVerifyingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  };

  useEffect(() => {
    verifyLocation(selectedRestaurant, mockGpsEnabled);
  }, [selectedRestaurant, mockGpsEnabled]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleRemovePreview = () => {
    setImageFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  // Fetch all restaurants for picker
  useEffect(() => {
    axios.get(`${API_URL}/api/restaurants`).then(({ data }) => setRestaurants(data));
  }, []);

  // Fetch profile: level, already-reviewed restaurant IDs, and database missions
  useEffect(() => {
    if (isSignedIn && user) {
      const getProfile = async () => {
        try {
          const headers = await getAuthHeaders(user, getToken);
          const { data } = await axios.get(`${API_URL}/api/users/profile/${user.id}`, { headers });
          if (data?.level) setUserLevel(data.level);
          if (data?.reviews) {
            const ids = new Set<string>(
              data.reviews.map((r: { restaurantId: string }) => r.restaurantId)
            );
            setReviewedRestaurantIds(ids);
          }
          if (data?.missions) {
            const missionIds = data.missions.map((m: { missionId: string }) => m.missionId);
            setCompletedMissions(new Set(missionIds));
          }
        } catch (err) {
          console.warn('Failed to fetch profile in ReviewPage:', err);
        }
      };
      getProfile();
    }
  }, [isSignedIn, user, getToken]);

  // Filtered restaurants based on search query
  const filteredRestaurants = restaurants.filter(
    (r) =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.cuisine.toLowerCase().includes(search.toLowerCase())
  );

  function selectRestaurant(r: Restaurant) {
    setSelectedRestaurant(r);
    setSearch(r.name);
    setShowDropdown(false);
    setOsmSearchDone(false);
  }

  function clearSelection() {
    setSelectedRestaurant(null);
    setSearch('');
    setOsmSearchDone(false);
  }

  // Live OSM search: fetch from Overpass, import into DB, refresh local list
  async function handleOsmSearch() {
    if (!search || search.length < 2) return;
    setOsmSearching(true);
    try {
      const { data } = await axios.get(`${API_URL}/api/restaurants/search-osm`, {
        params: { query: search },
      });
      if (data.restaurants && data.restaurants.length > 0) {
        // Merge new results into local restaurants list (avoid duplicates by ID)
        setRestaurants((prev) => {
          const existingIds = new Set(prev.map((r) => r.id));
          const newOnes = data.restaurants.filter((r: Restaurant) => !existingIds.has(r.id));
          return [...prev, ...newOnes];
        });
      }
      setOsmSearchDone(true);
    } catch (err) {
      console.error('OSM search failed:', err);
      setOsmSearchDone(true);
    } finally {
      setOsmSearching(false);
    }
  }

  // Derived state for form validation
  const alreadyReviewed = selectedRestaurant
    ? reviewedRestaurantIds.has(selectedRestaurant.id)
    : false;
  const isCommentValid = comment.trim().length >= MIN_COMMENT_LENGTH;
  const canSubmit =
    !submitting &&
    rating > 0 &&
    isCommentValid &&
    !!selectedRestaurant &&
    !alreadyReviewed &&
    locationVerified;

  function showToast(t: Toast) {
    setToast(t);
    setTimeout(() => setToast(null), 4000);
  }

  async function handleSubmit(e: React.FormEvent) {
    if (!isSignedIn || !user || !selectedRestaurant || rating === 0 || !comment.trim()) return;
    e.preventDefault();
    setSubmitting(true);

    try {
      let uploadedImageUrl: string | undefined = undefined;
      if (imageFile) {
        uploadedImageUrl = await uploadPhoto(imageFile, 'review-photos');
      }

      const headers = await getAuthHeaders(user, getToken);
      const { data } = await axios.post(`${API_URL}/api/reviews`, {
        clerkId: user.id,
        restaurantId: selectedRestaurant.id,
        rating,
        comment,
        imageUrl: uploadedImageUrl,
        lat: userCoords ? userCoords[0] : null,
        lng: userCoords ? userCoords[1] : null,
      }, { headers });

      // Mark this restaurant as reviewed
      setReviewedRestaurantIds((prev) => new Set([...prev, selectedRestaurant.id]));

      // Update missions completed from backend database response
      if (data.completedMissions) {
        setCompletedMissions(new Set(data.completedMissions));
      }

      // Success toast with actual XP from backend
      showToast({ text: `Review submitted! Keep eating!`, xp: data.xpEarned, type: 'success' });

      // Reset form
      setSelectedRestaurant(null);
      setSearch('');
      setRating(0);
      setComment('');
      setImageFile(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }

      // Detect Level Up
      if (data.newLevel > userLevel) {
        setLevelUpData({ level: data.newLevel, badges: data.newBadges || [] });
        setUserLevel(data.newLevel);
      }
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } };
      const msg =
        axiosErr?.response?.data?.error || 'Failed to submit review. Please try again.';
      showToast({ text: msg, type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="review-page">
      {/* Toast (success or error) */}
      {toast && (
        <div className={`xp-toast fade-up ${toast.type === 'error' ? 'error-toast' : ''}`}>
          <span>{toast.type === 'error' ? '❌' : '🎉'} {toast.text}</span>
          {toast.xp && <span className="xp-badge">+{toast.xp} XP</span>}
        </div>
      )}

      {/* Level Up Modal */}
      {levelUpData && (
        <div className="levelup-overlay">
          <div className="levelup-modal glass-card fade-up">
            <div className="confetti-container">
              {[...Array(16)].map((_, i) => (
                <span key={i} className={`confetti-particle p-${i + 1}`} />
              ))}
            </div>
            <span className="levelup-crown">👑</span>
            <h2 className="levelup-title">LEVEL UP!</h2>
            <p className="levelup-sub">Wah, you are now a</p>
            <span className="levelup-badge">
              Lv.{levelUpData.level} {LEVEL_NAMES[levelUpData.level] || 'Elite Gourmet'}
            </span>

            {levelUpData.badges.length > 0 && (
              <div className="levelup-unlocked-badges">
                <p className="badges-label">Unlocked Badges:</p>
                <div className="unlocked-badge-row">
                  {levelUpData.badges.map((b) => (
                    <span key={b} className="unlocked-badge-item">🏅 {b}</span>
                  ))}
                </div>
              </div>
            )}

            <button className="btn-primary levelup-btn" type="button" onClick={() => setLevelUpData(null)}>
              Steady Lah! 🚀
            </button>
          </div>
        </div>
      )}

      <div className="review-header">
        <h1 className="section-title">Reviews & Missions</h1>
        <p className="section-sub">Share your experience, earn XP 🏆</p>
      </div>

      {/* Active Missions */}
      <section className="missions-section">
        <h2 className="sub-heading">🎯 Active Missions</h2>
        <div className="missions-list">
          {MISSIONS.map((m) => {
            const done = completedMissions.has(m.id);
            return (
              <div key={m.id} className={`mission-card glass-card ${done ? 'completed' : ''}`}>
                <span className="mission-icon">{done ? '✅' : m.icon}</span>
                <div className="mission-info">
                  <p className="mission-title">{m.title}</p>
                  <span className="xp-badge">+{m.xp} XP</span>
                </div>
                {done ? (
                  <span className="mission-done-tag">Done!</span>
                ) : (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    width="16"
                    height="16"
                    className="mission-arrow"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                  </svg>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Review Form */}
      <section className="review-form-section">
        <h2 className="sub-heading">✍️ Write a Review</h2>
        {!isSignedIn ? (
          <div className="sign-in-prompt glass-card">
            <p>Sign in to submit a review and earn XP!</p>
            <SignInButton mode="modal">
              <button className="btn-primary" id="review-signin-btn">
                Sign In to Review
              </button>
            </SignInButton>
          </div>
        ) : (
          <form className="review-form glass-card" onSubmit={handleSubmit}>

            {/* Searchable Restaurant Picker */}
            <div className="form-group">
              <div className="picker-label-row">
                <label className="form-label">Select a Restaurant</label>
                <span className="proximity-constraint-caption">
                  📍 Proximity check active (must be within 200m)
                </span>
              </div>
              <div className="restaurant-search-wrapper" ref={dropdownRef}>
                <div className="restaurant-search-input-row">
                  <input
                    id="restaurant-search"
                    type="text"
                    className="input-field"
                    placeholder="Search by name or cuisine..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setSelectedRestaurant(null);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    autoComplete="off"
                  />
                  {(search || selectedRestaurant) && (
                    <button type="button" className="clear-search-btn" onClick={clearSelection}>
                      ✕
                    </button>
                  )}
                </div>

                {/* Selected confirmation tag */}
                {selectedRestaurant && (
                  <div className="selected-restaurant-tag">
                    <span className="selected-dot" />
                    <span className="selected-name">{selectedRestaurant.name}</span>
                    <span className="selected-cuisine">· {selectedRestaurant.cuisine}</span>
                    {selectedRestaurant.isHalal && <span className="selected-halal">✓ Halal</span>}
                  </div>
                )}

                {/* Dropdown results */}
                {showDropdown && search.length > 0 && !selectedRestaurant && (
                  <div className="restaurant-dropdown">
                    {filteredRestaurants.length === 0 ? (
                      <div className="dropdown-empty">
                        <p>No local results for "{search}"</p>
                        {!osmSearchDone ? (
                          <button
                            id="osm-search-btn"
                            type="button"
                            className="osm-search-btn"
                            onClick={handleOsmSearch}
                            disabled={osmSearching}
                          >
                            {osmSearching ? (
                              <><span className="spinner" /> Searching OpenStreetMap...</>
                            ) : (
                              <>🌍 Search OpenStreetMap for "{search}"</>
                            )}
                          </button>
                        ) : (
                          <p className="osm-done-msg">
                            {filteredRestaurants.length > 0
                              ? `Found ${filteredRestaurants.length} result(s) from OpenStreetMap!`
                              : '😕 No matches found on OpenStreetMap either.'}
                          </p>
                        )}
                      </div>
                    ) : (
                      filteredRestaurants.slice(0, 8).map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          className={`dropdown-item ${reviewedRestaurantIds.has(r.id) ? 'already-reviewed' : ''}`}
                          onClick={() => selectRestaurant(r)}
                        >
                          <div className="dropdown-item-main">
                            <span className="dropdown-name">{r.name}</span>
                            {reviewedRestaurantIds.has(r.id) && (
                              <span className="reviewed-tag">✓ Reviewed</span>
                            )}
                          </div>
                          <span className="dropdown-cuisine">{r.cuisine} · {r.category}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Duplicate warning */}
              {alreadyReviewed && (
                <div className="duplicate-warning">
                  ⚠️ You've already reviewed <strong>{selectedRestaurant?.name}</strong>. Each restaurant can only be reviewed once to keep ratings fair.
                </div>
              )}

              {/* Location Verification Status Card */}
              {selectedRestaurant && (
                <div className={`location-status-card ${locationVerified ? 'verified' : locationError ? 'failed' : 'verifying'}`}>
                  <div className="location-status-header">
                    <span className="status-dot-indicator" />
                    <span className="status-label">
                      {verifyingLocation
                        ? 'Verifying your location...'
                        : locationVerified
                        ? `Location Verified (${distanceToSelected}m away)`
                        : 'Location Verification Failed'}
                    </span>
                  </div>
                  {locationError && (
                    <div className="location-status-error-text">
                      {locationError}
                    </div>
                  )}
                  {!verifyingLocation && !locationVerified && (
                    <button
                      type="button"
                      className="retry-gps-btn"
                      onClick={() => verifyLocation(selectedRestaurant, mockGpsEnabled)}
                    >
                      🔄 Retry Location Verification
                    </button>
                  )}
                </div>
              )}

              {/* Simulation checkbox for testing/demo */}
              {selectedRestaurant && (
                <div className="mock-gps-group">
                  <label className="mock-gps-label">
                    <input
                      type="checkbox"
                      checked={mockGpsEnabled}
                      onChange={(e) => setMockGpsEnabled(e.target.checked)}
                      className="mock-gps-checkbox"
                    />
                    <span>Simulate GPS Proximity (For Testing & Demo)</span>
                  </label>
                </div>
              )}
            </div>

            {/* Star Rating */}
            <div className="form-group">
              <label className="form-label">Your Rating</label>
              <div className="star-picker">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    id={`star-${s}`}
                    className={`star-btn ${s <= (hoverRating || rating) ? 'active' : ''}`}
                    onMouseEnter={() => setHoverRating(s)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => setRating(s)}
                  >
                    ★
                  </button>
                ))}
                {rating > 0 && (
                  <span className="rating-label">
                    {['', 'Poor', 'Fair', 'Good', 'Great', 'Amazing!'][rating]}
                  </span>
                )}
              </div>
            </div>

            {/* Comment with char count */}
            <div className="form-group">
              <label className="form-label">Your Review</label>
              <textarea
                id="review-comment"
                className="input-field"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
                placeholder="Tell others what you loved (or not) about this place... (min. 20 characters)"
                rows={4}
                required
              />
              <div className="comment-meta-row">
                <span className="comment-hint">
                  {comment.length === 0 ? '' : !isCommentValid ? (
                    <span className="comment-hint-warn">At least {MIN_COMMENT_LENGTH} characters needed</span>
                  ) : (
                    <span className="comment-hint-ok">✓ Looks good!</span>
                  )}
                </span>
                <span className={`char-count ${comment.length >= MAX_COMMENT_LENGTH ? 'at-limit' : ''}`}>
                  {comment.length}/{MAX_COMMENT_LENGTH}
                </span>
              </div>
            </div>

            {/* Photo Upload */}
            <div className="form-group">
              <label className="form-label">Add a Photo (Optional)</label>
              <div className="photo-uploader glass-card">
                <input
                  id="review-photo-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <label htmlFor="review-photo-input" className="uploader-label">
                  <span className="uploader-icon">📷</span>
                  <span className="uploader-text">
                    {imageFile ? imageFile.name : 'Choose a photo or capture one'}
                  </span>
                </label>
                {previewUrl && (
                  <div className="preview-container">
                    <img src={previewUrl} alt="Review Preview" className="photo-preview" />
                    <button type="button" className="remove-preview-btn" onClick={handleRemovePreview}>
                      ✕
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              id="submit-review-btn"
              type="submit"
              className="btn-primary submit-btn"
              disabled={!canSubmit}
            >
              {submitting ? (
                <><span className="spinner" /> Submitting...</>
              ) : (
                <>Submit Review · +15 XP</>
              )}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
