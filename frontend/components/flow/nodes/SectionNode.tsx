import { useCallback, useMemo } from 'react';
import { Handle, Position, useNodes, type Node, type NodeProps } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';
import { CONTROL_STYLE, SECTION_MIN_WIDTH, SECTION_MIN_HEIGHT } from '../constants';
import { formatTypedFields, formatValidationRules } from '../utils';
import type { FlowNodeData, SectionNodeData } from '../types';

const SECTION_RESIZE_PADDING_X = 32;
const SECTION_RESIZE_PADDING_BOTTOM = 40;

function getNodeSize(node: Node<FlowNodeData>) {
  const width =
    node.width ?? (typeof node.style?.width === 'number' ? node.style.width : undefined);
  const height =
    node.height ?? (typeof node.style?.height === 'number' ? node.style.height : undefined);

  if (!width || !height) {
    return null;
  }

  return { width, height };
}

function getSectionMinimumSize(nodes: Node<FlowNodeData>[], sectionId: string) {
  return nodes
    .filter((node) => node.parentNode === sectionId)
    .reduce(
      (minimum, childNode) => {
        const size = getNodeSize(childNode);
        if (!size) {
          return minimum;
        }

        return {
          width: Math.max(
            minimum.width,
            Math.max(0, childNode.position.x) + size.width + SECTION_RESIZE_PADDING_X
          ),
          height: Math.max(
            minimum.height,
            Math.max(0, childNode.position.y) + size.height + SECTION_RESIZE_PADDING_BOTTOM
          ),
        };
      },
      {
        width: SECTION_MIN_WIDTH,
        height: SECTION_MIN_HEIGHT,
      }
    );
}

export function SectionNode({ id, data, selected }: NodeProps<SectionNodeData>) {
  const nodes = useNodes<FlowNodeData>();
  const style = CONTROL_STYLE[data.sectionType] || CONTROL_STYLE.flow;
  const currentNode = useMemo(() => nodes.find((node) => node.id === id), [id, nodes]);
  const minimumSize = useMemo(() => getSectionMinimumSize(nodes, id), [id, nodes]);
  const shouldResize = useCallback(
    (_event: unknown, params: { width: number; height: number; x: number; y: number }) => {
      if (params.width < minimumSize.width || params.height < minimumSize.height) {
        return false;
      }

      if (currentNode?.parentNode && (params.x < 0 || params.y < 0)) {
        return false;
      }

      return true;
    },
    [currentNode?.parentNode, minimumSize.height, minimumSize.width]
  );
  const details: { label: string; value: string }[] = [];
  if (data.sectionType === 'function') {
    const args = formatTypedFields(data.functionArgs);
    if (args.length > 0) {
      details.push({ label: '引数', value: args.join('\n') });
    }
    const returns = data.functionReturnType?.trim() ?? '';
    if (returns.length > 0) {
      details.push({ label: '返り値の型', value: returns });
    }
    const returnValue = data.functionReturnValue?.trim() ?? '';
    if (returnValue.length > 0) {
      details.push({ label: '返り値', value: returnValue });
    }
  }
  if (data.sectionType === 'class') {
    const ctorArgs = formatTypedFields(data.classConstructorArgs);
    if (ctorArgs.length > 0) {
      details.push({ label: 'コンストラクタ引数', value: ctorArgs.join('\n') });
    }
    const members = formatTypedFields(data.classMembers);
    if (members.length > 0) {
      details.push({ label: 'メンバ変数', value: members.join('\n') });
    }
    if (data.classMethods && data.classMethods.length > 0) {
      data.classMethods.forEach((method, index) => {
        const lines: string[] = [];
        if (method.name && method.name.trim().length > 0) {
          lines.push(`名前: ${method.name}`);
        }
        const methodArgs = formatTypedFields(method.args);
        if (methodArgs.length > 0) {
          lines.push(`引数:\n${methodArgs.join('\n')}`);
        }
        if (method.returns && method.returns.trim().length > 0) {
          lines.push(`返り値: ${method.returns}`);
        }
        if (method.note && method.note.trim().length > 0) {
          lines.push(`補足: ${method.note}`);
        }
        if (lines.length > 0) {
          details.push({ label: `メソッド${index + 1}`, value: lines.join('\n') });
        }
      });
    }
  }
  if (data.sectionType === 'interface') {
    const members = formatTypedFields(data.interfaceMembers);
    if (members.length > 0) {
      details.push({ label: 'プロパティ', value: members.join('\n') });
    }
    if (data.interfaceMethods && data.interfaceMethods.length > 0) {
      data.interfaceMethods.forEach((method, index) => {
        const lines: string[] = [];
        if (method.name && method.name.trim().length > 0) {
          lines.push(`名前: ${method.name}`);
        }
        const methodArgs = formatTypedFields(method.args);
        if (methodArgs.length > 0) {
          lines.push(`引数:\n${methodArgs.join('\n')}`);
        }
        if (method.returns && method.returns.trim().length > 0) {
          lines.push(`返り値: ${method.returns}`);
        }
        if (method.note && method.note.trim().length > 0) {
          lines.push(`補足: ${method.note}`);
        }
        if (lines.length > 0) {
          details.push({ label: `メソッド${index + 1}`, value: lines.join('\n') });
        }
      });
    }
  }
  if (data.sectionType === 'while' || data.sectionType === 'for') {
    const loopCondition = data.loopCondition?.trim() ?? '';
    if (loopCondition.length > 0) {
      details.push({ label: '条件式', value: loopCondition });
    }
  }
  if (data.sectionType === 'catch') {
    const exceptionValue = data.catchException?.trim() ?? '';
    if (exceptionValue.length > 0) {
      details.push({ label: '例外種別', value: exceptionValue });
    }
  }
  if (
    data.sectionType === 'function' ||
    data.sectionType === 'class' ||
    data.sectionType === 'interface'
  ) {
    const validationLines = formatValidationRules(data.validations);
    if (validationLines.length > 0) {
      details.push({ label: 'validation', value: validationLines.join('\n') });
    }
  }
  if (data.sectionType !== 'main' && data.note && data.note.trim().length > 0) {
    details.push({ label: '補足', value: data.note });
  }
  return (
    <div
      className="relative h-full w-full rounded-xl border-2 border-dashed p-3 text-sm text-slate-800"
      style={{
        borderColor: style.color,
        backgroundColor: 'transparent',
        pointerEvents: 'none'
      }}
    >
      <NodeResizer
        isVisible={selected}
        color={style.color}
        minWidth={minimumSize.width}
        minHeight={minimumSize.height}
        shouldResize={shouldResize}
        handleStyle={{ pointerEvents: 'auto', zIndex: 20 }}
        lineStyle={{ pointerEvents: 'auto', zIndex: 20 }}
      />
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: style.color, pointerEvents: 'auto' }}>
        {style.label}
      </div>
      {data.label && data.label.trim().length > 0 ? (
        <div className="mt-1 text-sm font-semibold text-gray-900 whitespace-pre-wrap" style={{ pointerEvents: 'auto' }}>
          {data.label}
        </div>
      ) : null}
      {details.length > 0 ? (
        <div className="mt-2 space-y-1 text-xs text-gray-700" style={{ pointerEvents: 'auto' }}>
          {details.map((item, index) => (
            <div key={`${item.label}-${index}`} className="whitespace-pre-wrap">
              <span className="font-semibold">{item.label}:</span> {item.value}
            </div>
          ))}
        </div>
      ) : null}
      <Handle type="source" position={Position.Left} id="section-h-left" />
      <Handle type="source" position={Position.Right} id="section-h-right" />
      <Handle type="source" position={Position.Top} id="section-h-top" />
      <Handle type="source" position={Position.Bottom} id="section-h-bottom" />
    </div>
  );
}
