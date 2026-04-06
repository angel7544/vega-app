import { useState, useEffect } from 'react';

let globalNow = Date.now();
const listeners = new Set<(now: number) => void>();

// Centralized timer to avoid multiple intervals running simultaneously
// Updates every 60 seconds
let interval: any = null;

function startTimer() {
  if (interval) return;
  interval = setInterval(() => {
    globalNow = Date.now();
    listeners.forEach(l => l(globalNow));
  }, 60000);
}

export function useNow() {
  const [now, setNow] = useState(globalNow);

  useEffect(() => {
    startTimer();
    listeners.add(setNow);
    return () => {
      listeners.delete(setNow);
    };
  }, []);

  return now;
}
