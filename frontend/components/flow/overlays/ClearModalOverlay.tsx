type Props = {
  isClearModalOpen: boolean;
  closeClearModal: () => void;
  clearCanvas: () => void;
};

export function ClearModalOverlay({ isClearModalOpen, closeClearModal, clearCanvas }: Props) {
  if (!isClearModalOpen) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">キャンバスをクリア</h3>
        </div>
        <div className="mb-6">
          <p className="text-sm text-gray-600">
            すべてのノード、エッジ、セクション、メモ、スタンプが削除されます。
            <br />
            この操作は元に戻せません。続行しますか？
          </p>
        </div>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            onClick={closeClearModal}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            onClick={clearCanvas}
          >
            クリアする
          </button>
        </div>
      </div>
    </div>
  );
}
