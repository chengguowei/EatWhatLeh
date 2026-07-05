import { useState, useEffect } from 'react';
import { useUser, SignInButton, useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import { useChatContext } from '../context/chatContextStore';
import { getAuthHeaders } from '../utils/authHelper';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import axios from 'axios';
import { API_URL } from '../utils/api';
import './ProfilePage.css';

const LEVEL_NAMES: Record<number, string> = {
  1: 'Apprentice Foodie',
  2: 'Hawker Hunter',
  3: 'Sambal Explorer',
  4: 'Gourmet Critic',
  5: 'Legendary Glutton',
};

const XP_PER_LEVEL = [0, 0, 100, 250, 500, 1000];

// Each badge gets its own distinct emoji and accent colour
const BADGE_CONFIG: Record<string, { emoji: string; color: string }> = {
  'First Bite':        { emoji: '🍽️', color: '#f97316' },
  'Jonker Explorer':   { emoji: '🗺️', color: '#06b6d4' },
  'Sambal Explorer':   { emoji: '🌶️', color: '#ef4444' },
  'Hawker Hunter':     { emoji: '🦅', color: '#eab308' },
  'Nyonya Master':     { emoji: '👩‍🍳', color: '#a855f7' },
  'Gourmet Critic':    { emoji: '🎩', color: '#3b82f6' },
  'Legendary Glutton': { emoji: '👑', color: '#f59e0b' },
};

function xpProgress(xp: number, level: number) {
  const start = XP_PER_LEVEL[level] ?? 0;
  const end = XP_PER_LEVEL[level + 1] ?? start + 500;
  return Math.min(((xp - start) / (end - start)) * 100, 100);
}

interface LeaderboardUser { id: string; name: string; xp: number; level: number; badges: string[]; }
interface Review {
  id: string;
  restaurantId: string;
  rating: number;
  comment: string;
  imageUrl?: string;
  createdAt: string;
  restaurant?: { name: string; category: string; };
}
interface UserProfile {
  xp: number;
  points: number;
  level: number;
  badges: string[];
  reviews: Review[];
  createdAt: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  Main:    '#f97316',
  Dessert: '#a855f7',
  Cafe:    '#06b6d4',
  Bar:     '#e11d48',
};

const REVIEWS_PREVIEW_COUNT = 5;

export default function ProfilePage() {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();
  const { triggerSignOut, emulateAdmin, setEmulateAdmin } = useChatContext();
  const [tab, setTab] = useState<'profile' | 'leaderboard'>('profile');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);
  const [showAllReviews, setShowAllReviews] = useState(false);

  useEffect(() => {
    if (tab === 'leaderboard' || !profile) {
      fetchLeaderboard();
    }
    if (isSignedIn && !profile) {
      fetchProfile();
    }
  }, [tab, isSignedIn]);

  async function fetchProfile() {
    if (!isSignedIn || !user) return;
    try {
      const headers = await getAuthHeaders(user, getToken);
      const { data } = await axios.get(`${API_URL}/api/users/profile/${user.id}`, { headers });
      setProfile(data);
    } catch {
      // User might not exist yet in DB; that's okay
    }
  }

  async function fetchLeaderboard() {
    try {
      const { data } = await axios.get(`${API_URL}/api/users/leaderboard`);
      setLeaderboard(data);
    } catch (err) {
      console.error(err);
    }
  }

  // 1. XP timeline dataset
  const signupDate = profile
    ? new Date(profile.createdAt).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' })
    : '';
  const lineData = [{ name: 'Start', xp: 0, date: signupDate }];
  let cumulativeXp = 0;
  if (profile?.reviews) {
    profile.reviews.forEach((rev, idx) => {
      cumulativeXp += 15;
      lineData.push({
        name: `Review ${idx + 1}`,
        xp: cumulativeXp,
        date: new Date(rev.createdAt).toLocaleDateString('en-MY', { month: 'short', day: 'numeric' }),
      });
    });
  }

  // 2. Category Pie dataset
  const categoryCounts = { Main: 0, Dessert: 0, Cafe: 0, Bar: 0 };
  if (profile?.reviews) {
    profile.reviews.forEach((rev) => {
      const cat = rev.restaurant?.category;
      if (cat && cat in categoryCounts) {
        categoryCounts[cat as keyof typeof categoryCounts]++;
      }
    });
  }
  const pieData = Object.entries(categoryCounts)
    .filter(([, count]) => count > 0)
    .map(([name, value]) => ({ name, value }));

  // 3. Avg rating from reviews
  const avgRating =
    profile?.reviews && profile.reviews.length > 0
      ? profile.reviews.reduce((sum, r) => sum + r.rating, 0) / profile.reviews.length
      : null;

  // 4. Member since formatted
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })
    : '—';

  // 5. Reviews list with expand/collapse
  const allReviewsDesc = profile?.reviews ? [...profile.reviews].reverse() : [];
  const displayedReviews = showAllReviews
    ? allReviewsDesc
    : allReviewsDesc.slice(0, REVIEWS_PREVIEW_COUNT);
  const hasMoreReviews = allReviewsDesc.length > REVIEWS_PREVIEW_COUNT;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1 className="section-title">My Foodie Journey</h1>
      </div>

      {/* Tab switcher */}
      <div className="profile-tabs">
        <button
          id="tab-profile"
          className={`tab-btn ${tab === 'profile' ? 'active' : ''}`}
          onClick={() => setTab('profile')}
        >
          👤 Profile
        </button>
        <button
          id="tab-leaderboard"
          className={`tab-btn ${tab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setTab('leaderboard')}
        >
          🏆 Leaderboard
        </button>
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="profile-content">
          {!isSignedIn ? (
            <div className="sign-in-prompt-box glass-card">
              <div className="prompt-icon">🍽️</div>
              <h2>Join the Foodie Community</h2>
              <p>Sign in to track your XP, earn badges, and compete on the leaderboard!</p>
              <SignInButton mode="modal">
                <button className="btn-primary" id="profile-signin-btn">Get Started</button>
              </SignInButton>
            </div>
          ) : (
            <>
              {/* User Card */}
              <div className="user-card glass-card">
                <div className="user-card-top" style={{ justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <img src={user.imageUrl} alt={user.fullName ?? ''} className="user-avatar" />
                    <div className="user-info">
                      <h2 className="user-name">{user.fullName}</h2>
                      <p className="user-email">{user.primaryEmailAddress?.emailAddress}</p>
                      <p className="user-since">Member since {memberSince}</p>
                      <span className="level-badge" style={{ marginTop: '6px', display: 'inline-block' }}>
                        Lv.{profile?.level ?? 1} {LEVEL_NAMES[profile?.level ?? 1]}
                      </span>
                      {(((user?.publicMetadata?.role as string) || 'USER') === 'ADMIN' || emulateAdmin) && (
                        <div style={{ marginTop: '10px' }}>
                          <Link to="/admin" className="admin-link-btn">
                            🛠️ Admin Dashboard
                          </Link>
                        </div>
                      )}
                      <div className="dev-bypass-control" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text-muted)' }}>🧪 Dev Admin Bypass:</span>
                        <button
                          type="button"
                          className="profile-chip"
                          style={{
                            padding: '4px 8px',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 600,
                            border: '1px solid var(--border)',
                            background: emulateAdmin ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                            color: emulateAdmin ? '#22c55e' : 'var(--text-muted)',
                            cursor: 'pointer'
                          }}
                          onClick={() => setEmulateAdmin(!emulateAdmin)}
                        >
                          {emulateAdmin ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                    </div>
                  </div>
                  <button 
                    className="btn-primary profile-signout-btn" 
                    onClick={triggerSignOut}
                  >
                    🚪 Sign Out
                  </button>
                </div>
                <div className="xp-section">
                  <div className="xp-label-row">
                    <span>XP Progress</span>
                    <span className="xp-count">{profile?.xp ?? 0} XP</span>
                  </div>
                  <div className="xp-bar-outer">
                    <div
                      className="xp-bar-inner"
                      style={{ width: `${xpProgress(profile?.xp ?? 0, profile?.level ?? 1)}%` }}
                    />
                  </div>
                  <p className="xp-hint">
                    Next: {LEVEL_NAMES[(profile?.level ?? 1) + 1] ?? '🎉 Max Level Reached!'}
                  </p>
                </div>
              </div>

              {/* Stats Row — 5 stats in 2 rows */}
              <div className="stats-grid">
                <div className="stat-box glass-card">
                  <span className="stat-value">{profile?.xp ?? 0}</span>
                  <span className="stat-label">Total XP</span>
                </div>
                <div className="stat-box glass-card">
                  <span className="stat-value">{profile?.reviews?.length ?? 0}</span>
                  <span className="stat-label">Reviews</span>
                </div>
                <div className="stat-box glass-card">
                  <span className="stat-value">{profile?.badges?.length ?? 1}</span>
                  <span className="stat-label">Badges</span>
                </div>
                <div className="stat-box glass-card">
                  <span className="stat-value">
                    {avgRating !== null ? avgRating.toFixed(1) : '—'}
                  </span>
                  <span className="stat-label">Avg Rating</span>
                </div>
                <div className="stat-box glass-card stat-box-wide">
                  <span className="stat-value stat-value-sm">{memberSince}</span>
                  <span className="stat-label">Member Since</span>
                </div>
              </div>

              {/* Badges — each with its own distinct icon & colour */}
              {profile?.badges && profile.badges.length > 0 && (
                <div className="badges-section">
                  <h3 className="sub-section-title">🎖️ Your Badges</h3>
                  <div className="badges-grid">
                    {profile.badges.map((b) => {
                      const config = BADGE_CONFIG[b] ?? { emoji: '🏅', color: '#f97316' };
                      return (
                        <div
                          key={b}
                          className="badge-chip glass-card"
                          style={{ borderColor: `${config.color}40` }}
                        >
                          <span className="badge-emoji">{config.emoji}</span>
                          <div className="badge-info">
                            <span className="badge-name">{b}</span>
                          </div>
                          <div
                            className="badge-glow"
                            style={{ background: config.color }}
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Analytics & Progress */}
              <div className="analytics-section">
                <h3 className="sub-section-title">📊 Analytics & Progress</h3>
                {profile?.reviews && profile.reviews.length > 0 ? (
                  <div className="charts-grid">
                    <div className="chart-card glass-card">
                      <h4 className="chart-title">XP Progression</h4>
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={200}>
                          <AreaChart data={lineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorXp" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%"  stopColor="#f97316" stopOpacity={0.4} />
                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                            <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                            <Tooltip
                              contentStyle={{
                                background: 'var(--bg-card)',
                                borderColor: 'var(--border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-sans)',
                                fontSize: 11,
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="xp"
                              stroke="#f97316"
                              strokeWidth={2}
                              fillOpacity={1}
                              fill="url(#colorXp)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="chart-card glass-card">
                      <h4 className="chart-title">Eatery Distribution</h4>
                      <div className="chart-container">
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={pieData}
                              cx="50%"
                              cy="45%"
                              innerRadius={50}
                              outerRadius={70}
                              paddingAngle={4}
                              dataKey="value"
                            >
                              {pieData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={CATEGORY_COLORS[entry.name] || '#666'}
                                />
                              ))}
                            </Pie>
                            <Tooltip
                              contentStyle={{
                                background: 'var(--bg-card)',
                                borderColor: 'var(--border)',
                                borderRadius: 'var(--radius-md)',
                                color: 'var(--text-primary)',
                                fontFamily: 'var(--font-sans)',
                                fontSize: 11,
                              }}
                            />
                            <Legend
                              verticalAlign="bottom"
                              height={36}
                              iconSize={8}
                              iconType="circle"
                              wrapperStyle={{ fontSize: 10, color: 'var(--text-muted)' }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="no-stats-placeholder glass-card">
                    <span className="placeholder-icon">📈</span>
                    <p>No analytics yet. Submit your first review to unlock your foodie tracking charts!</p>
                  </div>
                )}
              </div>

              {/* Recent Reviews with See All toggle */}
              {allReviewsDesc.length > 0 && (
                <div className="recent-reviews-section">
                  <div className="reviews-section-header">
                    <h3 className="sub-section-title">✍️ My Reviews</h3>
                    <span className="reviews-count-badge">{allReviewsDesc.length}</span>
                  </div>
                  <div className="recent-reviews-list">
                    {displayedReviews.map((rev) => (
                      <div key={rev.id} className="recent-review-item glass-card">
                        <div className="review-item-header">
                          <h4 className="review-restaurant-name">
                            {rev.restaurant?.name || 'Unknown Restaurant'}
                          </h4>
                          <span className="review-item-rating">{'★'.repeat(rev.rating)}</span>
                        </div>
                        <div className="review-tags-row">
                          {rev.restaurant?.category && (
                            <span className="review-category-tag">{rev.restaurant.category}</span>
                          )}
                          {profile?.level && profile.level >= 4 && (
                            <span className="review-weight-indicator">
                              ⚖️ Critic Review (Level {profile.level} weight)
                            </span>
                          )}
                        </div>
                        <p className="review-item-comment">"{rev.comment}"</p>
                        {rev.imageUrl && (
                          <div className="review-image-wrapper">
                            <img src={rev.imageUrl} alt="Review attachment" className="review-attached-img" />
                          </div>
                        )}
                        <span className="review-item-date">
                          {new Date(rev.createdAt).toLocaleDateString('en-MY', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* See All / Show Less toggle */}
                  {hasMoreReviews && (
                    <button
                      className="see-all-btn"
                      onClick={() => setShowAllReviews((v) => !v)}
                    >
                      {showAllReviews
                        ? '↑ Show less'
                        : `Show all ${allReviewsDesc.length} reviews ↓`}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {tab === 'leaderboard' && (
        <div className="leaderboard-content">
          {leaderboard.length === 0 ? (
            <div className="empty-lb">No leaderboard data yet. Be the first!</div>
          ) : (
            <div className="lb-list">
              {leaderboard.map((u, i) => (
                <div
                  key={u.id}
                  className={`lb-row glass-card ${i < 3 ? `rank-${i + 1}` : ''} ${isSignedIn && user?.id === u.id ? 'lb-self' : ''}`}
                >
                  <div className="lb-rank">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                  </div>
                  <div className="lb-info">
                    <p className="lb-name">
                      {u.name}{' '}
                      {isSignedIn && user?.id === u.id && <span className="you-tag">You</span>}
                    </p>
                    <p className="lb-level">
                      Lv.{u.level} · {LEVEL_NAMES[u.level]}
                    </p>
                    {/* Top badge shown on leaderboard row */}
                    {u.badges.length > 0 && (() => {
                      const topBadge = u.badges[u.badges.length - 1];
                      const cfg = BADGE_CONFIG[topBadge] ?? { emoji: '🏅', color: '#f97316' };
                      return (
                        <span className="lb-top-badge" style={{ color: cfg.color }}>
                          {cfg.emoji} {topBadge}
                        </span>
                      );
                    })()}
                  </div>
                  <div className="lb-xp">
                    <span>{u.xp}</span>
                    <span className="lb-xp-label">XP</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
