import { useState, useEffect } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { uploadPhoto } from '../utils/supabaseClient';
import { API_URL } from '../utils/api';
import { useChatContext } from '../context/chatContextStore';
import './AdminPage.css';

interface Restaurant {
  id: string;
  name: string;
  cuisine: string;
  description: string;
  category: string;
  address: string;
  lat: number;
  lng: number;
  priceRange: string;
  tags: string[];
  rating: number;
  imageUrl: string;
  openHours: string;
  isHalal: boolean;
  matchPercentage?: number;
  matchDetails?: any;
}

interface Review {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
  user?: { name: string; level?: number };
  restaurant?: { name: string };
}

export default function AdminPage() {
  const { isSignedIn, user, isLoaded } = useUser();
  const { getToken } = useAuth();
  const { emulateAdmin, setEmulateAdmin } = useChatContext();

  const [tab, setTab] = useState<'eateries' | 'reviews' | 'fraud' | 'conflicts'>('eateries');

  // Lists
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);

  // Fraud and Conflicts States
  interface FlaggedUser {
    id: string;
    name: string;
    email: string;
    xp: number;
    level: number;
    reasons: string[];
    recentReviews: any[];
  }

  interface TagConflict {
    restaurantId: string;
    restaurantName: string;
    restaurantTags: string[];
    tag: string;
    upvotes: number;
    downvotes: number;
    total: number;
  }

  const [flaggedUsers, setFlaggedUsers] = useState<FlaggedUser[]>([]);
  const [tagConflicts, setTagConflicts] = useState<TagConflict[]>([]);
  const [loadingFraud, setLoadingFraud] = useState(false);
  const [loadingConflicts, setLoadingConflicts] = useState(false);

  // Form States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cuisine, setCuisine] = useState('');
  const [category, setCategory] = useState('Main');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('2.1896');
  const [lng, setLng] = useState('102.2501');
  const [priceRange, setPriceRange] = useState('$$');
  const [tags, setTags] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [openHours, setOpenHours] = useState('10:00 AM - 10:00 PM');
  const [isHalal, setIsHalal] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // User Role Check (ADMIN bypass or Clerk role check)
  const userRole = emulateAdmin ? 'ADMIN' : (user?.publicMetadata?.role as string) || (user?.id === 'demo_clerk_id' ? 'ADMIN' : 'USER');
  const isAdmin = userRole === 'ADMIN';

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setImageUrl(''); // Clear text URL if they upload a file
    }
  };

  const handleRemovePreview = () => {
    setImageFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const fetchFlaggedUsers = async () => {
    setLoadingFraud(true);
    try {
      const headers = await getAuthHeaders();
      const { data } = await axios.get(`${API_URL}/api/admin/fraud-detection`, { headers });
      setFlaggedUsers(data);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Failed to fetch flagged users.' });
    } finally {
      setLoadingFraud(false);
    }
  };

  const fetchTagConflicts = async () => {
    setLoadingConflicts(true);
    try {
      const headers = await getAuthHeaders();
      const { data } = await axios.get(`${API_URL}/api/admin/tag-conflicts`, { headers });
      setTagConflicts(data);
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Failed to fetch tag conflicts.' });
    } finally {
      setLoadingConflicts(false);
    }
  };

  const handleFreezeUser = async (userId: string) => {
    if (!window.confirm("Are you sure you want to reset this user's XP and level? This action is permanent.")) return;
    try {
      const headers = await getAuthHeaders();
      await axios.post(`${API_URL}/api/admin/users/${userId}/freeze`, {}, { headers });
      setFeedback({ type: 'success', text: 'User XP reset to 0.' });
      fetchFlaggedUsers();
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Failed to reset user XP.' });
    }
  };

  const handleResolveTag = async (restaurantId: string, tag: string, action: 'keep' | 'delete') => {
    if (!window.confirm(`Are you sure you want to resolve tag "${tag}" by action: "${action}"?`)) return;
    try {
      const headers = await getAuthHeaders();
      await axios.post(`${API_URL}/api/admin/resolve-tag`, { restaurantId, tag, action }, { headers });
      setFeedback({ type: 'success', text: `Tag "${tag}" resolved successfully.` });
      fetchTagConflicts();
    } catch (err) {
      console.error(err);
      setFeedback({ type: 'error', text: 'Failed to resolve tag.' });
    }
  };

  useEffect(() => {
    if (isSignedIn && isAdmin) {
      if (tab === 'eateries') fetchRestaurants();
      if (tab === 'reviews') fetchReviews();
      if (tab === 'fraud') fetchFlaggedUsers();
      if (tab === 'conflicts') fetchTagConflicts();
    }
  }, [isSignedIn, isAdmin, tab]);

  const fetchRestaurants = async () => {
    try {
      const { data } = await axios.get(`${API_URL}/api/restaurants`);
      setRestaurants(data);
    } catch (err) {
      console.error('Failed to fetch restaurants:', err);
    }
  };

  const fetchReviews = async () => {
    try {
      const headers = await getAuthHeaders();
      const { data } = await axios.get(`${API_URL}/api/reviews`, { headers });
      setReviews(data);
    } catch (err) {
      console.error('Failed to fetch reviews:', err);
    }
  };

  const getAuthHeaders = async () => {
    const headers: Record<string, string> = {};
    if (emulateAdmin) {
      headers['x-mock-clerk-id'] = user?.id || 'demo_clerk_id';
      headers['x-mock-role'] = 'ADMIN';
      try {
        if (isSignedIn && user) {
          const token = await getToken();
          if (token) {
            headers['Authorization'] = `Bearer ${token}`;
          }
        }
      } catch (err) {
        console.warn('Failed to retrieve Clerk JWT token, falling back to mock headers:', err);
      }
      return headers;
    }
    if (isSignedIn && user) {
      headers['x-mock-clerk-id'] = user.id;
      headers['x-mock-role'] = userRole;
      try {
        const token = await getToken();
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
      } catch (err) {
        console.warn('Failed to retrieve Clerk JWT token, falling back to mock headers:', err);
      }
    }
    return headers;
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setCuisine('');
    setCategory('Main');
    setAddress('');
    setLat('2.1896');
    setLng('102.2501');
    setPriceRange('$$');
    setTags('');
    setImageUrl('');
    setOpenHours('11am – 10pm');
    setIsHalal(false);
    setImageFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const handleEditClick = (r: Restaurant) => {
    setEditingId(r.id);
    setName(r.name);
    setDescription(r.description);
    setCuisine(r.cuisine);
    setCategory(r.category);
    setAddress(r.address);
    setLat(String(r.lat));
    setLng(String(r.lng));
    setPriceRange(r.priceRange);
    setTags(r.tags.join(', '));
    setImageUrl(r.imageUrl);
    setOpenHours(r.openHours);
    setIsHalal(r.isHalal);
    // Scroll form into view
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !description.trim() || !cuisine.trim()) return;

    setSubmitting(true);
    setFeedback(null);

    let finalImageUrl = imageUrl;
    if (imageFile) {
      try {
        finalImageUrl = await uploadPhoto(imageFile, 'restaurant-photos');
      } catch (uploadErr) {
        console.error('Failed to upload restaurant photo:', uploadErr);
        setFeedback({ type: 'error', text: 'Failed to upload restaurant photo. Please check your Supabase Storage settings.' });
        setSubmitting(false);
        return;
      }
    } else if (!imageUrl.trim()) {
      setFeedback({ type: 'error', text: 'Please upload a photo or provide an Image URL.' });
      setSubmitting(false);
      return;
    }

    const payload = {
      name,
      description,
      cuisine,
      category,
      address,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
      priceRange,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      imageUrl: finalImageUrl,
      openHours,
      isHalal,
    };

    try {
      const headers = await getAuthHeaders();
      if (editingId) {
        // Edit Restaurant
        await axios.put(`${API_URL}/api/restaurants/${editingId}`, payload, { headers });
        setFeedback({ type: 'success', text: `Successfully updated ${name} lah!` });
      } else {
        // Create Restaurant
        await axios.post(`${API_URL}/api/restaurants`, payload, { headers });
        setFeedback({ type: 'success', text: `Successfully added ${name} to Melaka listings!` });
      }
      resetForm();
      fetchRestaurants();
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to save restaurant listing.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId: string) => {
    if (!window.confirm('Are you sure you want to delete this review? This will recalculate the restaurant rating.')) return;
    try {
      const headers = await getAuthHeaders();
      await axios.delete(`${API_URL}/api/reviews/${reviewId}`, { headers });
      setFeedback({ type: 'success', text: 'Review deleted and ratings updated!' });
      fetchReviews();
      fetchRestaurants();
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: any) {
      console.error(err);
      setFeedback({ type: 'error', text: err.response?.data?.error || 'Failed to delete review.' });
    }
  };

  // Guard checks
  if (!isLoaded) {
    return <div className="admin-loading-screen"><span className="spinner" /> Loading Admin configurations...</div>;
  }

  if (!emulateAdmin && (!isSignedIn || !isAdmin)) {
    return (
      <div className="admin-page unauthorized">
        <div className="unauthorized-card glass-card fade-up">
          <span className="unauthorized-icon">🚫</span>
          <h2>403 - Access Forbidden</h2>
          <p>Alamak! This area is for Admin Foodies only. You do not have permission to manage restaurant listings or moderate reviews.</p>
          <div className="unauthorized-actions" style={{ display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
            <Link to="/" className="btn-primary" style={{ width: '100%', textAlign: 'center' }}>Back to Discover</Link>
            <div style={{ margin: '4px 0', fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '0.5px' }}>— DEVELOPER / EVALUATOR ONLY —</div>
            <button 
              type="button"
              className="btn-ghost" 
              style={{ borderColor: 'var(--accent)', color: 'var(--accent)', width: '100%', padding: '10px', fontWeight: 600 }}
              onClick={() => setEmulateAdmin(true)}
            >
              🧪 Enable Developer Admin Bypass
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="header-left">
          <h1 className="section-title">Admin Dashboard</h1>
          <p className="section-sub">Manage Melaka culinary spots & review feeds 🛠️</p>
        </div>
        <Link to="/profile" className="btn-ghost btn-sm">Exit Admin</Link>
      </div>

      {/* Tabs */}
      <div className="admin-tabs">
        <button className={`tab-btn ${tab === 'eateries' ? 'active' : ''}`} onClick={() => setTab('eateries')}>
          🍽️ Manage Eateries
        </button>
        <button className={`tab-btn ${tab === 'reviews' ? 'active' : ''}`} onClick={() => setTab('reviews')}>
          💬 Review Moderation
        </button>
        <button className={`tab-btn ${tab === 'fraud' ? 'active' : ''}`} onClick={() => setTab('fraud')}>
          🛡️ XP Fraud Detector
        </button>
        <button className={`tab-btn ${tab === 'conflicts' ? 'active' : ''}`} onClick={() => setTab('conflicts')}>
          ⚖️ Tag Conflict Resolver
        </button>
      </div>

      {feedback && (
        <div className={`admin-feedback fade-up ${feedback.type}`}>
          <span>{feedback.type === 'success' ? '🎉' : '⚠️'} {feedback.text}</span>
          <button className="feedback-close" onClick={() => setFeedback(null)}>×</button>
        </div>
      )}

      {/* Eateries Tab */}
      {tab === 'eateries' && (
        <div className="admin-tab-content">
          {/* Restaurant Form */}
          <form className="restaurant-form glass-card" onSubmit={handleSubmit}>
            <h3 className="form-title">{editingId ? '✏️ Edit Restaurant Listing' : '➕ Add New Melaka Eatery'}</h3>
            
            <div className="form-row-grid">
              <div className="form-group">
                <label className="form-label">Restaurant Name</label>
                <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Kedai Kopi Baba" required />
              </div>
              <div className="form-group">
                <label className="form-label">Cuisine Type</label>
                <input type="text" className="input-field" value={cuisine} onChange={e => setCuisine(e.target.value)} placeholder="e.g. Nyonya, Hawker, Cafe" required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description</label>
              <textarea className="input-field" value={description} onChange={e => setDescription(e.target.value)} placeholder="Explain why this place is awesome..." rows={3} required />
            </div>

            <div className="form-row-grid three-col">
              <div className="form-group">
                <label className="form-label">Category</label>
                <select className="input-field select-field" value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="Main">Main Meals</option>
                  <option value="Dessert">Desserts</option>
                  <option value="Cafe">Cafés</option>
                  <option value="Bar">Bars & Nightlife</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Price Range</label>
                <select className="input-field select-field" value={priceRange} onChange={e => setPriceRange(e.target.value)}>
                  <option value="$">$ (Cheap / Hawker)</option>
                  <option value="$$">$$ (Mid-range / Café)</option>
                  <option value="$$$">$$$ (Premium / Fine Dining)</option>
                </select>
              </div>
              <div className="form-group checkbox-group">
                <label className="form-label-checkbox">
                  <input type="checkbox" checked={isHalal} onChange={e => setIsHalal(e.target.checked)} />
                  <span>Halal Certified</span>
                </label>
              </div>
            </div>

            <div className="form-row-grid three-col">
              <div className="form-group">
                <label className="form-label">Latitude</label>
                <input type="number" step="any" className="input-field" value={lat} onChange={e => setLat(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Longitude</label>
                <input type="number" step="any" className="input-field" value={lng} onChange={e => setLng(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Open Hours</label>
                <input type="text" className="input-field" value={openHours} onChange={e => setOpenHours(e.target.value)} placeholder="e.g. 10am – 9pm" required />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Address</label>
              <input type="text" className="input-field" value={address} onChange={e => setAddress(e.target.value)} placeholder="Full street address in Melaka" required />
            </div>

            <div className="form-group">
              <label className="form-label">Restaurant Photo</label>
              <div className="photo-uploader glass-card">
                <input
                  id="restaurant-photo-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <label htmlFor="restaurant-photo-input" className="uploader-label">
                  <span className="uploader-icon">📷</span>
                  <span className="uploader-text">
                    {imageFile ? imageFile.name : 'Upload eatery image'}
                  </span>
                </label>
                {(previewUrl || imageUrl) && (
                  <div className="preview-container">
                    <img src={previewUrl || imageUrl} alt="Restaurant Preview" className="photo-preview" />
                    {previewUrl && (
                      <button type="button" className="remove-preview-btn" onClick={handleRemovePreview}>
                        ✕
                      </button>
                    )}
                  </div>
                )}
              </div>
              
              <div style={{ margin: '8px 0', textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)' }}>— OR —</div>
              
              <label className="form-label">Paste Direct Image URL</label>
              <input 
                type="url" 
                className="input-field" 
                value={imageUrl} 
                onChange={e => {
                  setImageUrl(e.target.value);
                  if (previewUrl) {
                    URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }
                  setImageFile(null);
                }} 
                placeholder="Unsplash or direct image link" 
                required={!imageFile} 
              />
            </div>

            <div className="form-group">
              <label className="form-label">Tags (comma separated)</label>
              <input type="text" className="input-field" value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. Spicy, Local, Aircon, Family" />
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary submit-btn" disabled={submitting}>
                {submitting ? 'Saving...' : editingId ? 'Update Listing' : 'Add Eatery'}
              </button>
              {editingId && (
                <button type="button" className="btn-ghost" onClick={resetForm}>Cancel</button>
              )}
            </div>
          </form>

          {/* Listings Table */}
          <div className="eateries-list-section">
            <h3 className="sub-heading">Existing Listings ({restaurants.length})</h3>
            <div className="admin-table-wrapper glass-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Cuisine</th>
                    <th>Price</th>
                    <th>Halal</th>
                    <th>Rating</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {restaurants.map((r) => (
                    <tr key={r.id}>
                      <td className="font-semibold">{r.name}</td>
                      <td>{r.category}</td>
                      <td>{r.cuisine}</td>
                      <td>{r.priceRange}</td>
                      <td>{r.isHalal ? '✓ Yes' : '✕ No'}</td>
                      <td>★ {r.rating}</td>
                      <td>
                        <button className="btn-edit" onClick={() => handleEditClick(r)}>Edit</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Reviews Tab */}
      {tab === 'reviews' && (
        <div className="admin-tab-content">
          <h3 className="sub-heading">All Reviews ({reviews.length})</h3>
          {reviews.length === 0 ? (
            <div className="empty-state glass-card">No reviews have been submitted yet.</div>
          ) : (
            <div className="admin-table-wrapper glass-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Restaurant</th>
                    <th>User</th>
                    <th>Rating</th>
                    <th>Comment</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((rev) => (
                    <tr key={rev.id}>
                      <td className="font-semibold">{rev.restaurant?.name || 'Unknown'}</td>
                      <td>
                        {rev.user?.name || 'Foodie'}
                        {rev.user?.level && (
                          <span className="user-level-badge">Lv.{rev.user.level}</span>
                        )}
                      </td>
                      <td className="review-stars">{'★'.repeat(rev.rating)}</td>
                      <td className="review-comment-cell">"{rev.comment}"</td>
                      <td className="nowrap">{new Date(rev.createdAt).toLocaleDateString()}</td>
                      <td>
                        <button className="btn-delete" onClick={() => handleDeleteReview(rev.id)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Fraud Detection Tab */}
      {tab === 'fraud' && (
        <div className="admin-tab-content">
          <h3 className="sub-heading">🛡️ Security & XP Fraud Detection</h3>
          <p className="description-text" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            System scans for suspicious review patterns (XP/Points farming) and flags anomalies. Limit is 3 reviews per hour or velocity &lt; 60 seconds.
          </p>
          {loadingFraud ? (
            <div className="empty-state glass-card">Scanning database logs for review velocity anomalies...</div>
          ) : flaggedUsers.length === 0 ? (
            <div className="empty-state glass-card" style={{ borderColor: 'rgba(34, 197, 94, 0.4)', color: 'var(--success)' }}>
              ✅ No review velocity or duplicate content anomalies detected. All user logs are clean.
            </div>
          ) : (
            <div className="admin-table-wrapper glass-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Email</th>
                    <th>Stats</th>
                    <th>Flag Anomaly Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {flaggedUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="font-semibold">{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className="user-level-badge">Lv.{u.level}</span>
                        <span style={{ fontSize: '12px', marginLeft: '6px', color: 'var(--text-muted)' }}>{u.xp} XP</span>
                      </td>
                      <td style={{ color: 'var(--error)', fontSize: '13px' }}>
                        <ul style={{ margin: 0, paddingLeft: '16px' }}>
                          {u.reasons.map((r, ri) => (
                            <li key={ri}>{r}</li>
                          ))}
                        </ul>
                      </td>
                      <td>
                        <button className="btn-delete" onClick={() => handleFreezeUser(u.id)}>
                          Reset XP Anomaly
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tag Conflict Resolver Tab */}
      {tab === 'conflicts' && (
        <div className="admin-tab-content">
          <h3 className="sub-heading">⚖️ Tag Consensus Conflict Resolver</h3>
          <p className="description-text" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '14px' }}>
            Eatery tags that have received downvotes from the community (consensus disagreement ratio &gt;= 40%). Moderation actions resolve conflicts.
          </p>
          {loadingConflicts ? (
            <div className="empty-state glass-card">Loading user consensus voting logs...</div>
          ) : tagConflicts.length === 0 ? (
            <div className="empty-state glass-card" style={{ borderColor: 'rgba(34, 197, 94, 0.4)', color: 'var(--success)' }}>
              ✅ No tag consensus conflicts currently reported. Community tags are in agreement.
            </div>
          ) : (
            <div className="admin-table-wrapper glass-card">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Restaurant</th>
                    <th>Conflicting Tag</th>
                    <th>Consensus Up/Down Votes</th>
                    <th>Active Restaurant Tags</th>
                    <th>Conflict Moderation Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tagConflicts.map((c) => (
                    <tr key={`${c.restaurantId}-${c.tag}`}>
                      <td className="font-semibold">{c.restaurantName}</td>
                      <td>
                        <span className="tag" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>{c.tag}</span>
                      </td>
                      <td>
                        <span style={{ color: 'var(--success)', fontWeight: 600 }}>👍 {c.upvotes}</span>
                        <span style={{ margin: '0 8px' }}>/</span>
                        <span style={{ color: 'var(--error)', fontWeight: 600 }}>👎 {c.downvotes}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '8px' }}>({Math.round((c.downvotes / c.total) * 100)}% downvotes)</span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {c.restaurantTags.map(t => (
                            <span key={t} className="tag" style={{ fontSize: '10px', padding: '2px 6px' }}>{t}</span>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button className="btn-edit" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleResolveTag(c.restaurantId, c.tag, 'keep')}>
                            Approve Tag
                          </button>
                          <button className="btn-delete" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={() => handleResolveTag(c.restaurantId, c.tag, 'delete')}>
                            Delete Tag
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
