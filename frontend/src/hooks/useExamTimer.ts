import { useState, useEffect, useRef } from 'react';

interface UseExamTimerProps {
  initialMinutes?: number;
  endTimeIso?: string;
  isRunning?: boolean;
  onTimeExpired: () => void;
}

export function useExamTimer({
  initialMinutes = 90,
  endTimeIso,
  isRunning = true,
  onTimeExpired,
}: UseExamTimerProps) {
  const calculateInitialSeconds = () => {
    if (endTimeIso) {
      const endMs = new Date(endTimeIso).getTime();
      const diffSec = Math.floor((endMs - Date.now()) / 1000);
      return diffSec > 0 ? diffSec : 0;
    }
    return initialMinutes * 60;
  };

  const [secondsRemaining, setSecondsRemaining] = useState<number>(calculateInitialSeconds);
  const prevInitialMinutesRef = useRef(initialMinutes);
  const onTimeExpiredRef = useRef(onTimeExpired);
  onTimeExpiredRef.current = onTimeExpired;

  // React dynamically when overall duration or participant extra time changes
  useEffect(() => {
    if (initialMinutes !== prevInitialMinutesRef.current) {
      const deltaMinutes = initialMinutes - prevInitialMinutesRef.current;
      prevInitialMinutesRef.current = initialMinutes;
      setSecondsRemaining((prev) => Math.max(0, prev + deltaMinutes * 60));
    }
  }, [initialMinutes]);

  const addExtraSeconds = (extraSeconds: number) => {
    setSecondsRemaining((prev) => Math.max(0, prev + extraSeconds));
  };

  useEffect(() => {
    if (!isRunning) return;

    if (secondsRemaining <= 0) {
      onTimeExpiredRef.current();
      return;
    }

    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onTimeExpiredRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, secondsRemaining]);

  const hours = Math.floor(secondsRemaining / 3600);
  const minutes = Math.floor((secondsRemaining % 3600) / 60);
  const seconds = secondsRemaining % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formattedTime = hours > 0
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;

  const isLowTime = secondsRemaining <= 300 && secondsRemaining > 0; // Under 5 mins

  return {
    secondsRemaining,
    formattedTime,
    isLowTime,
    isExpired: secondsRemaining === 0,
    addExtraSeconds,
  };
}
