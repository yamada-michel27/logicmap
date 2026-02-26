'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type SavedFlowSummary = {
  id: string;
  name: string;
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

export default function FlowsPage() {
  const [flows, setFlows] = useState<SavedFlowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchFlows = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const flowList = await apiFetch<SavedFlowSummary[]>('/flows', { method: 'GET' });
      setFlows(flowList ?? []);
    } catch (err) {
      setError('フロー一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchFlows();
  }, [fetchFlows]);

  const handleFlowClick = (flowId: string) => {
    router.push(`/?flowId=${flowId}`);
  };

  const handleBackToEditor = () => {
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-slate-900 dark:text-white">読み込み中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="mx-auto flex min-h-screen w-full max-w-screen-2xl flex-col px-4 py-6">
        {/* ヘッダー */}
        <header className="mb-6 rounded-2xl glass-panel-strong px-6 py-5 text-slate-900 dark:text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">保存済みフロー</h1>
              <p className="text-slate-600 dark:text-slate-200">
                保存したフローチャートを閲覧・管理できます
              </p>
            </div>
            <button
              onClick={handleBackToEditor}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              エディターに戻る
            </button>
          </div>
        </header>

        {/* メインコンテンツ */}
        <div className="flex-1">
          <div className="rounded-2xl glass-panel p-6 text-slate-900 dark:text-white">
            {error ? (
              <div className="text-center py-8">
                <div className="text-red-500 mb-4">{error}</div>
                <button
                  onClick={fetchFlows}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  再試行
                </button>
              </div>
            ) : flows.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-slate-500 dark:text-slate-400 mb-4">
                  保存されたフローがありません
                </div>
                <Link
                  href="/"
                  className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  フローを作成する
                </Link>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {flows.map((flow) => (
                  <div
                    key={flow.id}
                    onClick={() => handleFlowClick(flow.id)}
                    className="p-4 rounded-lg bg-white/20 border border-white/60 backdrop-blur-xl shadow-xl hover:bg-white/30 cursor-pointer transition-all dark:bg-slate-900/30 dark:border-slate-500/40 dark:hover:bg-slate-900/40"
                  >
                    <h3 className="font-semibold text-lg mb-2 truncate">
                      {flow.name}
                    </h3>
                    <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                      <div>
                        作成: {new Date(flow.createdAt).toLocaleDateString('ja-JP')}
                      </div>
                      <div>
                        更新: {new Date(flow.updatedAt).toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}