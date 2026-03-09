import { useFlowUiContext } from '../context/FlowUiContext';

export function PythonImportModalOverlay() {
  const { pythonImportModalOverlay } = useFlowUiContext();
  const {
    isPythonImportModalOpen,
    pythonInputCode,
    setPythonInputCode,
    isCanvasGenerating,
    generateCanvasFromPython,
    closePythonImportModal,
  } = pythonImportModalOverlay;

  if (!isPythonImportModalOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            📝 PythonコードからCanvas生成
          </h3>
          <button
            type="button"
            className="rounded-md p-2 text-gray-500 hover:text-gray-700"
            onClick={closePythonImportModal}
          >
            ✕
          </button>
        </div>

        <div className="mb-4">
          <p className="mb-3 text-sm text-gray-600">
            Pythonコードを入力してCanvasを生成します。
          </p>
          <textarea
            value={pythonInputCode}
            onChange={(e) => setPythonInputCode(e.target.value)}
            placeholder="def example_function(a: int, b: int) -> int:&#10;    result = a + b&#10;    return result&#10;&#10;if __name__ == '__main__':&#10;    print(example_function(1, 2))"
            className="w-full h-96 rounded-md border border-gray-300 p-3 font-mono text-sm resize-none focus:border-blue-500 focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            onClick={closePythonImportModal}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
            onClick={generateCanvasFromPython}
            disabled={!pythonInputCode.trim() || isCanvasGenerating}
          >
            {isCanvasGenerating ? '生成中...' : 'Canvas生成'}
          </button>
        </div>
      </div>
    </div>
  );
}
