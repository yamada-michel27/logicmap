'use client';

import { type NodeProps } from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';

import type { MemoNodeData } from '../types';
import { MEMO_MIN_WIDTH, MEMO_MIN_HEIGHT } from '../constants';

export function MemoNode({ data, selected }: NodeProps<MemoNodeData>) {
  return (
    <div className="relative h-full w-full rounded-lg border border-white/60 bg-amber-50/60 p-3 text-sm text-slate-900 backdrop-blur-md shadow-lg ring-1 ring-white/40">
      <NodeResizer isVisible={selected} minWidth={MEMO_MIN_WIDTH} minHeight={MEMO_MIN_HEIGHT} />
      <div className="text-xs font-semibold text-amber-700">メモ</div>
      {data.text?.trim().length > 0 ? (
        <div className="mt-2 whitespace-pre-wrap text-sm text-gray-900">{data.text}</div>
      ) : (
        <div className="mt-2 text-xs text-amber-600">内容を入力してください</div>
      )}
    </div>
  );
}
