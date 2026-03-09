import type { Connection, Edge } from 'reactflow';

import type {
  EdgeControlType,
  EdgeFormState,
  LogicEdgeData,
} from '../types';
import { EDGE_CONTROL_OPTIONS } from '../types';
import { CONTROL_STYLE } from '../constants';
import { getIfControlOptions, getConditionMeta } from '../utils';

export type EdgeModalProps = {
  pendingConnection: Connection | null;
  pendingEdgeEdit: { id: string } | null;
  edges: Edge<LogicEdgeData>[];
  selectedEdgeControl: EdgeControlType;
  edgeForm: EdgeFormState;
  setEdgeForm: React.Dispatch<React.SetStateAction<EdgeFormState>>;
  onEdgeControlChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  applySelectedControl: () => void;
  cancelConnection: () => void;
  closeEdgeModal: () => void;
  deleteEdgeById: (edgeId: string) => void;
};

export default function EdgeModal({
  pendingConnection,
  pendingEdgeEdit,
  edges,
  selectedEdgeControl,
  edgeForm,
  setEdgeForm,
  onEdgeControlChange,
  applySelectedControl,
  cancelConnection,
  closeEdgeModal,
  deleteEdgeById,
}: EdgeModalProps) {
  const isEdit = Boolean(pendingEdgeEdit);
  if (!pendingConnection && !pendingEdgeEdit) return null;

  const editingEdge = pendingEdgeEdit
    ? edges.find((edge) => edge.id === pendingEdgeEdit.id) ?? null
    : null;
  const sourceId = pendingConnection?.source ?? editingEdge?.source ?? null;
  const ifOptions = getIfControlOptions(
    sourceId,
    edges,
    editingEdge?.id ?? null,
    editingEdge?.data?.controlType ?? null
  );
  const availableEdgeControls = EDGE_CONTROL_OPTIONS.filter((type) => {
    if (type === 'if' || type === 'elif' || type === 'else') {
      return ifOptions.includes(type);
    }
    return true;
  });
  const conditionMeta = getConditionMeta(selectedEdgeControl);

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md max-h-[80vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">
          {isEdit ? 'エッジを編集' : '制御構文を選択'}
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          {isEdit
            ? 'エッジの制御構文を変更できます。'
            : '接続したエッジの制御構文を選んでください。キャンセルすると接続は破棄されます。'}
        </p>
        <div className="mt-4">
          <label className="text-xs font-semibold text-gray-700">エッジ種別</label>
          <select
            value={selectedEdgeControl}
            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            onChange={onEdgeControlChange}
          >
            {availableEdgeControls.map((type) => {
              const controlStyle = CONTROL_STYLE[type] || CONTROL_STYLE.flow;
              return (
                <option key={type} value={type}>
                  {controlStyle.modalLabel ?? controlStyle.label}
                </option>
              );
            })}
          </select>
        </div>
        <div className="mt-4 grid gap-3">
          {conditionMeta ? (
            <div>
              <label className="text-xs font-semibold text-gray-700">
                {conditionMeta.label}
              </label>
              <input
                type="text"
                value={edgeForm.condition}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                onChange={(event) =>
                  setEdgeForm((current) => ({ ...current, condition: event.target.value }))
                }
                placeholder={conditionMeta.placeholder}
              />
            </div>
          ) : null}
          <div>
            <label className="text-xs font-semibold text-gray-700">補足コメント</label>
            <textarea
              value={edgeForm.note}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              rows={3}
              onChange={(event) =>
                setEdgeForm((current) => ({ ...current, note: event.target.value }))
              }
              placeholder="補足コメントを入力"
            />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-700">validation</label>
              <button
                type="button"
                className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() =>
                  setEdgeForm((current) => ({
                    ...current,
                    validations: [
                      ...current.validations,
                      { target: '', rule: '', message: '' },
                    ],
                  }))
                }
              >
                + 追加
              </button>
            </div>
            {edgeForm.validations.length === 0 ? (
              <div className="mt-2 text-xs text-gray-500">validationを追加してください。</div>
            ) : (
              <div className="mt-3 grid gap-3">
                {edgeForm.validations.map((rule, index) => (
                  <div
                    key={`edge-validation-${index}`}
                    className="rounded-md border border-gray-200 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-gray-700">
                        validation {index + 1}
                      </div>
                      <button
                        type="button"
                        className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                        onClick={() =>
                          setEdgeForm((current) => ({
                            ...current,
                            validations: current.validations.filter(
                              (_item, ruleIndex) => ruleIndex !== index
                            ),
                          }))
                        }
                      >
                        削除
                      </button>
                    </div>
                    <div className="mt-2 grid gap-2">
                      <div>
                        <label className="text-xs font-semibold text-gray-700">対象</label>
                        <input
                          type="text"
                          value={rule.target}
                          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                          onChange={(event) =>
                            setEdgeForm((current) => ({
                              ...current,
                              validations: current.validations.map((item, ruleIndex) =>
                                ruleIndex === index
                                  ? { ...item, target: event.target.value }
                                  : item
                              ),
                            }))
                          }
                          placeholder="例: input.age"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700">ルール</label>
                        <input
                          type="text"
                          value={rule.rule}
                          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                          onChange={(event) =>
                            setEdgeForm((current) => ({
                              ...current,
                              validations: current.validations.map((item, ruleIndex) =>
                                ruleIndex === index
                                  ? { ...item, rule: event.target.value }
                                  : item
                              ),
                            }))
                          }
                          placeholder="例: > 0"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700">
                          メッセージ/補足
                        </label>
                        <input
                          type="text"
                          value={rule.message}
                          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                          onChange={(event) =>
                            setEdgeForm((current) => ({
                              ...current,
                              validations: current.validations.map((item, ruleIndex) =>
                                ruleIndex === index
                                  ? { ...item, message: event.target.value }
                                  : item
                              ),
                            }))
                          }
                          placeholder="例: 必須入力"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          {isEdit ? (
            <button
              type="button"
              className="mr-auto rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              onClick={() => {
                if (!pendingEdgeEdit) return;
                deleteEdgeById(pendingEdgeEdit.id);
              }}
            >
              削除する
            </button>
          ) : null}
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            onClick={isEdit ? closeEdgeModal : cancelConnection}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            onClick={applySelectedControl}
          >
            適用
          </button>
        </div>
      </div>
    </div>
  );
}
