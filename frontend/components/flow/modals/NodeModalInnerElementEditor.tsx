import type { Dispatch, SetStateAction } from 'react';

import type { InnerElement, NodeFormState, SectionType } from '../types';
import { getAvailableInnerElements } from '../utils';
import {
  dangerTextButtonClassName,
  EmptyMessage,
  FieldLabel,
  secondaryButtonClassName,
} from './NodeModalShared';

type Props = {
  sectionType: SectionType;
  nodeForm: NodeFormState;
  setNodeForm: Dispatch<SetStateAction<NodeFormState>>;
};

export function NodeModalInnerElementEditor({
  sectionType,
  nodeForm,
  setNodeForm,
}: Props) {
  const addInnerElement = (eventValue: string) => {
    if (!eventValue) return;

    const [type, subType] = eventValue.split(':');
    const availableElements = getAvailableInnerElements(sectionType);
    const selected = availableElements.find(
      (element) =>
        element.type === type &&
        (type === 'section'
          ? element.sectionType === subType
          : element.nodeKind === subType)
    );

    if (!selected) return;

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
  };

  const updateInnerElements = (updater: (current: InnerElement[]) => InnerElement[]) => {
    setNodeForm((current) => ({
      ...current,
      innerElements: updater(current.innerElements),
    }));
  };

  const sortedElements = [...nodeForm.innerElements].sort((a, b) => a.order - b.order);

  return (
    <div>
      <div className="flex items-center justify-between">
        <FieldLabel>内部要素</FieldLabel>
        <select
          value=""
          className={secondaryButtonClassName}
          onChange={(event) => {
            addInnerElement(event.target.value);
            event.target.value = '';
          }}
        >
          <option value="">+ 要素を追加</option>
          {getAvailableInnerElements(sectionType).map((element) => (
            <option
              key={`${element.type}-${element.sectionType || element.nodeKind}`}
              value={`${element.type}:${element.sectionType || element.nodeKind}`}
            >
              {element.label}
            </option>
          ))}
        </select>
      </div>
      {sortedElements.length === 0 ? (
        <EmptyMessage>
          このセクション内に追加する要素を選択してください。要素は指定した順序でフローが接続されます。
        </EmptyMessage>
      ) : (
        <div className="mt-3 space-y-2">
          {sortedElements.map((element, index) => (
            <div
              key={element.id}
              className="flex items-center justify-between rounded-md border border-gray-200 p-2"
            >
              <div className="flex items-center space-x-2">
                <span className="text-xs font-mono text-gray-500">{index + 1}.</span>
                <span className="text-sm font-medium text-gray-900">{element.label}</span>
                <span className="text-xs text-gray-500">
                  ({element.type === 'section' ? 'セクション' : 'ノード'})
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  disabled={index === 0}
                  onClick={() =>
                    updateInnerElements((current) => {
                      const nextElements = [...current];
                      const currentIndex = nextElements.findIndex(
                        (currentElement) => currentElement.id === element.id
                      );
                      if (currentIndex > 0) {
                        [nextElements[currentIndex], nextElements[currentIndex - 1]] = [
                          nextElements[currentIndex - 1],
                          nextElements[currentIndex],
                        ];
                        nextElements.forEach((currentElement, nextIndex) => {
                          currentElement.order = nextIndex;
                        });
                      }
                      return nextElements;
                    })
                  }
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-50"
                  disabled={index === sortedElements.length - 1}
                  onClick={() =>
                    updateInnerElements((current) => {
                      const nextElements = [...current];
                      const currentIndex = nextElements.findIndex(
                        (currentElement) => currentElement.id === element.id
                      );
                      if (currentIndex < nextElements.length - 1) {
                        [nextElements[currentIndex], nextElements[currentIndex + 1]] = [
                          nextElements[currentIndex + 1],
                          nextElements[currentIndex],
                        ];
                        nextElements.forEach((currentElement, nextIndex) => {
                          currentElement.order = nextIndex;
                        });
                      }
                      return nextElements;
                    })
                  }
                >
                  ↓
                </button>
                <button
                  type="button"
                  className={dangerTextButtonClassName}
                  onClick={() =>
                    updateInnerElements((current) =>
                      current.filter((currentElement) => currentElement.id !== element.id)
                    )
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
  );
}
