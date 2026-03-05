'use client';

import { type NodeProps } from 'reactflow';

import type { StampNodeData } from '../types';
import { STAMP_OPTIONS } from '../types';

export function StampNode({ id, data }: NodeProps<StampNodeData>) {
  const stamp = STAMP_OPTIONS.find((option) => option.id === data.stamp);
  return (
    <div className="group relative flex h-full w-full items-center justify-center rounded-full border border-white/60 bg-white/50 backdrop-blur-md shadow-lg ring-1 ring-white/50">
      <button
        type="button"
        className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full border border-white/70 bg-white/80 text-[10px] text-gray-600 shadow-sm group-hover:flex"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          data.onDelete?.(id);
        }}
      >
        ×
      </button>
      <div className="text-2xl" aria-label={stamp?.label ?? 'スタンプ'}>
        {stamp?.emoji ?? '❓'}
      </div>
    </div>
  );
}
