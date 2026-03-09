'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

const FlowVisualization = dynamic(() => import('@/components/FlowVisualization'), {
  ssr: false,
});

function HomeContent() {
  const searchParams = useSearchParams();
  const flowId = searchParams.get('flowId');
  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex h-dvh w-full max-w-none flex-col px-3 py-3 sm:px-4 sm:py-4">
        <header className="mb-3 rounded-2xl glass-panel-strong px-4 py-3 text-slate-900 sm:px-5 sm:py-4 dark:text-white">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                LogicMap
              </h1>
              <p className="mt-1 text-sm leading-5 text-slate-600 sm:text-[15px] dark:text-slate-200">
                See the whole flow. Think deeper. Close the gap.
              </p>
            </div>
            <Link
              href="/flows"
              className="inline-flex shrink-0 items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              保存済みフロー
            </Link>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          <div className="flex h-full min-h-0 flex-col rounded-2xl glass-panel p-3 text-slate-900 sm:p-4 dark:text-white">
            <div className="mb-1.5 px-1">
              <h2 className="text-[11px] font-semibold tracking-[0.24em] text-slate-600 dark:text-slate-300">
                FLOW VISUALIZATION
              </h2>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-white/60 bg-white/20 shadow-xl backdrop-blur-xl dark:border-slate-500/40 dark:bg-slate-900/30">
              <FlowVisualization initialFlowId={flowId} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-transparent flex items-center justify-center">
      <div className="text-slate-900 dark:text-white">読み込み中...</div>
    </div>}>
      <HomeContent />
    </Suspense>
  );
}
