'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
} from 'reactflow';

import 'reactflow/dist/style.css';

type NodeKind = 'start' | 'end' | 'normal';

const CONTROL_TYPES = [
  'while',
  'for',
  'if-else',
  'break',
  'continue',
  'try-except',
  'function',
  'class',
] as const;

type ControlType = (typeof CONTROL_TYPES)[number];

type LogicNodeData = {
  label?: string;
  nodeKind: NodeKind;
  seq: number;
  controlType?: ControlType;
};

type LogicEdgeData = {
  controlType: ControlType;
};

const CONTROL_STYLE: Record<
  ControlType,
  { label: string; color: string; edgeDash?: string; nodeBg?: string }
> = {
  while: { label: 'while', color: '#2563eb', edgeDash: '6 4' },
  for: { label: 'for', color: '#0f766e', edgeDash: '6 4' },
  'if-else': { label: 'if-else', color: '#4f46e5' },
  break: { label: 'break', color: '#b91c1c', edgeDash: '4 4' },
  continue: { label: 'continue', color: '#c2410c', edgeDash: '2 4' },
  'try-except': { label: 'try-except', color: '#15803d', edgeDash: '4 2' },
  function: { label: 'function', color: '#0e7490', nodeBg: '#ecfeff' },
  class: { label: 'class', color: '#1d4ed8', nodeBg: '#eff6ff' },
};

type NodeOption = {
  label: string;
  kind: NodeKind;
  controlType?: ControlType;
};

const NODE_OPTIONS: NodeOption[] = [
  { label: 'Start', kind: 'start' },
  { label: 'End', kind: 'end' },
  ...CONTROL_TYPES.map(
    (type): NodeOption => ({
      label: CONTROL_STYLE[type].label,
      kind: 'normal',
      controlType: type,
    })
  ),
];

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
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

const nodeTypes = {
  logicNode: LogicNode,
};

export default function FlowVisualization() {
  const [nodes, setNodes, onNodesChange] = useNodesState<LogicNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<LogicEdgeData>([]);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [pendingNodeClientPosition, setPendingNodeClientPosition] = useState<XYPosition | null>(
    null
  );
  const [debugDots, setDebugDots] = useState<XYPosition[]>([]);
  const [debugEventLabel, setDebugEventLabel] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);
  const nextNodeSeq = useRef(1);
  const nextEdgeSeq = useRef(1);

  const createNode = useCallback(
    (params: {
      kind: NodeKind;
      label: string;
      position: XYPosition;
      controlType?: ControlType;
    }) => {
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
      } satisfies Node<LogicNodeData>;
    },
    []
  );

  const onConnect = useCallback((params: Connection) => {
    setPendingNodeClientPosition(null);
    setPendingConnection(params);
  }, []);

  const getLocalPoint = useCallback((clientX: number, clientY: number) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return { x: clientX, y: clientY };
    const rect = wrapper.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const openNodeModalAtClient = useCallback((event: MouseEvent) => {
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
    setDebugEventLabel(`open-modal x:${Math.round(event.clientX)} y:${Math.round(event.clientY)}`);
  }, []);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const localPoint = getLocalPoint(event.clientX, event.clientY);
      setDebugDots((prev) => [...prev.slice(-3), localPoint]);
      setDebugEventLabel(`pointerdown detail:${event.detail ?? 'n/a'}`);
    };

    const handleDoubleClick = (event: MouseEvent) => {
      if (event.button !== 0) return;
      if (event.detail < 2) return;
      setDebugEventLabel(`dblclick detail:${event.detail}`);
      openNodeModalAtClient(event);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('dblclick', handleDoubleClick, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('dblclick', handleDoubleClick, true);
    };
  }, [getLocalPoint, openNodeModalAtClient]);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

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
        label: style.label,
        style: {
          stroke: style.color,
          strokeWidth: 2,
          strokeDasharray: style.edgeDash,
        },
        labelStyle: {
          fill: style.color,
          fontWeight: 600,
        },
        data: { controlType },
      };

      setEdges((eds) => addEdge(edge, eds));
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
      const newNode = createNode({
        kind: option.kind,
        label: option.label,
        controlType: option.controlType,
        position: flowPosition,
      });
      setNodes((currentNodes) => [...currentNodes, newNode]);
      setPendingNodeClientPosition(null);
    },
    [createNode, pendingNodeClientPosition, setNodes]
  );

  const cancelNodeCreation = useCallback(() => {
    setPendingNodeClientPosition(null);
  }, []);

  const edgeModalContent = useMemo(() => {
    if (!pendingConnection) return null;
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-gray-900">制御構文を選択</h3>
          <p className="mt-1 text-sm text-gray-600">
            接続したエッジの制御構文を選んでください。キャンセルすると接続は破棄されます。
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {CONTROL_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-900 hover:bg-gray-50"
                onClick={() => applyControlType(type)}
              >
                {CONTROL_STYLE[type].label}
              </button>
            ))}
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={cancelConnection}
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    );
  }, [applyControlType, cancelConnection, pendingConnection]);

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
    <div className="relative h-full w-full" ref={wrapperRef}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
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
      {debugDots.map((dot, index) => (
        <div
          key={`${dot.x}-${dot.y}-${index}`}
          className="pointer-events-none absolute z-50 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-rose-500"
          style={{ left: dot.x, top: dot.y }}
        />
      ))}
      {debugEventLabel ? (
        <div className="pointer-events-none absolute left-3 top-3 z-50 rounded-md bg-black/70 px-2 py-1 text-xs font-semibold text-white">
          {debugEventLabel}
        </div>
      ) : null}
    </div>
  );
}
