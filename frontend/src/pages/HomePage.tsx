import { useState } from 'react';
import { useUser, SignInButton } from '@clerk/clerk-react';
import RestaurantCard, { type Restaurant } from '../components/RestaurantCard';
import MapModal from '../components/MapModal';
import { useChatContext } from '../context/chatContextStore';
import './HomePage.css';

const DEMO_PROFILES = [
  { label: '👤 Default', clerkId: '' },
  { label: '💸 User A (Budget)', clerkId: 'user_clerk_a' },
  { label: '💎 User B (Fine Dining)', clerkId: 'user_clerk_b' },
];


function renderMarkdown(text: string) {
  if (!text) return '';
  let escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Bold (**text** or __text__)
  escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  escaped = escaped.replace(/__(.*?)__/g, '<strong>$1</strong>');

  // Italic (*text* or _text_)
  escaped = escaped.replace(/\*(?!\*)(.*?)\*/g, '<em>$1</em>');
  escaped = escaped.replace(/_(?!\_)(.*?)_/g, '<em>$1</em>');

  // Inline code (`code`)
  escaped = escaped.replace(/`(.*?)`/g, '<code>$1</code>');

  // Line breaks
  escaped = escaped.replace(/\n/g, '<br />');

  return escaped;
}

const SUGGESTIONS = [
  '🍜 Spicy noodles near Jonker Street',
  '🍡 Plan me dinner then dessert',
  '☕ Best cafés in Melaka',
  '🥘 Halal asam pedas please!',
];

export default function HomePage() {
  const { isSignedIn, user } = useUser();
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);
  const {
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
    locationStatus,
    requestLiveLocation,
  } = useChatContext();

  // Pick the active phase set based on what we predicted the request to be
  const LOADING_PHASES = predictedIsItinerary ? ITINERARY_PHASES : SINGLE_PHASES;

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="home-page">
      {/* Header */}
      <header className="home-header">
        <div className="home-logo">
          <span className="logo-icon">🍽️</span>
          <span className="logo-text gradient-text">EatWhatLeh</span>
        </div>
        <div className="home-header-right">
          <button 
            className={`location-badge location-badge-interactive status-${locationStatus}`}
            onClick={requestLiveLocation}
            title="Click to recalibrate / update location"
          >
            <span className="location-badge-icon">
              {locationStatus === 'requesting' ? '🔄' : '📍'}
            </span>
            <span>
              {locationStatus === 'granted' && 'Live GPS'}
              {locationStatus === 'out-of-town' && 'Melaka (Default)'}
              {locationStatus === 'denied' && 'Melaka (Default)'}
              {locationStatus === 'fallback' && 'Melaka (Default)'}
              {locationStatus === 'requesting' && 'Locating...'}
              {locationStatus === 'prompt' && 'Set Location'}
            </span>
            {locationStatus !== 'requesting' && (
              <span className="location-recalibrate-target">🎯</span>
            )}
          </button>
          {!isSignedIn ? (
            <SignInButton mode="modal">
              <button className="btn-ghost" id="sign-in-btn">Sign In</button>
            </SignInButton>
          ) : (
            <div 
              className="avatar-chip avatar-chip-interactive" 
              style={{ cursor: 'pointer' }}
              onClick={triggerSignOut}
            >
              <img src={user.imageUrl} alt={user.firstName ?? ''} className="avatar-img" />
              <span>{user.firstName}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Split Panel */}
      <div className="home-page-split">
        {/* Left Panel: Chat container */}
        <div className="chat-panel">
          {/* Location Warning Banner */}
          {locationStatus === 'out-of-town' && (
            <div className="location-warning-banner chat-warning-banner info-mode">
              <span>📍 We noticed you are outside Melaka! Using Melaka Center coordinates so you can explore.</span>
            </div>
          )}
          {locationStatus === 'denied' && (
            <div className="location-warning-banner chat-warning-banner">
              <span>📍 Geolocation access is disabled. Using default Melaka coordinates.</span>
            </div>
          )}
          <div className="chat-window">
            {messages.map((msg) => (
              <div key={msg.id} className={`message-row ${msg.role}`}>
                {msg.role === 'bot' && (
                  <div className="bot-avatar">🤖</div>
                )}
                <div className={`message-bubble ${msg.role}`}>
                  <p
                    className="message-text"
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }}
                  />
                  {msg.restaurants && msg.restaurants.length > 0 && (
                    <div className="message-cards">
                      {msg.isItinerary && (
                        <div className="itinerary-label">
                          <span>✨ Your Dining Itinerary</span>
                        </div>
                      )}
                      <div className="cards-scroll">
                        {msg.restaurants.map((r, i) => {
                          const prevRestaurant = i > 0 && msg.restaurants ? msg.restaurants[i - 1] : null;
                          const showDivider = !msg.isItinerary && prevRestaurant && r.recommendationType !== prevRestaurant.recommendationType;

                          return (
                            <div key={r.id} className="card-inline-wrapper">
                              {showDivider && (
                                <div className="recommendation-section-divider">
                                  <div className="divider-line" />
                                  <span className="divider-label">
                                    {r.recommendationType === 'preference' ? '✨ Personalised Matches' : '💎 Hidden Gem'}
                                  </span>
                                  <div className="divider-line" />
                                </div>
                              )}
                              {/* Walk connector between stops — shown for all stops after the first */}
                              {msg.isItinerary && i > 0 && (
                                <div className="walk-connector">
                                  <span className="walk-connector-line" />
                                  <span className="walk-connector-pill">
                                    🚶 {r.walkMinutes != null ? `~${r.walkMinutes} min walk` : 'walk'}{r.distanceFromPrev != null ? ` · ${r.distanceFromPrev.toFixed(1)} km` : ''}
                                  </span>
                                  <span className="walk-connector-line" />
                                </div>
                              )}
                              <RestaurantCard 
                                restaurant={r} 
                                index={i} 
                                showStep={msg.isItinerary} 
                                onClick={() => setSelectedRestaurant(r)}
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="message-row bot">
                <div className="bot-avatar">🤖</div>
                <div className={`message-bubble bot loading-status-bubble ${phaseVisible ? 'phase-in' : 'phase-out'}`}>
                  <span className="loading-phase-icon">{LOADING_PHASES[loadingPhase].icon}</span>
                  <span className="loading-phase-text">{LOADING_PHASES[loadingPhase].text}</span>
                  <span className="loading-dots">
                    <span className="dot" /><span className="dot" /><span className="dot" />
                  </span>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions (only shown before first user message) */}
          {messages.length <= 1 && (
            <div className="suggestions-row">
              {SUGGESTIONS.map((s) => (
                <button key={s} className="suggestion-chip" onClick={() => sendMessage(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <div className="chat-input-bar">
            {/* Demo Profile Switcher */}
            <div className="demo-profile-switcher chat-demo-switcher">
              <span className="demo-label">🧪 Demo Profile:</span>
              {DEMO_PROFILES.map((p) => (
                <button
                  key={p.clerkId}
                  id={`chat-profile-${p.clerkId || 'default'}`}
                  className={`profile-chip ${demoProfile.clerkId === p.clerkId ? 'profile-active' : ''}`}
                  onClick={() => setDemoProfile(p)}
                  title={p.clerkId ? `Switch to ${p.label} to see personalised recommendations` : 'No personalisation'}
                >
                  {p.label}
                </button>
              ))}
              {demoProfile.clerkId && (
                <span className="profile-hint">
                  ({demoProfile.label.split('(')[1]?.replace(')', '').trim() || 'Taste profile active'})
                </span>
              )}
            </div>
            <div className="chat-input-inner">
              <textarea
                id="chat-input"
                className="chat-textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask me what to eat in Melaka..."
                rows={1}
              />
              <button
                id="send-btn"
                className="send-btn"
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
              >
                {loading ? <span className="spinner" /> : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="20" height="20">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"/>
                  </svg>
                )}
              </button>
            </div>
            <p className="input-hint">Powered by Gemini AI · EatWhatLeh 🇲🇾</p>
          </div>
        </div>

      </div>

      {/* Map Modal Popup */}
      <MapModal
        restaurant={selectedRestaurant}
        onClose={() => setSelectedRestaurant(null)}
      />
    </div>
  );
}
