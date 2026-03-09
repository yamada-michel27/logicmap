import type { Dispatch, SetStateAction } from 'react';

import type { ClassMethod, NodeFormState } from '../types';
import {
  cardClassName,
  dangerTextButtonClassName,
  EmptyMessage,
  FieldLabel,
  fieldClassName,
  secondaryButtonClassName,
} from './NodeModalShared';

type MethodListKey = 'classMethods' | 'interfaceMethods';

type Props = {
  fieldKey: MethodListKey;
  label: string;
  emptyMessage: string;
  notePlaceholder: string;
  nodeForm: NodeFormState;
  setNodeForm: Dispatch<SetStateAction<NodeFormState>>;
};

export function NodeModalMethodList({
  fieldKey,
  label,
  emptyMessage,
  notePlaceholder,
  nodeForm,
  setNodeForm,
}: Props) {
  const methods = nodeForm[fieldKey] as ClassMethod[];

  const updateMethods = (updater: (current: ClassMethod[]) => ClassMethod[]) => {
    setNodeForm((current) => ({
      ...current,
      [fieldKey]: updater(current[fieldKey] as ClassMethod[]),
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
            updateMethods((current) => [
              ...current,
              { name: '', args: [], returns: '', note: '' },
            ])
          }
        >
          + メソッドを追加
        </button>
      </div>
      {methods.length === 0 ? (
        <EmptyMessage>{emptyMessage}</EmptyMessage>
      ) : (
        <div className="mt-3 grid gap-3">
          {methods.map((method, index) => (
            <div key={`${fieldKey}-${index}`} className={cardClassName}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-700">
                  メソッド {index + 1}
                </div>
                <button
                  type="button"
                  className={dangerTextButtonClassName}
                  onClick={() =>
                    updateMethods((current) =>
                      current.filter((_currentMethod, currentIndex) => currentIndex !== index)
                    )
                  }
                >
                  削除
                </button>
              </div>
              <div className="mt-2 grid gap-2">
                <div>
                  <FieldLabel>メソッド名</FieldLabel>
                  <input
                    type="text"
                    value={method.name}
                    className={fieldClassName}
                    onChange={(event) =>
                      updateMethods((current) =>
                        current.map((currentMethod, currentIndex) =>
                          currentIndex === index
                            ? { ...currentMethod, name: event.target.value }
                            : currentMethod
                        )
                      )
                    }
                    placeholder="例: fetchUser"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <FieldLabel>メソッド引数</FieldLabel>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() =>
                        updateMethods((current) =>
                          current.map((currentMethod, currentIndex) =>
                            currentIndex === index
                              ? {
                                  ...currentMethod,
                                  args: [...currentMethod.args, { name: '', type: '' }],
                                }
                              : currentMethod
                          )
                        )
                      }
                    >
                      + 追加
                    </button>
                  </div>
                  {method.args.length === 0 ? (
                    <EmptyMessage>引数を追加してください。</EmptyMessage>
                  ) : (
                    <div className="mt-3 grid gap-2">
                      {method.args.map((arg, argIndex) => (
                        <div
                          key={`${fieldKey}-${index}-arg-${argIndex}`}
                          className={cardClassName}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-xs font-semibold text-gray-700">
                              引数 {argIndex + 1}
                            </div>
                            <button
                              type="button"
                              className={dangerTextButtonClassName}
                              onClick={() =>
                                updateMethods((current) =>
                                  current.map((currentMethod, currentIndex) =>
                                    currentIndex === index
                                      ? {
                                          ...currentMethod,
                                          args: currentMethod.args.filter(
                                            (_currentArg, currentArgIndex) =>
                                              currentArgIndex !== argIndex
                                          ),
                                        }
                                      : currentMethod
                                  )
                                )
                              }
                            >
                              削除
                            </button>
                          </div>
                          <div className="mt-2 grid gap-2">
                            <div>
                              <FieldLabel>引数名</FieldLabel>
                              <input
                                type="text"
                                value={arg.name}
                                className={fieldClassName}
                                onChange={(event) =>
                                  updateMethods((current) =>
                                    current.map((currentMethod, currentIndex) =>
                                      currentIndex === index
                                        ? {
                                            ...currentMethod,
                                            args: currentMethod.args.map(
                                              (currentArg, currentArgIndex) =>
                                                currentArgIndex === argIndex
                                                  ? {
                                                      ...currentArg,
                                                      name: event.target.value,
                                                    }
                                                  : currentArg
                                            ),
                                          }
                                        : currentMethod
                                    )
                                  )
                                }
                                placeholder="例: id"
                              />
                            </div>
                            <div>
                              <FieldLabel>型</FieldLabel>
                              <input
                                type="text"
                                value={arg.type}
                                className={fieldClassName}
                                onChange={(event) =>
                                  updateMethods((current) =>
                                    current.map((currentMethod, currentIndex) =>
                                      currentIndex === index
                                        ? {
                                            ...currentMethod,
                                            args: currentMethod.args.map(
                                              (currentArg, currentArgIndex) =>
                                                currentArgIndex === argIndex
                                                  ? {
                                                      ...currentArg,
                                                      type: event.target.value,
                                                    }
                                                  : currentArg
                                            ),
                                          }
                                        : currentMethod
                                    )
                                  )
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
                  <FieldLabel>メソッド返り値</FieldLabel>
                  <input
                    type="text"
                    value={method.returns}
                    className={fieldClassName}
                    onChange={(event) =>
                      updateMethods((current) =>
                        current.map((currentMethod, currentIndex) =>
                          currentIndex === index
                            ? { ...currentMethod, returns: event.target.value }
                            : currentMethod
                        )
                      )
                    }
                    placeholder="例: User"
                  />
                </div>
                <div>
                  <FieldLabel>補足コメント</FieldLabel>
                  <textarea
                    value={method.note}
                    className={fieldClassName}
                    rows={2}
                    onChange={(event) =>
                      updateMethods((current) =>
                        current.map((currentMethod, currentIndex) =>
                          currentIndex === index
                            ? { ...currentMethod, note: event.target.value }
                            : currentMethod
                        )
                      )
                    }
                    placeholder={notePlaceholder}
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
