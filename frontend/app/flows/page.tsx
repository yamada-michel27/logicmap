'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/components/flow/api';
import type { SavedFlowSummary } from '@/components/flow/types';

export default function FlowsPage() {
  const [flows, setFlows] = useState<SavedFlowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingFlowId, setDeletingFlowId] = useState<string | null>(null);
  const router = useRouter();

  const fetchFlows = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const flowList = await apiFetch<SavedFlowSummary[]>('/flows', { method: 'GET' });
      setFlows(flowList);
    } catch {
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

  const handleDeleteFlow = useCallback(
    async (flowId: string) => {
      const targetFlow = flows.find((flow) => flow.id === flowId);
      const flowName = targetFlow?.name ?? 'このフロー';
      const shouldDelete = window.confirm(`「${flowName}」を削除します。よろしいですか？`);

      if (!shouldDelete) {
        return;
      }

      setDeletingFlowId(flowId);
      setError(null);

      try {
        await apiFetch<null>(`/flows/${flowId}`, { method: 'DELETE' });
        setFlows((currentFlows) => currentFlows.filter((flow) => flow.id !== flowId));
      } catch {
        setError('フローの削除に失敗しました');
      } finally {
        setDeletingFlowId(null);
      }
    },
    [flows]
  );

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
            {error && flows.length === 0 ? (
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
              <div className="space-y-4">
                {error ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                  </div>
                ) : null}
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {flows.map((flow) => (
                    <div
                      key={flow.id}
                      className="flex min-h-44 flex-col justify-between rounded-lg border border-white/60 bg-white/20 p-4 shadow-xl backdrop-blur-xl transition-all dark:border-slate-500/40 dark:bg-slate-900/30"
                    >
                      <div>
                        <h3 className="mb-2 truncate text-lg font-semibold">{flow.name}</h3>
                        <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                          <div>
                            作成: {new Date(flow.createdAt).toLocaleDateString('ja-JP')}
                          </div>
                          <div>
                            更新: {new Date(flow.updatedAt).toLocaleDateString('ja-JP')}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleFlowClick(flow.id)}
                          className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                        >
                          エディターで開く
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteFlow(flow.id)}
                          disabled={deletingFlowId === flow.id}
                          className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                            deletingFlowId === flow.id
                              ? 'cursor-not-allowed bg-rose-200 text-rose-500'
                              : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                          }`}
                        >
                          {deletingFlowId === flow.id ? '削除中...' : '削除'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
