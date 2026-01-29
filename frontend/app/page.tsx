'use client';

import dynamic from 'next/dynamic';

const FlowVisualization = dynamic(() => import('@/components/FlowVisualization'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex h-screen w-full max-w-screen-2xl flex-col px-4 py-6">
        <header className="mb-4 rounded-2xl glass-panel-strong px-6 py-5 text-slate-900 dark:text-white">
          <h1 className="text-4xl font-bold mb-2">
            LogicMap
          </h1>
          <p className="text-slate-600 dark:text-slate-200">
            Visualize algorithm flows
          </p>
        </header>

        <div className="flex-1">
          <div className="flex h-full flex-col rounded-2xl glass-panel p-5 text-slate-900 dark:text-white">
            <h2 className="mb-3 text-xl font-semibold">
              Flow Visualization
            </h2>
            <div className="flex-1 min-h-[70vh] rounded-2xl border border-white/60 bg-white/20 backdrop-blur-xl shadow-xl overflow-hidden dark:border-slate-500/40 dark:bg-slate-900/30">
              <FlowVisualization />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
