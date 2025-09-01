import { useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface UseUnsavedChangesOptions {
  hasUnsavedChanges: boolean;
  message?: string;
}

export const useUnsavedChanges = ({ 
  hasUnsavedChanges, 
  message = 'You have unsaved changes. Are you sure you want to leave?' 
}: UseUnsavedChangesOptions) => {
  const navigate = useNavigate();
  const location = useLocation();
  const savedLocationRef = useRef(location.pathname);

  useEffect(() => {
    savedLocationRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = message;
        return message;
      }
    };

    const handlePopstate = (e: PopStateEvent) => {
      if (hasUnsavedChanges) {
        const confirmNavigation = window.confirm(message);
        if (!confirmNavigation) {
          e.preventDefault();
          // Push the current location back to history
          window.history.pushState(null, '', savedLocationRef.current);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopstate);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopstate);
    };
  }, [hasUnsavedChanges, message]);

  const navigateWithCheck = (to: string) => {
    if (hasUnsavedChanges) {
      const confirmNavigation = window.confirm(message);
      if (confirmNavigation) {
        navigate(to);
      }
    } else {
      navigate(to);
    }
  };

  return { navigateWithCheck };
};