import { useFlowUiContext } from '../context/FlowUiContext';

export function SavePanel() {
  const { savePanel } = useFlowUiContext();
  const {
    saveName,
    setSaveName,
    isSavingFlow,
    saveCurrentFlow,
    saveError,
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
    </div>
  );
}
