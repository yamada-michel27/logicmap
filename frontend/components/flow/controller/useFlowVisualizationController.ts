'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import {
  useNodesState,
  useEdgesState,
  type Connection,
  type Node,
  type XYPosition,
  type ReactFlowInstance,
} from 'reactflow';

import type {
  EdgeControlType,
  PythonType,
  MemoNodeData,
  StampNodeData,
  VariableScope,
  VariableNodeData,
  FlowNodeData,
  LogicEdgeData,
  NodeFormState,
  EdgeFormState,
  NodeOption,
  StampType,
} from '../types';
import {
  DEFAULT_EDGE_CONTROL,
  EMPTY_NODE_FORM,
  EMPTY_EDGE_FORM,
} from '../constants';
import { ensureEdgeData, normalizeParallelOffsets } from '../utils';
import { useFlowPersistence } from '../hooks/useFlowPersistence';
import { usePythonIntegration } from '../hooks/usePythonIntegration';
import { useEdgeOperations } from '../hooks/useEdgeOperations';
import { useDragDrop } from '../hooks/useDragDrop';
import { useNodeOperations } from '../hooks/useNodeOperations';
import { useTemplates } from '../hooks/useTemplates';
import { buildNodeFormFromNode } from '../forms/buildNodeFormFromNode';

type Props = {
  initialFlowId?: string | null;
};

export function useFlowVisualizationController({ initialFlowId }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<LogicEdgeData>([]);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [pendingNodeClientPosition, setPendingNodeClientPosition] = useState<XYPosition | null>(null);
  const [pendingMemoClientPosition, setPendingMemoClientPosition] = useState<XYPosition | null>(null);
  const [pendingNodeDelete, setPendingNodeDelete] = useState<{ id: string; label: string } | null>(null);
  const [pendingNodeEdit, setPendingNodeEdit] = useState<{ id: string } | null>(null);
  const [pendingMemoEdit, setPendingMemoEdit] = useState<{ id: string } | null>(null);
  const [pendingEdgeEdit, setPendingEdgeEdit] = useState<{ id: string } | null>(null);
  const [nodeModalOption, setNodeModalOption] = useState<NodeOption | null>(null);
  const [nodeForm, setNodeForm] = useState<NodeFormState>({ ...EMPTY_NODE_FORM });
  const [memoText, setMemoText] = useState('');
  const [variableForm, setVariableForm] = useState<VariableNodeData>({
    operationType: 'declare',
    seq: 0,
    pythonType: 'str',
    variableName: '',
    initialValue: '',
    scope: 'global',
    note: '',
  });
  const [selectedEdgeControl, setSelectedEdgeControl] = useState<EdgeControlType>(DEFAULT_EDGE_CONTROL);
  const [edgeForm, setEdgeForm] = useState<EdgeFormState>({ ...EMPTY_EDGE_FORM });
  const [pendingStamp, setPendingStamp] = useState<StampType | null>(null);
  const [pendingVariableEdit, setPendingVariableEdit] = useState<{ id: string } | null>(null);

  const [declaredVariables, setDeclaredVariables] = useState<Map<string, { type: PythonType; scope: VariableScope; nodeId: string }>>(new Map());

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [debugEvent, setDebugEvent] = useState<{
    type: string;
    x: number;
    y: number;
    count: number;
  } | null>(null);

  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const nextNodeSeq = useRef(1);
  const nextEdgeSeq = useRef(1);
  const debugEventCount = useRef(0);
  const lastPaneClickAt = useRef<number | null>(null);

  const updateDeclaredVariables = useCallback((currentNodes: Node<FlowNodeData>[]) => {
    const newDeclaredVariables = new Map<string, { type: PythonType; scope: VariableScope; nodeId: string }>();
    currentNodes.forEach((node) => {
      if ((node.type === 'variableNode' || node.type === 'typeNode') && node.data) {
        const data = node.data as VariableNodeData;
        if ((data.operationType === 'declare' || !data.operationType) && data.variableName && data.pythonType) {
          newDeclaredVariables.set(data.variableName, {
            type: data.pythonType,
            scope: data.scope || 'global',
            nodeId: node.id,
          });
        }
      }
    });
    setDeclaredVariables(newDeclaredVariables);
  }, []);

  useEffect(() => {
    updateDeclaredVariables(nodes);
  }, [nodes, updateDeclaredVariables]);

  const validateTypeCompatibility = useCallback(
    (targetVariable: string, newValue: string): { isValid: boolean; message?: string } => {
      const varInfo = declaredVariables.get(targetVariable);
      if (!varInfo) {
        return { isValid: false, message: '変数が見つかりません' };
      }
      if (!newValue || newValue.trim() === '') {
        return { isValid: false, message: '値を入力してください' };
      }
      const trimmedValue = newValue.trim();
      switch (varInfo.type) {
        case 'int': {
          const isInt = /^-?\d+$/.test(trimmedValue);
          return { isValid: isInt, message: isInt ? undefined : '整数を入力してください（例: 123, -456）' };
        }
        case 'float': {
          const isFloat = /^-?\d+(\.\d+)?$/.test(trimmedValue) && !isNaN(Number(trimmedValue));
          return { isValid: isFloat, message: isFloat ? undefined : '数値を入力してください（例: 3.14, -2.5）' };
        }
        case 'bool': {
          const isBool = ['True', 'False', 'true', 'false'].includes(trimmedValue);
          return { isValid: isBool, message: isBool ? undefined : 'True または False を入力してください' };
        }
        case 'str': {
          const isStr = /^["'].*["']$/.test(trimmedValue) || trimmedValue.length > 0;
          return { isValid: isStr, message: isStr ? undefined : '文字列を入力してください（例: "hello", \'world\'）' };
        }
        case 'list': {
          const isList = /^\[.*\]$/.test(trimmedValue);
          return { isValid: isList, message: isList ? undefined : 'リスト形式で入力してください（例: [1, 2, 3]）' };
        }
        case 'dict': {
          const isDict = /^\{.*\}$/.test(trimmedValue);
          return { isValid: isDict, message: isDict ? undefined : '辞書形式で入力してください（例: {"key": "value"})' };
        }
        case 'tuple': {
          const isTuple = /^\(.*\)$/.test(trimmedValue);
          return { isValid: isTuple, message: isTuple ? undefined : 'タプル形式で入力してください（例: (1, 2, 3)）' };
        }
        case 'set': {
          const isSet = /^\{.*\}$/.test(trimmedValue) && !trimmedValue.includes(':');
          return { isValid: isSet, message: isSet ? undefined : 'セット形式で入力してください（例: {1, 2, 3}）' };
        }
        case 'None': {
          const isNone = trimmedValue === 'None';
          return { isValid: isNone, message: isNone ? undefined : 'None を入力してください' };
        }
        default:
          return { isValid: true };
      }
    },
    [declaredVariables]
  );

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
  }, []);

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
  }, []);

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
  }, []);

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
  }, []);

  const closeTemplateModal = useCallback(() => {
    setIsTemplateModalOpen(false);
  }, []);

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

  const cancelMemoModal = useCallback(() => {
    setPendingMemoClientPosition(null);
    setPendingMemoEdit(null);
    setMemoText('');
  }, []);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  const resetTransientState = useCallback(() => {
    setPendingConnection(null);
    setPendingNodeClientPosition(null);
    setPendingMemoClientPosition(null);
    setPendingNodeDelete(null);
    setPendingNodeEdit(null);
    setPendingMemoEdit(null);
    setPendingEdgeEdit(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
    setMemoText('');
    setSelectedEdgeControl(DEFAULT_EDGE_CONTROL);
    setEdgeForm({ ...EMPTY_EDGE_FORM });
    setPendingStamp(null);
  }, []);

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

  const recordDebugEvent = useCallback((type: string, event: ReactMouseEvent) => {
    debugEventCount.current += 1;
    setDebugEvent({
      type,
      x: Math.round(event.clientX),
      y: Math.round(event.clientY),
      count: debugEventCount.current,
    });
  }, []);

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
      const now = Date.now();
      const lastClick = lastPaneClickAt.current;
      const isDoubleClick = lastClick !== null && now - lastClick < 320;
      lastPaneClickAt.current = now;
      recordDebugEvent(isDoubleClick ? 'pane double click' : 'pane click', event);
    },
    [createStampNode, pendingStamp, recordDebugEvent, setNodes]
  );

  const cancelConnection = useCallback(() => {
    setPendingConnection(null);
  }, []);

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
    [findEdgeNearPointInSection, openEdgeEditModal, openMemoEditModal, openNodeEditModal, openVariableEditModal]
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
  }, [createMemoNode, memoText, pendingMemoClientPosition, setNodes]);

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
  }, [memoText, pendingMemoEdit, setNodes]);

  const applyVariableEdit = useCallback(() => {
    if (!pendingVariableEdit) return;
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== pendingVariableEdit.id || (node.type !== 'variableNode' && node.type !== 'typeNode')) return node;
        return { ...node, type: 'variableNode', data: { ...variableForm } };
      })
    );
    setPendingVariableEdit(null);
    setVariableForm({
      operationType: 'declare',
      seq: 0,
      pythonType: 'str',
      variableName: '',
      initialValue: '',
      scope: 'global',
      note: '',
    });
  }, [pendingVariableEdit, setNodes, variableForm]);

  const cancelVariableEdit = useCallback(() => {
    setPendingVariableEdit(null);
    setVariableForm({
      operationType: 'declare',
      seq: 0,
      pythonType: 'str',
      variableName: '',
      initialValue: '',
      scope: 'global',
      note: '',
    });
  }, []);

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
