import type { Dispatch, SetStateAction } from 'react';

import type { VariableNodeData } from '../types';
import type { DeclaredVariableInfo } from '../services/flowInteractionService';
import { FloatingEditorPanel } from './FloatingEditorPanel';
import { NodeModalVariableForm } from './NodeModalVariableForm';

export type VariableModalProps = {
  pendingVariableEdit: { id: string } | null;
  variableForm: VariableNodeData;
  setVariableForm: Dispatch<SetStateAction<VariableNodeData>>;
  declaredVariables: Map<string, DeclaredVariableInfo>;
  validateTypeCompatibility: (
    targetVariable: string,
    newValue: string
  ) => { isValid: boolean; message?: string };
  cancelVariableEdit: () => void;
  applyVariableEdit: () => void;
};

export default function VariableModal({
  pendingVariableEdit,
  variableForm,
  setVariableForm,
  declaredVariables,
  validateTypeCompatibility,
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
        <NodeModalVariableForm
          variableForm={variableForm}
          setVariableForm={setVariableForm}
          declaredVariables={declaredVariables}
          validateTypeCompatibility={validateTypeCompatibility}
        />
      </div>
    </FloatingEditorPanel>
  );
}
