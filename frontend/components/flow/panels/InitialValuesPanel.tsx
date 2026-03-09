import { Panel } from 'reactflow';

import type { DeclaredVariableEntry } from '../state/useVariableRegistryState';

type Props = {
  variables: DeclaredVariableEntry[];
};

function getScopeLabel(scope: DeclaredVariableEntry['scope']) {
  return scope === 'local' ? 'ローカル' : 'グローバル';
}

export function InitialValuesPanel({ variables }: Props) {
  return (
    <Panel
      position="top-right"
      className="pointer-events-auto"
      style={{
        top: 184,
        right: 12,
        maxHeight: 'calc(100% - 196px)',
      }}
    >
      <aside className="flex h-full w-[min(20rem,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-sky-100/80 bg-white/92 shadow-xl backdrop-blur-xl">
        <div className="border-b border-sky-100 bg-gradient-to-r from-sky-50 via-white to-cyan-50 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold tracking-[0.2em] text-sky-600">
                INITIAL VALUES
              </div>
              <h3 className="mt-1 text-sm font-semibold text-slate-900">初期値データ</h3>
            </div>
            <span className="rounded-full bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-700">
              {variables.length}件
            </span>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            宣言済みの変数ノードから、型・スコープ・初期値を常に確認できます。
          </p>
        </div>

        {variables.length === 0 ? (
          <div className="px-4 py-6 text-xs leading-6 text-slate-500">
            まだ変数宣言ノードがありません。
            <br />
            変数ノードを追加すると、ここに初期値が表示されます。
          </div>
        ) : (
          <div className="flex-1 space-y-3 overflow-y-auto px-3 py-3">
            {variables.map((variable) => {
              const hasInitialValue = variable.initialValue.trim().length > 0;

              return (
                <section
                  key={`${variable.nodeId}-${variable.name}`}
                  className="rounded-xl border border-slate-200/80 bg-white/90 p-3 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-slate-900">
                        {variable.name}
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">
                        型: {variable.type}
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600">
                      {getScopeLabel(variable.scope)}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="text-[11px] font-semibold text-slate-500">初期値</div>
                    <pre
                      className={`mt-1 overflow-x-auto rounded-lg px-3 py-2 text-xs leading-5 ${
                        hasInitialValue
                          ? 'bg-slate-900 text-slate-100'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      <code>{hasInitialValue ? variable.initialValue : '未設定'}</code>
                    </pre>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </aside>
    </Panel>
  );
}
