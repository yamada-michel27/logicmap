'use client';

import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  Edge,
  Node,
  NodeProps,
  Handle,
  Position,
  XYPosition,
  ReactFlowInstance,
  ConnectionMode,
  type NodeDragHandler,
} from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';

import 'reactflow/dist/style.css';
import '@reactflow/node-resizer/dist/style.css';

type NodeKind = 'start' | 'end' | 'normal';
type SectionType = 'function' | 'class';

const EDGE_CONTROL_TYPES = [
  'flow',
  'while',
  'for',
  'if-else',
  'break',
  'continue',
  'try-except',
  'function',
  'class',
] as const;

type ControlType = (typeof EDGE_CONTROL_TYPES)[number];

type LogicNodeData = {
  label?: string;
  nodeKind: NodeKind;
  seq: number;
  controlType?: ControlType;
};

type SectionNodeData = {
  label: string;
  sectionType: SectionType;
  seq: number;
  controlType?: ControlType;
};

type FlowNodeData = LogicNodeData | SectionNodeData;

type LogicEdgeData = {
  controlType: ControlType;
};

type NodeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function toRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (normalized.length !== 6) return `rgba(248, 250, 252, ${alpha})`;
  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return `rgba(248, 250, 252, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const CONTROL_STYLE: Record<
  ControlType,
  { label: string; color: string; edgeDash?: string; nodeBg?: string; modalLabel?: string }
> = {
  flow: { label: '', color: '#64748b', modalLabel: '通常（ラベルなし）' },
  while: { label: 'while', color: '#2563eb', edgeDash: '6 4' },
  for: { label: 'for', color: '#0f766e', edgeDash: '6 4' },
  'if-else': { label: 'if-else', color: '#4f46e5' },
  break: { label: 'break', color: '#b91c1c', edgeDash: '4 4' },
  continue: { label: 'continue', color: '#c2410c', edgeDash: '2 4' },
  'try-except': { label: 'try-except', color: '#15803d', edgeDash: '4 2' },
  function: { label: 'function', color: '#0e7490', nodeBg: '#ecfeff' },
  class: { label: 'class', color: '#1d4ed8', nodeBg: '#eff6ff' },
};

const SECTION_MIN_WIDTH = 240;
const SECTION_MIN_HEIGHT = 160;
const SECTION_DEFAULT_WIDTH = 320;
const SECTION_DEFAULT_HEIGHT = 220;
const EDGE_STROKE_WIDTH = 3;
const DEFAULT_EDGE_CONTROL: ControlType = 'flow';

type NodeOption = {
  label: string;
  kind: NodeKind | 'section';
  sectionType?: SectionType;
  nodeLabel?: string;
};

const NODE_OPTIONS: NodeOption[] = [
  { label: 'Start', kind: 'start' },
  { label: 'End', kind: 'end' },
  { label: '通常', kind: 'normal', nodeLabel: '' },
  { label: CONTROL_STYLE.function.label, kind: 'section', sectionType: 'function' },
  { label: CONTROL_STYLE.class.label, kind: 'section', sectionType: 'class' },
];

function getNodeRect(node: Node<FlowNodeData>): NodeRect | null {
  const width =
    node.width ?? (typeof node.style?.width === 'number' ? node.style.width : undefined);
  const height =
    node.height ?? (typeof node.style?.height === 'number' ? node.style.height : undefined);
  if (!width || !height) return null;
  const position = node.positionAbsolute ?? node.position;
  return { x: position.x, y: position.y, width, height };
}

function findSectionAtPoint(
  point: XYPosition,
  sectionNodes: Node<SectionNodeData>[]
): Node<SectionNodeData> | null {
  let best: Node<SectionNodeData> | null = null;
  let bestArea = Number.POSITIVE_INFINITY;
  for (const section of sectionNodes) {
    const rect = getNodeRect(section);
    if (!rect) continue;
    const inside =
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height;
    if (!inside) continue;
    const area = rect.width * rect.height;
    if (area < bestArea) {
      best = section;
      bestArea = area;
    }
  }
  return best;
}

function getBaseNodeClass(nodeKind: NodeKind) {
  if (nodeKind === 'start') return 'bg-emerald-50';
  if (nodeKind === 'end') return 'bg-rose-50';
  return 'bg-white';
}

function LogicNode({ data }: NodeProps<LogicNodeData>) {
  const controlStyle = data.controlType ? CONTROL_STYLE[data.controlType] : null;
  const label =
    data.label ?? (data.nodeKind === 'start' ? 'Start' : data.nodeKind === 'end' ? 'End' : '');
  const borderColor = controlStyle?.color ?? '#1f2937';
  const nodeBg = controlStyle?.nodeBg ?? undefined;
  const showLabel = label.length > 0;

  return (
    <div
      className={`rounded-md border-2 shadow-sm px-4 py-3 min-w-[120px] text-sm font-medium text-gray-900 ${getBaseNodeClass(
        data.nodeKind
      )}`}
      style={{
        borderColor,
        backgroundColor: nodeBg,
        borderStyle:
          controlStyle?.edgeDash || data.controlType === 'function' || data.controlType === 'class'
            ? 'dashed'
            : 'solid',
        boxShadow:
          data.controlType === 'function' || data.controlType === 'class'
            ? `0 0 0 3px ${borderColor}22`
            : undefined,
      }}
    >
      {showLabel ? <div className="text-sm font-semibold">{label}</div> : null}
      <Handle type="source" position={Position.Left} id="h-left" />
      <Handle type="source" position={Position.Right} id="h-right" />
      <Handle type="source" position={Position.Top} id="h-top" />
      <Handle type="source" position={Position.Bottom} id="h-bottom" />
    </div>
  );
}

function SectionNode({ data, selected }: NodeProps<SectionNodeData>) {
  const style = CONTROL_STYLE[data.sectionType];
  const sectionBg = toRgba(style.nodeBg ?? '#f8fafc', 0.45);
  return (
    <div
      className="relative h-full w-full rounded-xl border-2 border-dashed p-3 text-sm text-gray-700 shadow-sm"
      style={{ borderColor: style.color, backgroundColor: sectionBg }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={SECTION_MIN_WIDTH}
        minHeight={SECTION_MIN_HEIGHT}
      />
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: style.color }}>
        {style.label}
      </div>
      <Handle type="source" position={Position.Left} id="section-h-left" />
      <Handle type="source" position={Position.Right} id="section-h-right" />
      <Handle type="source" position={Position.Top} id="section-h-top" />
      <Handle type="source" position={Position.Bottom} id="section-h-bottom" />
    </div>
  );
}

const nodeTypes = {
  logicNode: LogicNode,
  sectionNode: SectionNode,
};

export default function FlowVisualization() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<LogicEdgeData>([]);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [pendingNodeClientPosition, setPendingNodeClientPosition] = useState<XYPosition | null>(
    null
  );
  const [selectedEdgeControl, setSelectedEdgeControl] =
    useState<ControlType>(DEFAULT_EDGE_CONTROL);
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

  const createLogicNode = useCallback(
    (params: {
      kind: NodeKind;
      label: string;
      position: XYPosition;
      controlType?: ControlType;
    }): Node<LogicNodeData> => {
      const seq = nextNodeSeq.current++;
      return {
        id: `node-${seq}`,
        type: 'logicNode',
        position: params.position,
        data: {
          label: params.label,
          nodeKind: params.kind,
          seq,
          controlType: params.controlType,
        },
      };
    },
    []
  );

  const createSectionNode = useCallback(
    (params: { sectionType: SectionType; label: string; position: XYPosition }): Node<SectionNodeData> => {
      const seq = nextNodeSeq.current++;
      return {
        id: `section-${seq}`,
        type: 'sectionNode',
        position: params.position,
        style: { width: SECTION_DEFAULT_WIDTH, height: SECTION_DEFAULT_HEIGHT },
        data: {
          label: params.label,
          sectionType: params.sectionType,
          seq,
        },
      };
    },
    []
  );

  const onConnect = useCallback((params: Connection) => {
    setPendingNodeClientPosition(null);
    setSelectedEdgeControl(DEFAULT_EDGE_CONTROL);
    setPendingConnection(params);
  }, []);

  const openNodeModalAtClient = useCallback((event: ReactMouseEvent) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    if (
      event.clientX < rect.left ||
      event.clientX > rect.right ||
      event.clientY < rect.top ||
      event.clientY > rect.bottom
    ) {
      return;
    }
    event.preventDefault();
    setPendingConnection(null);
    setPendingNodeClientPosition({ x: event.clientX, y: event.clientY });
  }, []);

  const onWrapperDoubleClickCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      openNodeModalAtClient(event);
    },
    [openNodeModalAtClient]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

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
      const now = Date.now();
      const lastClick = lastPaneClickAt.current;
      const isDoubleClick = lastClick !== null && now - lastClick < 320;
      lastPaneClickAt.current = now;
      recordDebugEvent(isDoubleClick ? 'pane double click' : 'pane click', event);
    },
    [recordDebugEvent]
  );

  const applyControlType = useCallback(
    (controlType: ControlType) => {
      if (!pendingConnection?.source || !pendingConnection.target) {
        setPendingConnection(null);
        return;
      }
      const style = CONTROL_STYLE[controlType];
      const edgeId = `edge-${nextEdgeSeq.current++}`;
      const edge: Edge<LogicEdgeData> = {
        id: edgeId,
        source: pendingConnection.source,
        target: pendingConnection.target,
        label: style.label || undefined,
        style: {
          stroke: style.color,
          strokeWidth: EDGE_STROKE_WIDTH,
          strokeDasharray: style.edgeDash,
        },
        labelStyle: {
          fill: style.color,
          fontWeight: 600,
        },
        data: { controlType },
      };

      setEdges((eds) => addEdge(edge, eds));
      if (controlType !== 'flow') {
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.id === pendingConnection.source || node.id === pendingConnection.target) {
              return {
                ...node,
                data: { ...node.data, controlType },
              };
            }
            return node;
          })
        );
      }
      setPendingConnection(null);
    },
    [pendingConnection, setEdges, setNodes]
  );

  const cancelConnection = useCallback(() => {
    setPendingConnection(null);
  }, []);

  const applyNodeOption = useCallback(
    (option: NodeOption) => {
      if (!pendingNodeClientPosition) return;
      const instance = reactFlowInstance.current;
      if (!instance) return;
      const flowPosition = instance.screenToFlowPosition(pendingNodeClientPosition);
      if (option.kind === 'section') {
        if (!option.sectionType) {
          setPendingNodeClientPosition(null);
          return;
        }
        const newSection = createSectionNode({
          sectionType: option.sectionType,
          label: option.label,
          position: flowPosition,
        });
        setNodes((currentNodes) => [newSection, ...currentNodes]);
        setPendingNodeClientPosition(null);
        return;
      }

      const sectionNodes = instance
        .getNodes()
        .filter((node): node is Node<SectionNodeData> => node.type === 'sectionNode');
      const parentSection = findSectionAtPoint(flowPosition, sectionNodes);
      const baseNode = createLogicNode({
        kind: option.kind,
        label: option.nodeLabel ?? option.label,
        position: flowPosition,
      });
      let newNode: Node<LogicNodeData> = baseNode;
      if (parentSection) {
        const parentRect = getNodeRect(parentSection);
        if (parentRect) {
          newNode = {
            ...baseNode,
            parentNode: parentSection.id,
            extent: 'parent',
            position: {
              x: flowPosition.x - parentRect.x,
              y: flowPosition.y - parentRect.y,
            },
          };
        }
      }
      setNodes((currentNodes) => [...currentNodes, newNode]);
      setPendingNodeClientPosition(null);
    },
    [createLogicNode, createSectionNode, pendingNodeClientPosition, setNodes]
  );

  const cancelNodeCreation = useCallback(() => {
    setPendingNodeClientPosition(null);
  }, []);

  const onEdgeControlChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedEdgeControl(event.target.value as ControlType);
  }, []);

  const applySelectedControl = useCallback(() => {
    applyControlType(selectedEdgeControl);
  }, [applyControlType, selectedEdgeControl]);

  const onNodeDragStop = useCallback<NodeDragHandler>(
    (_event, draggedNode) => {
      if (draggedNode.type === 'sectionNode') return;
      const instance = reactFlowInstance.current;
      if (!instance) return;
      const sectionNodes = instance
        .getNodes()
        .filter((node): node is Node<SectionNodeData> => node.type === 'sectionNode');
      const draggedRect = getNodeRect(draggedNode);
      const focusPoint = draggedRect
        ? {
            x: draggedRect.x + draggedRect.width / 2,
            y: draggedRect.y + draggedRect.height / 2,
          }
        : draggedNode.positionAbsolute ?? draggedNode.position;
      const parentSection = findSectionAtPoint(focusPoint, sectionNodes);

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== draggedNode.id) return node;
          if (parentSection) {
            const parentRect = getNodeRect(parentSection);
            if (!parentRect) return node;
            const absolutePos = draggedNode.positionAbsolute ?? draggedNode.position;
            return {
              ...node,
              parentNode: parentSection.id,
              extent: 'parent',
              position: {
                x: absolutePos.x - parentRect.x,
                y: absolutePos.y - parentRect.y,
              },
            };
          }
          if (node.parentNode) {
            const absolutePos = draggedNode.positionAbsolute ?? draggedNode.position;
            return {
              ...node,
              parentNode: undefined,
              extent: undefined,
              position: absolutePos,
            };
          }
          return node;
        })
      );
    },
    [setNodes]
  );

  const edgeModalContent = useMemo(() => {
    if (!pendingConnection) return null;
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-gray-900">制御構文を選択</h3>
          <p className="mt-1 text-sm text-gray-600">
            接続したエッジの制御構文を選んでください。キャンセルすると接続は破棄されます。
          </p>
          <div className="mt-4">
            <label className="text-xs font-semibold text-gray-700">エッジ種別</label>
            <select
              value={selectedEdgeControl}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              onChange={onEdgeControlChange}
            >
              {EDGE_CONTROL_TYPES.map((type) => (
                <option key={type} value={type}>
                  {CONTROL_STYLE[type].modalLabel ?? CONTROL_STYLE[type].label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={cancelConnection}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              onClick={applySelectedControl}
            >
              適用
            </button>
          </div>
        </div>
      </div>
    );
  }, [
    applySelectedControl,
    cancelConnection,
    onEdgeControlChange,
    pendingConnection,
    selectedEdgeControl,
  ]);

  const nodeModalContent = useMemo(() => {
    if (!pendingNodeClientPosition) return null;
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-gray-900">ノード種別を選択</h3>
          <p className="mt-1 text-sm text-gray-600">
            追加したいノードを選んでください。キャンセルすると追加は行いません。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {NODE_OPTIONS.map((option) => (
              <button
                key={`${option.kind}-${option.label}`}
                type="button"
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                onClick={() => applyNodeOption(option)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={cancelNodeCreation}
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    );
  }, [applyNodeOption, cancelNodeCreation, pendingNodeClientPosition]);

  return (
    <div
      className="relative h-full w-full"
      ref={wrapperRef}
      onDoubleClickCapture={onWrapperDoubleClickCapture}
      onClickCapture={onWrapperClickCapture}
    >
      <button
        type="button"
        className="absolute right-3 top-3 z-30 rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
        onClick={() => setPendingNodeClientPosition({ x: 300, y: 220 })}
      >
        Debug: Open Modal
      </button>
      <div className="absolute right-3 top-12 z-30 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm">
        <div className="font-semibold">Debug: Pane Event</div>
        {debugEvent ? (
          <>
            <div className="mt-1">type: {debugEvent.type}</div>
            <div>pos: {debugEvent.x}, {debugEvent.y}</div>
            <div>count: {debugEvent.count}</div>
          </>
        ) : (
          <div className="mt-1">none</div>
        )}
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        onPaneClick={onPaneClick}
        connectionMode={ConnectionMode.Loose}
        zoomOnDoubleClick={false}
        onInit={onInit}
        nodeTypes={nodeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
      </ReactFlow>
      {edgeModalContent}
      {nodeModalContent}
    </div>
  );
}
