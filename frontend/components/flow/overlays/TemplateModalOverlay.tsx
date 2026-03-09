import { TEMPLATE_OPTIONS } from '../types';
import { useFlowUiContext } from '../context/FlowUiContext';

export function TemplateModalOverlay() {
  const { templateModalOverlay } = useFlowUiContext();
  const { isTemplateModalOpen, applyTemplate, closeTemplateModal } = templateModalOverlay;

  if (!isTemplateModalOpen) return null;
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900">アルゴリズムテンプレート</h3>
        <p className="mt-1 text-sm text-gray-600">
          使用するアルゴリズムテンプレートを選択してください。
        </p>
        <div className="mt-4 grid grid-cols-1 gap-2">
          {TEMPLATE_OPTIONS.map((template) => (
            <button
              key={template.id}
              type="button"
              className="rounded-md border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50"
              onClick={() => applyTemplate(template.id)}
            >
              <div className="font-semibold">{template.name}</div>
              <div className="text-xs text-gray-600 mt-1">{template.description}</div>
            </button>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            onClick={closeTemplateModal}
          >
            キャンセル
          </button>
        </div>
      </div>
    </div>
  );
}
