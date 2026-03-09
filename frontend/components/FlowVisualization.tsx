'use client';

import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  ConnectionMode,
} from 'reactflow';

import 'reactflow/dist/style.css';
import '@reactflow/node-resizer/dist/style.css';

import { useFlowVisualizationController } from './flow/controller/useFlowVisualizationController';
import { FlowUiProvider } from './flow/context/FlowUiContext';
import EdgeModal from './flow/modals/EdgeModal';
import MemoModal from './flow/modals/MemoModal';
import VariableModal from './flow/modals/VariableModal';
import NodeModal from './flow/modals/NodeModal';
import { nodeTypes } from './flow/nodes';
import { edgeTypes } from './flow/edges';
import { NodeDeleteOverlay } from './flow/overlays/NodeDeleteOverlay';
import { TemplateModalOverlay } from './flow/overlays/TemplateModalOverlay';
import { ExportModalOverlay } from './flow/overlays/ExportModalOverlay';
import { PythonModalOverlay } from './flow/overlays/PythonModalOverlay';
import { PythonImportModalOverlay } from './flow/overlays/PythonImportModalOverlay';
import { ImportModalOverlay } from './flow/overlays/ImportModalOverlay';
import { ClearModalOverlay } from './flow/overlays/ClearModalOverlay';
import { SavePanel } from './flow/panels/SavePanel';
import { ActionPanel } from './flow/panels/ActionPanel';
import { DebugPanel } from './flow/panels/DebugPanel';
import { InitialValuesPanel } from './flow/panels/InitialValuesPanel';

type FlowVisualizationProps = {
  initialFlowId?: string | null;
};

export default function FlowVisualization({ initialFlowId }: FlowVisualizationProps) {
  const controller = useFlowVisualizationController({ initialFlowId });
  const {
    wrapperRef,
    nodesForRender,
    edgesForRender,
    onNodesChange,
    onEdgesChange,
    onInit,
    onWrapperDoubleClickCapture,
    onWrapperClickCapture,
    onPaneClick,
    onNodeDoubleClick,
    onNodeDragStart,
    onNodeDragStop,
    onConnect,
    onEdgeUpdate,
    onEdgeDoubleClick,
    debugEvent,
    saveName,
    setSaveName,
    isSavingFlow,
    saveCurrentFlow,
    saveError,
    savedFlows,
    isLoadingFlows,
    restoreSavedFlow,
    deleteSavedFlow,
    currentFlowId,
    currentFlowName,
    updateFlow,
    openTemplateModal,
    createNewCanvas,
    openExportModal,
    openImportModal,
    generatePythonCode,
    openPythonImportModal,
    openClearModal,
    openMemoCreateModal,
    pendingStamp,
    setPendingStamp,
    pendingConnection,
    pendingEdgeEdit,
    edges,
    selectedEdgeControl,
    edgeForm,
    setEdgeForm,
    onEdgeControlChange,
    applySelectedControl,
    cancelConnection,
    closeEdgeModal,
    deleteEdgeById,
    pendingMemoClientPosition,
    pendingMemoEdit,
    memoText,
    setMemoText,
    applyMemoCreation,
    applyMemoEdit,
    cancelMemoModal,
    deleteNodeById,
    pendingVariableEdit,
    variableForm,
    setVariableForm,
    cancelVariableEdit,
    applyVariableEdit,
    pendingNodeClientPosition,
    pendingNodeEdit,
    nodes,
    nodeForm,
    setNodeForm,
    nodeModalOption,
    setNodeModalOption,
    declaredVariables,
    declaredVariableEntries,
    validateTypeCompatibility,
    applyNodeCreation,
    applyNodeEdit,
    cancelNodeCreation,
    cancelNodeEdit,
    createClassInstance,
    openNodeDeleteModal,
    pendingNodeDelete,
    setPendingNodeDelete,
    isTemplateModalOpen,
    applyTemplate,
    closeTemplateModal,
    isExportModalOpen,
    exportedText,
    isCopied,
    copyToClipboard,
    downloadFlowStructure,
    closeExportModal,
    isPythonModalOpen,
    isPythonGenerating,
    pythonCode,
    isPythonCopied,
    copyPythonCode,
    downloadPythonFile,
    closePythonModal,
    isPythonImportModalOpen,
    pythonInputCode,
    setPythonInputCode,
    isCanvasGenerating,
    generateCanvasFromPython,
    isImportModalOpen,
    importText,
    setImportText,
    importFlowFromText,
    closeImportModal,
    closePythonImportModal,
    isClearModalOpen,
    closeClearModal,
    clearCanvas,
  } = controller;

  const flowUiValue = {
    savePanel: {
      saveName,
      setSaveName,
      isSavingFlow,
      saveCurrentFlow,
      saveError,
      savedFlows,
      isLoadingFlows,
      restoreSavedFlow,
      deleteSavedFlow,
    },
    actionPanel: {
      currentFlowId,
      currentFlowName,
      updateFlow,
      openTemplateModal,
      createNewCanvas,
      openExportModal,
      openImportModal,
      generatePythonCode,
      openPythonImportModal,
      openClearModal,
      openMemoCreateModal,
      pendingStamp,
      setPendingStamp,
    },
    debugPanel: {
      debugEvent,
    },
    nodeDeleteOverlay: {
      pendingNodeDelete,
      setPendingNodeDelete,
      deleteNodeById,
    },
    templateModalOverlay: {
      isTemplateModalOpen,
      applyTemplate,
      closeTemplateModal,
    },
    exportModalOverlay: {
      isExportModalOpen,
      exportedText,
      isCopied,
      copyToClipboard,
      downloadFlowStructure,
      closeExportModal,
    },
    pythonModalOverlay: {
      isPythonModalOpen,
      isPythonGenerating,
      pythonCode,
      isPythonCopied,
      copyPythonCode,
      downloadPythonFile,
      closePythonModal,
    },
    pythonImportModalOverlay: {
      isPythonImportModalOpen,
      pythonInputCode,
      setPythonInputCode,
      isCanvasGenerating,
      generateCanvasFromPython,
      closePythonImportModal,
    },
    importModalOverlay: {
      isImportModalOpen,
      importText,
      setImportText,
      importFlowFromText,
      closeImportModal,
    },
    clearModalOverlay: {
      isClearModalOpen,
      closeClearModal,
      clearCanvas,
    },
  };

  return (
    <FlowUiProvider value={flowUiValue}>
      <div
        className="relative h-full w-full bg-gradient-to-br from-slate-50 via-slate-100 to-sky-50"
        ref={wrapperRef}
        onDoubleClickCapture={onWrapperDoubleClickCapture}
        onClickCapture={onWrapperClickCapture}
      >
        <SavePanel />
        <ActionPanel />
        <DebugPanel />
        <ReactFlow
          nodes={nodesForRender}
          edges={edgesForRender}
          className="rounded-2xl border border-white/50 bg-white/35 backdrop-blur-xl shadow-xl"
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onEdgeUpdate={onEdgeUpdate}
          onNodeDragStart={onNodeDragStart}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onPaneClick={onPaneClick}
          connectionMode={ConnectionMode.Loose}
          zoomOnDoubleClick={false}
          onInit={onInit}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          elevateEdgesOnSelect={true}
        >
          <Controls />
          <MiniMap />
          <Background gap={12} size={1} />
          <InitialValuesPanel variables={declaredVariableEntries} />
        </ReactFlow>
        <EdgeModal
          pendingConnection={pendingConnection}
          pendingEdgeEdit={pendingEdgeEdit}
          edges={edges}
          selectedEdgeControl={selectedEdgeControl}
          edgeForm={edgeForm}
          setEdgeForm={setEdgeForm}
          onEdgeControlChange={onEdgeControlChange}
          applySelectedControl={applySelectedControl}
          cancelConnection={cancelConnection}
          closeEdgeModal={closeEdgeModal}
          deleteEdgeById={deleteEdgeById}
        />
        <MemoModal
          pendingMemoClientPosition={pendingMemoClientPosition}
          pendingMemoEdit={pendingMemoEdit}
          memoText={memoText}
          setMemoText={setMemoText}
          applyMemoCreation={applyMemoCreation}
          applyMemoEdit={applyMemoEdit}
          cancelMemoModal={cancelMemoModal}
          deleteNodeById={deleteNodeById}
        />
        <VariableModal
          pendingVariableEdit={pendingVariableEdit}
          variableForm={variableForm}
          setVariableForm={setVariableForm}
          cancelVariableEdit={cancelVariableEdit}
          applyVariableEdit={applyVariableEdit}
        />
        <NodeModal
          pendingNodeClientPosition={pendingNodeClientPosition}
          pendingNodeEdit={pendingNodeEdit}
          nodes={nodes}
          nodeForm={nodeForm}
          setNodeForm={setNodeForm}
          nodeModalOption={nodeModalOption}
          setNodeModalOption={setNodeModalOption}
          variableForm={variableForm}
          setVariableForm={setVariableForm}
          declaredVariables={declaredVariables}
          validateTypeCompatibility={validateTypeCompatibility}
          applyNodeCreation={applyNodeCreation}
          applyNodeEdit={applyNodeEdit}
          cancelNodeCreation={cancelNodeCreation}
          cancelNodeEdit={cancelNodeEdit}
          createClassInstance={createClassInstance}
          openNodeDeleteModal={openNodeDeleteModal}
        />
        <NodeDeleteOverlay />
        <TemplateModalOverlay />
        <ExportModalOverlay />
        <PythonModalOverlay />
        <PythonImportModalOverlay />
        <ImportModalOverlay />
        <ClearModalOverlay />
      </div>
    </FlowUiProvider>
  );
}
