import { createContext, useContext } from 'react';
import type { Session, User } from '@supabase/supabase-js';

export interface UserProfile {
  id: string;
  role: 'admin' | 'employee';
  full_name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  signOut: () => Promise<void>;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  signOut: async () => {},
  loading: true,
});

export const useAuth = () => useContext(AuthContext);
