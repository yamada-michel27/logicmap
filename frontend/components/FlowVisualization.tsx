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
  EdgeLabelRenderer,
  type EdgeProps,
  Node,
  NodeProps,
  Handle,
  Position,
  BaseEdge,
  XYPosition,
  ReactFlowInstance,
  ConnectionMode,
  getBezierPath,
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
  condition?: string;
  note?: string;
};

type SectionNodeData = {
  label: string;
  sectionType: SectionType;
  seq: number;
  controlType?: ControlType;
  note?: string;
  functionArgs?: string;
  functionReturns?: string;
  classConstructor?: string;
  classMembers?: string;
  classMethods?: string;
  classMethodArgs?: string;
  classMethodReturns?: string;
};

type FlowNodeData = LogicNodeData | SectionNodeData;

type LogicEdgeData = {
  controlType: ControlType;
  condition?: string;
  note?: string;
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

type NodeFormState = {
  label: string;
  condition: string;
  note: string;
  functionArgs: string;
  functionReturns: string;
  classConstructor: string;
  classMembers: string;
  classMethods: string;
  classMethodArgs: string;
  classMethodReturns: string;
};

type EdgeFormState = {
  condition: string;
  note: string;
};

const EMPTY_NODE_FORM: NodeFormState = {
  label: '',
  condition: '',
  note: '',
  functionArgs: '',
  functionReturns: '',
  classConstructor: '',
  classMembers: '',
  classMethods: '',
  classMethodArgs: '',
  classMethodReturns: '',
};

const EMPTY_EDGE_FORM: EdgeFormState = {
  condition: '',
  note: '',
};

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

function getLogicNodeLabel(data: LogicNodeData) {
  if (data.label && data.label.length > 0) return data.label;
  if (data.nodeKind === 'start') return 'Start';
  if (data.nodeKind === 'end') return 'End';
  return '通常';
}

function getNodeDisplayLabel(node: Node<FlowNodeData>) {
  if (node.type === 'sectionNode') {
    const data = node.data as SectionNodeData;
    return data.label || CONTROL_STYLE[data.sectionType].label;
  }
  return getLogicNodeLabel(node.data as LogicNodeData);
}

function getNodeOptionForNode(node: Node<FlowNodeData>): NodeOption | null {
  if (node.type === 'sectionNode') {
    const data = node.data as SectionNodeData;
    return (
      NODE_OPTIONS.find(
        (option) => option.kind === 'section' && option.sectionType === data.sectionType
      ) ?? null
    );
  }
  const data = node.data as LogicNodeData;
  return NODE_OPTIONS.find((option) => option.kind === data.nodeKind) ?? null;
}

function isEventFromNodeOrEdge(event: ReactMouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('.react-flow__node, .react-flow__edge'));
}

function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function buildEdgeLabel(controlType: ControlType, condition?: string, note?: string) {
  const controlLabel = CONTROL_STYLE[controlType].label;
  const normalizedCondition = condition?.trim() ?? '';
  const normalizedNote = note?.trim() ?? '';
  const items = [
    controlLabel.length > 0 ? { text: controlLabel, color: CONTROL_STYLE[controlType].color } : null,
    normalizedCondition.length > 0 ? { text: normalizedCondition, color: '#111827' } : null,
    normalizedNote.length > 0 ? { text: normalizedNote, color: '#6b7280' } : null,
  ].filter(Boolean) as { text: string; color: string }[];

  if (items.length === 0) return undefined;

  return (
    <div className="flex flex-col items-center gap-1 text-[11px]">
      {items.map((item, index) => (
        <div
          key={`${item.text}-${index}`}
          className="rounded-md border border-gray-200 bg-white/90 px-2 py-0.5 shadow-sm whitespace-pre-wrap"
          style={{ color: item.color }}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
}

function LogicEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
}: EdgeProps<LogicEdgeData>) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });
  const label = data ? buildEdgeLabel(data.controlType, data.condition, data.note) : undefined;

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} />
      {label ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}

function buildNodeFormFromNode(node: Node<FlowNodeData>): NodeFormState {
  const base = { ...EMPTY_NODE_FORM };
  if (node.type === 'sectionNode') {
    const data = node.data as SectionNodeData;
    return {
      ...base,
      label: data.label ?? '',
      note: data.note ?? '',
      functionArgs: data.functionArgs ?? '',
      functionReturns: data.functionReturns ?? '',
      classConstructor: data.classConstructor ?? '',
      classMembers: data.classMembers ?? '',
      classMethods: data.classMethods ?? '',
      classMethodArgs: data.classMethodArgs ?? '',
      classMethodReturns: data.classMethodReturns ?? '',
    };
  }
  const data = node.data as LogicNodeData;
  return {
    ...base,
    label: data.label ?? '',
    condition: data.condition ?? '',
    note: data.note ?? '',
  };
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
      {data.condition ? (
        <div className="mt-1 text-xs text-gray-700 whitespace-pre-wrap">
          条件式: {data.condition}
        </div>
      ) : null}
      {data.note ? (
        <div className="mt-1 text-xs text-gray-500 whitespace-pre-wrap">補足: {data.note}</div>
      ) : null}
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
  const details: { label: string; value: string }[] = [];
  if (data.sectionType === 'function') {
    if (data.functionArgs && data.functionArgs.trim().length > 0) {
      details.push({ label: '引数', value: data.functionArgs });
    }
    if (data.functionReturns && data.functionReturns.trim().length > 0) {
      details.push({ label: '返り値', value: data.functionReturns });
    }
  }
  if (data.sectionType === 'class') {
    if (data.classConstructor && data.classConstructor.trim().length > 0) {
      details.push({ label: 'コンストラクタ', value: data.classConstructor });
    }
    if (data.classMembers && data.classMembers.trim().length > 0) {
      details.push({ label: 'メンバ変数', value: data.classMembers });
    }
    if (data.classMethods && data.classMethods.trim().length > 0) {
      details.push({ label: 'メソッド名', value: data.classMethods });
    }
    if (data.classMethodArgs && data.classMethodArgs.trim().length > 0) {
      details.push({ label: 'メソッド引数', value: data.classMethodArgs });
    }
    if (data.classMethodReturns && data.classMethodReturns.trim().length > 0) {
      details.push({ label: 'メソッド返り値', value: data.classMethodReturns });
    }
  }
  if (data.note && data.note.trim().length > 0) {
    details.push({ label: '補足', value: data.note });
  }
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
      {data.label && data.label.trim().length > 0 ? (
        <div className="mt-1 text-sm font-semibold text-gray-900 whitespace-pre-wrap">
          {data.label}
        </div>
      ) : null}
      {details.length > 0 ? (
        <div className="mt-2 space-y-1 text-xs text-gray-700">
          {details.map((item, index) => (
            <div key={`${item.label}-${index}`} className="whitespace-pre-wrap">
              <span className="font-semibold">{item.label}:</span> {item.value}
            </div>
          ))}
        </div>
      ) : null}
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

const edgeTypes = {
  logicEdge: LogicEdge,
};

export default function FlowVisualization() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<LogicEdgeData>([]);
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [pendingNodeClientPosition, setPendingNodeClientPosition] = useState<XYPosition | null>(
    null
  );
  const [pendingNodeDelete, setPendingNodeDelete] = useState<{ id: string; label: string } | null>(
    null
  );
  const [pendingNodeEdit, setPendingNodeEdit] = useState<{ id: string } | null>(null);
  const [pendingEdgeEdit, setPendingEdgeEdit] = useState<{ id: string } | null>(null);
  const [nodeModalOption, setNodeModalOption] = useState<NodeOption | null>(null);
  const [nodeForm, setNodeForm] = useState<NodeFormState>({ ...EMPTY_NODE_FORM });
  const [selectedEdgeControl, setSelectedEdgeControl] =
    useState<ControlType>(DEFAULT_EDGE_CONTROL);
  const [edgeForm, setEdgeForm] = useState<EdgeFormState>({ ...EMPTY_EDGE_FORM });
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
      condition?: string;
      note?: string;
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
          condition: params.condition,
          note: params.note,
        },
      };
    },
    []
  );

  const createSectionNode = useCallback(
    (params: {
      sectionType: SectionType;
      label: string;
      position: XYPosition;
      note?: string;
      functionArgs?: string;
      functionReturns?: string;
      classConstructor?: string;
      classMembers?: string;
      classMethods?: string;
      classMethodArgs?: string;
      classMethodReturns?: string;
    }): Node<SectionNodeData> => {
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
          note: params.note,
          functionArgs: params.functionArgs,
          functionReturns: params.functionReturns,
          classConstructor: params.classConstructor,
          classMembers: params.classMembers,
          classMethods: params.classMethods,
          classMethodArgs: params.classMethodArgs,
          classMethodReturns: params.classMethodReturns,
        },
      };
    },
    []
  );

  const onConnect = useCallback((params: Connection) => {
    setPendingNodeClientPosition(null);
    setPendingNodeDelete(null);
    setPendingNodeEdit(null);
    setPendingEdgeEdit(null);
    setSelectedEdgeControl(DEFAULT_EDGE_CONTROL);
    setEdgeForm({ ...EMPTY_EDGE_FORM });
    setPendingConnection(params);
  }, []);

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge<LogicEdgeData>, newConnection: Connection) => {
      setPendingNodeClientPosition(null);
      setPendingNodeDelete(null);
      setPendingNodeEdit(null);
      setPendingEdgeEdit(null);
      setEdges((currentEdges) =>
        currentEdges.map((edge) => {
          if (edge.id !== oldEdge.id) return edge;
          return {
            ...edge,
            source: newConnection.source ?? edge.source,
            target: newConnection.target ?? edge.target,
            sourceHandle: newConnection.sourceHandle ?? edge.sourceHandle,
            targetHandle: newConnection.targetHandle ?? edge.targetHandle,
          };
        })
      );
    },
    [setEdges]
  );

  const openNodeModalAtClient = useCallback((event: ReactMouseEvent) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (isEventFromNodeOrEdge(event)) return;
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
    setPendingNodeDelete(null);
    setPendingNodeEdit(null);
    setPendingEdgeEdit(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
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
      const condition = normalizeText(edgeForm.condition);
      const note = normalizeText(edgeForm.note);
      const edgeId = `edge-${nextEdgeSeq.current++}`;
      const edge: Edge<LogicEdgeData> = {
        id: edgeId,
        type: 'logicEdge',
        source: pendingConnection.source,
        target: pendingConnection.target,
        sourceHandle: pendingConnection.sourceHandle ?? undefined,
        targetHandle: pendingConnection.targetHandle ?? undefined,
        label: buildEdgeLabel(controlType, condition, note),
        style: {
          stroke: style.color,
          strokeWidth: EDGE_STROKE_WIDTH,
          strokeDasharray: style.edgeDash,
        },
        data: { controlType, condition, note },
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
    [edgeForm.condition, edgeForm.note, pendingConnection, setEdges, setNodes]
  );

  const cancelConnection = useCallback(() => {
    setPendingConnection(null);
  }, []);

  const applyNodeCreation = useCallback(() => {
    if (!pendingNodeClientPosition || !nodeModalOption) return;
    const instance = reactFlowInstance.current;
    if (!instance) return;
    const flowPosition = instance.screenToFlowPosition(pendingNodeClientPosition);
    if (nodeModalOption.kind === 'section') {
      if (!nodeModalOption.sectionType) {
        setPendingNodeClientPosition(null);
        return;
      }
      const isFunction = nodeModalOption.sectionType === 'function';
      const newSection = createSectionNode({
        sectionType: nodeModalOption.sectionType,
        label: normalizeText(nodeForm.label) ?? '',
        position: flowPosition,
        note: normalizeText(nodeForm.note),
        functionArgs: isFunction ? normalizeText(nodeForm.functionArgs) : undefined,
        functionReturns: isFunction ? normalizeText(nodeForm.functionReturns) : undefined,
        classConstructor: !isFunction ? normalizeText(nodeForm.classConstructor) : undefined,
        classMembers: !isFunction ? normalizeText(nodeForm.classMembers) : undefined,
        classMethods: !isFunction ? normalizeText(nodeForm.classMethods) : undefined,
        classMethodArgs: !isFunction ? normalizeText(nodeForm.classMethodArgs) : undefined,
        classMethodReturns: !isFunction ? normalizeText(nodeForm.classMethodReturns) : undefined,
      });
      setNodes((currentNodes) => [newSection, ...currentNodes]);
      setPendingNodeClientPosition(null);
      setNodeModalOption(null);
      setNodeForm({ ...EMPTY_NODE_FORM });
      return;
    }

    const sectionNodes = instance
      .getNodes()
      .filter((node): node is Node<SectionNodeData> => node.type === 'sectionNode');
    const parentSection = findSectionAtPoint(flowPosition, sectionNodes);
    const isNormal = nodeModalOption.kind === 'normal';
    const nextLabel =
      nodeModalOption.kind === 'start' || nodeModalOption.kind === 'end'
        ? nodeModalOption.label
        : normalizeText(nodeForm.label) ?? nodeModalOption.nodeLabel ?? '';
    const baseNode = createLogicNode({
      kind: nodeModalOption.kind,
      label: nextLabel,
      position: flowPosition,
      condition: isNormal ? normalizeText(nodeForm.condition) : undefined,
      note: normalizeText(nodeForm.note),
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
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
  }, [
    createLogicNode,
    createSectionNode,
    nodeForm,
    nodeModalOption,
    pendingNodeClientPosition,
    setNodes,
  ]);

  const cancelNodeCreation = useCallback(() => {
    setPendingNodeClientPosition(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
  }, []);

  const cancelNodeEdit = useCallback(() => {
    setPendingNodeEdit(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
  }, []);

  const applyNodeEdit = useCallback(() => {
    if (!pendingNodeEdit || !nodeModalOption) return;
    let typeChanged = false;
    setNodes((currentNodes) => {
      const target = currentNodes.find((node) => node.id === pendingNodeEdit.id);
      if (!target) return currentNodes;
      const targetIsSection = target.type === 'sectionNode';
      const nextIsSection = nodeModalOption.kind === 'section';
      typeChanged = targetIsSection !== nextIsSection;
      const targetSeq = (target.data as FlowNodeData).seq;
      const absolutePos = target.positionAbsolute ?? target.position;
      const shouldDetachChildren = targetIsSection && !nextIsSection;
      const nextNodes = currentNodes.map((node) => {
        if (node.id === target.id) {
          if (nextIsSection) {
            const sectionType = nodeModalOption.sectionType ?? 'function';
            const width =
              typeof node.style?.width === 'number' ? node.style.width : SECTION_DEFAULT_WIDTH;
            const height =
              typeof node.style?.height === 'number' ? node.style.height : SECTION_DEFAULT_HEIGHT;
            const isFunction = sectionType === 'function';
            return {
              ...node,
              type: 'sectionNode',
              parentNode: undefined,
              extent: undefined,
              position: absolutePos,
              style: { width, height },
              data: {
                label: normalizeText(nodeForm.label) ?? '',
                sectionType,
                seq: targetSeq,
                note: normalizeText(nodeForm.note),
                functionArgs: isFunction ? normalizeText(nodeForm.functionArgs) : undefined,
                functionReturns: isFunction ? normalizeText(nodeForm.functionReturns) : undefined,
                classConstructor: !isFunction ? normalizeText(nodeForm.classConstructor) : undefined,
                classMembers: !isFunction ? normalizeText(nodeForm.classMembers) : undefined,
                classMethods: !isFunction ? normalizeText(nodeForm.classMethods) : undefined,
                classMethodArgs: !isFunction ? normalizeText(nodeForm.classMethodArgs) : undefined,
                classMethodReturns: !isFunction
                  ? normalizeText(nodeForm.classMethodReturns)
                  : undefined,
              },
            };
          }
          const isNormal = nodeModalOption.kind === 'normal';
          const label =
            nodeModalOption.kind === 'start' || nodeModalOption.kind === 'end'
              ? nodeModalOption.label
              : normalizeText(nodeForm.label) ?? nodeModalOption.nodeLabel ?? '';
          const controlType = (node.data as LogicNodeData).controlType;
          const keepParent = !targetIsSection;
          return {
            ...node,
            type: 'logicNode',
            parentNode: keepParent ? node.parentNode : undefined,
            extent: keepParent ? node.extent : undefined,
            position: keepParent ? node.position : absolutePos,
            style: keepParent ? node.style : undefined,
            data: {
              label,
              nodeKind: nodeModalOption.kind as NodeKind,
              seq: targetSeq,
              controlType,
              condition: isNormal ? normalizeText(nodeForm.condition) : undefined,
              note: normalizeText(nodeForm.note),
            },
          };
        }
        if (shouldDetachChildren && node.parentNode === target.id) {
          const absoluteChildPos = node.positionAbsolute ?? node.position;
          return {
            ...node,
            parentNode: undefined,
            extent: undefined,
            position: absoluteChildPos,
          };
        }
        return node;
      });
      return nextNodes;
    });

    if (typeChanged) {
      setEdges((currentEdges) =>
        currentEdges.map((edge) => {
          if (edge.source === pendingNodeEdit.id && edge.sourceHandle) {
            return { ...edge, sourceHandle: undefined };
          }
          if (edge.target === pendingNodeEdit.id && edge.targetHandle) {
            return { ...edge, targetHandle: undefined };
          }
          return edge;
        })
      );
    }

    setPendingNodeEdit(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
  }, [nodeForm, nodeModalOption, pendingNodeEdit, setEdges, setNodes]);

  const openNodeDeleteModal = useCallback((node: Node<FlowNodeData>) => {
    setPendingConnection(null);
    setPendingNodeClientPosition(null);
    setPendingNodeEdit(null);
    setPendingEdgeEdit(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
    setPendingNodeDelete({ id: node.id, label: getNodeDisplayLabel(node) });
  }, []);

  const openNodeEditModal = useCallback((node: Node<FlowNodeData>) => {
    setPendingConnection(null);
    setPendingNodeClientPosition(null);
    setPendingNodeDelete(null);
    setPendingEdgeEdit(null);
    setNodeModalOption(getNodeOptionForNode(node));
    setNodeForm(buildNodeFormFromNode(node));
    setPendingNodeEdit({ id: node.id });
  }, []);

  const deleteNodeById = useCallback(
    (nodeId: string) => {
      setEdges((currentEdges) =>
        currentEdges.filter((edge) => edge.source !== nodeId && edge.target !== nodeId)
      );
      setNodes((currentNodes) => {
        const removedNode = currentNodes.find((node) => node.id === nodeId);
        const removedIsSection = removedNode?.type === 'sectionNode';
        return currentNodes
          .filter((node) => node.id !== nodeId)
          .map((node) => {
            if (!removedIsSection || node.parentNode !== nodeId) return node;
            const absolutePos = node.positionAbsolute ?? node.position;
            return {
              ...node,
              parentNode: undefined,
              extent: undefined,
              position: absolutePos,
            };
          });
      });
      setPendingNodeDelete(null);
    },
    [setEdges, setNodes]
  );

  const onNodeDoubleClick = useCallback(
    (event: ReactMouseEvent, node: Node<FlowNodeData>) => {
      event.preventDefault();
      event.stopPropagation();
      openNodeEditModal(node);
    },
    [openNodeEditModal]
  );

  const onEdgeDoubleClick = useCallback(
    (event: ReactMouseEvent, edge: Edge<LogicEdgeData>) => {
      event.preventDefault();
      event.stopPropagation();
      setPendingNodeClientPosition(null);
      setPendingNodeDelete(null);
      setPendingConnection(null);
      setPendingNodeEdit(null);
      setSelectedEdgeControl(edge.data?.controlType ?? DEFAULT_EDGE_CONTROL);
      setEdgeForm({
        condition: edge.data?.condition ?? '',
        note: edge.data?.note ?? '',
      });
      setPendingEdgeEdit({ id: edge.id });
    },
    []
  );

  const deleteEdgeById = useCallback(
    (edgeId: string) => {
      setEdges((currentEdges) => currentEdges.filter((edge) => edge.id !== edgeId));
      setPendingEdgeEdit(null);
    },
    [setEdges]
  );

  const updateEdgeControl = useCallback(
    (edgeId: string, controlType: ControlType) => {
      const style = CONTROL_STYLE[controlType];
      const condition = normalizeText(edgeForm.condition);
      const note = normalizeText(edgeForm.note);
      setEdges((currentEdges) =>
        currentEdges.map((edge) => {
          if (edge.id !== edgeId) return edge;
          return {
            ...edge,
            type: 'logicEdge',
            label: buildEdgeLabel(controlType, condition, note),
            style: {
              ...edge.style,
              stroke: style.color,
              strokeWidth: EDGE_STROKE_WIDTH,
              strokeDasharray: style.edgeDash,
            },
            data: { ...edge.data, controlType, condition, note },
          };
        })
      );
    },
    [edgeForm.condition, edgeForm.note, setEdges]
  );

  const onEdgeControlChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedEdgeControl(event.target.value as ControlType);
  }, []);

  const closeEdgeModal = useCallback(() => {
    setPendingConnection(null);
    setPendingEdgeEdit(null);
  }, []);

  const applySelectedControl = useCallback(() => {
    if (pendingConnection) {
      applyControlType(selectedEdgeControl);
      return;
    }
    if (pendingEdgeEdit) {
      updateEdgeControl(pendingEdgeEdit.id, selectedEdgeControl);
      setPendingEdgeEdit(null);
    }
  }, [applyControlType, pendingConnection, pendingEdgeEdit, selectedEdgeControl, updateEdgeControl]);

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
    const isEdit = Boolean(pendingEdgeEdit);
    if (!pendingConnection && !pendingEdgeEdit) return null;
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'エッジを編集' : '制御構文を選択'}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {isEdit
              ? 'エッジの制御構文を変更できます。'
              : '接続したエッジの制御構文を選んでください。キャンセルすると接続は破棄されます。'}
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
          <div className="mt-4 grid gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700">条件式</label>
              <input
                type="text"
                value={edgeForm.condition}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                onChange={(event) =>
                  setEdgeForm((current) => ({ ...current, condition: event.target.value }))
                }
                placeholder="例: n > 5 / for n in 5 / 〇〇Error"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-700">補足コメント</label>
              <textarea
                value={edgeForm.note}
                className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                rows={3}
                onChange={(event) =>
                  setEdgeForm((current) => ({ ...current, note: event.target.value }))
                }
                placeholder="補足コメントを入力"
              />
            </div>
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            {isEdit ? (
              <button
                type="button"
                className="mr-auto rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                onClick={() => {
                  if (!pendingEdgeEdit) return;
                  deleteEdgeById(pendingEdgeEdit.id);
                }}
              >
                削除する
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={isEdit ? closeEdgeModal : cancelConnection}
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
    closeEdgeModal,
    deleteEdgeById,
    edgeForm.condition,
    edgeForm.note,
    onEdgeControlChange,
    pendingConnection,
    pendingEdgeEdit,
    selectedEdgeControl,
  ]);

  const nodeModalContent = useMemo(() => {
    const isEdit = Boolean(pendingNodeEdit);
    if (!pendingNodeClientPosition && !pendingNodeEdit) return null;
    const editingNode = pendingNodeEdit
      ? nodes.find((node) => node.id === pendingNodeEdit.id) ?? null
      : null;
    const fallbackOption = editingNode ? getNodeOptionForNode(editingNode) : null;
    const selectedOption = nodeModalOption ?? fallbackOption;
    const isSection = selectedOption?.kind === 'section';
    const isNormal = selectedOption?.kind === 'normal';
    const isStartOrEnd =
      selectedOption?.kind === 'start' || selectedOption?.kind === 'end';
    const isFunctionSection = isSection && selectedOption?.sectionType === 'function';
    const isClassSection = isSection && selectedOption?.sectionType === 'class';

    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'ノード種別を変更' : 'ノード種別を選択'}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {isEdit
              ? '変更したいノード種別を選んでください。'
              : '追加したいノードを選び、必要な情報を入力してください。'}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {NODE_OPTIONS.map((option) => (
              <button
                key={`${option.kind}-${option.label}`}
                type="button"
                className={`rounded-md border px-3 py-2 text-sm font-semibold ${
                  selectedOption &&
                  option.kind === selectedOption.kind &&
                  option.sectionType === selectedOption.sectionType
                    ? 'border-gray-900 bg-gray-900 text-white'
                    : 'border-gray-200 text-gray-900 hover:bg-gray-50'
                }`}
                onClick={() => setNodeModalOption(option)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="mt-4 border-t border-gray-100 pt-4">
            <div className="text-xs font-semibold text-gray-700">詳細入力</div>
            {!selectedOption ? (
              <div className="mt-2 text-xs text-gray-500">
                種別を選択してから詳細を入力してください。
              </div>
            ) : (
              <div className="mt-3 grid gap-3">
                {isSection ? (
                  <>
                    <div>
                      <label className="text-xs font-semibold text-gray-700">
                        表示名（関数名/クラス名）
                      </label>
                      <input
                        type="text"
                        value={nodeForm.label}
                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        onChange={(event) =>
                          setNodeForm((current) => ({ ...current, label: event.target.value }))
                        }
                        placeholder="例: fetchUser / UserService"
                      />
                    </div>
                    {isFunctionSection ? (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">引数</label>
                          <textarea
                            value={nodeForm.functionArgs}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            rows={2}
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                functionArgs: event.target.value,
                              }))
                            }
                            placeholder="例: userId, includePosts"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">返り値</label>
                          <textarea
                            value={nodeForm.functionReturns}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            rows={2}
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                functionReturns: event.target.value,
                              }))
                            }
                            placeholder="例: UserResponse"
                          />
                        </div>
                      </>
                    ) : null}
                    {isClassSection ? (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">
                            コンストラクタ条件
                          </label>
                          <textarea
                            value={nodeForm.classConstructor}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            rows={2}
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                classConstructor: event.target.value,
                              }))
                            }
                            placeholder="例: __init__(userId: string)"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">メンバ変数</label>
                          <textarea
                            value={nodeForm.classMembers}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            rows={2}
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                classMembers: event.target.value,
                              }))
                            }
                            placeholder="例: id, name, email"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">メソッド名</label>
                          <textarea
                            value={nodeForm.classMethods}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            rows={2}
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                classMethods: event.target.value,
                              }))
                            }
                            placeholder="例: fetch / update"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">
                            メソッド引数
                          </label>
                          <textarea
                            value={nodeForm.classMethodArgs}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            rows={2}
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                classMethodArgs: event.target.value,
                              }))
                            }
                            placeholder="例: update(name: string)"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">
                            メソッド返り値
                          </label>
                          <textarea
                            value={nodeForm.classMethodReturns}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            rows={2}
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                classMethodReturns: event.target.value,
                              }))
                            }
                            placeholder="例: User"
                          />
                        </div>
                      </>
                    ) : null}
                    <div>
                      <label className="text-xs font-semibold text-gray-700">補足コメント</label>
                      <textarea
                        value={nodeForm.note}
                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        rows={3}
                        onChange={(event) =>
                          setNodeForm((current) => ({ ...current, note: event.target.value }))
                        }
                        placeholder="補足コメントを入力"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {!isStartOrEnd ? (
                      <div>
                        <label className="text-xs font-semibold text-gray-700">ノード文字列</label>
                        <input
                          type="text"
                          value={nodeForm.label}
                          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                          onChange={(event) =>
                            setNodeForm((current) => ({ ...current, label: event.target.value }))
                          }
                          placeholder="表示したい文字列"
                        />
                      </div>
                    ) : null}
                    {isNormal ? (
                      <div>
                        <label className="text-xs font-semibold text-gray-700">条件式</label>
                        <input
                          type="text"
                          value={nodeForm.condition}
                          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                          onChange={(event) =>
                            setNodeForm((current) => ({
                              ...current,
                              condition: event.target.value,
                            }))
                          }
                          placeholder="例: i < 10"
                        />
                      </div>
                    ) : null}
                    <div>
                      <label className="text-xs font-semibold text-gray-700">補足コメント</label>
                      <textarea
                        value={nodeForm.note}
                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        rows={3}
                        onChange={(event) =>
                          setNodeForm((current) => ({ ...current, note: event.target.value }))
                        }
                        placeholder="補足コメントを入力"
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="mt-5 flex items-center justify-end gap-2">
            {isEdit && editingNode ? (
              <button
                type="button"
                className="mr-auto rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                onClick={() => openNodeDeleteModal(editingNode)}
              >
                削除する
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={isEdit ? cancelNodeEdit : cancelNodeCreation}
            >
              キャンセル
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-2 text-sm font-semibold text-white ${
                selectedOption ? 'bg-gray-900 hover:bg-gray-800' : 'bg-gray-300'
              }`}
              onClick={isEdit ? applyNodeEdit : applyNodeCreation}
              disabled={!selectedOption}
            >
              {isEdit ? '保存する' : '追加する'}
            </button>
          </div>
        </div>
      </div>
    );
  }, [
    applyNodeCreation,
    applyNodeEdit,
    cancelNodeCreation,
    cancelNodeEdit,
    nodeForm.classConstructor,
    nodeForm.classMembers,
    nodeForm.classMethodArgs,
    nodeForm.classMethodReturns,
    nodeForm.classMethods,
    nodeForm.condition,
    nodeForm.functionArgs,
    nodeForm.functionReturns,
    nodeForm.label,
    nodeForm.note,
    nodeModalOption,
    nodes,
    openNodeDeleteModal,
    pendingNodeClientPosition,
    pendingNodeEdit,
  ]);

  const nodeDeleteContent = useMemo(() => {
    if (!pendingNodeDelete) return null;
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-gray-900">ノードを削除</h3>
          <p className="mt-1 text-sm text-gray-600">
            「{pendingNodeDelete.label}」を削除しますか？
          </p>
          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => setPendingNodeDelete(null)}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white hover:bg-rose-500"
              onClick={() => deleteNodeById(pendingNodeDelete.id)}
            >
              削除する
            </button>
          </div>
        </div>
      </div>
    );
  }, [deleteNodeById, pendingNodeDelete]);

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
        onEdgeUpdate={onEdgeUpdate}
        onNodeDragStop={onNodeDragStop}
        onNodeDoubleClick={onNodeDoubleClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onPaneClick={onPaneClick}
        connectionMode={ConnectionMode.Loose}
        zoomOnDoubleClick={false}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
      >
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
      </ReactFlow>
      {edgeModalContent}
      {nodeModalContent}
      {nodeDeleteContent}
    </div>
  );
}
