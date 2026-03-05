import { useMemo } from 'react';

export type MemoModalProps = {
  pendingMemoClientPosition: { x: number; y: number } | null;
  pendingMemoEdit: { id: string } | null;
  memoText: string;
  setMemoText: React.Dispatch<React.SetStateAction<string>>;
  applyMemoCreation: () => void;
  applyMemoEdit: () => void;
  cancelMemoModal: () => void;
  deleteNodeById: (nodeId: string) => void;
};

export default function MemoModal({
  pendingMemoClientPosition,
  pendingMemoEdit,
  memoText,
  setMemoText,
  applyMemoCreation,
  applyMemoEdit,
  cancelMemoModal,
  deleteNodeById,
}: MemoModalProps) {
  const content = useMemo(() => {
    const isEdit = Boolean(pendingMemoEdit);
    if (!pendingMemoClientPosition && !pendingMemoEdit) return null;
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'メモを編集' : 'メモを追加'}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {isEdit ? 'メモ内容を変更できます。' : 'フロウ上に貼り付けるメモを入力してください。'}
          </p>
          <div className="mt-4">
            <label className="text-xs font-semibold text-gray-700">本文</label>
            <textarea
              value={memoText}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              rows={6}
              onChange={(event) => setMemoText(event.target.value)}
              placeholder="メモを入力"
            />
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            {isEdit && pendingMemoEdit ? (
              <button
                type="button"
                className="mr-auto rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                onClick={() => deleteNodeById(pendingMemoEdit.id)}
              >
                削除する
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={cancelMemoModal}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              onClick={isEdit ? applyMemoEdit : applyMemoCreation}
            >
              {isEdit ? '保存する' : '追加する'}
            </button>
          </div>
        </div>
      </div>
    );
  }, [
    applyMemoCreation,
    applyMemoEdit,
    cancelMemoModal,
    deleteNodeById,
    memoText,
    pendingMemoClientPosition,
    pendingMemoEdit,
  ]);

  return content;
}
