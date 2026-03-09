import { useFlowUiContext } from '../context/FlowUiContext';

export function ExportModalOverlay() {
  const { exportModalOverlay } = useFlowUiContext();
  const {
    isExportModalOpen,
    exportedText,
    isCopied,
    copyToClipboard,
    downloadFlowStructure,
    closeExportModal,
  } = exportModalOverlay;

  if (!isExportModalOpen) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">フロー構造エクスポート</h3>
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-md border px-3 py-1 text-xs font-semibold ${
                isCopied
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
              onClick={copyToClipboard}
              disabled={isCopied}
            >
              {isCopied ? '✓ コピーしました' : '📋 コピー'}
            </button>
            <button
              type="button"
              className="rounded-md border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100"
              onClick={downloadFlowStructure}
            >
              💾 ダウンロード
            </button>
            <button
              type="button"
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              onClick={closeExportModal}
            >
              閉じる
            </button>
          </div>
        </div>
        <div className="mt-4">
          <textarea
            value={exportedText}
            readOnly
            className="w-full h-96 p-3 text-xs font-mono bg-gray-50 border border-gray-300 rounded-md resize-none"
            style={{ whiteSpace: 'pre' }}
          />
        </div>
      </div>
    </div>
  );
}
