import type { Dispatch, SetStateAction } from 'react';

import type {
  PythonType,
  VariableOperationType,
  VariableNodeData,
} from '../types';
import { PYTHON_TYPE_OPTIONS } from '../types';
import { FloatingEditorPanel } from './FloatingEditorPanel';

export type VariableModalProps = {
  pendingVariableEdit: { id: string } | null;
  variableForm: VariableNodeData;
  setVariableForm: Dispatch<SetStateAction<VariableNodeData>>;
  cancelVariableEdit: () => void;
  applyVariableEdit: () => void;
};

export default function VariableModal({
  pendingVariableEdit,
  variableForm,
  setVariableForm,
  cancelVariableEdit,
  applyVariableEdit,
}: VariableModalProps) {
  if (!pendingVariableEdit) return null;

  return (
    <FloatingEditorPanel
      title="変数ノードを編集"
      description="変数の宣言または変更の詳細設定を行えます。"
      widthClassName="sm:w-[26rem]"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            onClick={cancelVariableEdit}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            onClick={applyVariableEdit}
          >
            保存する
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="text-xs font-semibold text-gray-700">操作タイプ</label>
          <div className="mt-2 flex flex-wrap gap-4">
            <label className="flex items-center">
              <input
                type="radio"
                value="declare"
                checked={variableForm.operationType === 'declare'}
                onChange={(event) =>
                  setVariableForm((prev) => ({
                    ...prev,
                    operationType: event.target.value as VariableOperationType,
                  }))
                }
                className="mr-2"
              />
              <span className="text-sm">宣言 (新規作成)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="assign"
                checked={variableForm.operationType === 'assign'}
                onChange={(event) =>
                  setVariableForm((prev) => ({
                    ...prev,
                    operationType: event.target.value as VariableOperationType,
                  }))
                }
                className="mr-2"
              />
              <span className="text-sm">変更 (既存変数)</span>
            </label>
          </div>
        </div>

        {variableForm.operationType === 'declare' ? (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-700">Python型</label>
              <select
                value={variableForm.pythonType || 'str'}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                onChange={(event) =>
                  setVariableForm((prev) => ({
                    ...prev,
                    pythonType: event.target.value as PythonType,
                  }))
                }
              >
                {PYTHON_TYPE_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} - {option.description}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">変数名</label>
              <input
                type="text"
                value={variableForm.variableName || ''}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                placeholder="例: user_name"
                onChange={(event) =>
                  setVariableForm((prev) => ({
                    ...prev,
                    variableName: event.target.value,
                  }))
                }
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">初期値</label>
              <input
                type="text"
                value={variableForm.initialValue || ''}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                placeholder="例: 'デフォルト値'"
                onChange={(event) =>
                  setVariableForm((prev) => ({
                    ...prev,
                    initialValue: event.target.value,
                  }))
                }
              />
            </div>

            {(variableForm.pythonType === 'list' ||
              variableForm.pythonType === 'tuple' ||
              variableForm.pythonType === 'set') && (
              <div>
                <label className="text-xs font-semibold text-gray-700">要素型</label>
                <input
                  type="text"
                  value={variableForm.elementType || ''}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  placeholder="例: str, int, Any"
                  onChange={(event) =>
                    setVariableForm((prev) => ({
                      ...prev,
                      elementType: event.target.value,
                    }))
                  }
                />
              </div>
            )}

            {variableForm.pythonType === 'dict' && (
              <>
                <div>
                  <label className="text-xs font-semibold text-gray-700">キー型</label>
                  <input
                    type="text"
                    value={variableForm.keyType || ''}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    placeholder="例: str, int"
                    onChange={(event) =>
                      setVariableForm((prev) => ({
                        ...prev,
                        keyType: event.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-700">値型</label>
                  <input
                    type="text"
                    value={variableForm.valueType || ''}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    placeholder="例: Any, List[str]"
                    onChange={(event) =>
                      setVariableForm((prev) => ({
                        ...prev,
                        valueType: event.target.value,
                      }))
                    }
                  />
                </div>
              </>
            )}

            {variableForm.pythonType === 'Optional' && (
              <div>
                <label className="text-xs font-semibold text-gray-700">内部型</label>
                <input
                  type="text"
                  value={variableForm.innerType || ''}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  placeholder="例: str, int, List[str]"
                  onChange={(event) =>
                    setVariableForm((prev) => ({
                      ...prev,
                      innerType: event.target.value,
                    }))
                  }
                />
              </div>
            )}

            {variableForm.pythonType === 'Union' && (
              <div>
                <label className="text-xs font-semibold text-gray-700">
                  型リスト（カンマ区切り）
                </label>
                <input
                  type="text"
                  value={variableForm.unionTypes?.join(', ') || ''}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  placeholder="例: str, int, None"
                  onChange={(event) =>
                    setVariableForm((prev) => ({
                      ...prev,
                      unionTypes: event.target.value
                        .split(',')
                        .map((type) => type.trim())
                        .filter((type) => type),
                    }))
                  }
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-gray-700">補足</label>
              <textarea
                value={variableForm.note || ''}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                rows={3}
                placeholder="説明や用途などを入力"
                onChange={(event) =>
                  setVariableForm((prev) => ({
                    ...prev,
                    note: event.target.value,
                  }))
                }
              />
            </div>
          </>
        ) : (
          <>
            <div>
              <label className="text-xs font-semibold text-gray-700">変数名</label>
              <input
                type="text"
                value={variableForm.variableName || ''}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                placeholder="既存変数名を入力"
                onChange={(event) =>
                  setVariableForm((prev) => ({
                    ...prev,
                    variableName: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">新しい値</label>
              <input
                type="text"
                value={variableForm.newValue || ''}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                placeholder="例: '新しい値'"
                onChange={(event) =>
                  setVariableForm((prev) => ({
                    ...prev,
                    newValue: event.target.value,
                  }))
                }
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">補足</label>
              <textarea
                value={variableForm.note || ''}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                rows={3}
                placeholder="変更理由や説明を入力"
                onChange={(event) =>
                  setVariableForm((prev) => ({
                    ...prev,
                    note: event.target.value,
                  }))
                }
              />
            </div>
          </>
        )}
      </div>
    </FloatingEditorPanel>
  );
}
