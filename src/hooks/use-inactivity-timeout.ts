
'use client';

import { useEffect, useCallback, useRef } from 'react';

const LOGOUT_TIMEOUT_MS = 60 * 60 * 1000; // 60 minutes
const WARNING_TIME_MS = 5 * 60 * 1000; // 5 minutes before logout

/**
 * A custom hook to manage user inactivity timeout with a warning dialog.
 * @param onTimeout - The function to call when the final timeout is reached.
 * @param onWarning - A function to show the warning dialog.
 * @param onReset - A function to hide the warning dialog.
 * @param isDisabled - A boolean to completely disable the timeout functionality.
 * @returns An object containing a function to manually reset the timers.
 */
export function useInactivityTimeout(
    onTimeout: () => void,
    onWarning: (countdown: number) => void,
    onReset: () => void,
    isDisabled: boolean = false // Add the isDisabled parameter
) {
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = useCallback(onTimeout, [onTimeout]);
  const showWarning = useCallback(onWarning, [onWarning]);

  const clearAllTimers = () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      if (warningTimerRef.current) clearTimeout(warningTimerRef.current);
  };

  const resetTimers = useCallback(() => {
    clearAllTimers();

    if (isDisabled) {
        return; // Do not set any new timers if the hook is disabled
    }

    onReset();

    warningTimerRef.current = setTimeout(() => {
      showWarning(WARNING_TIME_MS);
    }, LOGOUT_TIMEOUT_MS - WARNING_TIME_MS);

    logoutTimerRef.current = setTimeout(handleLogout, LOGOUT_TIMEOUT_MS);
  }, [isDisabled, handleLogout, showWarning, onReset]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const activityEvents: (keyof WindowEventMap)[] = [
      'mousemove', 'mousedown', 'keypress', 'touchstart', 'scroll'
    ];

    const handleActivity = () => {
      resetTimers();
    };

    if (!isDisabled) {
        activityEvents.forEach(event => window.addEventListener(event, handleActivity));
        resetTimers(); // Set initial timers only if not disabled
    } else {
        // If it becomes disabled, clear any running timers
        clearAllTimers();
    }

    return () => {
      clearAllTimers();
      activityEvents.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [resetTimers, isDisabled]); // Re-run the effect if the disabled state changes

  return { resetInactivityTimers: resetTimers };
}
