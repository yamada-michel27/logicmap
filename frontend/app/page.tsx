'use client';

import dynamic from 'next/dynamic';

const FlowVisualization = dynamic(() => import('@/components/FlowVisualization'), {
  ssr: false,
});

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="mx-auto flex h-screen w-full max-w-6xl flex-col px-4 py-6">
        <header className="mb-4">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            LogicMap
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Visualize algorithm flows
          </p>
        </header>

        <div className="flex-1">
          <div className="flex h-full flex-col rounded-lg bg-white p-4 shadow-lg dark:bg-gray-800">
            <h2 className="mb-3 text-xl font-semibold text-gray-900 dark:text-white">
              Flow Visualization
            </h2>
            <div className="flex-1 min-h-[70vh] rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              <FlowVisualization />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
