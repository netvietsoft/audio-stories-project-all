import { create } from "zustand";

type AuthView = 'login' | 'register' | 'forgot' | 'reset' | 'verify';

interface AuthModalState {
  isOpen: boolean;
  view: AuthView;
  resetToken?: string;
  verifyToken?: string;
  email?: string;
  openLogin: () => void;
  openRegister: () => void;
  openForgot: () => void;
  openReset: (token?: string, email?: string) => void;
  openVerify: (token?: string, email?: string) => void;
  close: () => void;
  setView: (view: AuthView) => void;
}

export const useAuthModalStore = create<AuthModalState>((set) => ({
  isOpen: false,
  view: 'login',
  resetToken: undefined,
  verifyToken: undefined,
  email: undefined,

  openLogin: () => set({ isOpen: true, view: 'login' }),
  openRegister: () => set({ isOpen: true, view: 'register' }),
  openForgot: () => set({ isOpen: true, view: 'forgot' }),
  openReset: (token?: string, email?: string) => set({ isOpen: true, view: 'reset', resetToken: token, email }),
  openVerify: (token?: string, email?: string) => set({ isOpen: true, view: 'verify', verifyToken: token, email }),
  close: () => set({ isOpen: false }),
  setView: (view: AuthView) => set({ view }),
}));
