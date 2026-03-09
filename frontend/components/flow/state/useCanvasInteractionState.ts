import { useCallback, useRef } from 'react';
import type { ReactFlowInstance } from 'reactflow';

import { isDoubleClickWithinThreshold } from '../services/flowInteractionService';

export function useCanvasInteractionState() {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const lastPaneClickAt = useRef<number | null>(null);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  const consumePaneClickType = useCallback(() => {
    const now = Date.now();
    const isDoubleClick = isDoubleClickWithinThreshold(lastPaneClickAt.current, now);
    lastPaneClickAt.current = now;
    return isDoubleClick;
  }, []);

  return {
    wrapperRef,
    reactFlowInstance,
    onInit,
    consumePaneClickType,
  };
}
