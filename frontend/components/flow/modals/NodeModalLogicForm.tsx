import type { Dispatch, SetStateAction } from 'react';

import type { NodeFormState } from '../types';
import { TextAreaField, TextInputField } from './NodeModalShared';

type Props = {
  isStartOrEnd: boolean;
  isNormal: boolean;
  nodeForm: NodeFormState;
  setNodeForm: Dispatch<SetStateAction<NodeFormState>>;
};

export function NodeModalLogicForm({
  isStartOrEnd,
  isNormal,
  nodeForm,
  setNodeForm,
}: Props) {
  return (
    <>
      {isStartOrEnd ? null : (
        <TextInputField
          label="ノード文字列"
          value={nodeForm.label}
          onChange={(value) =>
            setNodeForm((current) => ({ ...current, label: value }))
          }
          placeholder="表示したい文字列"
        />
      )}
      {isNormal ? (
        <TextInputField
          label="条件式"
          value={nodeForm.condition}
          onChange={(value) =>
            setNodeForm((current) => ({ ...current, condition: value }))
          }
          placeholder="例: i < 10"
        />
      ) : null}
      <TextAreaField
        label="補足コメント"
        value={nodeForm.note}
        onChange={(value) =>
          setNodeForm((current) => ({ ...current, note: value }))
        }
        placeholder="補足コメントを入力"
      />
    </>
  );
}
