import { createContext, useContext, type RefObject } from 'react';
import type { Restaurant } from '../components/RestaurantCard';

export interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  restaurants?: Restaurant[];
  isItinerary?: boolean;
}

export interface DemoProfile {
  label: string;
  clerkId: string;
}

export interface ChatContextValue {
  messages: Message[];
  loading: boolean;
  loadingPhase: number;
  phaseVisible: boolean;
  predictedIsItinerary: boolean;
  input: string;
  setInput: (v: string) => void;
  sendMessage: (text: string) => Promise<void>;
  bottomRef: RefObject<HTMLDivElement>;
  SINGLE_PHASES: { icon: string; text: string }[];
  ITINERARY_PHASES: { icon: string; text: string }[];
  demoProfile: DemoProfile;
  setDemoProfile: (p: DemoProfile) => void;
  triggerSignOut: () => void;
  emulateAdmin: boolean;
  setEmulateAdmin: (val: boolean) => void;
  userCoords: { lat: number; lng: number } | null;
  isLocationFallback: boolean;
  locationStatus: 'prompt' | 'requesting' | 'granted' | 'fallback' | 'denied' | 'out-of-town';
  requestLiveLocation: () => void;
  useDefaultLocation: () => void;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used inside <ChatProvider>');
  return ctx;
}