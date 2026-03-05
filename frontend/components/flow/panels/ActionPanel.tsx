import { STAMP_OPTIONS } from '../types';
import type { StampType } from '../types';

type Props = {
  currentFlowId: string | null;
  currentFlowName: string | null;
  updateFlow: () => void;
  openTemplateModal: () => void;
  createNewCanvas: () => void;
  openExportModal: () => void;
  openImportModal: () => void;
  generatePythonCode: () => void;
  openPythonImportModal: () => void;
  openClearModal: () => void;
  openMemoCreateModal: () => void;
  pendingStamp: StampType | null;
  setPendingStamp: (value: StampType | null) => void;
};

export function ActionPanel({
  currentFlowId,
  currentFlowName,
  updateFlow,
  openTemplateModal,
  createNewCanvas,
  openExportModal,
  openImportModal,
  generatePythonCode,
  openPythonImportModal,
  openClearModal,
  openMemoCreateModal,
  pendingStamp,
  setPendingStamp,
}: Props) {
  return (
    <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-2">
      {currentFlowId && (
        <div className="rounded-md border border-gray-200 bg-white/95 px-3 py-2 text-xs shadow-sm">
          <div className="flex items-center gap-2">
            <div className="font-semibold text-gray-900">{currentFlowName}</div>
            <button
              type="button"
              className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              onClick={updateFlow}
            >
              💾 上書き保存
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm">
        <button
          type="button"
          className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          onClick={openTemplateModal}
        >
          📐 テンプレート
        </button>
        <button
          type="button"
          className="rounded-md border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100"
          onClick={createNewCanvas}
        >
          📄 新規
        </button>
        <button
          type="button"
          className="rounded-md border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100"
          onClick={openExportModal}
        >
          📋 エクスポート
        </button>
        <button
          type="button"
          className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
          onClick={openImportModal}
        >
          📥 インポート
        </button>
        <button
          type="button"
          className="rounded-md border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-100"
          onClick={generatePythonCode}
        >
          🐍 Python生成
        </button>
        <button
          type="button"
          className="rounded-md border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100"
          onClick={openPythonImportModal}
        >
          📝 Python→Canvas
        </button>
        <button
          type="button"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
          onClick={openClearModal}
        >
          🗑️ クリア
        </button>
        <button
          type="button"
          className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
          onClick={openMemoCreateModal}
        >
          + メモ
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">スタンプ</span>
          <select
            value={pendingStamp ?? ''}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
            onChange={(event) =>
              setPendingStamp(event.target.value ? (event.target.value as StampType) : null)
            }
          >
            <option value="">選択</option>
            {STAMP_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.emoji} {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {pendingStamp ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 shadow-sm">
          クリックでスタンプを配置
        </div>
      ) : null}
    </div>
  );
}
