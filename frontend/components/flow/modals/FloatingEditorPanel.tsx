import type { ReactNode } from 'react';

type FloatingEditorPanelProps = {
  title: string;
  description: string;
  children: ReactNode;
  footer: ReactNode;
  widthClassName?: string;
};

export function FloatingEditorPanel({
  title,
  description,
  children,
  footer,
  widthClassName = 'sm:w-[24rem]',
}: FloatingEditorPanelProps) {
  return (
    <div className="pointer-events-none absolute inset-0 z-20">
      <section
        className={`pointer-events-auto absolute bottom-3 left-3 right-3 flex max-h-[72vh] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-xl sm:left-1/2 sm:right-auto sm:-translate-x-1/2 ${widthClassName}`}
      >
        <header className="border-b border-slate-200/80 bg-gradient-to-r from-white via-slate-50 to-sky-50 px-4 py-3">
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
        <footer className="border-t border-slate-200/80 bg-white/90 px-4 py-3">
          {footer}
        </footer>
      </section>
    </div>
  );
}
