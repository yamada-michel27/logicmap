'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge
} from 'reactflow';

import 'reactflow/dist/style.css';

type SavedFlowDetail = {
  id: string;
  name: string;
  snapshot: {
    nodes: Node[];
    edges: Edge[];
  };
  createdAt: string;
  updatedAt: string;
};

const USER_ID_STORAGE_KEY = 'logicmap:user-id';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

function getUserId() {
  if (typeof window === 'undefined') return 'unknown';
  const stored = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (stored) return stored;
  const generated =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(USER_ID_STORAGE_KEY, generated);
  return generated;
}

function resolveApiUrl(path: string) {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
}

// APIフェッチ関数（FlowVisualization.tsxから移植）
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T | null> {
  try {
    const headers = new Headers(options?.headers);
    headers.set('Content-Type', 'application/json');
    headers.set('X-User-Id', getUserId());

    const response = await fetch(resolveApiUrl(url), {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('API fetch error:', error);
    return null;
  }
}

export default function FlowDetailPage() {
  const params = useParams();
  const router = useRouter();
  const flowId = params.id as string;

  const [flow, setFlow] = useState<SavedFlowDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlow = useCallback(async () => {
    if (!flowId) return;

    setLoading(true);
    setError(null);

    try {
      const flowDetail = await apiFetch<SavedFlowDetail>(`/flows/${flowId}`, { method: 'GET' });
      if (flowDetail) {
        setFlow(flowDetail);
      } else {
        setError('フローが見つかりません');
      }
    } catch (err) {
      setError('フローの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [flowId]);

  useEffect(() => {
    void fetchFlow();
  }, [fetchFlow]);

  const handleBackToList = () => {
    router.push('/flows');
  };

  const handleEditInEditor = () => {
    // エディターで開く際のクエリパラメータとして流すか、
    // 別途状態管理で渡すかは既存実装に依存
    router.push(`/?flowId=${flowId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-slate-900 dark:text-white">読み込み中...</div>
      </div>
    );
  }

  if (error || !flow) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">{error || 'フローが見つかりません'}</div>
          <button
            onClick={handleBackToList}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            一覧に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col px-4 py-6">
        {/* ヘッダー */}
        <header className="mb-4 rounded-2xl glass-panel-strong px-6 py-5 text-slate-900 dark:text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">{flow.name}</h1>
              <div className="text-slate-600 dark:text-slate-200 space-x-4">
                <span>作成: {new Date(flow.createdAt).toLocaleString('ja-JP')}</span>
                <span>更新: {new Date(flow.updatedAt).toLocaleString('ja-JP')}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleEditInEditor}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                エディターで編集
              </button>
              <button
                onClick={handleBackToList}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                一覧に戻る
              </button>
            </div>
          </div>
        </header>

        {/* フローチャート表示 */}
        <div className="flex-1">
          <div className="flex h-full flex-col rounded-2xl glass-panel p-5 text-slate-900 dark:text-white">
            <h2 className="mb-3 text-xl font-semibold">フローチャート (閲覧専用)</h2>
            <div className="flex-1 min-h-[70vh] rounded-2xl border border-white/60 bg-white/20 backdrop-blur-xl shadow-xl overflow-hidden dark:border-slate-500/40 dark:bg-slate-900/30">
              <ReactFlow
                nodes={flow.snapshot.nodes}
                edges={flow.snapshot.edges}
                nodesDraggable={false}
                nodesConnectable={false}
                elementsSelectable={false}
                panOnDrag={true}
                zoomOnScroll={true}
                fitView
                attributionPosition="top-right"
              >
                <Background />
                <Controls />
                <MiniMap />
              </ReactFlow>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}