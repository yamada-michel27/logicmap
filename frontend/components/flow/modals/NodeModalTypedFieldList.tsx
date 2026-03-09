import type { Dispatch, SetStateAction } from 'react';

import type { NodeFormState, TypedField } from '../types';
import {
  cardClassName,
  dangerTextButtonClassName,
  EmptyMessage,
  FieldLabel,
  fieldClassName,
  secondaryButtonClassName,
} from './NodeModalShared';

type TypedFieldListKey =
  | 'functionArgs'
  | 'classConstructorArgs'
  | 'classMembers'
  | 'interfaceMembers';

type Props = {
  fieldKey: TypedFieldListKey;
  label: string;
  itemLabel: string;
  emptyMessage: string;
  nameLabel: string;
  typeLabel: string;
  namePlaceholder: string;
  typePlaceholder: string;
  nodeForm: NodeFormState;
  setNodeForm: Dispatch<SetStateAction<NodeFormState>>;
};

export function NodeModalTypedFieldList({
  fieldKey,
  label,
  itemLabel,
  emptyMessage,
  nameLabel,
  typeLabel,
  namePlaceholder,
  typePlaceholder,
  nodeForm,
  setNodeForm,
}: Props) {
  const items = nodeForm[fieldKey] as TypedField[];

  const updateItems = (updater: (current: TypedField[]) => TypedField[]) => {
    setNodeForm((current) => ({
      ...current,
      [fieldKey]: updater(current[fieldKey] as TypedField[]),
    }) as NodeFormState);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <button
          type="button"
          className={secondaryButtonClassName}
          onClick={() =>
            updateItems((current) => [...current, { name: '', type: '' }])
          }
        >
          + 追加
        </button>
      </div>
      {items.length === 0 ? (
        <EmptyMessage>{emptyMessage}</EmptyMessage>
      ) : (
        <div className="mt-3 grid gap-2">
          {items.map((item, index) => (
            <div key={`${fieldKey}-${index}`} className={cardClassName}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-700">
                  {itemLabel} {index + 1}
                </div>
                <button
                  type="button"
                  className={dangerTextButtonClassName}
                  onClick={() =>
                    updateItems((current) =>
                      current.filter((_currentItem, currentIndex) => currentIndex !== index)
                    )
                  }
                >
                  削除
                </button>
              </div>
              <div className="mt-2 grid gap-2">
                <div>
                  <FieldLabel>{nameLabel}</FieldLabel>
                  <input
                    type="text"
                    value={item.name}
                    className={fieldClassName}
                    onChange={(event) =>
                      updateItems((current) =>
                        current.map((currentItem, currentIndex) =>
                          currentIndex === index
                            ? { ...currentItem, name: event.target.value }
                            : currentItem
                        )
                      )
                    }
                    placeholder={namePlaceholder}
                  />
                </div>
                <div>
                  <FieldLabel>{typeLabel}</FieldLabel>
                  <input
                    type="text"
                    value={item.type}
                    className={fieldClassName}
                    onChange={(event) =>
                      updateItems((current) =>
                        current.map((currentItem, currentIndex) =>
                          currentIndex === index
                            ? { ...currentItem, type: event.target.value }
                            : currentItem
                        )
                      )
                    }
                    placeholder={typePlaceholder}
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
