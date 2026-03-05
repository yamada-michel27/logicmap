import { useMemo } from 'react';
import type { Node } from 'reactflow';

import type {
  PythonType,
  VariableOperationType,
  VariableScope,
  VariableNodeData,
  FlowNodeData,
  InnerElement,
  NodeFormState,
  NodeOption,
} from '../types';
import { PYTHON_TYPE_OPTIONS } from '../types';
import { CONTROL_STYLE, NODE_OPTIONS, CATCH_OPTIONS } from '../constants';
import { getNodeOptionForNode, getNodeDisplayLabel, getAvailableInnerElements } from '../utils';

export type NodeModalProps = {
  pendingNodeClientPosition: { x: number; y: number } | null;
  pendingNodeEdit: { id: string } | null;
  nodes: Node<FlowNodeData>[];
  nodeForm: NodeFormState;
  setNodeForm: React.Dispatch<React.SetStateAction<NodeFormState>>;
  nodeModalOption: NodeOption | null;
  setNodeModalOption: React.Dispatch<React.SetStateAction<NodeOption | null>>;
  variableForm: VariableNodeData;
  setVariableForm: React.Dispatch<React.SetStateAction<VariableNodeData>>;
  declaredVariables: Map<string, { type: PythonType; scope: VariableScope; nodeId: string }>;
  validateTypeCompatibility: (targetVariable: string, newValue: string) => { isValid: boolean; message?: string };
  applyNodeCreation: () => void;
  applyNodeEdit: () => void;
  cancelNodeCreation: () => void;
  cancelNodeEdit: () => void;
  createClassInstance: (node: Node<FlowNodeData>) => void;
  openNodeDeleteModal: (node: Node<FlowNodeData>) => void;
};

export default function NodeModal({
  pendingNodeClientPosition,
  pendingNodeEdit,
  nodes,
  nodeForm,
  setNodeForm,
  nodeModalOption,
  setNodeModalOption,
  variableForm,
  setVariableForm,
  declaredVariables,
  validateTypeCompatibility,
  applyNodeCreation,
  applyNodeEdit,
  cancelNodeCreation,
  cancelNodeEdit,
  createClassInstance,
  openNodeDeleteModal,
}: NodeModalProps) {
  const content = useMemo(() => {
    const isEdit = Boolean(pendingNodeEdit);
    if (!pendingNodeClientPosition && !pendingNodeEdit) return null;
    const editingNode = pendingNodeEdit
      ? nodes.find((node) => node.id === pendingNodeEdit.id) ?? null
      : null;
    const fallbackOption = editingNode ? getNodeOptionForNode(editingNode) : null;
    const selectedOption = nodeModalOption ?? fallbackOption;
    const isSection = selectedOption?.kind === 'section';
    const isVariable = selectedOption?.kind === 'variable';
    const isType = selectedOption?.kind === 'type'; // 後方互換性
    const isNormal = selectedOption?.kind === 'normal';
    const isStartOrEnd =
      selectedOption?.kind === 'start' || selectedOption?.kind === 'end';
    const isFunctionSection = isSection && selectedOption?.sectionType === 'function';
    const isClassSection = isSection && selectedOption?.sectionType === 'class';
    const isInterfaceSection = isSection && selectedOption?.sectionType === 'interface';
    const isMainSection = isSection && selectedOption?.sectionType === 'main';
    const isLoopSection =
      isSection &&
      (selectedOption?.sectionType === 'while' || selectedOption?.sectionType === 'for');
    const loopPlaceholder =
      selectedOption?.sectionType === 'for' ? '例: for item in items' : '例: i < 10';
    const isCatchSection = isSection && selectedOption?.sectionType === 'catch';
    const allowSectionValidations =
      isSection &&
      (selectedOption?.sectionType === 'function' ||
        selectedOption?.sectionType === 'class' ||
        selectedOption?.sectionType === 'interface');

    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'ノード種別を変更' : 'ノード種別を選択'}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {isEdit
              ? '変更したいノード種別を選んでください。'
              : '追加したいノードを選び、必要な情報を入力してください。'}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {NODE_OPTIONS.map((option) => (
              <button
                key={`${option.kind}-${option.label}`}
                type="button"
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  selectedOption &&
                  option.kind === selectedOption.kind &&
                  option.sectionType === selectedOption.sectionType
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => setNodeModalOption(option)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="text-xs font-semibold text-gray-700">詳細入力</div>
            {!selectedOption ? (
              <div className="mt-2 text-xs text-gray-500">
                種別を選択してから詳細を入力してください。
              </div>
            ) : (
              <div className="mt-3 grid gap-3">
                {isSection ? (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-gray-700">
                        {isMainSection || isCatchSection ? '表示名' : '表示名（関数名/クラス名）'}
                      </label>
                      <input
                        type="text"
                        value={nodeForm.label}
                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        onChange={(event) =>
                          setNodeForm((current) => ({ ...current, label: event.target.value }))
                        }
                        placeholder={
                          isMainSection
                            ? '例: MainProcess'
                            : isCatchSection
                            ? '例: ErrorHandler'
                            : '例: fetchUser / UserService'
                        }
                      />
                    </div>
                    {isEdit && editingNode && editingNode.type === 'sectionNode' ? (
                      <div>
                        <label className="text-xs font-semibold text-gray-700">最初のノード</label>
                        {nodes.filter(
                          (node) =>
                            node.type === 'logicNode' && node.parentNode === editingNode.id
                        ).length === 0 ? (
                          <div className="mt-2 text-xs text-gray-500">
                            セクション内にノードがありません。
                          </div>
                        ) : (
                          <select
                            value={nodeForm.entryNodeId}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                entryNodeId: event.target.value,
                              }))
                            }
                          >
                            <option value="">未設定</option>
                            {nodes
                              .filter(
                                (node) =>
                                  node.type === 'logicNode' &&
                                  node.parentNode === editingNode.id
                              )
                              .map((node) => (
                                <option key={node.id} value={node.id}>
                                  {getNodeDisplayLabel(node)}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                    ) : null}
                    {isFunctionSection ? (
                      <>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-700">引数</label>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() =>
                                setNodeForm((current) => ({
                                  ...current,
                                  functionArgs: [...current.functionArgs, { name: '', type: '' }],
                                }))
                              }
                            >
                              + 追加
                            </button>
                          </div>
                          {nodeForm.functionArgs.length === 0 ? (
                            <div className="mt-2 text-xs text-gray-500">
                              引数を追加してください。
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-2">
                              {nodeForm.functionArgs.map((arg, index) => (
                                <div
                                  key={`function-arg-${index}`}
                                  className="rounded-md border border-gray-200 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-gray-700">
                                      引数 {index + 1}
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                      onClick={() =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          functionArgs: current.functionArgs.filter(
                                            (_item, argIndex) => argIndex !== index
                                          ),
                                        }))
                                      }
                                    >
                                      削除
                                    </button>
                                  </div>
                                  <div className="mt-2 grid gap-2">
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        引数名
                                      </label>
                                      <input
                                        type="text"
                                        value={arg.name}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            functionArgs: current.functionArgs.map(
                                              (item, argIndex) =>
                                                argIndex === index
                                                  ? { ...item, name: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: userId"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        型
                                      </label>
                                      <input
                                        type="text"
                                        value={arg.type}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            functionArgs: current.functionArgs.map(
                                              (item, argIndex) =>
                                                argIndex === index
                                                  ? { ...item, type: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: string"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">
                            返り値の型
                          </label>
                          <input
                            type="text"
                            value={nodeForm.functionReturnType}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                functionReturnType: event.target.value,
                              }))
                            }
                            placeholder="例: UserResponse"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">返り値</label>
                          <input
                            type="text"
                            value={nodeForm.functionReturnValue}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                functionReturnValue: event.target.value,
                              }))
                            }
                            placeholder="例: user"
                          />
                        </div>
                      </>
                    ) : null}
                    {isClassSection ? (
                      <>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-700">
                              コンストラクタ引数
                            </label>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() =>
                                setNodeForm((current) => ({
                                  ...current,
                                  classConstructorArgs: [
                                    ...current.classConstructorArgs,
                                    { name: '', type: '' },
                                  ],
                                }))
                              }
                            >
                              + 追加
                            </button>
                          </div>
                          {nodeForm.classConstructorArgs.length === 0 ? (
                            <div className="mt-2 text-xs text-gray-500">
                              コンストラクタ引数を追加してください。
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-2">
                              {nodeForm.classConstructorArgs.map((arg, index) => (
                                <div
                                  key={`class-ctor-${index}`}
                                  className="rounded-md border border-gray-200 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-gray-700">
                                      引数 {index + 1}
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                      onClick={() =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          classConstructorArgs:
                                            current.classConstructorArgs.filter(
                                              (_item, argIndex) => argIndex !== index
                                            ),
                                        }))
                                      }
                                    >
                                      削除
                                    </button>
                                  </div>
                                  <div className="mt-2 grid gap-2">
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        引数名
                                      </label>
                                      <input
                                        type="text"
                                        value={arg.name}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            classConstructorArgs:
                                              current.classConstructorArgs.map(
                                                (item, argIndex) =>
                                                  argIndex === index
                                                    ? { ...item, name: event.target.value }
                                                    : item
                                              ),
                                          }))
                                        }
                                        placeholder="例: userId"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        型
                                      </label>
                                      <input
                                        type="text"
                                        value={arg.type}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            classConstructorArgs:
                                              current.classConstructorArgs.map(
                                                (item, argIndex) =>
                                                  argIndex === index
                                                    ? { ...item, type: event.target.value }
                                                    : item
                                              ),
                                          }))
                                        }
                                        placeholder="例: string"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-700">
                              メンバ変数
                            </label>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() =>
                                setNodeForm((current) => ({
                                  ...current,
                                  classMembers: [...current.classMembers, { name: '', type: '' }],
                                }))
                              }
                            >
                              + 追加
                            </button>
                          </div>
                          {nodeForm.classMembers.length === 0 ? (
                            <div className="mt-2 text-xs text-gray-500">
                              メンバ変数を追加してください。
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-2">
                              {nodeForm.classMembers.map((member, index) => (
                                <div
                                  key={`class-member-${index}`}
                                  className="rounded-md border border-gray-200 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-gray-700">
                                      メンバ {index + 1}
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                      onClick={() =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          classMembers: current.classMembers.filter(
                                            (_item, memberIndex) => memberIndex !== index
                                          ),
                                        }))
                                      }
                                    >
                                      削除
                                    </button>
                                  </div>
                                  <div className="mt-2 grid gap-2">
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        変数名
                                      </label>
                                      <input
                                        type="text"
                                        value={member.name}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            classMembers: current.classMembers.map(
                                              (item, memberIndex) =>
                                                memberIndex === index
                                                  ? { ...item, name: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: id"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        型
                                      </label>
                                      <input
                                        type="text"
                                        value={member.type}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            classMembers: current.classMembers.map(
                                              (item, memberIndex) =>
                                                memberIndex === index
                                                  ? { ...item, type: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: string"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {isEdit && editingNode ? (
                          <div>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() => createClassInstance(editingNode)}
                            >
                              + 初期化ノードを追加
                            </button>
                          </div>
                        ) : null}
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-700">
                              メソッド一覧
                            </label>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() =>
                                setNodeForm((current) => ({
                                  ...current,
                                  classMethods: [
                                    ...current.classMethods,
                                    { name: '', args: [], returns: '', note: '' },
                                  ],
                                }))
                              }
                            >
                              + メソッドを追加
                            </button>
                          </div>
                          {nodeForm.classMethods.length === 0 ? (
                            <div className="mt-2 text-xs text-gray-500">
                              メソッドを追加してください。
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-3">
                              {nodeForm.classMethods.map((method, index) => (
                                <div
                                  key={`class-method-${index}`}
                                  className="rounded-md border border-gray-200 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-gray-700">
                                      メソッド {index + 1}
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                      onClick={() =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          classMethods: current.classMethods.filter(
                                            (_item, methodIndex) => methodIndex !== index
                                          ),
                                        }))
                                      }
                                    >
                                      削除
                                    </button>
                                  </div>
                                  <div className="mt-2 grid gap-2">
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                      メソッド名
                                    </label>
                                    <input
                                      type="text"
                                      value={method.name}
                                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            classMethods: current.classMethods.map(
                                              (item, methodIndex) =>
                                                methodIndex === index
                                                  ? { ...item, name: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: fetchUser"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-gray-700">
                                          メソッド引数
                                        </label>
                                        <button
                                          type="button"
                                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                          onClick={() =>
                                            setNodeForm((current) => ({
                                              ...current,
                                              classMethods: current.classMethods.map(
                                                (item, methodIndex) =>
                                                  methodIndex === index
                                                    ? {
                                                        ...item,
                                                        args: [
                                                          ...item.args,
                                                          { name: '', type: '' },
                                                        ],
                                                      }
                                                    : item
                                              ),
                                            }))
                                          }
                                        >
                                          + 追加
                                        </button>
                                      </div>
                                      {method.args.length === 0 ? (
                                        <div className="mt-2 text-xs text-gray-500">
                                          引数を追加してください。
                                        </div>
                                      ) : (
                                        <div className="mt-3 grid gap-2">
                                          {method.args.map((arg, argIndex) => (
                                            <div
                                              key={`class-method-${index}-arg-${argIndex}`}
                                              className="rounded-md border border-gray-200 p-3"
                                            >
                                              <div className="flex items-center justify-between">
                                                <div className="text-xs font-semibold text-gray-700">
                                                  引数 {argIndex + 1}
                                                </div>
                                                <button
                                                  type="button"
                                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                                  onClick={() =>
                                                    setNodeForm((current) => ({
                                                      ...current,
                                                      classMethods: current.classMethods.map(
                                                        (item, methodIndex) =>
                                                          methodIndex === index
                                                            ? {
                                                                ...item,
                                                                args: item.args.filter(
                                                                  (_arg, removeIndex) =>
                                                                    removeIndex !== argIndex
                                                                ),
                                                              }
                                                            : item
                                                      ),
                                                    }))
                                                  }
                                                >
                                                  削除
                                                </button>
                                              </div>
                                              <div className="mt-2 grid gap-2">
                                                <div>
                                                  <label className="text-xs font-semibold text-gray-700">
                                                    引数名
                                                  </label>
                                                  <input
                                                    type="text"
                                                    value={arg.name}
                                                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                    onChange={(event) =>
                                                      setNodeForm((current) => ({
                                                        ...current,
                                                        classMethods: current.classMethods.map(
                                                          (item, methodIndex) =>
                                                            methodIndex === index
                                                              ? {
                                                                  ...item,
                                                                  args: item.args.map(
                                                                    (argItem, itemIndex) =>
                                                                      itemIndex === argIndex
                                                                        ? {
                                                                            ...argItem,
                                                                            name: event.target.value,
                                                                          }
                                                                        : argItem
                                                                  ),
                                                                }
                                                              : item
                                                        ),
                                                      }))
                                                    }
                                                    placeholder="例: id"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-xs font-semibold text-gray-700">
                                                    型
                                                  </label>
                                                  <input
                                                    type="text"
                                                    value={arg.type}
                                                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                    onChange={(event) =>
                                                      setNodeForm((current) => ({
                                                        ...current,
                                                        classMethods: current.classMethods.map(
                                                          (item, methodIndex) =>
                                                            methodIndex === index
                                                              ? {
                                                                  ...item,
                                                                  args: item.args.map(
                                                                    (argItem, itemIndex) =>
                                                                      itemIndex === argIndex
                                                                        ? {
                                                                            ...argItem,
                                                                            type: event.target.value,
                                                                          }
                                                                        : argItem
                                                                  ),
                                                                }
                                                              : item
                                                        ),
                                                      }))
                                                    }
                                                    placeholder="例: string"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        メソッド返り値
                                      </label>
                                      <input
                                        type="text"
                                        value={method.returns}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            classMethods: current.classMethods.map(
                                              (item, methodIndex) =>
                                                methodIndex === index
                                                  ? { ...item, returns: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: User"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        補足コメント
                                      </label>
                                      <textarea
                                        value={method.note}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        rows={2}
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            classMethods: current.classMethods.map(
                                              (item, methodIndex) =>
                                                methodIndex === index
                                                  ? { ...item, note: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: 例外時はnullを返す"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                    {isInterfaceSection ? (
                      <>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-700">プロパティ</label>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() =>
                                setNodeForm((current) => ({
                                  ...current,
                                  interfaceMembers: [
                                    ...current.interfaceMembers,
                                    { name: '', type: '' },
                                  ],
                                }))
                              }
                            >
                              + 追加
                            </button>
                          </div>
                          {nodeForm.interfaceMembers.length === 0 ? (
                            <div className="mt-2 text-xs text-gray-500">
                              プロパティを追加してください。
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-2">
                              {nodeForm.interfaceMembers.map((member, index) => (
                                <div
                                  key={`interface-member-${index}`}
                                  className="rounded-md border border-gray-200 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-gray-700">
                                      プロパティ {index + 1}
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                      onClick={() =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          interfaceMembers: current.interfaceMembers.filter(
                                            (_item, memberIndex) => memberIndex !== index
                                          ),
                                        }))
                                      }
                                    >
                                      削除
                                    </button>
                                  </div>
                                  <div className="mt-2 grid gap-2">
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        名前
                                      </label>
                                      <input
                                        type="text"
                                        value={member.name}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            interfaceMembers: current.interfaceMembers.map(
                                              (item, memberIndex) =>
                                                memberIndex === index
                                                  ? { ...item, name: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: id"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        型
                                      </label>
                                      <input
                                        type="text"
                                        value={member.type}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            interfaceMembers: current.interfaceMembers.map(
                                              (item, memberIndex) =>
                                                memberIndex === index
                                                  ? { ...item, type: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: string"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-700">
                              メソッド一覧
                            </label>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() =>
                                setNodeForm((current) => ({
                                  ...current,
                                  interfaceMethods: [
                                    ...current.interfaceMethods,
                                    { name: '', args: [], returns: '', note: '' },
                                  ],
                                }))
                              }
                            >
                              + メソッドを追加
                            </button>
                          </div>
                          {nodeForm.interfaceMethods.length === 0 ? (
                            <div className="mt-2 text-xs text-gray-500">
                              メソッドを追加してください。
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-3">
                              {nodeForm.interfaceMethods.map((method, index) => (
                                <div
                                  key={`interface-method-${index}`}
                                  className="rounded-md border border-gray-200 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-gray-700">
                                      メソッド {index + 1}
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                      onClick={() =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          interfaceMethods: current.interfaceMethods.filter(
                                            (_item, methodIndex) => methodIndex !== index
                                          ),
                                        }))
                                      }
                                    >
                                      削除
                                    </button>
                                  </div>
                                  <div className="mt-2 grid gap-2">
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        メソッド名
                                      </label>
                                      <input
                                        type="text"
                                        value={method.name}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            interfaceMethods: current.interfaceMethods.map(
                                              (item, methodIndex) =>
                                                methodIndex === index
                                                  ? { ...item, name: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: fetchUser"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-gray-700">
                                          メソッド引数
                                        </label>
                                        <button
                                          type="button"
                                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                          onClick={() =>
                                            setNodeForm((current) => ({
                                              ...current,
                                              interfaceMethods: current.interfaceMethods.map(
                                                (item, methodIndex) =>
                                                  methodIndex === index
                                                    ? {
                                                        ...item,
                                                        args: [
                                                          ...item.args,
                                                          { name: '', type: '' },
                                                        ],
                                                      }
                                                    : item
                                              ),
                                            }))
                                          }
                                        >
                                          + 追加
                                        </button>
                                      </div>
                                      {method.args.length === 0 ? (
                                        <div className="mt-2 text-xs text-gray-500">
                                          引数を追加してください。
                                        </div>
                                      ) : (
                                        <div className="mt-3 grid gap-2">
                                          {method.args.map((arg, argIndex) => (
                                            <div
                                              key={`interface-method-${index}-arg-${argIndex}`}
                                              className="rounded-md border border-gray-200 p-3"
                                            >
                                              <div className="flex items-center justify-between">
                                                <div className="text-xs font-semibold text-gray-700">
                                                  引数 {argIndex + 1}
                                                </div>
                                                <button
                                                  type="button"
                                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                                  onClick={() =>
                                                    setNodeForm((current) => ({
                                                      ...current,
                                                      interfaceMethods: current.interfaceMethods.map(
                                                        (item, methodIndex) =>
                                                          methodIndex === index
                                                            ? {
                                                                ...item,
                                                                args: item.args.filter(
                                                                  (_arg, removeIndex) =>
                                                                    removeIndex !== argIndex
                                                                ),
                                                              }
                                                            : item
                                                      ),
                                                    }))
                                                  }
                                                >
                                                  削除
                                                </button>
                                              </div>
                                              <div className="mt-2 grid gap-2">
                                                <div>
                                                  <label className="text-xs font-semibold text-gray-700">
                                                    引数名
                                                  </label>
                                                  <input
                                                    type="text"
                                                    value={arg.name}
                                                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                    onChange={(event) =>
                                                      setNodeForm((current) => ({
                                                        ...current,
                                                        interfaceMethods: current.interfaceMethods.map(
                                                          (item, methodIndex) =>
                                                            methodIndex === index
                                                              ? {
                                                                  ...item,
                                                                  args: item.args.map(
                                                                    (argItem, itemIndex) =>
                                                                      itemIndex === argIndex
                                                                        ? {
                                                                            ...argItem,
                                                                            name: event.target.value,
                                                                          }
                                                                        : argItem
                                                                  ),
                                                                }
                                                              : item
                                                        ),
                                                      }))
                                                    }
                                                    placeholder="例: id"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-xs font-semibold text-gray-700">
                                                    型
                                                  </label>
                                                  <input
                                                    type="text"
                                                    value={arg.type}
                                                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                    onChange={(event) =>
                                                      setNodeForm((current) => ({
                                                        ...current,
                                                        interfaceMethods: current.interfaceMethods.map(
                                                          (item, methodIndex) =>
                                                            methodIndex === index
                                                              ? {
                                                                  ...item,
                                                                  args: item.args.map(
                                                                    (argItem, itemIndex) =>
                                                                      itemIndex === argIndex
                                                                        ? {
                                                                            ...argItem,
                                                                            type: event.target.value,
                                                                          }
                                                                        : argItem
                                                                  ),
                                                                }
                                                              : item
                                                        ),
                                                      }))
                                                    }
                                                    placeholder="例: string"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        メソッド返り値
                                      </label>
                                      <input
                                        type="text"
                                        value={method.returns}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            interfaceMethods: current.interfaceMethods.map(
                                              (item, methodIndex) =>
                                                methodIndex === index
                                                  ? { ...item, returns: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: User"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        補足コメント
                                      </label>
                                      <textarea
                                        value={method.note}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        rows={2}
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            interfaceMethods: current.interfaceMethods.map(
                                              (item, methodIndex) =>
                                                methodIndex === index
                                                  ? { ...item, note: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: optional"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                    {isLoopSection ? (
                      <div>
                        <label className="text-xs font-semibold text-gray-700">条件式</label>
                        <input
                          type="text"
                          value={nodeForm.loopCondition}
                          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                          onChange={(event) =>
                            setNodeForm((current) => ({
                              ...current,
                              loopCondition: event.target.value,
                            }))
                          }
                          placeholder={loopPlaceholder}
                        />
                      </div>
                    ) : null}
                    {isCatchSection ? (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">例外種別</label>
                          <select
                            value={nodeForm.catchExceptionType}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                catchExceptionType: event.target.value,
                              }))
                            }
                          >
                            <option value="">選択してください</option>
                            {CATCH_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {nodeForm.catchExceptionType === 'other' ? (
                          <div>
                            <label className="text-xs font-semibold text-gray-700">
                              例外詳細
                            </label>
                            <input
                              type="text"
                              value={nodeForm.catchExceptionOther}
                              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                              onChange={(event) =>
                                setNodeForm((current) => ({
                                  ...current,
                                  catchExceptionOther: event.target.value,
                                }))
                              }
                              placeholder="例: UserNotFoundException"
                            />
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    {allowSectionValidations ? (
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-700">validation</label>
                          <button
                            type="button"
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            onClick={() =>
                              setNodeForm((current) => ({
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
                        {nodeForm.validations.length === 0 ? (
                          <div className="mt-2 text-xs text-gray-500">
                            validationを追加してください。
                          </div>
                        ) : (
                          <div className="mt-3 grid gap-3">
                            {nodeForm.validations.map((rule, index) => (
                              <div
                                key={`section-validation-${index}`}
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
                                      setNodeForm((current) => ({
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
                                    <label className="text-xs font-semibold text-gray-700">
                                      対象
                                    </label>
                                    <input
                                      type="text"
                                      value={rule.target}
                                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                      onChange={(event) =>
                                        setNodeForm((current) => ({
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
                                    <label className="text-xs font-semibold text-gray-700">
                                      ルール
                                    </label>
                                    <input
                                      type="text"
                                      value={rule.rule}
                                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                      onChange={(event) =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          validations: current.validations.map((item, ruleIndex) =>
                                            ruleIndex === index
                                              ? { ...item, rule: event.target.value }
                                              : item
                                          ),
                                        }))
                                      }
                                      placeholder="例: required"
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
                                        setNodeForm((current) => ({
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
                    ) : null}
                    {isMainSection ? null : (
                      <div>
                        <label className="text-xs font-semibold text-gray-700">補足コメント</label>
                        <textarea
                          value={nodeForm.note}
                          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                          rows={3}
                          onChange={(event) =>
                            setNodeForm((current) => ({ ...current, note: event.target.value }))
                          }
                          placeholder="補足コメントを入力"
                        />
                      </div>
                    )}

                    {/* Phase7: 内部要素管理UI */}
                    {isSection && !isEdit && selectedOption.sectionType && (
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-700">内部要素</label>
                          <select
                            value=""
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50"
                            onChange={(event) => {
                              const value = event.target.value;
                              if (!value) return;

                              const [type, subType] = value.split(':');
                              const availableElements = getAvailableInnerElements(selectedOption.sectionType!);
                              const selected = availableElements.find(el =>
                                el.type === type &&
                                (type === 'section' ? el.sectionType === subType : el.nodeKind === subType)
                              );

                              if (selected) {
                                const newElement: InnerElement = {
                                  id: `inner-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                                  type: selected.type,
                                  sectionType: selected.sectionType,
                                  nodeKind: selected.nodeKind,
                                  label: selected.label,
                                  order: nodeForm.innerElements.length,
                                };

                                setNodeForm((current) => ({
                                  ...current,
                                  innerElements: [...current.innerElements, newElement],
                                }));
                              }

                              // selectの値をリセット
                              event.target.value = '';
                            }}
                          >
                            <option value="">+ 要素を追加</option>
                            {getAvailableInnerElements(selectedOption.sectionType).map((element) => (
                              <option
                                key={`${element.type}-${element.sectionType || element.nodeKind}`}
                                value={`${element.type}:${element.sectionType || element.nodeKind}`}
                              >
                                {element.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        {nodeForm.innerElements.length === 0 ? (
                          <div className="mt-2 text-xs text-gray-500">
                            このセクション内に追加する要素を選択してください。要素は指定した順序でフローが接続されます。
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2">
                            {nodeForm.innerElements
                              .sort((a, b) => a.order - b.order)
                              .map((element, index) => (
                              <div
                                key={element.id}
                                className="flex items-center justify-between rounded-md border border-gray-200 p-2"
                              >
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs font-mono text-gray-500">
                                    {index + 1}.
                                  </span>
                                  <span className="text-sm font-medium text-gray-900">
                                    {element.label}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    ({element.type === 'section' ? 'セクション' : 'ノード'})
                                  </span>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {/* 順序変更ボタン */}
                                  <button
                                    type="button"
                                    className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                    disabled={index === 0}
                                    onClick={() => {
                                      const newElements = [...nodeForm.innerElements];
                                      const currentIndex = newElements.findIndex(el => el.id === element.id);
                                      if (currentIndex > 0) {
                                        [newElements[currentIndex], newElements[currentIndex - 1]] =
                                        [newElements[currentIndex - 1], newElements[currentIndex]];
                                        // orderを再設定
                                        newElements.forEach((el, idx) => el.order = idx);
                                        setNodeForm(current => ({ ...current, innerElements: newElements }));
                                      }
                                    }}
                                  >
                                    ↑
                                  </button>
                                  <button
                                    type="button"
                                    className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
                                    disabled={index === nodeForm.innerElements.length - 1}
                                    onClick={() => {
                                      const newElements = [...nodeForm.innerElements];
                                      const currentIndex = newElements.findIndex(el => el.id === element.id);
                                      if (currentIndex < newElements.length - 1) {
                                        [newElements[currentIndex], newElements[currentIndex + 1]] =
                                        [newElements[currentIndex + 1], newElements[currentIndex]];
                                        // orderを再設定
                                        newElements.forEach((el, idx) => el.order = idx);
                                        setNodeForm(current => ({ ...current, innerElements: newElements }));
                                      }
                                    }}
                                  >
                                    ↓
                                  </button>
                                  {/* 削除ボタン */}
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                    onClick={() =>
                                      setNodeForm((current) => ({
                                        ...current,
                                        innerElements: current.innerElements.filter(el => el.id !== element.id),
                                      }))
                                    }
                                  >
                                    削除
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                ) : (isVariable || isType) ? (
                  <>
                    {/* Phase8: 変数操作モード選択 */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700">操作タイプ</label>
                      <div className="mt-2 flex space-x-4">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="declare"
                            checked={variableForm.operationType === 'declare'}
                            onChange={(e) => setVariableForm(prev => ({
                              ...prev,
                              operationType: e.target.value as VariableOperationType
                            }))}
                            className="mr-2"
                          />
                          <span className="text-sm">宣言 (新規作成)</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            value="assign"
                            checked={variableForm.operationType === 'assign'}
                            onChange={(e) => setVariableForm(prev => ({
                              ...prev,
                              operationType: e.target.value as VariableOperationType
                            }))}
                            className="mr-2"
                          />
                          <span className="text-sm">変更 (既存変数)</span>
                        </label>
                      </div>
                    </div>

                    {/* 宣言モード用UI */}
                    {variableForm.operationType === 'declare' && (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">Python型</label>
                          <select
                            value={variableForm.pythonType || 'str'}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setVariableForm((current) => ({
                                ...current,
                                pythonType: event.target.value as PythonType
                              }))
                            }
                          >
                            {PYTHON_TYPE_OPTIONS.map(option => (
                              <option key={option.id} value={option.id}>{option.name} - {option.description}</option>
                        ))}
                      </select>
                    </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">変数名</label>
                          <input
                            type="text"
                            value={variableForm.variableName || ''}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setVariableForm((current) => ({
                                ...current,
                                variableName: event.target.value
                              }))
                            }
                            placeholder="例: user_name, count, items"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-gray-700">初期値</label>
                          <input
                            type="text"
                            value={variableForm.initialValue || ''}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setVariableForm((current) => ({
                                ...current,
                                initialValue: event.target.value
                              }))
                            }
                            placeholder={
                              variableForm.pythonType === 'str' ? '例: "hello"' :
                              variableForm.pythonType === 'int' ? '例: 0' :
                              variableForm.pythonType === 'list' ? '例: []' :
                              variableForm.pythonType === 'dict' ? '例: {}' :
                              '例: None'
                            }
                          />
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-gray-700">スコープ</label>
                          <select
                            value={variableForm.scope || 'global'}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setVariableForm((current) => ({
                                ...current,
                                scope: event.target.value as VariableScope
                              }))
                            }
                          >
                            <option value="global">グローバル</option>
                            <option value="local">ローカル</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* 変更モード用UI */}
                    {variableForm.operationType === 'assign' && (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">変更対象の変数</label>
                          <select
                            value={variableForm.targetVariable || ''}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setVariableForm((current) => ({
                                ...current,
                                targetVariable: event.target.value
                              }))
                            }
                          >
                            <option value="">変数を選択してください</option>
                            {Array.from(declaredVariables.entries()).map(([varName, varInfo]) => (
                              <option key={varName} value={varName}>
                                {varName} ({varInfo.type}) - {varInfo.scope}
                              </option>
                            ))}
                          </select>
                          {declaredVariables.size === 0 && (
                            <div className="mt-1 text-xs text-red-600">
                              宣言済みの変数がありません。先に変数を宣言してください。
                            </div>
                          )}
                        </div>

                        <div>
                          <label className="text-xs font-semibold text-gray-700">新しい値</label>
                          {(() => {
                            const validation = variableForm.targetVariable && variableForm.newValue
                              ? validateTypeCompatibility(variableForm.targetVariable, variableForm.newValue)
                              : { isValid: true };

                            return (
                              <>
                                <input
                                  type="text"
                                  value={variableForm.newValue || ''}
                                  className={`mt-2 w-full rounded-md border px-3 py-2 text-sm text-gray-900 ${
                                    validation.isValid ? 'border-gray-300' : 'border-red-500 bg-red-50'
                                  }`}
                                  onChange={(event) =>
                                    setVariableForm((current) => ({
                                      ...current,
                                      newValue: event.target.value
                                    }))
                                  }
                                  placeholder={variableForm.targetVariable
                                    ? `${declaredVariables.get(variableForm.targetVariable)?.type}型の値を入力`
                                    : "新しい値を入力"
                                  }
                                />
                                {!validation.isValid && validation.message && (
                                  <div className="mt-1 text-xs text-red-600">
                                    ❌ {validation.message}
                                  </div>
                                )}
                                {validation.isValid && variableForm.newValue && variableForm.targetVariable && (
                                  <div className="mt-1 text-xs text-green-600">
                                    ✅ 有効な{declaredVariables.get(variableForm.targetVariable)?.type}型の値です
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </>
                    )}

                    {/* 共通: 補足コメント */}
                    <div>
                      <label className="text-xs font-semibold text-gray-700">補足コメント</label>
                      <textarea
                        value={variableForm.note || ''}
                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        rows={3}
                        onChange={(event) =>
                          setVariableForm((current) => ({ ...current, note: event.target.value }))
                        }
                        placeholder="変数の使用目的や注意点を入力"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {!isStartOrEnd ? (
                      <div>
                        <label className="text-xs font-semibold text-gray-700">ノード文字列</label>
                        <input
                          type="text"
                          value={nodeForm.label}
                          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                          onChange={(event) =>
                            setNodeForm((current) => ({ ...current, label: event.target.value }))
                          }
                          placeholder="表示したい文字列"
                        />
                      </div>
                    ) : null}
                    {isNormal ? (
                      <div>
                        <label className="text-xs font-semibold text-gray-700">条件式</label>
                        <input
                          type="text"
                          value={nodeForm.condition}
                          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                          onChange={(event) =>
                            setNodeForm((current) => ({
                              ...current,
                              condition: event.target.value,
                            }))
                          }
                          placeholder="例: i < 10"
                        />
                      </div>
                    ) : null}
                    <div>
                      <label className="text-xs font-semibold text-gray-700">補足コメント</label>
                      <textarea
                        value={nodeForm.note}
                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        rows={3}
                        onChange={(event) =>
                          setNodeForm((current) => ({ ...current, note: event.target.value }))
                        }
                        placeholder="補足コメントを入力"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            {isEdit && editingNode ? (
              <button
                type="button"
                className="mr-auto rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                onClick={() => openNodeDeleteModal(editingNode)}
              >
                削除する
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={isEdit ? cancelNodeEdit : cancelNodeCreation}
            >
              キャンセル
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-semibold text-white ${
                selectedOption ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-300'
              }`}
              onClick={isEdit ? applyNodeEdit : applyNodeCreation}
              disabled={!selectedOption}
            >
              {isEdit ? '保存する' : '追加する'}
            </button>
          </div>
        </div>
      </div>
    );
  }, [
    applyNodeCreation,
    applyNodeEdit,
    cancelNodeCreation,
    cancelNodeEdit,
    createClassInstance,
    nodeForm.classConstructorArgs,
    nodeForm.classMembers,
    nodeForm.classMethods,
    nodeForm.catchExceptionOther,
    nodeForm.catchExceptionType,
    nodeForm.condition,
    nodeForm.functionArgs,
    nodeForm.functionReturnValue,
    nodeForm.functionReturnType,
    nodeForm.interfaceMembers,
    nodeForm.interfaceMethods,
    nodeForm.label,
    nodeForm.loopCondition,
    nodeForm.note,
    nodeForm.entryNodeId,
    nodeForm.validations,
    nodeModalOption,
    nodes,
    openNodeDeleteModal,
    pendingNodeClientPosition,
    pendingNodeEdit,
  ]);

  return content;
}
