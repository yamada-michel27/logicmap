import type { Dispatch, SetStateAction } from 'react';
import type { Node } from 'reactflow';

import type {
  FlowNodeData,
  NodeFormState,
  NodeOption,
  VariableNodeData,
} from '../types';
import { NODE_OPTION_GROUPS } from '../constants';
import { getNodeOptionForNode } from '../utils';
import type { DeclaredVariableInfo } from '../services/flowInteractionService';
import { NodeModalLogicForm } from './NodeModalLogicForm';
import { NodeModalSectionForm } from './NodeModalSectionForm';
import { NodeModalVariableForm } from './NodeModalVariableForm';

export type NodeModalProps = {
  pendingNodeClientPosition: { x: number; y: number } | null;
  pendingNodeEdit: { id: string } | null;
  nodes: Node<FlowNodeData>[];
  nodeForm: NodeFormState;
  setNodeForm: Dispatch<SetStateAction<NodeFormState>>;
  nodeModalOption: NodeOption | null;
  setNodeModalOption: Dispatch<SetStateAction<NodeOption | null>>;
  variableForm: VariableNodeData;
  setVariableForm: Dispatch<SetStateAction<VariableNodeData>>;
  declaredVariables: Map<string, DeclaredVariableInfo>;
  validateTypeCompatibility: (
    targetVariable: string,
    newValue: string
  ) => { isValid: boolean; message?: string };
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
  const isEdit = Boolean(pendingNodeEdit);
  if (!pendingNodeClientPosition && !pendingNodeEdit) return null;

  const editingNode = pendingNodeEdit
    ? nodes.find((node) => node.id === pendingNodeEdit.id) ?? null
    : null;
  const fallbackOption = editingNode ? getNodeOptionForNode(editingNode) : null;
  const selectedOption = nodeModalOption ?? fallbackOption;
  const isSection = selectedOption?.kind === 'section';
  const isVariable = selectedOption?.kind === 'variable' || selectedOption?.kind === 'type';
  const isNormal = selectedOption?.kind === 'normal';
  const isStartOrEnd =
    selectedOption?.kind === 'start' || selectedOption?.kind === 'end';

  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[80vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">
          {isEdit ? 'ノード種別を変更' : 'ノード種別を選択'}
        </h3>
        <p className="mt-1 text-sm text-gray-600">
          {isEdit
            ? '変更したいノード種別を選んでください。'
            : '追加したい要素をノードとセクションから選び、必要な情報を入力してください。'}
        </p>

        <div className="mt-4 grid gap-4">
          {NODE_OPTION_GROUPS.map((group) => (
            <section key={group.id} className="rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-gray-900">{group.label}</div>
                  <p className="mt-1 text-xs text-gray-500">{group.description}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-600">
                  {group.options.length}種
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {group.options.map((option) => (
                  <button
                    key={`${group.id}-${option.kind}-${option.sectionType ?? option.label}`}
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
            </section>
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
                <NodeModalSectionForm
                  isEdit={isEdit}
                  editingNode={editingNode}
                  nodes={nodes}
                  nodeForm={nodeForm}
                  setNodeForm={setNodeForm}
                  sectionType={selectedOption.sectionType!}
                  createClassInstance={createClassInstance}
                />
              ) : isVariable ? (
                <NodeModalVariableForm
                  variableForm={variableForm}
                  setVariableForm={setVariableForm}
                  declaredVariables={declaredVariables}
                  validateTypeCompatibility={validateTypeCompatibility}
                />
              ) : (
                <NodeModalLogicForm
                  isStartOrEnd={isStartOrEnd}
                  isNormal={isNormal}
                  nodeForm={nodeForm}
                  setNodeForm={setNodeForm}
                />
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
}
