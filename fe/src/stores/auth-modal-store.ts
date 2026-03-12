import { create } from "zustand";

type AuthView = 'login' | 'register' | 'forgot' | 'reset' | 'verify';

interface AuthModalState {
  isOpen: boolean;
  view: AuthView;
  resetToken?: string;
  verifyToken?: string;
  openLogin: () => void;
  openRegister: () => void;
  openForgot: () => void;
  openReset: (token: string) => void;
  openVerify: (token: string) => void;
  close: () => void;
  setView: (view: AuthView) => void;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  isOpen: false,
  view: 'login',
  resetToken: undefined,
  verifyToken: undefined,
  
  openLogin: () => set({ isOpen: true, view: 'login' }),
  openRegister: () => set({ isOpen: true, view: 'register' }),
  openForgot: () => set({ isOpen: true, view: 'forgot' }),
  openReset: (token: string) => set({ isOpen: true, view: 'reset', resetToken: token }),
  openVerify: (token: string) => set({ isOpen: true, view: 'verify', verifyToken: token }),
  close: () => set({ isOpen: false }),
  setView: (view: AuthView) => set({ view }),
}));
