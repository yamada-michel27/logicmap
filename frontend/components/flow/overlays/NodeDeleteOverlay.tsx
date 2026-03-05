type Props = {
  pendingNodeDelete: { id: string; label: string } | null;
  setPendingNodeDelete: (value: { id: string; label: string } | null) => void;
  deleteNodeById: (id: string) => void;
};

export function NodeDeleteOverlay({ pendingNodeDelete, setPendingNodeDelete, deleteNodeById }: Props) {
  if (!pendingNodeDelete) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">ノードを削除</h3>
        <p className="mt-1 text-sm text-gray-600">
          「{pendingNodeDelete.label}」を削除しますか？
        </p>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            onClick={() => setPendingNodeDelete(null)}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500"
            onClick={() => deleteNodeById(pendingNodeDelete.id)}
          >
            削除する
          </button>
        </div>
      </div>
    </div>
  );
}
