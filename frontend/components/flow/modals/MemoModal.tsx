import { FloatingEditorPanel } from './FloatingEditorPanel';

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
  const isEdit = Boolean(pendingMemoEdit);
  if (!pendingMemoClientPosition && !pendingMemoEdit) return null;

  return (
    <FloatingEditorPanel
      title={isEdit ? 'メモを編集' : 'メモを追加'}
      description={
        isEdit ? 'メモ内容を変更できます。' : 'フロウ上に貼り付けるメモを入力してください。'
      }
      widthClassName="sm:w-[24rem]"
      footer={
        <div className="flex items-center justify-end gap-2">
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
      }
    >
      <div>
        <label className="text-xs font-semibold text-slate-700">本文</label>
        <textarea
          value={memoText}
          className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
          rows={6}
          onChange={(event) => setMemoText(event.target.value)}
          placeholder="メモを入力"
        />
      </div>
    </FloatingEditorPanel>
  );
}
