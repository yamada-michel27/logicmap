import { useCallback, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';

type DebugEvent = {
  type: string;
  x: number;
  y: number;
  count: number;
};

export function useDebugEventState() {
  const [debugEvent, setDebugEvent] = useState<DebugEvent | null>(null);
  const debugEventCount = useRef(0);

  const recordDebugEvent = useCallback((type: string, event: ReactMouseEvent) => {
    debugEventCount.current += 1;
    setDebugEvent({
      type,
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
      count: debugEventCount.current,
    });
  }, []);

  return {
    debugEvent,
    recordDebugEvent,
  };
}
