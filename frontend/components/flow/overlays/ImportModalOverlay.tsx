type Props = {
  isImportModalOpen: boolean;
  importText: string;
  setImportText: (value: string) => void;
  importFlowFromText: () => void;
  closeImportModal: () => void;
};

export function ImportModalOverlay({
  isImportModalOpen,
  importText,
  setImportText,
  importFlowFromText,
  closeImportModal,
}: Props) {
  if (!isImportModalOpen) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Mermaidもどきインポート</h3>
          <button
            type="button"
            className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
            onClick={closeImportModal}
          >
            閉じる
          </button>
        </div>
        <div className="mb-4">
          <p className="text-sm text-gray-600 mb-3">
            Mermaidもどき形式のテキストを入力してフローを再現できます。
          </p>
          <div className="text-xs text-gray-500 mb-3">
            <strong>形式例:</strong>
            <pre className="bg-gray-100 p-2 rounded mt-1">
              {`- [normal] データ処理 (id: node-1)
  - 位置: (100, 200), サイズ: 150 × 80
- [normal] 結果出力 (id: node-2)
  - 位置: (300, 200), サイズ: 150 × 80
- [通常] データ処理 → 結果出力`}
            </pre>
          </div>
        </div>
        <div className="mb-4">
          <textarea
            value={importText}
            onChange={(e) => setImportText(e.target.value)}
            placeholder="Mermaidもどきテキストをここに入力してください..."
            className="w-full h-64 p-3 text-sm font-mono bg-white border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            style={{ whiteSpace: 'pre' }}
          />
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={closeImportModal}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={importFlowFromText}
            disabled={!importText.trim()}
          >
            インポートする
          </button>
        </div>
      </div>
    </div>
  );
}
