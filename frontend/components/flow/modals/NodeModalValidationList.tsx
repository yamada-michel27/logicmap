import type { Dispatch, SetStateAction } from 'react';

import type { NodeFormState, ValidationRule } from '../types';
import {
  cardClassName,
  dangerTextButtonClassName,
  EmptyMessage,
  FieldLabel,
  fieldClassName,
  secondaryButtonClassName,
} from './NodeModalShared';

type Props = {
  nodeForm: NodeFormState;
  setNodeForm: Dispatch<SetStateAction<NodeFormState>>;
};

export function NodeModalValidationList({ nodeForm, setNodeForm }: Props) {
  const validations = nodeForm.validations as ValidationRule[];

  const updateValidations = (updater: (current: ValidationRule[]) => ValidationRule[]) => {
    setNodeForm((current) => ({
      ...current,
      validations: updater(current.validations),
    }));
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <FieldLabel>validation</FieldLabel>
        <button
          type="button"
          className={secondaryButtonClassName}
          onClick={() =>
            updateValidations((current) => [
              ...current,
              { target: '', rule: '', message: '' },
            ])
          }
        >
          + 追加
        </button>
      </div>
      {validations.length === 0 ? (
        <EmptyMessage>validationを追加してください。</EmptyMessage>
      ) : (
        <div className="mt-3 grid gap-3">
          {validations.map((rule, index) => (
            <div key={`section-validation-${index}`} className={cardClassName}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-700">
                  validation {index + 1}
                </div>
                <button
                  type="button"
                  className={dangerTextButtonClassName}
                  onClick={() =>
                    updateValidations((current) =>
                      current.filter((_currentRule, currentIndex) => currentIndex !== index)
                    )
                  }
                >
                  削除
                </button>
              </div>
              <div className="mt-2 grid gap-2">
                <div>
                  <FieldLabel>対象</FieldLabel>
                  <input
                    type="text"
                    value={rule.target}
                    className={fieldClassName}
                    onChange={(event) =>
                      updateValidations((current) =>
                        current.map((currentRule, currentIndex) =>
                          currentIndex === index
                            ? { ...currentRule, target: event.target.value }
                            : currentRule
                        )
                      )
                    }
                    placeholder="例: input.age"
                  />
                </div>
                <div>
                  <FieldLabel>ルール</FieldLabel>
                  <input
                    type="text"
                    value={rule.rule}
                    className={fieldClassName}
                    onChange={(event) =>
                      updateValidations((current) =>
                        current.map((currentRule, currentIndex) =>
                          currentIndex === index
                            ? { ...currentRule, rule: event.target.value }
                            : currentRule
                        )
                      )
                    }
                    placeholder="例: required"
                  />
                </div>
                <div>
                  <FieldLabel>メッセージ/補足</FieldLabel>
                  <input
                    type="text"
                    value={rule.message}
                    className={fieldClassName}
                    onChange={(event) =>
                      updateValidations((current) =>
                        current.map((currentRule, currentIndex) =>
                          currentIndex === index
                            ? { ...currentRule, message: event.target.value }
                            : currentRule
                        )
                      )
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
  );
}
