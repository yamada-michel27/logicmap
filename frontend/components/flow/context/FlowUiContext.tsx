'use client';

import { createContext, useContext, type ReactNode } from 'react';

import type { FlowVisualizationController } from '../controller/useFlowVisualizationController';

type FlowUiController = Pick<
  FlowVisualizationController,
  | 'debugEvent'
  | 'saveName'
  | 'setSaveName'
  | 'isSavingFlow'
  | 'saveCurrentFlow'
  | 'saveError'
  | 'currentFlowId'
  | 'currentFlowName'
  | 'updateFlow'
  | 'createNewCanvas'
  | 'openExportModal'
  | 'openImportModal'
  | 'generatePythonCode'
  | 'openPythonImportModal'
  | 'openClearModal'
  | 'openMemoCreateModal'
  | 'pendingStamp'
  | 'setPendingStamp'
  | 'pendingNodeDelete'
  | 'setPendingNodeDelete'
  | 'deleteNodeById'
  | 'isExportModalOpen'
  | 'exportedText'
  | 'isCopied'
  | 'copyToClipboard'
  | 'downloadFlowStructure'
  | 'closeExportModal'
  | 'isPythonModalOpen'
  | 'isPythonGenerating'
  | 'pythonCode'
  | 'isPythonCopied'
  | 'copyPythonCode'
  | 'downloadPythonFile'
  | 'closePythonModal'
  | 'isPythonImportModalOpen'
  | 'pythonInputCode'
  | 'setPythonInputCode'
  | 'isCanvasGenerating'
  | 'generateCanvasFromPython'
  | 'closePythonImportModal'
  | 'isImportModalOpen'
  | 'importText'
  | 'setImportText'
  | 'importFlowFromText'
  | 'closeImportModal'
  | 'isClearModalOpen'
  | 'closeClearModal'
  | 'clearCanvas'
>;

type FlowUiContextValue = {
  savePanel: Pick<
    FlowUiController,
    | 'saveName'
    | 'setSaveName'
    | 'isSavingFlow'
    | 'saveCurrentFlow'
    | 'saveError'
  >;
  actionPanel: Pick<
    FlowUiController,
    | 'currentFlowId'
    | 'currentFlowName'
    | 'updateFlow'
    | 'createNewCanvas'
    | 'openExportModal'
    | 'openImportModal'
    | 'generatePythonCode'
    | 'openPythonImportModal'
    | 'openClearModal'
    | 'openMemoCreateModal'
    | 'pendingStamp'
    | 'setPendingStamp'
  >;
  debugPanel: Pick<FlowUiController, 'debugEvent'>;
  nodeDeleteOverlay: Pick<FlowUiController, 'pendingNodeDelete' | 'setPendingNodeDelete' | 'deleteNodeById'>;
  exportModalOverlay: Pick<
    FlowUiController,
    | 'isExportModalOpen'
    | 'exportedText'
    | 'isCopied'
    | 'copyToClipboard'
    | 'downloadFlowStructure'
    | 'closeExportModal'
  >;
  pythonModalOverlay: Pick<
    FlowUiController,
    | 'isPythonModalOpen'
    | 'isPythonGenerating'
    | 'pythonCode'
    | 'isPythonCopied'
    | 'copyPythonCode'
    | 'downloadPythonFile'
    | 'closePythonModal'
  >;
  pythonImportModalOverlay: Pick<
    FlowUiController,
    | 'isPythonImportModalOpen'
    | 'pythonInputCode'
    | 'setPythonInputCode'
    | 'isCanvasGenerating'
    | 'generateCanvasFromPython'
    | 'closePythonImportModal'
  >;
  importModalOverlay: Pick<
    FlowUiController,
    | 'isImportModalOpen'
    | 'importText'
    | 'setImportText'
    | 'importFlowFromText'
    | 'closeImportModal'
  >;
  clearModalOverlay: Pick<FlowUiController, 'isClearModalOpen' | 'closeClearModal' | 'clearCanvas'>;
};

const FlowUiContext = createContext<FlowUiContextValue | null>(null);

type Props = {
  children: ReactNode;
  value: FlowUiContextValue;
};

export function FlowUiProvider({ children, value }: Props) {
  return <FlowUiContext.Provider value={value}>{children}</FlowUiContext.Provider>;
}

export function useFlowUiContext() {
  const context = useContext(FlowUiContext);
  if (!context) {
    throw new Error('useFlowUiContext must be used within FlowUiProvider');
  }
  return context;
}
