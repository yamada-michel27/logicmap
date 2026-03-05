'use client';

import { Handle, Position, type NodeProps } from 'reactflow';

import type { LogicNodeData } from '../types';
import { CONTROL_STYLE } from '../constants';
import { toRgba, getBaseNodeTint } from '../utils';

export function LogicNode({ data }: NodeProps<LogicNodeData>) {
  const controlStyle = data.controlType ? CONTROL_STYLE[data.controlType] : null;
  const label =
    data.label ?? (data.nodeKind === 'start' ? 'Start' : data.nodeKind === 'end' ? 'End' : '');
  const borderColor = controlStyle?.color ?? '#1f2937';
  const nodeBg = controlStyle?.nodeBg ?? getBaseNodeTint(data.nodeKind);
  const showLabel = label.length > 0;

  return (
    <div
      className="rounded-md border-2 px-5 py-4 min-w-[160px] min-h-[72px] text-base font-medium text-slate-900 backdrop-blur-md shadow-lg ring-1 ring-white/40"
      style={{
        borderColor,
        backgroundColor: toRgba(nodeBg, 0.35),
        borderStyle:
          controlStyle?.edgeDash || data.controlType === 'function' || data.controlType === 'class'
            ? 'dashed'
            : 'solid',
        boxShadow:
          data.controlType === 'function' || data.controlType === 'class'
            ? `0 0 0 3px ${borderColor}22`
            : undefined,
      }}
    >
      {showLabel ? <div className="text-center text-base font-semibold">{label}</div> : null}
      {data.condition ? (
        <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
          条件式: {data.condition}
        </div>
      ) : null}
      {data.note ? (
        <div className="mt-1 text-sm text-gray-500 whitespace-pre-wrap">補足: {data.note}</div>
      ) : null}
      <Handle type="source" position={Position.Left} id="h-left" />
      <Handle type="source" position={Position.Right} id="h-right" />
      <Handle type="source" position={Position.Top} id="h-top" />
      <Handle type="source" position={Position.Bottom} id="h-bottom" />
    </div>
  );
}
