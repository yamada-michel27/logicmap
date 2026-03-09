import { useFlowUiContext } from '../context/FlowUiContext';

export function DebugPanel() {
  const {
    debugPanel: { debugEvent },
  } = useFlowUiContext();

  return (
    <div className="absolute right-3 top-24 z-30 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm">
      <div className="font-semibold">Debug: Pane Event</div>
      {debugEvent ? (
        <>
          <div className="mt-1">type: {debugEvent.type}</div>
          <div>
            pos: {debugEvent.x}, {debugEvent.y}
          </div>
          <div>count: {debugEvent.count}</div>
        </>
      ) : (
        <div className="mt-1">none</div>
      )}
    </div>
  );
}
