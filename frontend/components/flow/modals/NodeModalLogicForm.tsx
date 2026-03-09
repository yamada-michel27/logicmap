import type { Dispatch, SetStateAction } from 'react';

import type { NodeFormState, NodeKind } from '../types';
import { TextAreaField, TextInputField } from './NodeModalShared';

type Props = {
  nodeKind: NodeKind;
  nodeForm: NodeFormState;
  setNodeForm: Dispatch<SetStateAction<NodeFormState>>;
};

function getPrimaryFieldConfig(nodeKind: NodeKind) {
  switch (nodeKind) {
    case 'normal':
      return { label: '処理内容', placeholder: '例: total += price' };
    case 'return':
      return { label: '戻り値', placeholder: '例: user' };
    case 'break':
      return { label: 'break 条件・理由', placeholder: '例: 条件を満たしたので終了' };
    case 'continue':
      return { label: 'continue 条件・理由', placeholder: '例: 無効データは次へ進む' };
    default:
      return null;
  }
}

function getNotePlaceholder(nodeKind: NodeKind) {
  switch (nodeKind) {
    case 'start':
      return '開始時の前提や初期条件を入力';
    case 'end':
      return '終了時の状態や結果を入力';
    case 'return':
      return '返却意図や補足を入力';
    case 'break':
    case 'continue':
      return '分岐理由や補足を入力';
    default:
      return '補足コメントを入力';
  }
}

export function NodeModalLogicForm({
  nodeKind,
  nodeForm,
  setNodeForm,
}: Props) {
  const primaryFieldConfig = getPrimaryFieldConfig(nodeKind);

  return (
    <>
      {primaryFieldConfig ? (
        <TextInputField
          label={primaryFieldConfig.label}
          value={nodeForm.label}
          onChange={(value) =>
            setNodeForm((current) => ({ ...current, label: value }))
          }
          placeholder={primaryFieldConfig.placeholder}
        />
      ) : null}
      {nodeKind === 'normal' ? (
        <TextInputField
          label="条件式（任意）"
          value={nodeForm.condition}
          onChange={(value) =>
            setNodeForm((current) => ({ ...current, condition: value }))
          }
          placeholder="例: total > limit"
        />
      ) : null}
      <TextAreaField
        label="補足コメント"
        value={nodeForm.note}
        onChange={(value) =>
          setNodeForm((current) => ({ ...current, note: value }))
        }
        placeholder={getNotePlaceholder(nodeKind)}
      />
    </>
  );
}
