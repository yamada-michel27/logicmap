'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  XYPosition,
  ReactFlowInstance,
  ConnectionMode,
} from 'reactflow';

import 'reactflow/dist/style.css';
import '@reactflow/node-resizer/dist/style.css';

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
} from './flow/types';
import {
  DEFAULT_EDGE_CONTROL,
  EMPTY_NODE_FORM,
  EMPTY_EDGE_FORM,
} from './flow/constants';
import {
  ensureEdgeData,
  normalizeParallelOffsets,
} from './flow/utils';
import { useFlowPersistence } from './flow/hooks/useFlowPersistence';
import { usePythonIntegration } from './flow/hooks/usePythonIntegration';
import { useEdgeOperations } from './flow/hooks/useEdgeOperations';
import { useDragDrop } from './flow/hooks/useDragDrop';
import { useNodeOperations } from './flow/hooks/useNodeOperations';
import { useTemplates } from './flow/hooks/useTemplates';
import EdgeModal from './flow/modals/EdgeModal';
import MemoModal from './flow/modals/MemoModal';
import VariableModal from './flow/modals/VariableModal';
import NodeModal from './flow/modals/NodeModal';
import { nodeTypes } from './flow/nodes';
import { edgeTypes } from './flow/edges';
import { buildNodeFormFromNode } from './flow/forms/buildNodeFormFromNode';
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

type FlowVisualizationProps = {
  initialFlowId?: string | null;
};

export default function FlowVisualization({ initialFlowId }: FlowVisualizationProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<LogicEdgeData>([]);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [pendingNodeClientPosition, setPendingNodeClientPosition] = useState<XYPosition | null>(
    null
  );
  const [pendingMemoClientPosition, setPendingMemoClientPosition] = useState<XYPosition | null>(
    null
  );
  const [pendingNodeDelete, setPendingNodeDelete] = useState<{ id: string; label: string } | null>(
    null
  );
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
    note: ''
  });
  const [selectedEdgeControl, setSelectedEdgeControl] =
    useState<EdgeControlType>(DEFAULT_EDGE_CONTROL);
  const [edgeForm, setEdgeForm] = useState<EdgeFormState>({ ...EMPTY_EDGE_FORM });
  const [pendingStamp, setPendingStamp] = useState<StampType | null>(null);
  const [pendingVariableEdit, setPendingVariableEdit] = useState<{ id: string } | null>(null);

  // Phase8: 変数管理システム
  const [declaredVariables, setDeclaredVariables] = useState<Map<string, { type: PythonType; scope: VariableScope; nodeId: string }>>(new Map());

  // 変数リストを更新する関数
  const updateDeclaredVariables = useCallback((currentNodes: Node<FlowNodeData>[]) => {
    const newDeclaredVariables = new Map<string, { type: PythonType; scope: VariableScope; nodeId: string }>();

    currentNodes.forEach(node => {
      if ((node.type === 'variableNode' || node.type === 'typeNode') && node.data) {
        const data = node.data as VariableNodeData;

        // 宣言モードの場合のみ変数リストに追加
        if ((data.operationType === 'declare' || !data.operationType) && data.variableName && data.pythonType) {
          newDeclaredVariables.set(data.variableName, {
            type: data.pythonType,
            scope: data.scope || 'global',
            nodeId: node.id
          });
        }
      }
    });

    setDeclaredVariables(newDeclaredVariables);
  }, []);

  // ノードが変更されたときに変数リストを更新
  useEffect(() => {
    updateDeclaredVariables(nodes);
  }, [nodes, updateDeclaredVariables]);

  // Phase8: 型チェック機能
  const validateTypeCompatibility = useCallback((targetVariable: string, newValue: string): { isValid: boolean; message?: string } => {
    const varInfo = declaredVariables.get(targetVariable);
    if (!varInfo) {
      return { isValid: false, message: '変数が見つかりません' };
    }

    if (!newValue || newValue.trim() === '') {
      return { isValid: false, message: '値を入力してください' };
    }

    const trimmedValue = newValue.trim();

    // 基本的な型チェック
    switch (varInfo.type) {
      case 'int':
        const isInt = /^-?\d+$/.test(trimmedValue);
        return { isValid: isInt, message: isInt ? undefined : '整数を入力してください（例: 123, -456）' };

      case 'float':
        const isFloat = /^-?\d+(\.\d+)?$/.test(trimmedValue) && !isNaN(Number(trimmedValue));
        return { isValid: isFloat, message: isFloat ? undefined : '数値を入力してください（例: 3.14, -2.5）' };

      case 'bool':
        const isBool = ['True', 'False', 'true', 'false'].includes(trimmedValue);
        return { isValid: isBool, message: isBool ? undefined : 'True または False を入力してください' };

      case 'str':
        const isStr = /^["'].*["']$/.test(trimmedValue) || trimmedValue.length > 0;
        return { isValid: isStr, message: isStr ? undefined : '文字列を入力してください（例: "hello", \'world\'）' };

      case 'list':
        const isList = /^\[.*\]$/.test(trimmedValue);
        return { isValid: isList, message: isList ? undefined : 'リスト形式で入力してください（例: [1, 2, 3]）' };

      case 'dict':
        const isDict = /^\{.*\}$/.test(trimmedValue);
        return { isValid: isDict, message: isDict ? undefined : '辞書形式で入力してください（例: {"key": "value"}）' };

      case 'tuple':
        const isTuple = /^\(.*\)$/.test(trimmedValue);
        return { isValid: isTuple, message: isTuple ? undefined : 'タプル形式で入力してください（例: (1, 2, 3)）' };

      case 'set':
        const isSet = /^\{.*\}$/.test(trimmedValue) && !trimmedValue.includes(':');
        return { isValid: isSet, message: isSet ? undefined : 'セット形式で入力してください（例: {1, 2, 3}）' };

      case 'None':
        const isNone = trimmedValue === 'None';
        return { isValid: isNone, message: isNone ? undefined : 'None を入力してください' };

      default:
        // Optional, Union, Any等の複合型は基本的にOK
        return { isValid: true };
    }
  }, [declaredVariables]);

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

  useEffect(() => {
    const normalized = normalizeParallelOffsets(edges);
    if (normalized !== edges) {
      setEdges(normalized);
    }
  }, [edges, setEdges]);

  const {
    calculateSectionSize,
    updateParentSectionSize,
    onNodeDragStart,
    onNodeDragStop,
  } = useDragDrop({
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
      operationType: node.data.operationType || 'declare', // 後方互換性
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
      genericParams: node.data.genericParams ?? ''
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
    [
      findEdgeNearPointInSection,
      openEdgeEditModal,
      openMemoEditModal,
      openNodeEditModal,
      openVariableEditModal,
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
  }, [createMemoNode, memoText, pendingMemoClientPosition, setNodes]);

  const applyMemoEdit = useCallback(() => {
    if (!pendingMemoEdit) return;
    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== pendingMemoEdit.id || node.type !== 'memoNode') return node;
        return {
          ...node,
          data: { ...(node.data as MemoNodeData), text: memoText },
        };
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
        return {
          ...node,
          type: 'variableNode', // 型ノードも変数ノードに統一
          data: { ...variableForm },
        };
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
      note: ''
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
      note: ''
    });
  }, []);

  const nodesForRender = useMemo(
    () =>
      nodes.map((node) => {
        if (node.type === 'stampNode') {
          return {
            ...node,
            data: {
              ...(node.data as StampNodeData),
              onDelete: deleteNodeById,
            },
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
        data: {
          ...ensureEdgeData(edge),
          onEdit: openEdgeEditModalById,
        },
      })),
    [edges, openEdgeEditModalById]
  );

  return (
    <div
      className="relative h-full w-full bg-gradient-to-br from-slate-50 via-slate-100 to-sky-50"
      ref={wrapperRef}
      onDoubleClickCapture={onWrapperDoubleClickCapture}
      onClickCapture={onWrapperClickCapture}
    >
      <SavePanel
        saveName={saveName}
        setSaveName={setSaveName}
        isSavingFlow={isSavingFlow}
        saveCurrentFlow={saveCurrentFlow}
        saveError={saveError}
        savedFlows={savedFlows}
        isLoadingFlows={isLoadingFlows}
        restoreSavedFlow={restoreSavedFlow}
        deleteSavedFlow={deleteSavedFlow}
      />
      <ActionPanel
        currentFlowId={currentFlowId}
        currentFlowName={currentFlowName}
        updateFlow={updateFlow}
        openTemplateModal={openTemplateModal}
        createNewCanvas={createNewCanvas}
        openExportModal={openExportModal}
        openImportModal={openImportModal}
        generatePythonCode={generatePythonCode}
        openPythonImportModal={openPythonImportModal}
        openClearModal={openClearModal}
        openMemoCreateModal={openMemoCreateModal}
        pendingStamp={pendingStamp}
        setPendingStamp={setPendingStamp}
      />
      <DebugPanel debugEvent={debugEvent} />
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
      <NodeDeleteOverlay
        pendingNodeDelete={pendingNodeDelete}
        setPendingNodeDelete={setPendingNodeDelete}
        deleteNodeById={deleteNodeById}
      />
      <TemplateModalOverlay
        isTemplateModalOpen={isTemplateModalOpen}
        applyTemplate={applyTemplate}
        closeTemplateModal={closeTemplateModal}
      />
      <ExportModalOverlay
        isExportModalOpen={isExportModalOpen}
        exportedText={exportedText}
        isCopied={isCopied}
        copyToClipboard={copyToClipboard}
        downloadFlowStructure={downloadFlowStructure}
        closeExportModal={closeExportModal}
      />
      <PythonModalOverlay
        isPythonModalOpen={isPythonModalOpen}
        isPythonGenerating={isPythonGenerating}
        pythonCode={pythonCode}
        isPythonCopied={isPythonCopied}
        copyPythonCode={copyPythonCode}
        downloadPythonFile={downloadPythonFile}
        closePythonModal={closePythonModal}
      />
      <PythonImportModalOverlay
        isPythonImportModalOpen={isPythonImportModalOpen}
        pythonInputCode={pythonInputCode}
        setPythonInputCode={setPythonInputCode}
        isCanvasGenerating={isCanvasGenerating}
        generateCanvasFromPython={generateCanvasFromPython}
        closePythonImportModal={closePythonImportModal}
      />
      <ImportModalOverlay
        isImportModalOpen={isImportModalOpen}
        importText={importText}
        setImportText={setImportText}
        importFlowFromText={importFlowFromText}
        closeImportModal={closeImportModal}
      />
      <ClearModalOverlay
        isClearModalOpen={isClearModalOpen}
        closeClearModal={closeClearModal}
        clearCanvas={clearCanvas}
      />
    </div>
  );
}
