import { useState, useEffect } from 'react';

/**
 * Hook to detect whether a virtual keyboard or input focus is active on mobile devices.
 * Automatically hides bottom navigation bars so they don't uplift and obscure forms/buttons.
 */
export const useKeyboardStatus = () => {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    // 1. Visual Viewport API: detects virtual keyboard appearance in Android Chrome & iOS Safari
    const handleViewportChange = () => {
      if (window.visualViewport) {
        // When on-screen keyboard opens, visualViewport.height shrinks significantly
        const isShrunk = window.innerHeight - window.visualViewport.height > 120;
        setIsKeyboardOpen(isShrunk);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleViewportChange);
      window.visualViewport.addEventListener('scroll', handleViewportChange);
    }

    // 2. Focus listeners: immediate reaction when user taps any form input
    const handleFocusIn = (e) => {
      const tag = e.target?.tagName?.toLowerCase();
      const isInput = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target?.isContentEditable;
      if (isInput) {
        setIsKeyboardOpen(true);
      }
    };

    const handleFocusOut = () => {
      setTimeout(() => {
        const activeTag = document.activeElement?.tagName?.toLowerCase();
        const stillFocused = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || document.activeElement?.isContentEditable;
        
        if (!stillFocused) {
          if (!window.visualViewport || (window.innerHeight - window.visualViewport.height <= 120)) {
            setIsKeyboardOpen(false);
          }
        }
      }, 150);
    };

    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportChange);
        window.visualViewport.removeEventListener('scroll', handleViewportChange);
      }
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  return isKeyboardOpen;
};

export default useKeyboardStatus;
