'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { apiFetch } from '@/components/flow/api';
import type { SavedFlowSummary } from '@/components/flow/types';

type FlowEditState = {
  name: string;
  description: string;
  links: string[];
};

const EMPTY_EDIT_STATE: FlowEditState = {
  name: '',
  description: '',
  links: [''],
};

function buildEditState(flow: SavedFlowSummary): FlowEditState {
  const links = Array.isArray(flow.links) ? flow.links : [];

  return {
    name: flow.name,
    description: flow.description ?? '',
    links: links.length > 0 ? [...links] : [''],
  };
}

function getDisplayHref(link: string): string | null {
  const trimmed = link.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return null;
    }
  }
}

export default function FlowsPage() {
  const [flows, setFlows] = useState<SavedFlowSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingFlowId, setSavingFlowId] = useState<string | null>(null);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);
  const [editState, setEditState] = useState<FlowEditState>(EMPTY_EDIT_STATE);
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

  const startEditing = useCallback((flow: SavedFlowSummary) => {
    setEditingFlowId(flow.id);
    setEditState(buildEditState(flow));
    setError(null);
  }, []);

  const stopEditing = useCallback(() => {
    setEditingFlowId(null);
    setEditState(EMPTY_EDIT_STATE);
  }, []);

  const handleEditFieldChange = useCallback(
    (field: 'name' | 'description', value: string) => {
      setEditState((current) => ({
        ...current,
        [field]: value,
      }));
    },
    []
  );

  const handleLinkChange = useCallback((index: number, value: string) => {
    setEditState((current) => ({
      ...current,
      links: current.links.map((link, linkIndex) => (linkIndex === index ? value : link)),
    }));
  }, []);

  const addLinkField = useCallback(() => {
    setEditState((current) => ({
      ...current,
      links: [...current.links, ''],
    }));
  }, []);

  const removeLinkField = useCallback((index: number) => {
    setEditState((current) => {
      if (current.links.length <= 1) {
        return { ...current, links: [''] };
      }

      return {
        ...current,
        links: current.links.filter((_, linkIndex) => linkIndex !== index),
      };
    });
  }, []);

  const handleSaveFlowMeta = useCallback(
    async (flowId: string) => {
      const name = editState.name.trim();
      if (!name) {
        setError('タイトルは必須です');
        return;
      }

      const description = editState.description.trim();
      const links = editState.links
        .map((link) => link.trim())
        .filter((link) => link.length > 0);

      setSavingFlowId(flowId);
      setError(null);

      try {
        const updatedFlow = await apiFetch<SavedFlowSummary>(`/flows/${flowId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name,
            description,
            links,
          }),
        });

        setFlows((currentFlows) =>
          currentFlows.map((flow) => (flow.id === flowId ? updatedFlow : flow))
        );
        stopEditing();
      } catch {
        setError('フロー情報の更新に失敗しました');
      } finally {
        setSavingFlowId(null);
      }
    },
    [editState, stopEditing]
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
        <header className="mb-6 rounded-2xl glass-panel-strong px-6 py-5 text-slate-900 dark:text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="mb-2 text-4xl font-bold">保存済みフロー</h1>
              <p className="text-slate-600 dark:text-slate-200">
                保存したフローチャートを閲覧・管理できます
              </p>
            </div>
            <button
              onClick={handleBackToEditor}
              className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
            >
              エディターに戻る
            </button>
          </div>
        </header>

        <div className="flex-1">
          <div className="rounded-2xl glass-panel p-6 text-slate-900 dark:text-white">
            {error && flows.length === 0 ? (
              <div className="py-8 text-center">
                <div className="mb-4 text-red-500">{error}</div>
                <button
                  onClick={fetchFlows}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                >
                  再試行
                </button>
              </div>
            ) : flows.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mb-4 text-slate-500 dark:text-slate-400">
                  保存されたフローがありません
                </div>
                <Link
                  href="/"
                  className="inline-block rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
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
                  {flows.map((flow) => {
                    const isEditing = editingFlowId === flow.id;
                    const isSaving = savingFlowId === flow.id;
                    const savedLinks = Array.isArray(flow.links) ? flow.links : [];

                    return (
                      <div
                        key={flow.id}
                        className="flex min-h-64 flex-col justify-between rounded-lg border border-white/60 bg-white/20 p-4 shadow-xl backdrop-blur-xl transition-all dark:border-slate-500/40 dark:bg-slate-900/30"
                      >
                        <div className="space-y-3">
                          {isEditing ? (
                            <>
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                                  タイトル
                                </label>
                                <input
                                  type="text"
                                  value={editState.name}
                                  onChange={(event) =>
                                    handleEditFieldChange('name', event.target.value)
                                  }
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  placeholder="フローのタイトル"
                                />
                              </div>
                              <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                                  詳細
                                </label>
                                <textarea
                                  value={editState.description}
                                  onChange={(event) =>
                                    handleEditFieldChange('description', event.target.value)
                                  }
                                  rows={4}
                                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                  placeholder="このフローの補足や目的を書けます"
                                />
                              </div>
                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                                    リンク
                                  </label>
                                  <button
                                    type="button"
                                    onClick={addLinkField}
                                    className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                                  >
                                    リンクを追加
                                  </button>
                                </div>
                                <div className="space-y-2">
                                  {editState.links.map((link, index) => (
                                    <div key={`${flow.id}-link-${index}`} className="flex gap-2">
                                      <input
                                        type="text"
                                        value={link}
                                        onChange={(event) =>
                                          handleLinkChange(index, event.target.value)
                                        }
                                        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                                        placeholder="https://example.com"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => removeLinkField(index)}
                                        className="rounded-lg bg-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-300"
                                      >
                                        削除
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          ) : (
                            <>
                              <div>
                                <h3 className="mb-2 text-lg font-semibold">{flow.name}</h3>
                                <p className="whitespace-pre-wrap break-words text-sm text-slate-600 dark:text-slate-300">
                                  {flow.description || '詳細は未設定です'}
                                </p>
                              </div>
                              <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
                                <div>作成: {new Date(flow.createdAt).toLocaleDateString('ja-JP')}</div>
                                <div>更新: {new Date(flow.updatedAt).toLocaleDateString('ja-JP')}</div>
                              </div>
                              <div className="space-y-2">
                                <div className="text-xs font-semibold text-slate-500 dark:text-slate-300">
                                  リンク
                                </div>
                                {savedLinks.length > 0 ? (
                                  <div className="space-y-1">
                                    {savedLinks.map((link, index) => {
                                      const href = getDisplayHref(link);
                                      return href ? (
                                        <a
                                          key={`${flow.id}-saved-link-${index}`}
                                          href={href}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="block truncate text-sm text-blue-700 underline underline-offset-2 hover:text-blue-800"
                                        >
                                          {link}
                                        </a>
                                      ) : (
                                        <div
                                          key={`${flow.id}-saved-link-${index}`}
                                          className="truncate text-sm text-slate-500"
                                        >
                                          {link}
                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="text-sm text-slate-500 dark:text-slate-400">
                                    リンクは未設定です
                                  </div>
                                )}
                              </div>
                            </>
                          )}
                        </div>

                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleSaveFlowMeta(flow.id)}
                                disabled={isSaving}
                                className={`rounded-lg px-3 py-2 text-sm font-medium text-white transition-colors ${
                                  isSaving ? 'bg-slate-400' : 'bg-emerald-600 hover:bg-emerald-700'
                                }`}
                              >
                                {isSaving ? '保存中...' : '変更を保存'}
                              </button>
                              <button
                                type="button"
                                onClick={stopEditing}
                                disabled={isSaving}
                                className="rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300"
                              >
                                キャンセル
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleFlowClick(flow.id)}
                                className="flex-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                              >
                                エディターで開く
                              </button>
                              <button
                                type="button"
                                onClick={() => startEditing(flow)}
                                className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                              >
                                編集
                              </button>
                            </>
                          )}
                          {/* <button
                            type="button"
                            onClick={() => void handleDeleteFlow(flow.id)}
                            disabled={isDeleting || isSaving}
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                              isDeleting || isSaving
                                ? 'cursor-not-allowed bg-rose-200 text-rose-500'
                                : 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                            }`}
                          >
                            {isDeleting ? '削除中...' : '削除'}
                          </button> */}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
