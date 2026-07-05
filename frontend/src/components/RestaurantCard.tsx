import { useState } from 'react';
import axios from 'axios';
import { useUser, useAuth } from '@clerk/clerk-react';
import { getAuthHeaders } from '../utils/authHelper';
import { API_URL } from '../utils/api';

interface MatchDetails {
  proximityLabel: string;
  proximityScore: number;
  proximityMax: number;
  cuisineLabel: string;
  cuisineScore: number;
  cuisineMax: number;
  ratingLabel: string;
  ratingScore: number;
  ratingMax: number;
  preferenceLabel: string;
  preferenceScore: number;
  preferenceMax: number;
  tasteLabel?: string;
  tasteScore?: number;
  tasteMax?: number;
}

interface RankingBreakdown {
  ratingScore: number;
  exposureScore: number;
  distanceScore: number;
  priceAdjustment: number;
}

interface ReviewPreview {
  id: string;
  rating: number;
  comment: string;
  user?: { name: string; level: number };
}

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  priceRange: string;
  tags: string[];
  rating: number;
  imageUrl: string;
  openHours: string;
  isHalal: boolean;
  category: string;
  distance?: number;
  distanceFromPrev?: number;
  walkMinutes?: number;
  matchPercentage?: number;
  matchDetails?: MatchDetails;
  hasExpertEndorsement?: boolean;
  // Personalised feed fields
  reviews?: ReviewPreview[];
  personalizedScore?: number;
  rankingBreakdown?: RankingBreakdown;
  pricePref?: 'CHEAP' | 'EXPENSIVE' | 'NONE';
  recommendationType?: 'prompt' | 'preference' | 'gem';
}

interface RestaurantCardProps {
  restaurant: Restaurant;
  index?: number;
  showStep?: boolean;
  onClick?: () => void;
}

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return (
    <span className="stars">
      {'★'.repeat(full)}{half ? '½' : ''}{'☆'.repeat(5 - full - (half ? 1 : 0))}
    </span>
  );
}

function ReviewDrawer({ reviews }: { reviews: ReviewPreview[] }) {
  if (!reviews || reviews.length === 0) return null;
  return (
    <div className="review-drawer">
      <p className="review-drawer-title">💬 Recent Reviews</p>
      {reviews.map((rev) => (
        <div key={rev.id} className="review-preview-item">
          <div className="review-preview-header">
            <span className="review-preview-name">
              {rev.user?.name ?? 'Anonymous'}
              {rev.user?.level && rev.user.level >= 4 && (
                <span className="expert-badge" title="Expert reviewer">⭐</span>
              )}
            </span>
            <span className="review-preview-stars">{'★'.repeat(rev.rating)}</span>
          </div>
          {rev.comment && (
            <p className="review-preview-comment">
              "{rev.comment.length > 90 ? rev.comment.slice(0, 90) + '…' : rev.comment}"
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export default function RestaurantCard({ restaurant, index, showStep, onClick }: RestaurantCardProps) {
  const [showMatchDetails, setShowMatchDetails] = useState(false);
  const [showReviews, setShowReviews] = useState(false);

  const { user, isSignedIn } = useUser();
  const { getToken } = useAuth();

  const [activeTagVote, setActiveTagVote] = useState<string | null>(null);
  const [voteCounts, setVoteCounts] = useState<Record<string, { upvotes: number; downvotes: number; total: number }>>({});
  const [loadingVotes, setLoadingVotes] = useState(false);

  const fetchVoteCounts = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/restaurants/${restaurant.id}/tag-votes`);
      setVoteCounts(data);
    } catch (err) {
      console.error('Failed to fetch tag votes:', err);
    }
  };

  const handleTagClick = (e: React.MouseEvent, tag: string) => {
    e.stopPropagation();
    if (!isSignedIn) {
      alert('Please log in to vote on eatery tags!');
      return;
    }
    if (activeTagVote === tag) {
      setActiveTagVote(null);
    } else {
      setActiveTagVote(tag);
      fetchVoteCounts();
    }
  };

  const handleVote = async (tag: string, isPositive: boolean) => {
    if (!user || !getToken) return;
    setLoadingVotes(true);
    try {
      const headers = await getAuthHeaders(user, getToken);
      await axios.post(
        `${API_URL}/api/restaurants/${restaurant.id}/tags/${tag}/vote`,
        { isPositive },
        { headers }
      );
      await fetchVoteCounts();
      setActiveTagVote(null);
    } catch (err) {
      console.error('Failed to vote on tag:', err);
      alert('Failed to register tag vote. Please try again.');
    } finally {
      setLoadingVotes(false);
    }
  };

  const handleWhyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMatchDetails(!showMatchDetails);
  };

  const handleReviewsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowReviews(!showReviews);
  };

  const reviewCount = restaurant.reviews?.length ?? 0;

  // Price adjustment label for personalized ranking
  const priceAdj = restaurant.rankingBreakdown?.priceAdjustment ?? 0;
  const pricePref = restaurant.pricePref;
  const showPriceTag = pricePref && pricePref !== 'NONE';

  return (
    <div 
      className={`restaurant-card glass-card fade-up ${onClick ? 'interactive-card' : ''}`} 
      style={{ animationDelay: `${(index ?? 0) * 0.08}s` }}
      onClick={onClick}
    >
      {showStep && index !== undefined && (
        <div className="step-badge">
          <span>Stop {index + 1}</span>
        </div>
      )}
      
      {/* Match Percentage Pill (chat/explore mode) */}
      {restaurant.matchPercentage !== undefined && (
        <div className="match-badge-container">
          <span className={`match-pill ${
            restaurant.matchPercentage >= 80 ? 'match-high' : 
            restaurant.matchPercentage >= 50 ? 'match-med' : 'match-low'
          }`}>
            🔥 {restaurant.matchPercentage}% Match
          </span>
          <button 
            type="button" 
            className="why-btn" 
            onClick={handleWhyClick}
            title="Show match breakdown"
          >
            {showMatchDetails ? 'Hide' : 'Why?'}
          </button>
        </div>
      )}

      {/* Personalised ranking tag (feed mode) */}
      {showPriceTag && priceAdj !== 0 && (
        <div className="personalized-badge-container">
          <span className={`personalized-pill ${priceAdj > 0 ? 'pref-boost' : 'pref-penalty'}`}>
            {priceAdj > 0 ? '✨ Matches your taste' : '↓ Outside preference'}
          </span>
        </div>
      )}

      <div className="card-image-wrapper">
        <img src={restaurant.imageUrl} alt={restaurant.name} className="card-image" loading="lazy" />
        <div className="card-overlay" />
        <div className="card-price-badge">
          <span className="price">{restaurant.priceRange}</span>
        </div>
        {restaurant.hasExpertEndorsement && (
          <div className="expert-endorsement-badge">
            👑 Local Guide Endorsed
          </div>
        )}
      </div>
      <div className="card-body">
        <div className="card-header-row">
          <div>
            <h3 className="card-name">{restaurant.name}</h3>
            <p className="card-cuisine">{restaurant.cuisine}</p>
          </div>
          <div className="card-rating">
            <StarRating rating={restaurant.rating} />
            <span className="rating-num">{restaurant.rating}</span>
          </div>
        </div>
        <p className="card-description">{restaurant.description}</p>
        
        {/* Match Details Score Breakdown (chat/explore mode) */}
        {showMatchDetails && restaurant.matchDetails && (
          <div className="match-details-dropdown glass-card animate-slide-down" onClick={(e) => e.stopPropagation()}>
            <h4 className="match-details-title">🔍 Prompt Match Details</h4>
            <ul className="match-details-list">
              {restaurant.matchDetails.proximityScore !== undefined && (
                <li>
                  <span className="match-detail-label">📍 Proximity:</span>
                  <span className="match-detail-desc">{restaurant.matchDetails.proximityLabel}</span>
                  <span className="match-detail-score">{restaurant.matchDetails.proximityScore}/{restaurant.matchDetails.proximityMax}</span>
                </li>
              )}
              {restaurant.matchDetails.cuisineScore !== undefined && (
                <li>
                  <span className="match-detail-label">🍳 Cuisine:</span>
                  <span className="match-detail-desc">{restaurant.matchDetails.cuisineLabel}</span>
                  <span className="match-detail-score">{restaurant.matchDetails.cuisineScore}/{restaurant.matchDetails.cuisineMax}</span>
                </li>
              )}
              {restaurant.matchDetails.ratingScore !== undefined && (
                <li>
                  <span className="match-detail-label">⭐ Rating:</span>
                  <span className="match-detail-desc">{restaurant.matchDetails.ratingLabel}</span>
                  <span className="match-detail-score">{restaurant.matchDetails.ratingScore}/{restaurant.matchDetails.ratingMax}</span>
                </li>
              )}
              {restaurant.matchDetails.preferenceScore !== undefined && (
                <li>
                  <span className="match-detail-label">💡 Preferences:</span>
                  <span className="match-detail-desc">{restaurant.matchDetails.preferenceLabel}</span>
                  <span className="match-detail-score">{restaurant.matchDetails.preferenceScore}/{restaurant.matchDetails.preferenceMax}</span>
                </li>
              )}
              {restaurant.matchDetails.tasteLabel !== undefined && restaurant.matchDetails.tasteScore !== undefined && restaurant.matchDetails.tasteScore !== 0 && (
                <li>
                  <span className="match-detail-label">✨ Taste Profile:</span>
                  <span className="match-detail-desc">{restaurant.matchDetails.tasteLabel}</span>
                  <span className={`match-detail-score ${restaurant.matchDetails.tasteScore > 0 ? 'score-positive' : 'score-negative'}`}>
                    {restaurant.matchDetails.tasteScore > 0 ? '+' : ''}{restaurant.matchDetails.tasteScore}
                  </span>
                </li>
              )}
            </ul>
            <div className="match-details-total">
              <span>Total Match Score:</span>
              <strong>{restaurant.matchPercentage}%</strong>
            </div>
          </div>
        )}

        {/* Personalised Ranking Breakdown */}
        {showMatchDetails && restaurant.rankingBreakdown && !restaurant.matchDetails && (
          <div className="match-details-dropdown glass-card animate-slide-down" onClick={(e) => e.stopPropagation()}>
            <h4 className="match-details-title">📊 Ranking Score Breakdown</h4>
            <ul className="match-details-list">
              <li>
                <span className="match-detail-label">⭐ Rating:</span>
                <span className="match-detail-score">{restaurant.rankingBreakdown.ratingScore.toFixed(1)}/50</span>
              </li>
              <li>
                <span className="match-detail-label">🔍 Exposure:</span>
                <span className="match-detail-score">{restaurant.rankingBreakdown.exposureScore.toFixed(1)}/20</span>
              </li>
              <li>
                <span className="match-detail-label">📍 Distance:</span>
                <span className="match-detail-score">{restaurant.rankingBreakdown.distanceScore.toFixed(1)}/30</span>
              </li>
              <li>
                <span className="match-detail-label">💡 Price Pref:</span>
                <span className={`match-detail-score ${restaurant.rankingBreakdown.priceAdjustment > 0 ? 'score-positive' : restaurant.rankingBreakdown.priceAdjustment < 0 ? 'score-negative' : ''}`}>
                  {restaurant.rankingBreakdown.priceAdjustment > 0 ? '+' : ''}{restaurant.rankingBreakdown.priceAdjustment}
                </span>
              </li>
            </ul>
            <div className="match-details-total">
              <span>Total Score:</span>
              <strong>{restaurant.personalizedScore?.toFixed(1)}</strong>
            </div>
          </div>
        )}

        <div className="card-tags" style={{ position: 'relative' }}>
          {restaurant.isHalal && <span className="tag halal">✓ Halal</span>}
          {restaurant.tags.slice(0, 3).map((tag) => {
            const hasVotes = voteCounts[tag];
            const upCount = hasVotes ? hasVotes.upvotes : 0;
            const downCount = hasVotes ? hasVotes.downvotes : 0;
            const totalCount = hasVotes ? hasVotes.total : 0;
            const isVoting = activeTagVote === tag;

            return (
              <div key={tag} className="tag-vote-wrapper" style={{ display: 'inline-block' }}>
                {isVoting ? (
                  <span className="tag active-voting" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span>Is {tag} ok?</span>
                    <button 
                      type="button"
                      disabled={loadingVotes} 
                      onClick={(e) => { e.stopPropagation(); handleVote(tag, true); }}
                      className="vote-btn-inline up"
                    >
                      👍 {upCount}
                    </button>
                    <button 
                      type="button"
                      disabled={loadingVotes} 
                      onClick={(e) => { e.stopPropagation(); handleVote(tag, false); }}
                      className="vote-btn-inline down"
                    >
                      👎 {downCount}
                    </button>
                    <button 
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActiveTagVote(null); }}
                      className="vote-btn-inline cancel"
                    >
                      ×
                    </button>
                  </span>
                ) : (
                  <span 
                    className="tag" 
                    onClick={(e) => handleTagClick(e, tag)}
                    style={{ cursor: isSignedIn ? 'pointer' : 'default' }}
                    title={isSignedIn ? "Click to vote on consensus" : undefined}
                  >
                    {tag} {totalCount > 0 && `(${upCount}/${downCount})`}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Review Preview Drawer */}
        {reviewCount > 0 && (
          <button
            id={`reviews-toggle-${restaurant.id}`}
            type="button"
            className="reviews-toggle-btn"
            onClick={handleReviewsClick}
          >
            💬 {reviewCount} review{reviewCount !== 1 ? 's' : ''} {showReviews ? '▲' : '▼'}
          </button>
        )}
        {showReviews && restaurant.reviews && (
          <ReviewDrawer reviews={restaurant.reviews} />
        )}

        <div className="card-footer">
          <span className="card-hours">🕐 {restaurant.openHours}</span>
          {restaurant.distance !== undefined && (
            <span className="card-distance">📍 {restaurant.distance.toFixed(1)} km</span>
          )}
          {/* Ranking score (demo mode) */}
          {restaurant.personalizedScore !== undefined && (
            <button
              type="button"
              className="score-pill"
              onClick={handleWhyClick}
              title="Click to see ranking breakdown"
            >
              📊 {restaurant.personalizedScore.toFixed(0)} pts
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export type { Restaurant };
