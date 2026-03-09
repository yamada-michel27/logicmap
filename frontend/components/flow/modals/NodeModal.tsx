import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { Node } from 'reactflow';

import type {
  FlowNodeData,
  NodeKind,
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
import { FloatingEditorPanel } from './FloatingEditorPanel';

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
  const [view, setView] = useState<'select' | 'detail'>('select');

  useEffect(() => {
    if (!pendingNodeClientPosition && !pendingNodeEdit) return;
    setView(isEdit ? 'detail' : 'select');
  }, [isEdit, pendingNodeClientPosition, pendingNodeEdit]);

  if (!pendingNodeClientPosition && !pendingNodeEdit) return null;

  const editingNode = pendingNodeEdit
    ? nodes.find((node) => node.id === pendingNodeEdit.id) ?? null
    : null;
  const fallbackOption = editingNode ? getNodeOptionForNode(editingNode) : null;
  const selectedOption = nodeModalOption ?? fallbackOption;
  const isSection = selectedOption?.kind === 'section';
  const isVariable = selectedOption?.kind === 'variable' || selectedOption?.kind === 'type';
  const logicNodeKind: NodeKind | null =
    selectedOption &&
    selectedOption.kind !== 'section' &&
    selectedOption.kind !== 'variable' &&
    selectedOption.kind !== 'type'
      ? selectedOption.kind
      : null;
  const showDetailView = view === 'detail' && Boolean(selectedOption);
  const panelTitle = showDetailView
    ? isEdit
      ? `${selectedOption?.label} を編集`
      : `${selectedOption?.label} を追加`
    : isEdit
    ? 'ノード種別を変更'
    : 'ノード種別を選択';
  const panelDescription = showDetailView
    ? '対象の設定項目を入力してください。'
    : isEdit
    ? '変更したいノード種別を選んでください。'
    : '追加したい要素を選ぶと、詳細設定へ進みます。';

  return (
    <FloatingEditorPanel
      title={panelTitle}
      description={panelDescription}
      widthClassName="sm:w-[30rem]"
      footer={
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            {showDetailView ? (
              <button
                type="button"
                className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                onClick={() => setView('select')}
              >
                戻る
              </button>
            ) : null}
            {isEdit && editingNode && showDetailView ? (
              <button
                type="button"
                className="rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                onClick={() => openNodeDeleteModal(editingNode)}
              >
                削除する
              </button>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={isEdit ? cancelNodeEdit : cancelNodeCreation}
            >
              キャンセル
            </button>
            {showDetailView ? (
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
            ) : null}
          </div>
        </div>
      }
    >
      {!showDetailView ? (
        <div className="grid gap-3">
          {NODE_OPTION_GROUPS.map((group) => (
            <section key={group.id} className="rounded-xl border border-slate-200/80 bg-white p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-slate-900">{group.label}</div>
                  <p className="mt-1 text-xs text-slate-500">{group.description}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                  {group.options.length}種
                </span>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2">
                {group.options.map((option) => (
                  <button
                    key={`${group.id}-${option.kind}-${option.sectionType ?? option.label}`}
                    type="button"
                    className={`flex items-center justify-between rounded-lg border px-3 py-3 text-left text-sm font-semibold ${
                      selectedOption &&
                      option.kind === selectedOption.kind &&
                      option.sectionType === selectedOption.sectionType
                        ? 'border-slate-900 bg-slate-900 text-white'
                        : 'border-slate-200 text-slate-900 hover:bg-slate-50'
                    }`}
                    onClick={() => {
                      setNodeModalOption(option);
                      setView('detail');
                    }}
                  >
                    <span>{option.label}</span>
                    <span className="text-xs opacity-70">詳細へ</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : !selectedOption ? null : (
        <div className="grid gap-3">
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
          ) : logicNodeKind ? (
            <NodeModalLogicForm
              nodeKind={logicNodeKind}
              nodeForm={nodeForm}
              setNodeForm={setNodeForm}
            />
          ) : null}
        </div>
      )}
    </FloatingEditorPanel>
  );
}
