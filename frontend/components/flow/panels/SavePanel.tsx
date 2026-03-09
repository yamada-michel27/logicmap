import { useFlowUiContext } from '../context/FlowUiContext';

export function SavePanel() {
  const { savePanel } = useFlowUiContext();
  const {
    saveName,
    setSaveName,
    isSavingFlow,
    saveCurrentFlow,
    saveError,
    savedFlows,
    isLoadingFlows,
    restoreSavedFlow,
    deleteSavedFlow,
  } = savePanel;

  return (
    <div className="absolute left-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm">
        <span className="text-xs text-gray-500">保存</span>
        <input
          type="text"
          value={saveName}
          className="w-52 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
          onChange={(event) => setSaveName(event.target.value)}
          placeholder="保存名（空なら日時）"
        />
        <button
          type="button"
          className={`rounded-md px-3 py-1 text-xs font-semibold text-white ${
            isSavingFlow ? 'bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'
          }`}
          onClick={saveCurrentFlow}
          disabled={isSavingFlow}
        >
          {isSavingFlow ? '保存中...' : '保存する'}
        </button>
      </div>
      {saveError ? (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-sm">
          {saveError}
        </div>
      ) : null}
      {savedFlows.length > 0 ? (
        <div className="flex flex-wrap gap-2 rounded-md border border-gray-200 bg-white/80 px-3 py-2 text-xs text-gray-900 shadow-sm">
          {savedFlows.map((flow) => (
            <div
              key={flow.id}
              className="flex items-center overflow-hidden rounded-full border border-gray-200 bg-white"
            >
              <button
                type="button"
                className="max-w-[180px] truncate px-3 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                onClick={() => restoreSavedFlow(flow.id)}
                title={flow.name}
              >
                {flow.name}
              </button>
              <button
                type="button"
                className="border-l border-gray-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                onClick={() => deleteSavedFlow(flow.id)}
                aria-label="保存データを削除"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : isLoadingFlows ? (
        <div className="rounded-md border border-gray-200 bg-white/80 px-3 py-2 text-xs text-gray-500 shadow-sm">
          保存データを読み込み中...
        </div>
      ) : null}
    </div>
  );
}
