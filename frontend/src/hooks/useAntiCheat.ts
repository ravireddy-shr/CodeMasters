import { useEffect, useRef } from 'react';
import { api } from '../services/apiClient';

interface UseAntiCheatOptions {
  enabled: boolean;
  onWarning: (warning: { reason: string; message: string; warningsCount: number; isDisqualified: boolean }) => void;
  onDisqualified: (reason: string) => void;
}

export function useAntiCheat({ enabled, onWarning, onDisqualified }: UseAntiCheatOptions) {
  const lastWarningTimeRef = useRef<number>(0);
  const COOLDOWN_MS = 3000;

  const handleViolation = async (reason: string, message: string) => {
    if (!enabled) return;
    const now = Date.now();
    if (now - lastWarningTimeRef.current < COOLDOWN_MS) {
      return;
    }
    lastWarningTimeRef.current = now;

    try {
      const res = await api.reportWarning(reason, message);
      onWarning({
        reason,
        message,
        warningsCount: res.warnings_count,
        isDisqualified: res.is_disqualified,
      });

      if (res.is_disqualified) {
        onDisqualified(`Accumulated maximum integrity infractions (${res.warnings_count}/${res.max_warnings}).`);
      }
    } catch {
      // Backend error fallback
    }
  };

  useEffect(() => {
    if (!enabled) return;

    // 1. Tab Switching Detection
    const handleVisibilityChange = () => {
      if (document.hidden) {
        handleViolation(
          'Tab switching detected',
          'Leaving the Round 2 assessment tab is prohibited under competition proctoring rules.'
        );
      }
    };

    // 2. Window Blur Detection
    const handleWindowBlur = () => {
      handleViolation(
        'Window blur detected',
        'Your examination window lost focus. Please remain focused on the code editor.'
      );
    };

    // 3. Right-Click Context Menu Prevention
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      handleViolation(
        'Context menu blocked',
        'Right-click actions and inspect element are disabled during the contest.'
      );
    };

    // 4. Clipboard Copy Prevention
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      handleViolation(
        'Clipboard copy prevented',
        'Copying content from the contest portal is strictly prohibited.'
      );
    };

    // 5. Clipboard Cut Prevention
    const handleCut = (e: ClipboardEvent) => {
      e.preventDefault();
      handleViolation(
        'Clipboard cut prevented',
        'Cutting content from the contest portal is prohibited.'
      );
    };

    // 6. Clipboard Paste Prevention
    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      handleViolation(
        'Clipboard paste prevented',
        'Pasting external code or text is disabled to maintain examination integrity.'
      );
    };

    // 7. Restricted Keyboard Shortcuts (Ctrl/Cmd + C, V, X, U, S, F12, DevTools)
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.ctrlKey || e.metaKey;

      if (isCmdOrCtrl && ['c', 'v', 'x', 'u', 's'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        handleViolation(
          'Restricted shortcut used',
          `Keyboard shortcut Ctrl/Cmd+${e.key.toUpperCase()} is disabled during the contest.`
        );
      } else if (e.key === 'F12' || (isCmdOrCtrl && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase()))) {
        e.preventDefault();
        handleViolation(
          'Developer tools shortcut blocked',
          'Accessing browser developer tools is prohibited during the contest.'
        );
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('cut', handleCut);
    document.addEventListener('paste', handlePaste);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('cut', handleCut);
      document.removeEventListener('paste', handlePaste);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);
}
