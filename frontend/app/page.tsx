'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

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
}

export default function Home() {
  const [markdown, setMarkdown] = useState('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleParse = async () => {
    if (!markdown.trim()) {
      setError('Please enter some markdown');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const response = await fetch(`${apiUrl}/parse`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ markdown }),
      });

      if (!response.ok) {
        throw new Error('Failed to parse markdown');
      }

      const data = await response.json();
      setNodes(data.nodes);
      setEdges(data.edges);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
            LogicMap
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Visualize algorithm flows from Markdown
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Markdown Input
            </h2>
            <textarea
              className="w-full h-64 p-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              placeholder="Enter your algorithm in markdown format...&#10;&#10;Example:&#10;# Algorithm&#10;1. Start&#10;2. Process data&#10;3. Make decision&#10;4. End"
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
            />
            <button
              onClick={handleParse}
              disabled={loading}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200"
            >
              {loading ? 'Parsing...' : 'Visualize Flow'}
            </button>
            {error && (
              <div className="mt-4 p-3 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-600 text-red-700 dark:text-red-200 rounded">
                {error}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">
              Flow Visualization
            </h2>
            <div className="h-96 border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
              {nodes.length > 0 ? (
                <FlowVisualization nodes={nodes} edges={edges} />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
                  Enter markdown and click &quot;Visualize Flow&quot; to see the result
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
