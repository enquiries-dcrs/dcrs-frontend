import { create } from 'zustand';

interface GlobalState {
  isAuthenticated: boolean;
  user: { id?: string; name: string; email: string; role: string } | null;
  selectedHomeId: string;
  appMode: 'clinical' | 'family';
  isGlobalSearchOpen: boolean;
  
  login: (userData: { id?: string; name: string; email: string; role: string }) => void;
  logout: () => void;
  setSelectedHomeId: (id: string) => void;
  setAppMode: (mode: 'clinical' | 'family') => void;
  toggleGlobalSearch: () => void;
}

export const useGlobalStore = create<GlobalState>((set) => ({
  isAuthenticated: false,
  user: null,
  selectedHomeId: 'ALL',
  appMode: 'clinical',
  isGlobalSearchOpen: false,
  
  login: (userData) => set({ isAuthenticated: true, user: userData }),
  logout: () => set({ isAuthenticated: false, user: null }),
  setSelectedHomeId: (id) => set({ selectedHomeId: id }),
  setAppMode: (mode) => set({ appMode: mode }),
  toggleGlobalSearch: () => set((state) => ({ isGlobalSearchOpen: !state.isGlobalSearchOpen })),
}));