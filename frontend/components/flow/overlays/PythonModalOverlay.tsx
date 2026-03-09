import { useFlowUiContext } from '../context/FlowUiContext';

export function PythonModalOverlay() {
  const { pythonModalOverlay } = useFlowUiContext();
  const {
    isPythonModalOpen,
    isPythonGenerating,
    pythonCode,
    isPythonCopied,
    copyPythonCode,
    downloadPythonFile,
    closePythonModal,
  } = pythonModalOverlay;

  if (!isPythonModalOpen) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl max-h-[80vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">🐍 生成されたPythonコード</h3>
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded-md border px-3 py-1 text-xs font-semibold ${
                isPythonCopied
                  ? 'border-green-200 bg-green-50 text-green-700'
                  : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
              }`}
              onClick={copyPythonCode}
              disabled={isPythonGenerating}
            >
              {isPythonCopied ? '✓ コピー済み' : '📋 コピー'}
            </button>
            <button
              type="button"
              className="rounded-md border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100"
              onClick={downloadPythonFile}
              disabled={isPythonGenerating || !pythonCode}
            >
              💾 ダウンロード
            </button>
            <button
              type="button"
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              onClick={closePythonModal}
            >
              ✕ 閉じる
            </button>
          </div>
        </div>
        {isPythonGenerating ? (
          <div className="flex items-center justify-center p-8">
            <div className="text-center">
              <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-600">Pythonコードを生成中...</p>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <pre className="h-96 overflow-auto rounded-md border border-gray-300 bg-gray-50 p-4 text-sm font-mono">
              <code className="text-gray-800">{pythonCode}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
