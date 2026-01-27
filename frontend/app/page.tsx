'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useEffect } from 'react';

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

const sanitizeLabel = (input: string) => {
  const sanitized = input
    .replace(/\uFFFD+/g, '')
    .replace(/^\s*\[[^\]]+\]\s*/, '')
    .replace(/^\s*[-*・]\s*/, '')
    .replace(/\s*->\s*[\p{L}\p{N}_-]+$/u, '')
    .trim();

  if (/^>\s*[\p{L}\p{N}_-]*$/u.test(sanitized)) {
    return '';
  }

  return sanitized;
};

const normalizeFlow = (rawNodes: Node[], rawEdges: Edge[]) => {
  const nodes = rawNodes.map((node) => {
    const rawLabel = typeof node?.data?.label === 'string' ? node.data.label : '';
    return {
      ...node,
      data: {
        ...node.data,
        label: sanitizeLabel(rawLabel),
      },
    };
  });
  const edges = rawEdges.map((edge) => {
    const rawLabel = typeof edge?.label === 'string' ? edge.label : '';
    return {
      ...edge,
      label: rawLabel
        ? rawLabel.replace(/\uFFFD+/g, '').replace(/^\s*[-*・]\s*/, '').trim()
        : rawLabel,
    };
  });

  const emptyNodeIds = new Set(nodes.filter((node) => !node.data.label).map((node) => node.id));
  if (emptyNodeIds.size === 0) {
    return { nodes, edges };
  }

  const nextNodes = nodes.filter((node) => !emptyNodeIds.has(node.id));
  const nextEdges: Edge[] = [];
  const edgesBySource = new Map<string, Edge[]>();
  const edgesByTarget = new Map<string, Edge[]>();

  edges.forEach((edge) => {
    if (!edgesBySource.has(edge.source)) {
      edgesBySource.set(edge.source, []);
    }
    edgesBySource.get(edge.source)?.push(edge);
    if (!edgesByTarget.has(edge.target)) {
      edgesByTarget.set(edge.target, []);
    }
    edgesByTarget.get(edge.target)?.push(edge);
  });

  edges.forEach((edge) => {
    if (emptyNodeIds.has(edge.source) || emptyNodeIds.has(edge.target)) {
      return;
    }
    nextEdges.push(edge);
  });

  emptyNodeIds.forEach((nodeId) => {
    const incoming = edgesByTarget.get(nodeId) ?? [];
    const outgoing = edgesBySource.get(nodeId) ?? [];
    if (incoming.length === 1 && outgoing.length === 1) {
      const inEdge = incoming[0];
      const outEdge = outgoing[0];
      const merged: Edge = {
        id: `e${inEdge.source}-${outEdge.target}-collapsed`,
        source: inEdge.source,
        target: outEdge.target,
        label: inEdge.label || outEdge.label,
        type: outEdge.type || inEdge.type,
        animated: outEdge.animated || inEdge.animated,
        style: outEdge.style || inEdge.style,
      };
      nextEdges.push(merged);
    }
  });

  return { nodes: nextNodes, edges: nextEdges };
};

export default function Home() {
  const [markdown, setMarkdown] = useState('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState(
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'
  );
  const [error, setError] = useState('');

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await fetch('/config.json');
        if (!res.ok) return;
        const data = await res.json();
        if (data?.apiBaseUrl) {
          setApiBaseUrl(data.apiBaseUrl);
        }
      } catch {
        // fallback to env/default
      }
    };
    loadConfig();
  }, []);

  const handleParse = async () => {
    if (!markdown.trim()) {
      setError('Please enter some markdown');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${apiBaseUrl}/parse`, {
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
      const normalized = normalizeFlow(data.nodes || [], data.edges || []);
      setNodes(normalized.nodes);
      setEdges(normalized.edges);
      setSelectedNodeId(null);
      setNodeStatus((prev) => {
        const next: Record<string, Understanding> = {};
        normalized.nodes.forEach((node: Node) => {
          next[node.id] = prev[node.id] ?? 'ambiguous';
        });
        return next;
      });
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
