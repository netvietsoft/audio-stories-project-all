"use client";

import React from 'react';
import { X } from 'lucide-react';
import { useAuthModalStore } from '@/stores/auth-modal-store';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';
import ForgotForm from './ForgotForm';
import ResetForm from './ResetForm';
import VerifyEmailForm from './VerifyEmailForm';

export default function AuthModal() {
  const { isOpen, view, resetToken, verifyToken, email, close, setView } = useAuthModalStore();

  if (!isOpen) return null;

  const handleSuccess = () => {
    close();
    window.location.reload();
  };

  const renderView = () => {
    switch (view) {
      case 'login':
        return (
          <LoginForm
            onSuccess={handleSuccess}
            onSwitchToRegister={() => setView('register')}
            onSwitchToForgot={() => setView('forgot')}
          />
        );
      case 'register':
        return (
          <RegisterForm
            onSuccess={handleSuccess}
            onSwitchToLogin={() => setView('login')}
          />
        );
      case 'forgot':
        return (
          <ForgotForm
            onSuccess={() => setView('login')}
            onSwitchToLogin={() => setView('login')}
          />
        );
      case 'reset':
        return (
          <ResetForm
            token={resetToken || ''}
            email={email}
            onSuccess={() => setView('login')}
          />
        );
      case 'verify':
        return (
          <VerifyEmailForm
            token={verifyToken || ''}
            email={email}
            onSuccess={() => setView('login')}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          close();
        }
      }}
    >
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full shadow-2xl relative">
          {/* Close Button */}
          <button
            onClick={close}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-all z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {/* Content */}
          <div className="p-8">
            {renderView()}
          </div>
        </div>
      </div>
    </div>
  );
}
