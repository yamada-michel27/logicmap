import type { Dispatch, SetStateAction } from 'react';

import { PYTHON_TYPE_OPTIONS } from '../types';
import type {
  PythonType,
  VariableNodeData,
  VariableOperationType,
  VariableScope,
} from '../types';
import type { DeclaredVariableInfo } from '../services/flowInteractionService';
import {
  FieldLabel,
  fieldClassName,
  TextAreaField,
  TextInputField,
} from './NodeModalShared';

type Props = {
  variableForm: VariableNodeData;
  setVariableForm: Dispatch<SetStateAction<VariableNodeData>>;
  declaredVariables: Map<string, DeclaredVariableInfo>;
  validateTypeCompatibility: (
    targetVariable: string,
    newValue: string
  ) => { isValid: boolean; message?: string };
};

function getVariableNamePlaceholder(pythonType?: PythonType) {
  switch (pythonType) {
    case 'bool':
      return '例: is_active, has_access';
    case 'list':
    case 'tuple':
    case 'set':
      return '例: items, user_ids, tags';
    case 'dict':
      return '例: user_map, config';
    default:
      return '例: user_name, count, total';
  }
}

function getValuePlaceholder(pythonType?: PythonType) {
  switch (pythonType) {
    case 'str':
      return '例: "hello"';
    case 'int':
      return '例: 0';
    case 'float':
      return '例: 3.14';
    case 'bool':
      return '例: True';
    case 'list':
      return '例: ["apple", "banana"]';
    case 'tuple':
      return '例: (1, 2)';
    case 'dict':
      return '例: {"name": "Taro"}';
    case 'set':
      return '例: {"admin", "staff"}';
    case 'None':
      return '例: None';
    case 'Optional':
      return '例: None / "guest"';
    case 'Union':
      return '例: "guest", 0, None';
    case 'Any':
      return '例: 任意の値';
    default:
      return '例: value';
  }
}

function getTypeParameterPlaceholder(pythonType?: PythonType) {
  switch (pythonType) {
    case 'list':
      return '例: str, User';
    case 'tuple':
      return '例: int, str';
    case 'set':
      return '例: str, UUID';
    default:
      return '例: str';
  }
}

export function NodeModalVariableForm({
  variableForm,
  setVariableForm,
  declaredVariables,
  validateTypeCompatibility,
}: Props) {
  const assignTargetType = variableForm.targetVariable
    ? declaredVariables.get(variableForm.targetVariable)?.type
    : undefined;
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
                  pythonType:
                    event.target.value === 'declare'
                      ? current.pythonType || 'str'
                      : current.pythonType,
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
                  pythonType:
                    event.target.value === 'assign' ? assignTargetType ?? undefined : current.pythonType,
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
            placeholder={getVariableNamePlaceholder(variableForm.pythonType)}
          />
          <TextInputField
            label="初期値"
            value={variableForm.initialValue || ''}
            onChange={(value) =>
              setVariableForm((current) => ({ ...current, initialValue: value }))
            }
            placeholder={getValuePlaceholder(variableForm.pythonType)}
          />
          {variableForm.pythonType === 'list' ||
          variableForm.pythonType === 'tuple' ||
          variableForm.pythonType === 'set' ? (
            <TextInputField
              label="要素型"
              value={variableForm.elementType || ''}
              onChange={(value) =>
                setVariableForm((current) => ({ ...current, elementType: value }))
              }
              placeholder={getTypeParameterPlaceholder(variableForm.pythonType)}
            />
          ) : null}
          {variableForm.pythonType === 'dict' ? (
            <>
              <TextInputField
                label="キー型"
                value={variableForm.keyType || ''}
                onChange={(value) =>
                  setVariableForm((current) => ({ ...current, keyType: value }))
                }
                placeholder="例: str, int"
              />
              <TextInputField
                label="値型"
                value={variableForm.valueType || ''}
                onChange={(value) =>
                  setVariableForm((current) => ({ ...current, valueType: value }))
                }
                placeholder="例: User, list[str]"
              />
            </>
          ) : null}
          {variableForm.pythonType === 'Optional' ? (
            <TextInputField
              label="内部型"
              value={variableForm.innerType || ''}
              onChange={(value) =>
                setVariableForm((current) => ({ ...current, innerType: value }))
              }
              placeholder="例: str, User"
            />
          ) : null}
          {variableForm.pythonType === 'Union' ? (
            <TextInputField
              label="候補型"
              value={variableForm.unionTypes?.join(', ') || ''}
              onChange={(value) =>
                setVariableForm((current) => ({
                  ...current,
                  unionTypes: value
                    .split(',')
                    .map((type) => type.trim())
                    .filter(Boolean),
                }))
              }
              placeholder="例: str, int, None"
            />
          ) : null}
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
                  pythonType:
                    declaredVariables.get(event.target.value)?.type ?? current.pythonType,
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
                assignTargetType
                  ? `${assignTargetType}型の値を入力（${getValuePlaceholder(assignTargetType)}）`
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
        placeholder={
          variableForm.operationType === 'declare'
            ? 'この変数の用途や制約を入力'
            : '変更理由や更新条件を入力'
        }
      />
    </>
  );
}
