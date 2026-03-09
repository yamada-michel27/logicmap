import type { Dispatch, SetStateAction } from 'react';

import { PYTHON_TYPE_OPTIONS } from '../types';
import type {
  PythonType,
  VariableNodeData,
  VariableOperationType,
  VariableScope,
} from '../types';
import {
  FieldLabel,
  fieldClassName,
  TextAreaField,
  TextInputField,
} from './NodeModalShared';

type Props = {
  variableForm: VariableNodeData;
  setVariableForm: Dispatch<SetStateAction<VariableNodeData>>;
  declaredVariables: Map<string, { type: PythonType; scope: VariableScope; nodeId: string }>;
  validateTypeCompatibility: (
    targetVariable: string,
    newValue: string
  ) => { isValid: boolean; message?: string };
};

export function NodeModalVariableForm({
  variableForm,
  setVariableForm,
  declaredVariables,
  validateTypeCompatibility,
}: Props) {
  const validation =
    variableForm.operationType === 'assign' &&
    variableForm.targetVariable &&
    variableForm.newValue
      ? validateTypeCompatibility(variableForm.targetVariable, variableForm.newValue)
      : { isValid: true };
  const valueFieldClassName = `mt-2 w-full rounded-md border px-3 py-2 text-sm text-gray-900 ${
    validation.isValid ? 'border-gray-300' : 'border-red-500 bg-red-50'
  }`;

  return (
    <>
      <div>
        <FieldLabel>操作タイプ</FieldLabel>
        <div className="mt-2 flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="declare"
              checked={variableForm.operationType === 'declare'}
              onChange={(event) =>
                setVariableForm((current) => ({
                  ...current,
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
                setVariableForm((current) => ({
                  ...current,
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
            <FieldLabel>Python型</FieldLabel>
            <select
              value={variableForm.pythonType || 'str'}
              className={fieldClassName}
              onChange={(event) =>
                setVariableForm((current) => ({
                  ...current,
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
          <TextInputField
            label="変数名"
            value={variableForm.variableName || ''}
            onChange={(value) =>
              setVariableForm((current) => ({ ...current, variableName: value }))
            }
            placeholder="例: user_name, count, items"
          />
          <TextInputField
            label="初期値"
            value={variableForm.initialValue || ''}
            onChange={(value) =>
              setVariableForm((current) => ({ ...current, initialValue: value }))
            }
            placeholder={
              variableForm.pythonType === 'str'
                ? '例: "hello"'
                : variableForm.pythonType === 'int'
                ? '例: 0'
                : variableForm.pythonType === 'list'
                ? '例: []'
                : variableForm.pythonType === 'dict'
                ? '例: {}'
                : '例: None'
            }
          />
          <div>
            <FieldLabel>スコープ</FieldLabel>
            <select
              value={variableForm.scope || 'global'}
              className={fieldClassName}
              onChange={(event) =>
                setVariableForm((current) => ({
                  ...current,
                  scope: event.target.value as VariableScope,
                }))
              }
            >
              <option value="global">グローバル</option>
              <option value="local">ローカル</option>
            </select>
          </div>
        </>
      ) : (
        <>
          <div>
            <FieldLabel>変更対象の変数</FieldLabel>
            <select
              value={variableForm.targetVariable || ''}
              className={fieldClassName}
              onChange={(event) =>
                setVariableForm((current) => ({
                  ...current,
                  targetVariable: event.target.value,
                }))
              }
            >
              <option value="">変数を選択してください</option>
              {Array.from(declaredVariables.entries()).map(([variableName, variableInfo]) => (
                <option key={variableName} value={variableName}>
                  {variableName} ({variableInfo.type}) - {variableInfo.scope}
                </option>
              ))}
            </select>
            {declaredVariables.size === 0 ? (
              <div className="mt-1 text-xs text-red-600">
                宣言済みの変数がありません。先に変数を宣言してください。
              </div>
            ) : null}
          </div>
          <div>
            <FieldLabel>新しい値</FieldLabel>
            <input
              type="text"
              value={variableForm.newValue || ''}
              className={valueFieldClassName}
              onChange={(event) =>
                setVariableForm((current) => ({
                  ...current,
                  newValue: event.target.value,
                }))
              }
              placeholder={
                variableForm.targetVariable
                  ? `${declaredVariables.get(variableForm.targetVariable)?.type}型の値を入力`
                  : '新しい値を入力'
              }
            />
            {!validation.isValid && validation.message ? (
              <div className="mt-1 text-xs text-red-600">❌ {validation.message}</div>
            ) : null}
            {validation.isValid &&
            variableForm.newValue &&
            variableForm.targetVariable ? (
              <div className="mt-1 text-xs text-green-600">
                ✅ 有効な{declaredVariables.get(variableForm.targetVariable)?.type}型の値です
              </div>
            ) : null}
          </div>
        </>
      )}

      <TextAreaField
        label="補足コメント"
        value={variableForm.note || ''}
        onChange={(value) =>
          setVariableForm((current) => ({ ...current, note: value }))
        }
        placeholder="変数の使用目的や注意点を入力"
      />
    </>
  );
}
