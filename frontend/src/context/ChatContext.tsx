import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import axios from 'axios';
import { useUser, useClerk } from '@clerk/clerk-react';
import type { Restaurant } from '../components/RestaurantCard';
import { API_URL } from '../utils/api';
import { ChatContext, type DemoProfile, type Message } from './chatContextStore.ts';

// ─── Loading phase sets ───────────────────────────────────────────────────────

const SINGLE_PHASES = [
  { icon: '🔍', text: 'Scanning Melaka for hidden gems lah...' },
  { icon: '🧠', text: 'AI is thinking very hard ah...' },
  { icon: '📍', text: 'Checking what is nearby your location...' },
  { icon: '🍜', text: 'Sniffing out the best flavours in town...' },
  { icon: '⭐', text: 'Ranking the top picks for you wah!' },
  { icon: '🎯', text: 'Almost got it, banger food incoming!' },
];

const ITINERARY_PHASES = [
  { icon: '🗺️', text: 'Mapping out your Melaka adventure lah...' },
  { icon: '🍽️', text: 'Hunting for the perfect first stop ah...' },
  { icon: '📍', text: 'Plotting your food route across Melaka...' },
  { icon: '🚶', text: 'Calculating walkable distances wah...' },
  { icon: '✨', text: 'Crafting your dining itinerary...' },
  { icon: '🎯', text: 'Your food journey is almost ready!' },
];

// ─── Itinerary keyword detector ───────────────────────────────────────────────

const ITINERARY_KEYWORDS = [
  'then', 'after', 'followed by', 'and then', 'next', 'itinerary',
  'plan', 'route', 'stops', 'hop', 'crawl', 'tour', 'journey',
  'dinner then', 'lunch then', 'breakfast then', 'first.*then',
  'start.*end', 'begin.*finish',
];

function predictItinerary(text: string): boolean {
  const lower = text.toLowerCase();
  return ITINERARY_KEYWORDS.some((kw) => {
    // Support simple regex patterns in the keywords list
    if (kw.includes('.*')) {
      return new RegExp(kw).test(lower);
    }
    return lower.includes(kw);
  });
}

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_MESSAGE: Message = {
  id: '0',
  role: 'bot',
  text: `Wah, selamat datang to EatWhatLeh lah! 🍽️ I'm your personal Melaka food guide. Ask me anything — from spicy hawker stalls to romantic dinner spots. What are you craving today?`,
};

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
  const [lastRestaurants, setLastRestaurants] = useState<Restaurant[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPhase, setLoadingPhase] = useState(0);
  const [phaseVisible, setPhaseVisible] = useState(true);
  const [predictedIsItinerary, setPredictedIsItinerary] = useState(false);
  const loadingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null!);
  const { user } = useUser();
  const clerk = useClerk();
  const [demoProfile, setDemoProfile] = useState<DemoProfile>({ label: '👤 Default', clerkId: '' });
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('eatwhatleh_last_coords');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return null;
        }
      }
    }
    return null;
  });
  const [isLocationFallback, setIsLocationFallback] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'prompt' | 'requesting' | 'granted' | 'fallback' | 'denied' | 'out-of-town'>('prompt');
  const [showLocationPopup, setShowLocationPopup] = useState(false);
  const watcherIdRef = useRef<number | null>(null);
  
  const [emulateAdmin, setEmulateAdminState] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('eatwhatleh_emulate_admin') === 'true';
    }
    return false;
  });

  const setEmulateAdmin = (val: boolean) => {
    setEmulateAdminState(val);
    if (typeof window !== 'undefined') {
      localStorage.setItem('eatwhatleh_emulate_admin', String(val));
    }
  };

  const triggerSignOut = () => setShowSignOutConfirm(true);

  // Calculate distance in km using Haversine formula
  const haversineDistance = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const applyDefaultLocation = useCallback(() => {
    if (watcherIdRef.current !== null) {
      navigator.geolocation.clearWatch(watcherIdRef.current);
      watcherIdRef.current = null;
    }
    setUserCoords({ lat: 2.1896, lng: 102.2501 });
    setIsLocationFallback(false);
    setLocationStatus('fallback');
    localStorage.setItem('eatwhatleh_location_preference', 'default');
    setShowLocationPopup(false);
  }, []);

  const performLiveLocationFetch = useCallback((silent = false) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      applyDefaultLocation();
      return;
    }
    
    // Clear any existing active watch to avoid double-registration
    if (watcherIdRef.current !== null) {
      navigator.geolocation.clearWatch(watcherIdRef.current);
      watcherIdRef.current = null;
    }

    setLocationStatus('requesting');
    
    const id = navigator.geolocation.watchPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        localStorage.setItem('eatwhatleh_location_preference', 'live');
        
        const dist = haversineDistance(lat, lng, 2.1896, 102.2501);
        console.log(`[EatWhatLeh Location Watch] Success! Latitude: ${lat}, Longitude: ${lng}. Distance from Melaka Center: ${dist.toFixed(2)} km`);

        if (dist > 80) {
          console.warn("[EatWhatLeh Location Watch] Coordinates are >80km away from Melaka. Falling back to default Melaka coordinates.");
          setUserCoords({ lat: 2.1896, lng: 102.2501 });
          setIsLocationFallback(true);
          setLocationStatus('out-of-town');
        } else {
          setUserCoords({ lat, lng });
          localStorage.setItem('eatwhatleh_last_coords', JSON.stringify({ lat, lng }));
          setIsLocationFallback(false);
          setLocationStatus('granted');
        }
        setShowLocationPopup(false);
      },
      (error) => {
        console.warn('[EatWhatLeh Location Watch] Geolocation API call failed:', error);
        
        if (error.code === error.PERMISSION_DENIED) {
          localStorage.setItem('eatwhatleh_location_preference', 'default');
          localStorage.removeItem('eatwhatleh_last_coords');
          setUserCoords({ lat: 2.1896, lng: 102.2501 });
          setIsLocationFallback(true);
          setLocationStatus('denied');
          
          if (watcherIdRef.current !== null) {
            navigator.geolocation.clearWatch(watcherIdRef.current);
            watcherIdRef.current = null;
          }
          setShowLocationPopup(false);
          return;
        }

        // Try to keep the last known cached coordinates if they exist
        const saved = localStorage.getItem('eatwhatleh_last_coords');
        if (saved) {
          try {
            const coords = JSON.parse(saved);
            setUserCoords(coords);
            setIsLocationFallback(false);
            setLocationStatus('granted');
            console.log('[EatWhatLeh Location Watch] Retained last known successful coordinates:', coords);
          } catch {
            setUserCoords({ lat: 2.1896, lng: 102.2501 });
            setIsLocationFallback(true);
            setLocationStatus('denied');
          }
        } else {
          setUserCoords({ lat: 2.1896, lng: 102.2501 });
          setIsLocationFallback(true);
          setLocationStatus('denied');
        }

        setShowLocationPopup(false);
        if (!silent) {
          localStorage.setItem('eatwhatleh_location_preference', 'default');
          if (watcherIdRef.current !== null) {
            navigator.geolocation.clearWatch(watcherIdRef.current);
            watcherIdRef.current = null;
          }
        }
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
    
    watcherIdRef.current = id;
  }, [applyDefaultLocation]);

  const requestLiveLocation = () => {
    // Clear any stale denial state so watchPosition gets a fresh attempt
    localStorage.removeItem('eatwhatleh_location_preference');
    performLiveLocationFetch(false);
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const cachedPref = localStorage.getItem('eatwhatleh_location_preference');

      if (cachedPref === 'default') {
        setUserCoords({ lat: 2.1896, lng: 102.2501 });
        setIsLocationFallback(false);
        setLocationStatus('fallback');
        return;
      }

      if (cachedPref === 'live') {
        performLiveLocationFetch(true);
        return;
      }

      if (navigator.permissions && navigator.permissions.query) {
        void navigator.permissions.query({ name: 'geolocation' }).then((result) => {
          if (result.state === 'granted') {
            performLiveLocationFetch(true);
          } else if (result.state === 'denied') {
            setUserCoords({ lat: 2.1896, lng: 102.2501 });
            setIsLocationFallback(false);
            setLocationStatus('denied');
          } else {
            setShowLocationPopup(true);
          }
        }).catch((err) => {
          console.warn('Permissions API query failed:', err);
          setShowLocationPopup(true);
        });
      } else {
        setShowLocationPopup(true);
      }
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      if (watcherIdRef.current !== null) {
        navigator.geolocation.clearWatch(watcherIdRef.current);
      }
    };
  }, [performLiveLocationFetch]);

  // Auto-scroll when new messages arrive (skip on first load)
  useEffect(() => {
    if (messages.length > 1) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Cycle through loading phases while waiting for AI response
  useEffect(() => {
    const phases = predictedIsItinerary ? ITINERARY_PHASES : SINGLE_PHASES;
    if (loading) {
      let phase = 0;
      loadingTimer.current = setInterval(() => {
        setPhaseVisible(false);
        setTimeout(() => {
          phase = (phase + 1) % phases.length;
          setLoadingPhase(phase);
          setPhaseVisible(true);
        }, 300);
      }, 2000);
    } else {
      if (loadingTimer.current) clearInterval(loadingTimer.current);
    }
    return () => {
      if (loadingTimer.current) clearInterval(loadingTimer.current);
    };
  }, [loading, predictedIsItinerary]);

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    // Predict intent client-side before sending so loading phases can adapt immediately
    const isLikelyItinerary = predictItinerary(text);
    setPredictedIsItinerary(isLikelyItinerary);
    setLoadingPhase(0);
    setPhaseVisible(true);

    const userMsg: Message = { id: Date.now().toString(), role: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Send last 5 messages as history so Gemini understands follow-up context
      const historyPayload = messages.slice(-5).map((m) => ({
        role: m.role,
        text: m.text.slice(0, 300),
      }));

      type ChatRequestPayload = {
        message: string;
        history: { role: Message['role']; text: string }[];
        lastRestaurants: Restaurant[];
        userLat?: number;
        userLng?: number;
        demoClerkId?: string;
        clerkId?: string;
      };

      const payload: ChatRequestPayload = {
        message: text,
        history: historyPayload,
        lastRestaurants,
      };

      if (userCoords) {
        payload.userLat = userCoords.lat;
        payload.userLng = userCoords.lng;
      }
      console.log('[EatWhatLeh sendMessage] Sending coords to backend:', userCoords);

      if (demoProfile.clerkId) {
        payload.demoClerkId = demoProfile.clerkId;
      } else if (user?.id) {
        payload.clerkId = user.id;
      }

      const { data } = await axios.post(`${API_URL}/api/chat`, payload);

      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'bot',
        text: data.reply,
        restaurants: data.restaurants,
        isItinerary: data.isItinerary,
      };
      // Update lastRestaurants whenever the bot responds with restaurant data
      if (data.restaurants?.length > 0) {
        setLastRestaurants(data.restaurants);
      }
      setMessages((prev) => [...prev, botMsg]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'bot',
          text: 'Alamak, something went wrong lah. Please try again!',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ChatContext.Provider
      value={{
        messages,
        loading,
        loadingPhase,
        phaseVisible,
        predictedIsItinerary,
        input,
        setInput,
        sendMessage,
        bottomRef,
        SINGLE_PHASES,
        ITINERARY_PHASES,
        demoProfile,
        setDemoProfile,
        triggerSignOut,
        emulateAdmin,
        setEmulateAdmin,
        userCoords,
        isLocationFallback,
        locationStatus,
        requestLiveLocation,
        useDefaultLocation: applyDefaultLocation,
      }}
    >
      {children}

      {showLocationPopup && (
        <div className="custom-confirm-overlay">
          <div className="custom-confirm-card">
            <div className="custom-confirm-icon">📍</div>
            <h3 className="custom-confirm-title">Enable Location Access?</h3>
            <p className="custom-confirm-message">
              EatWhatLeh recommends local restaurants near you in Melaka, Malaysia. Share your location for personalization, or explore using default coordinates.
            </p>
            <div className="custom-confirm-actions" style={{ flexDirection: 'column', gap: '8px' }}>
              <button 
                className="btn-primary" 
                style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
                onClick={requestLiveLocation}
              >
                Share My Location
              </button>
              <button 
                className="btn-cancel" 
                style={{ width: '100%', padding: '12px' }}
                onClick={applyDefaultLocation}
              >
                Use Melaka Center (Default)
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignOutConfirm && (
        <div className="custom-confirm-overlay" onClick={() => setShowSignOutConfirm(false)}>
          <div className="custom-confirm-card" onClick={(e) => e.stopPropagation()}>
            <div className="custom-confirm-icon">👋</div>
            <h3 className="custom-confirm-title">Sign Out</h3>
            <p className="custom-confirm-message">
              Are you sure you want to sign out of EatWhatLeh? We'll miss your foodie contributions! 🥺
            </p>
            <div className="custom-confirm-actions">
              <button className="btn-cancel" onClick={() => setShowSignOutConfirm(false)}>
                Cancel
              </button>
              <button 
                className="btn-confirm" 
                onClick={async () => {
                  setShowSignOutConfirm(false);
                  setIsSigningOut(true);
                  try {
                    await clerk.signOut();
                  } catch (err) {
                    console.error('Sign out failed:', err);
                    setIsSigningOut(false);
                  }
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {isSigningOut && (
        <div className="custom-confirm-overlay" style={{ zIndex: 3000 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', color: 'white' }}>
            <div className="signing-out-spinner" />
            <span style={{ fontSize: '15px', fontWeight: 500, letterSpacing: '0.2px' }}>Signing out securely...</span>
          </div>
        </div>
      )}
    </ChatContext.Provider>
  );
}
