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
      <div className="mx-auto flex h-screen w-full max-w-screen-2xl flex-col px-4 py-6">
        <header className="mb-4 rounded-2xl glass-panel-strong px-6 py-5 text-slate-900 dark:text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">
                LogicMap
              </h1>
              <p className="text-slate-600 dark:text-slate-200">
                See the whole flow. Think deeper. Close the gap.
              </p>
            </div>
            <Link
              href="/flows"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              保存済みフロー
            </Link>
          </div>
        </header>

        <div className="flex-1">
          <div className="flex h-full flex-col rounded-2xl glass-panel p-5 text-slate-900 dark:text-white">
            <h2 className="mb-3 text-xl font-semibold">
              Flow Visualization
            </h2>
            <div className="flex-1 min-h-[70vh] rounded-2xl border border-white/60 bg-white/20 backdrop-blur-xl shadow-xl overflow-hidden dark:border-slate-500/40 dark:bg-slate-900/30">
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
