import { ClerkProvider, useUser, useAuth } from '@clerk/clerk-react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ChatProvider } from './context/ChatContext';
import BottomNav from './components/BottomNav';
import HomePage from './pages/HomePage';
import FeedPage from './pages/FeedPage';
import ReviewPage from './pages/ReviewPage';
import ProfilePage from './pages/ProfilePage';
import AdminPage from './pages/AdminPage';
import { getAuthHeaders } from './utils/authHelper';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function UserSync() {
  const { isSignedIn, user } = useUser();
  const { getToken } = useAuth();

  useEffect(() => {
    if (isSignedIn && user) {
      const syncUser = async () => {
        try {
          const headers = await getAuthHeaders(user, getToken);
          await axios.post(`${API_URL}/api/users/sync`, {
            clerkId: user.id,
            name: user.fullName || user.username || 'Anonymous Foodie',
            email: user.primaryEmailAddress?.emailAddress || '',
          }, { headers });
        } catch (err) {
          console.error('Failed to sync user with DB:', err);
        }
      };
      syncUser();
    }
  }, [isSignedIn, user, getToken]);

  return null;
}

export default function App() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {!isOnline && (
        <div className="offline-banner">
          <span>📡 You are offline. Search & review features are temporarily disabled.</span>
        </div>
      )}
      <ClerkProvider publishableKey={PUBLISHABLE_KEY} afterSignInUrl="/" afterSignUpUrl="/">
        <BrowserRouter>
          <ChatProvider>
            <UserSync />
            <div className="app-layout">
              <div className="page">
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/feed" element={<FeedPage />} />
                  <Route path="/review" element={<ReviewPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/admin" element={<AdminPage />} />
                </Routes>
              </div>
              <BottomNav />
            </div>
          </ChatProvider>
        </BrowserRouter>
      </ClerkProvider>
    </>
  );
}
