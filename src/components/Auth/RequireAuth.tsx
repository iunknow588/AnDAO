import React, { useEffect, useState } from 'react';
import { authService } from '@/services/AuthService';
import { UnauthenticatedPrompt } from './UnauthenticatedPrompt';

interface RequireAuthProps {
  children: React.ReactElement;
}

export const RequireAuth: React.FC<RequireAuthProps> = ({ children }) => {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isFirstLogin, setIsFirstLogin] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const authed = authService.isAuthenticated();
        if (!mounted) {
          return;
        }
        setIsAuthenticated(authed);
        if (!authed) {
          const first = await authService.isFirstLogin();
          if (!mounted) {
            return;
          }
          setIsFirstLogin(first);
        }
        setIsChecking(false);
      } catch {
        if (mounted) {
          setIsAuthenticated(false);
          setIsChecking(false);
        }
      }
    };
    void check();

    const handleAutoLocked = () => {
      void check();
    };
    const handleFocus = () => {
      void check();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void check();
      }
    };

    window.addEventListener('wallet:auto-locked', handleAutoLocked as EventListener);
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      window.removeEventListener('wallet:auto-locked', handleAutoLocked as EventListener);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  if (isChecking) {
    return <div>认证状态检查中...</div>;
  }

  if (!isAuthenticated) {
    return <UnauthenticatedPrompt isFirstLogin={isFirstLogin} />;
  }

  return children;
};
