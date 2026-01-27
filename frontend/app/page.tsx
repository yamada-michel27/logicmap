'use client';

import dynamic from 'next/dynamic';
import { useState, type CSSProperties } from 'react';

const FlowVisualization = dynamic(
  () => import('@/components/FlowVisualization'),
  { ssr: false }
);

interface Node {
  id: string;
  type: string;
  data: { label: string };
  position: { x: number; y: number };
}

interface Edge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
  animated?: boolean;
  style?: CSSProperties;
}

type Understanding = 'understood' | 'ambiguous' | 'not_understood';

const statusConfig: Record<
  Understanding,
  { label: string; color: string; ring: string; dashed?: boolean }
> = {
  understood: {
    label: '理解できている',
    color: '#2f855a',
    ring: 'rgba(47,133,90,0.25)',
  },
  ambiguous: {
    label: '曖昧',
    color: '#d97706',
    ring: 'rgba(217,119,6,0.25)',
    dashed: true,
  },
  not_understood: {
    label: '理解できていない',
    color: '#c2410c',
    ring: 'rgba(194,65,12,0.25)',
  },
};

export default function Home() {
  const [nodes] = useState<Node[]>([]);
  const [edges] = useState<Edge[]>([]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            LogicMap
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Visualize algorithm flows
          </p>
        </header>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
            Flow Visualization
          </h2>
          <div className="h-96 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
            {nodes.length > 0 ? (
              <FlowVisualization nodes={nodes} edges={edges} />
            ) : (
              <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                No flow to display yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
