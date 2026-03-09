'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  useNodesState,
  useEdgesState,
  type Node,
} from 'reactflow';

import type {
  MemoNodeData,
  StampNodeData,
  VariableNodeData,
  FlowNodeData,
  LogicEdgeData,
} from '../types';
import { EMPTY_NODE_FORM } from '../constants';
import { ensureEdgeData, normalizeParallelOffsets } from '../utils';
import { useFlowPersistence } from '../hooks/useFlowPersistence';
import { usePythonIntegration } from '../hooks/usePythonIntegration';
import { useEdgeOperations } from '../hooks/useEdgeOperations';
import { useDragDrop } from '../hooks/useDragDrop';
import { useNodeOperations } from '../hooks/useNodeOperations';
import { useTemplates } from '../hooks/useTemplates';
import { buildNodeFormFromNode } from '../forms/buildNodeFormFromNode';
import { useFlowModalState } from '../state/useFlowModalState';
import { useCanvasInteractionState } from '../state/useCanvasInteractionState';
import { useVariableRegistryState } from '../state/useVariableRegistryState';
import { useDebugEventState } from '../state/useDebugEventState';

type Props = {
  initialFlowId?: string | null;
};

export function useFlowVisualizationController({ initialFlowId }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<LogicEdgeData>([]);
  const {
    pendingConnection,
    setPendingConnection,
    pendingNodeClientPosition,
    setPendingNodeClientPosition,
    pendingMemoClientPosition,
    setPendingMemoClientPosition,
    pendingNodeDelete,
    setPendingNodeDelete,
    pendingNodeEdit,
    setPendingNodeEdit,
    pendingMemoEdit,
    setPendingMemoEdit,
    pendingEdgeEdit,
    setPendingEdgeEdit,
    pendingVariableEdit,
    setPendingVariableEdit,
    nodeModalOption,
    setNodeModalOption,
    nodeForm,
    setNodeForm,
    memoText,
    setMemoText,
    variableForm,
    setVariableForm,
    selectedEdgeControl,
    setSelectedEdgeControl,
    edgeForm,
    setEdgeForm,
    pendingStamp,
    setPendingStamp,
    isTemplateModalOpen,
    setIsTemplateModalOpen,
    resetTransientState,
    cancelMemoModal,
    resetVariableEditState,
    closeTemplateModal,
  } = useFlowModalState();
  const { wrapperRef, reactFlowInstance, onInit, consumePaneClickType } = useCanvasInteractionState();
  const { declaredVariables, validateTypeCompatibility } = useVariableRegistryState(nodes);
  const { debugEvent, recordDebugEvent } = useDebugEventState();
  const nextNodeSeq = useRef(1);
  const nextEdgeSeq = useRef(1);

  useEffect(() => {
    const normalized = normalizeParallelOffsets(edges);
    if (normalized !== edges) {
      setEdges(normalized);
    }
  }, [edges, setEdges]);

  const { calculateSectionSize, updateParentSectionSize, onNodeDragStart, onNodeDragStop } = useDragDrop({
    reactFlowInstance,
    setNodes,
  });

  const {
    createLogicNode,
    createSectionNode,
    createMemoNode,
    createStampNode,
    openNodeModalAtClient,
    applyNodeCreation,
    cancelNodeCreation,
    cancelNodeEdit,
    applyNodeEdit,
    openNodeDeleteModal,
    openNodeEditModal,
    deleteNodeById,
    createClassInstance,
  } = useNodeOperations({
    nodes,
    setNodes,
    setEdges,
    nextNodeSeqRef: nextNodeSeq,
    nextEdgeSeqRef: nextEdgeSeq,
    wrapperRef,
    reactFlowInstance,
    pendingNodeClientPosition,
    setPendingConnection,
    setPendingNodeClientPosition,
    setPendingMemoClientPosition,
    setPendingNodeDelete,
    pendingNodeEdit,
    setPendingNodeEdit,
    setPendingMemoEdit,
    setPendingEdgeEdit,
    setPendingStamp,
    nodeModalOption,
    setNodeModalOption,
    nodeForm,
    setNodeForm,
    variableForm,
    setVariableForm,
    setMemoText,
    updateParentSectionSize,
    buildNodeFormFromNode,
  });

  const onWrapperDoubleClickCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      openNodeModalAtClient(event);
    },
    [openNodeModalAtClient]
  );

  const openMemoCreateModal = useCallback(() => {
    const wrapper = wrapperRef.current;
    const instance = reactFlowInstance.current;
    if (!wrapper || !instance) return;
    const rect = wrapper.getBoundingClientRect();
    const center = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    };
    setPendingConnection(null);
    setPendingNodeClientPosition(null);
    setPendingNodeDelete(null);
    setPendingNodeEdit(null);
    setPendingEdgeEdit(null);
    setPendingMemoEdit(null);
    setPendingStamp(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
    setPendingMemoClientPosition(center);
    setMemoText('');
  }, [
    reactFlowInstance,
    setMemoText,
    setNodeForm,
    setNodeModalOption,
    setPendingConnection,
    setPendingEdgeEdit,
    setPendingMemoClientPosition,
    setPendingMemoEdit,
    setPendingNodeClientPosition,
    setPendingNodeDelete,
    setPendingNodeEdit,
    setPendingStamp,
    wrapperRef,
  ]);

  const openMemoEditModal = useCallback((node: Node<MemoNodeData>) => {
    setPendingConnection(null);
    setPendingNodeClientPosition(null);
    setPendingNodeDelete(null);
    setPendingNodeEdit(null);
    setPendingEdgeEdit(null);
    setPendingMemoClientPosition(null);
    setPendingStamp(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
    setMemoText(node.data.text ?? '');
    setPendingMemoEdit({ id: node.id });
  }, [
    setMemoText,
    setNodeForm,
    setNodeModalOption,
    setPendingConnection,
    setPendingEdgeEdit,
    setPendingMemoClientPosition,
    setPendingMemoEdit,
    setPendingNodeClientPosition,
    setPendingNodeDelete,
    setPendingNodeEdit,
    setPendingStamp,
  ]);

  const openVariableEditModal = useCallback((node: Node<VariableNodeData>) => {
    setPendingConnection(null);
    setPendingNodeClientPosition(null);
    setPendingNodeDelete(null);
    setPendingNodeEdit(null);
    setPendingEdgeEdit(null);
    setPendingMemoEdit(null);
    setPendingMemoClientPosition(null);
    setPendingStamp(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
    setMemoText('');
    setVariableForm({
      operationType: node.data.operationType || 'declare',
      seq: node.data.seq,
      pythonType: node.data.pythonType || 'str',
      variableName: node.data.variableName ?? '',
      initialValue: node.data.initialValue ?? '',
      scope: node.data.scope || 'global',
      targetVariable: node.data.targetVariable ?? '',
      newValue: node.data.newValue ?? '',
      elementType: node.data.elementType ?? '',
      keyType: node.data.keyType ?? '',
      valueType: node.data.valueType ?? '',
      innerType: node.data.innerType ?? '',
      unionTypes: node.data.unionTypes ?? [],
      note: node.data.note ?? '',
      genericParams: node.data.genericParams ?? '',
    });
    setPendingVariableEdit({ id: node.id });
  }, [
    setMemoText,
    setNodeForm,
    setNodeModalOption,
    setPendingConnection,
    setPendingEdgeEdit,
    setPendingMemoClientPosition,
    setPendingMemoEdit,
    setPendingNodeClientPosition,
    setPendingNodeDelete,
    setPendingNodeEdit,
    setPendingStamp,
    setPendingVariableEdit,
    setVariableForm,
  ]);

  const openTemplateModal = useCallback(() => {
    setPendingConnection(null);
    setPendingNodeClientPosition(null);
    setPendingNodeDelete(null);
    setPendingNodeEdit(null);
    setPendingEdgeEdit(null);
    setPendingMemoEdit(null);
    setPendingStamp(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
    setIsTemplateModalOpen(true);
  }, [
    setIsTemplateModalOpen,
    setNodeForm,
    setNodeModalOption,
    setPendingConnection,
    setPendingEdgeEdit,
    setPendingMemoEdit,
    setPendingNodeClientPosition,
    setPendingNodeDelete,
    setPendingNodeEdit,
    setPendingStamp,
  ]);

  const { applyTemplate } = useTemplates({
    wrapperRef,
    reactFlowInstance,
    createLogicNode,
    createSectionNode,
    calculateSectionSize,
    setNodes,
    setEdges,
    nextEdgeSeqRef: nextEdgeSeq,
    setIsTemplateModalOpen,
  });

  const {
    savedFlows,
    isLoadingFlows,
    isSavingFlow,
    saveError,
    saveName,
    setSaveName,
    currentFlowId,
    currentFlowName,
    isExportModalOpen,
    exportedText,
    isCopied,
    isImportModalOpen,
    importText,
    setImportText,
    isClearModalOpen,
    saveCurrentFlow,
    updateFlow,
    openExportModal,
    closeExportModal,
    openImportModal,
    closeImportModal,
    importFlowFromText,
    openClearModal,
    closeClearModal,
    clearCanvas,
    createNewCanvas,
    copyToClipboard,
    downloadFlowStructure,
    deleteSavedFlow,
    restoreSavedFlow,
  } = useFlowPersistence({
    nodes,
    edges,
    setNodes,
    setEdges,
    nextNodeSeq,
    nextEdgeSeq,
    resetTransientState,
    initialFlowId,
  });

  const {
    isPythonModalOpen,
    pythonCode,
    isPythonGenerating,
    isPythonImportModalOpen,
    pythonInputCode,
    setPythonInputCode,
    isCanvasGenerating,
    isPythonCopied,
    generatePythonCode,
    closePythonModal,
    openPythonImportModal,
    closePythonImportModal,
    generateCanvasFromPython,
    copyPythonCode,
    downloadPythonFile,
  } = usePythonIntegration({
    nodes,
    edges,
    setNodes,
    setEdges,
    nextNodeSeq,
    nextEdgeSeq,
  });

  const {
    onConnect,
    onEdgeUpdate,
    findEdgeNearPointInSection,
    openEdgeEditModal,
    onEdgeDoubleClick,
    openEdgeEditModalById,
    deleteEdgeById,
    onEdgeControlChange,
    closeEdgeModal,
    applySelectedControl,
  } = useEdgeOperations({
    nodes,
    edges,
    setNodes,
    setEdges,
    pendingConnection,
    setPendingConnection,
    pendingEdgeEdit,
    setPendingEdgeEdit,
    selectedEdgeControl,
    setSelectedEdgeControl,
    edgeForm,
    setEdgeForm,
    nextEdgeSeqRef: nextEdgeSeq,
    setPendingNodeClientPosition,
    setPendingNodeDelete,
    setPendingNodeEdit,
    setPendingMemoEdit,
    setPendingMemoClientPosition,
  });

  const onWrapperClickCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      recordDebugEvent('wrapper click', event);
    },
    [recordDebugEvent]
  );

  const onPaneClick = useCallback(
    (event: ReactMouseEvent) => {
      if (pendingStamp) {
        const instance = reactFlowInstance.current;
        if (!instance) return;
        const flowPosition = instance.screenToFlowPosition({
          x: event.clientX,
          y: event.clientY,
        });
        const stampNode = createStampNode({ stamp: pendingStamp, position: flowPosition });
        setNodes((currentNodes) => [...currentNodes, stampNode]);
        setPendingStamp(null);
        return;
      }
      const isDoubleClick = consumePaneClickType();
      recordDebugEvent(isDoubleClick ? 'pane double click' : 'pane click', event);
    },
    [
      consumePaneClickType,
      createStampNode,
      pendingStamp,
      reactFlowInstance,
      recordDebugEvent,
      setNodes,
      setPendingStamp,
    ]
  );

  const cancelConnection = useCallback(() => {
    setPendingConnection(null);
  }, [setPendingConnection]);

  const onNodeDoubleClick = useCallback(
    (event: ReactMouseEvent, node: Node<FlowNodeData>) => {
      event.preventDefault();
      event.stopPropagation();
      if (node.type === 'memoNode') {
        openMemoEditModal(node as Node<MemoNodeData>);
        return;
      }
      if (node.type === 'typeNode' || node.type === 'variableNode') {
        openVariableEditModal(node as Node<VariableNodeData>);
        return;
      }
      if (node.type === 'stampNode') return;
      if (node.type === 'sectionNode') {
        const instance = reactFlowInstance.current;
        if (instance) {
          const flowPoint = instance.screenToFlowPosition({
            x: event.clientX,
            y: event.clientY,
          });
          const hitEdge = findEdgeNearPointInSection(node.id, flowPoint);
          if (hitEdge) {
            openEdgeEditModal(hitEdge);
            return;
          }
        }
      }
      openNodeEditModal(node);
    },
    [
      findEdgeNearPointInSection,
      openEdgeEditModal,
      openMemoEditModal,
      openNodeEditModal,
      openVariableEditModal,
      reactFlowInstance,
    ]
  );

  const applyMemoCreation = useCallback(() => {
    if (!pendingMemoClientPosition) return;
    const instance = reactFlowInstance.current;
    if (!instance) return;
    const flowPosition = instance.screenToFlowPosition(pendingMemoClientPosition);
    const memoNode = createMemoNode({ text: memoText, position: flowPosition });
    setNodes((currentNodes) => [...currentNodes, memoNode]);
    setPendingMemoClientPosition(null);
    setMemoText('');
  }, [
    createMemoNode,
    memoText,
    pendingMemoClientPosition,
    reactFlowInstance,
    setMemoText,
    setNodes,
    setPendingMemoClientPosition,
  ]);

  const applyMemoEdit = useCallback(() => {
    if (!pendingMemoEdit) return;
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== pendingMemoEdit.id || node.type !== 'memoNode') return node;
        return { ...node, data: { ...(node.data as MemoNodeData), text: memoText } };
      })
    );
    setPendingMemoEdit(null);
    setMemoText('');
  }, [memoText, pendingMemoEdit, setMemoText, setNodes, setPendingMemoEdit]);

  const applyVariableEdit = useCallback(() => {
    if (!pendingVariableEdit) return;
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== pendingVariableEdit.id || (node.type !== 'variableNode' && node.type !== 'typeNode')) return node;
        return { ...node, type: 'variableNode', data: { ...variableForm } };
      })
    );
    resetVariableEditState();
  }, [pendingVariableEdit, resetVariableEditState, setNodes, variableForm]);

  const cancelVariableEdit = resetVariableEditState;

  const nodesForRender = useMemo(
    () =>
      nodes.map((node) => {
        if (node.type === 'stampNode') {
          return {
            ...node,
            data: { ...(node.data as StampNodeData), onDelete: deleteNodeById },
          };
        }
        return node;
      }),
    [deleteNodeById, nodes]
  );

  const edgesForRender = useMemo(
    () =>
      edges.map((edge) => ({
        ...edge,
        data: { ...ensureEdgeData(edge), onEdit: openEdgeEditModalById },
      })),
    [edges, openEdgeEditModalById]
  );

  return {
    // refs
    wrapperRef,
    // ReactFlow core
    nodes,
    edges,
    nodesForRender,
    edgesForRender,
    onNodesChange,
    onEdgesChange,
    onInit,
    // canvas event handlers
    onWrapperDoubleClickCapture,
    onWrapperClickCapture,
    onPaneClick,
    onNodeDoubleClick,
    onNodeDragStart,
    onNodeDragStop,
    onConnect,
    onEdgeUpdate,
    onEdgeDoubleClick,
    // debug
    debugEvent,
    // save panel
    saveName,
    setSaveName,
    isSavingFlow,
    saveCurrentFlow,
    saveError,
    savedFlows,
    isLoadingFlows,
    restoreSavedFlow,
    deleteSavedFlow,
    // action panel
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
    // edge modal
    pendingConnection,
    pendingEdgeEdit,
    selectedEdgeControl,
    edgeForm,
    setEdgeForm,
    onEdgeControlChange,
    applySelectedControl,
    cancelConnection,
    closeEdgeModal,
    deleteEdgeById,
    // memo modal
    pendingMemoClientPosition,
    pendingMemoEdit,
    memoText,
    setMemoText,
    applyMemoCreation,
    applyMemoEdit,
    cancelMemoModal,
    deleteNodeById,
    // variable modal
    pendingVariableEdit,
    variableForm,
    setVariableForm,
    cancelVariableEdit,
    applyVariableEdit,
    // node modal
    pendingNodeClientPosition,
    pendingNodeEdit,
    nodeForm,
    setNodeForm,
    nodeModalOption,
    setNodeModalOption,
    declaredVariables,
    validateTypeCompatibility,
    applyNodeCreation,
    applyNodeEdit,
    cancelNodeCreation,
    cancelNodeEdit,
    createClassInstance,
    openNodeDeleteModal,
    // node delete overlay
    pendingNodeDelete,
    setPendingNodeDelete,
    // template overlay
    isTemplateModalOpen,
    applyTemplate,
    closeTemplateModal,
    // export overlay
    isExportModalOpen,
    exportedText,
    isCopied,
    copyToClipboard,
    downloadFlowStructure,
    closeExportModal,
    // python overlay
    isPythonModalOpen,
    isPythonGenerating,
    pythonCode,
    isPythonCopied,
    copyPythonCode,
    downloadPythonFile,
    closePythonModal,
    // python import overlay
    isPythonImportModalOpen,
    pythonInputCode,
    setPythonInputCode,
    isCanvasGenerating,
    generateCanvasFromPython,
    closePythonImportModal,
    // import overlay
    isImportModalOpen,
    importText,
    setImportText,
    importFlowFromText,
    closeImportModal,
    // clear overlay
    isClearModalOpen,
    closeClearModal,
    clearCanvas,
  };
}
