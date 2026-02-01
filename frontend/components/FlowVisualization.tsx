'use client';

import {
  useCallback,
  useEffect,
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
  MarkerType,
} from 'reactflow';
import { NodeResizer } from '@reactflow/node-resizer';

import 'reactflow/dist/style.css';
import '@reactflow/node-resizer/dist/style.css';

type NodeKind = 'start' | 'end' | 'normal';
type SectionType = 'function' | 'class' | 'interface' | 'main' | 'try' | 'catch' | 'while' | 'for';

const EDGE_CONTROL_OPTIONS = ['flow', 'if', 'elif', 'else', 'break', 'continue'] as const;

type EdgeControlType = (typeof EDGE_CONTROL_OPTIONS)[number];
type NodeControlType = EdgeControlType | 'function' | 'class';

type TypedField = {
  name: string;
  type: string;
};

type ValidationRule = {
  target: string;
  rule: string;
  message: string;
};

type ClassMethod = {
  name: string;
  args: TypedField[];
  returns: string;
  note: string;
};

type LogicNodeData = {
  label?: string;
  nodeKind: NodeKind;
  seq: number;
  controlType?: NodeControlType;
  condition?: string;
  note?: string;
  instanceOfSectionId?: string;
};

type SectionNodeData = {
  label: string;
  sectionType: SectionType;
  seq: number;
  controlType?: NodeControlType;
  note?: string;
  entryNodeId?: string;
  functionArgs?: TypedField[];
  functionReturnType?: string;
  functionReturnValue?: string;
  loopCondition?: string;
  catchException?: string;
  classConstructorArgs?: TypedField[];
  classMembers?: TypedField[];
  classMethods?: ClassMethod[];
  interfaceMembers?: TypedField[];
  interfaceMethods?: ClassMethod[];
  validations?: ValidationRule[];
};

const STAMP_OPTIONS = [
  { id: 'question', emoji: '❓', label: '疑問' },
  { id: 'idea', emoji: '💡', label: 'アイデア' },
  { id: 'warn', emoji: '⚠️', label: '注意' },
  { id: 'check', emoji: '✅', label: '確認' },
  { id: 'test', emoji: '🧪', label: '検証' },
  { id: 'todo', emoji: '📝', label: 'TODO' },
  { id: 'consult', emoji: '🚩', label: '要相談' },
] as const;

const TEMPLATE_OPTIONS = [
  { id: 'dfs', name: 'DFS（深さ優先探索）', description: 'スタックを使用した深さ優先探索' },
  { id: 'bfs', name: 'BFS（幅優先探索）', description: 'キューを使用した幅優先探索' },
  { id: 'binary_search', name: '二分探索', description: 'ソート済み配列での効率的な探索' },
  { id: 'a_star', name: 'A*探索', description: 'ヒューリスティックを使用した最短経路探索' },
] as const;

type StampType = (typeof STAMP_OPTIONS)[number]['id'];
type TemplateType = (typeof TEMPLATE_OPTIONS)[number]['id'];

type MemoNodeData = {
  text: string;
  seq: number;
};

type StampNodeData = {
  stamp: StampType;
  seq: number;
  onDelete?: (nodeId: string) => void;
};

type FlowNodeData = LogicNodeData | SectionNodeData | MemoNodeData | StampNodeData;

type LogicEdgeData = {
  controlType: EdgeControlType;
  condition?: string;
  note?: string;
  validations?: ValidationRule[];
  parallelOffset?: number;
  onEdit?: (edgeId: string) => void;
};

type StoredNode = Pick<
  Node<FlowNodeData>,
  'id' | 'type' | 'position' | 'data' | 'parentNode' | 'extent' | 'style' | 'width' | 'height'
>;

type StoredEdge = Pick<
  Edge<LogicEdgeData>,
  | 'id'
  | 'type'
  | 'source'
  | 'target'
  | 'sourceHandle'
  | 'targetHandle'
  | 'data'
  | 'style'
  | 'markerEnd'
  | 'markerStart'
>;

type FlowSnapshot = {
  version: number;
  nodes: StoredNode[];
  edges: StoredEdge[];
  nextNodeSeq: number;
  nextEdgeSeq: number;
};

type SavedFlowSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

type SavedFlowDetail = SavedFlowSummary & {
  snapshot: FlowSnapshot;
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

type StyleKey = EdgeControlType | SectionType;

const CONTROL_STYLE: Record<
  StyleKey,
  { label: string; color: string; edgeDash?: string; nodeBg?: string; modalLabel?: string }
> = {
  flow: { label: '', color: '#64748b', modalLabel: '通常（ラベルなし）' },
  while: { label: 'while', color: '#2563eb', edgeDash: '6 4' },
  for: { label: 'for', color: '#0f766e', edgeDash: '6 4' },
  if: { label: 'if', color: '#4f46e5' },
  elif: { label: 'elif', color: '#4f46e5' },
  else: { label: 'else', color: '#4f46e5' },
  break: { label: 'break', color: '#b91c1c', edgeDash: '4 4' },
  continue: { label: 'continue', color: '#c2410c', edgeDash: '2 4' },
  try: { label: 'try', color: '#15803d', edgeDash: '4 2' },
  catch: { label: 'catch', color: '#dc2626', edgeDash: '4 2' },
  function: { label: 'function', color: '#0e7490', nodeBg: '#ecfeff' },
  class: { label: 'class', color: '#1d4ed8', nodeBg: '#eff6ff' },
  interface: { label: 'interface', color: '#0ea5e9', nodeBg: '#e0f2fe' },
  main: { label: 'main', color: '#f59e0b', nodeBg: '#fef3c7' },
};

const SECTION_MIN_WIDTH = 240;
const SECTION_MIN_HEIGHT = 160;
const SECTION_DEFAULT_WIDTH = 320;
const SECTION_DEFAULT_HEIGHT = 220;
const MEMO_MIN_WIDTH = 180;
const MEMO_MIN_HEIGHT = 120;
const MEMO_DEFAULT_WIDTH = 260;
const MEMO_DEFAULT_HEIGHT = 180;
const STAMP_SIZE = 48;
const EDGE_STROKE_WIDTH = 3;
const EDGE_PARALLEL_OFFSET = 24;
const EDGE_HIT_RADIUS = 28;
const INSTANCE_OFFSET_X = 220;
const INSTANCE_OFFSET_Y = 80;
const DEFAULT_EDGE_CONTROL: EdgeControlType = 'flow';
const FLOW_STORAGE_VERSION = 1;
const USER_ID_STORAGE_KEY = 'logicmap:user-id';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

type NodeFormState = {
  label: string;
  condition: string;
  note: string;
  entryNodeId: string;
  functionArgs: TypedField[];
  functionReturnType: string;
  functionReturnValue: string;
  loopCondition: string;
  catchExceptionType: string;
  catchExceptionOther: string;
  classConstructorArgs: TypedField[];
  classMembers: TypedField[];
  classMethods: ClassMethod[];
  interfaceMembers: TypedField[];
  interfaceMethods: ClassMethod[];
  validations: ValidationRule[];
};

type EdgeFormState = {
  condition: string;
  note: string;
  validations: ValidationRule[];
};

const EMPTY_NODE_FORM: NodeFormState = {
  label: '',
  condition: '',
  note: '',
  entryNodeId: '',
  functionArgs: [],
  functionReturnType: '',
  functionReturnValue: '',
  loopCondition: '',
  catchExceptionType: '',
  catchExceptionOther: '',
  classConstructorArgs: [],
  classMembers: [],
  classMethods: [],
  interfaceMembers: [],
  interfaceMethods: [],
  validations: [],
};

const EMPTY_EDGE_FORM: EdgeFormState = {
  condition: '',
  note: '',
  validations: [],
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
  { label: CONTROL_STYLE.interface.label, kind: 'section', sectionType: 'interface' },
  { label: CONTROL_STYLE.main.label, kind: 'section', sectionType: 'main' },
  { label: CONTROL_STYLE.while.label, kind: 'section', sectionType: 'while' },
  { label: CONTROL_STYLE.for.label, kind: 'section', sectionType: 'for' },
  { label: CONTROL_STYLE.try.label, kind: 'section', sectionType: 'try' },
  { label: CONTROL_STYLE.catch.label, kind: 'section', sectionType: 'catch' },
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

function getHandlePoint(rect: NodeRect, handleId?: string | null) {
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  if (!handleId) return center;
  const id = handleId.toLowerCase();
  if (id.includes('left')) return { x: rect.x, y: rect.y + rect.height / 2 };
  if (id.includes('right')) return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
  if (id.includes('top')) return { x: rect.x + rect.width / 2, y: rect.y };
  if (id.includes('bottom')) return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
  return center;
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

function getBaseNodeTint(nodeKind: NodeKind) {
  if (nodeKind === 'start') return '#ecfdf5';
  if (nodeKind === 'end') return '#fff1f2';
  return '#ffffff';
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
  if (node.type === 'memoNode') return 'メモ';
  if (node.type === 'stampNode') return 'スタンプ';
  return getLogicNodeLabel(node.data as LogicNodeData);
}

function buildClassInstanceLabel(classNode: Node<SectionNodeData>) {
  const baseLabel = classNode.data.label?.trim() ?? '';
  const displayLabel = baseLabel.length > 0 ? baseLabel : CONTROL_STYLE.class.label;
  return `new ${displayLabel}()`;
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
  if (node.type !== 'logicNode') return null;
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

function cloneJson<T>(value: T): T {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

function formatSaveLabel(date: Date) {
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getUserId() {
  if (typeof window === 'undefined') return 'unknown';
  const stored = window.localStorage.getItem(USER_ID_STORAGE_KEY);
  if (stored) return stored;
  const generated =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `user-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(USER_ID_STORAGE_KEY, generated);
  return generated;
}

function resolveApiUrl(path: string) {
  if (!API_BASE_URL) return path;
  const base = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${base}${path}`;
}

async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers ?? {});
  headers.set('X-User-Id', getUserId());
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const url = resolveApiUrl(path);
  console.log(`[DEBUG] apiFetch: ${options.method || 'GET'} ${url}`, { userId: getUserId(), path, API_BASE_URL });
  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }
  if (response.status === 204) {
    return null as T;
  }
  return (await response.json()) as T;
}

function serializeNode(node: Node<FlowNodeData>): StoredNode {
  let data: FlowNodeData;
  if (node.type === 'stampNode') {
    const stampData = node.data as StampNodeData;
    data = { stamp: stampData.stamp, seq: stampData.seq };
  } else if (node.type === 'memoNode') {
    const memoData = node.data as MemoNodeData;
    data = { text: memoData.text, seq: memoData.seq };
  } else if (node.type === 'logicNode') {
    const logicData = node.data as LogicNodeData;
    data = {
      label: logicData.label,
      nodeKind: logicData.nodeKind,
      seq: logicData.seq,
      controlType: logicData.controlType,
      condition: logicData.condition,
      note: logicData.note,
      instanceOfSectionId: logicData.instanceOfSectionId,
    };
  } else {
    data = node.data as SectionNodeData;
  }
  return {
    id: node.id,
    type: node.type,
    position: { ...node.position },
    data: cloneJson(data),
    parentNode: node.parentNode,
    extent: node.extent,
    style: node.style ? { ...node.style } : undefined,
    width: node.width,
    height: node.height,
  };
}

function serializeEdge(edge: Edge<LogicEdgeData>): StoredEdge {
  const data = ensureEdgeData(edge);
  return {
    id: edge.id,
    type: 'logicEdge',
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    data: cloneJson({
      controlType: data.controlType,
      condition: data.condition,
      note: data.note,
      validations: data.validations ?? [],
      parallelOffset: data.parallelOffset ?? 0,
    }),
  };
}

function hydrateNode(node: StoredNode): Node<FlowNodeData> {
  return {
    ...node,
    position: { ...node.position },
    data: cloneJson(node.data),
    style: node.style ? { ...node.style } : undefined,
  };
}

function hydrateEdge(edge: StoredEdge): Edge<LogicEdgeData> {
  const base = {
    ...edge,
    type: 'logicEdge',
    data: edge.data ?? { controlType: DEFAULT_EDGE_CONTROL },
  };
  return {
    ...base,
    data: ensureEdgeData(base as Edge<LogicEdgeData>),
  };
}

function getNextNodeSeqFromNodes(nodes: StoredNode[]) {
  const maxSeq = nodes.reduce((max, node) => {
    const seq = (node.data as FlowNodeData).seq;
    return typeof seq === 'number' && seq > max ? seq : max;
  }, 0);
  return Math.max(1, maxSeq + 1);
}

function getNextEdgeSeqFromEdges(edges: StoredEdge[]) {
  const maxSeq = edges.reduce((max, edge) => {
    const match = edge.id.match(/edge-(\d+)/);
    const seq = match ? Number(match[1]) : 0;
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return Math.max(1, maxSeq + 1);
}

function formatTypedFields(items?: TypedField[]) {
  if (!items || !Array.isArray(items) || items.length === 0) return [];
  return items
    .map((item) => {
      const name = item.name?.trim() ?? '';
      const type = item.type?.trim() ?? '';
      if (!name && !type) return null;
      if (name && type) return `${name} : ${type}`;
      return name || type;
    })
    .filter(Boolean) as string[];
}

function formatValidationRules(items?: ValidationRule[]) {
  if (!items || !Array.isArray(items) || items.length === 0) return [];
  return items
    .map((rule) => {
      const target = rule.target?.trim() ?? '';
      const content = rule.rule?.trim() ?? '';
      const message = rule.message?.trim() ?? '';
      if (!target && !content && !message) return null;
      const base = [target, content].filter((value) => value.length > 0).join(' ');
      if (message.length > 0) {
        return base.length > 0 ? `${base} (${message})` : message;
      }
      return base;
    })
    .filter(Boolean) as string[];
}

function formatValidationLabel(rule: ValidationRule) {
  const target = rule.target?.trim() ?? '';
  const content = rule.rule?.trim() ?? '';
  const message = rule.message?.trim() ?? '';
  const base = [target, content].filter((value) => value.length > 0).join(' ');
  if (message.length > 0) {
    return base.length > 0 ? `${base} (${message})` : message;
  }
  return base;
}

const CATCH_OPTIONS = [
  { value: 'ValueError', label: 'ValueError' },
  { value: 'TypeError', label: 'TypeError' },
  { value: 'KeyError', label: 'KeyError' },
  { value: 'IndexError', label: 'IndexError' },
  { value: 'CustomError', label: 'CustomError' },
  { value: 'other', label: 'その他' },
] as const;

function parseCatchValue(value: string) {
  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return { exceptionType: '', exceptionOther: '' };
  }
  const matched = CATCH_OPTIONS.find(
    (option) => option.value !== 'other' && option.value === trimmed
  );
  if (matched) {
    return { exceptionType: matched.value, exceptionOther: '' };
  }
  return { exceptionType: 'other', exceptionOther: trimmed };
}

function buildCatchValue(form: NodeFormState) {
  if (form.catchExceptionType === 'other') {
    return normalizeText(form.catchExceptionOther);
  }
  return normalizeText(form.catchExceptionType);
}

function buildConditionForControl(controlType: EdgeControlType, form: EdgeFormState) {
  if (controlType === 'flow') return undefined;
  return normalizeText(form.condition);
}

function getConditionMeta(controlType: EdgeControlType) {
  if (controlType === 'flow') return null;
  if (controlType === 'break') {
    return { label: '理由', placeholder: '例: 条件を満たしたため' };
  }
  if (controlType === 'continue') {
    return { label: '理由', placeholder: '例: スキップ条件に該当' };
  }
  if (controlType === 'if') {
    return { label: '条件式', placeholder: '例: user.isAdmin' };
  }
  if (controlType === 'elif') {
    return { label: '条件式', placeholder: '例: status === \"pending\"' };
  }
  if (controlType === 'else') {
    return { label: '条件式', placeholder: '例: その他の条件' };
  }
  return { label: '条件式', placeholder: '条件を入力' };
}

function isSectionEntryConnection(
  nodes: Node<FlowNodeData>[],
  connection: Connection
): boolean {
  if (!connection.source || !connection.target) return false;
  const sourceNode = nodes.find((node) => node.id === connection.source);
  if (!sourceNode || sourceNode.type !== 'sectionNode') return false;
  const entryNodeId = (sourceNode.data as SectionNodeData).entryNodeId;
  if (!entryNodeId) return false;
  const targetNode = nodes.find((node) => node.id === connection.target);
  if (!targetNode || targetNode.type !== 'logicNode') return false;
  if (targetNode.parentNode !== sourceNode.id) return false;
  return entryNodeId === connection.target;
}

function getIfControlOptions(
  sourceId: string | null | undefined,
  edges: Edge<LogicEdgeData>[],
  currentEdgeId?: string | null,
  currentEdgeControl?: EdgeControlType | null
): EdgeControlType[] {
  if (!sourceId) return ['if', 'elif', 'else'];
  const otherEdges = edges.filter((edge) => edge.source === sourceId && edge.id !== currentEdgeId);
  const hasIf = otherEdges.some((edge) => edge.data?.controlType === 'if');
  const hasElse = otherEdges.some((edge) => edge.data?.controlType === 'else');
  let options: EdgeControlType[] = [];
  if (!hasIf) {
    options = ['if'];
  } else if (hasElse) {
    options = ['if', 'elif'];
  } else {
    options = ['if', 'elif', 'else'];
  }
  if (
    currentEdgeControl &&
    (currentEdgeControl === 'if' ||
      currentEdgeControl === 'elif' ||
      currentEdgeControl === 'else') &&
    !options.includes(currentEdgeControl)
  ) {
    options = [...options, currentEdgeControl];
  }
  return options;
}

function buildEdgeLabel(
  controlType: EdgeControlType,
  condition?: string,
  note?: string,
  validations?: ValidationRule[]
) {
  const controlLabel = CONTROL_STYLE[controlType].label;
  const normalizedCondition = condition?.trim() ?? '';
  const normalizedNote = note?.trim() ?? '';
  const validationItems = (validations ?? [])
    .map((rule) => formatValidationLabel(rule))
    .filter((value) => value.length > 0)
    .map((value) => ({ text: `validation: ${value}`, color: '#0f172a' }));
  const items = [
    controlLabel.length > 0 ? { text: controlLabel, color: CONTROL_STYLE[controlType].color } : null,
    normalizedCondition.length > 0 ? { text: normalizedCondition, color: '#111827' } : null,
    normalizedNote.length > 0 ? { text: normalizedNote, color: '#6b7280' } : null,
    ...validationItems,
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

function ensureEdgeData(edge: Edge<LogicEdgeData>): LogicEdgeData {
  const data = edge.data ?? { controlType: DEFAULT_EDGE_CONTROL };
  return {
    controlType: data.controlType ?? DEFAULT_EDGE_CONTROL,
    condition: data.condition,
    note: data.note,
    validations: data.validations,
    parallelOffset: data.parallelOffset ?? 0,
    onEdit: data.onEdit,
  };
}

function normalizeParallelOffsets(edges: Edge<LogicEdgeData>[]) {
  const pairs = new Map<
    string,
    { a: string; b: string; forward: boolean; reverse: boolean }
  >();
  edges.forEach((edge) => {
    const source = edge.source;
    const target = edge.target;
    if (!source || !target) return;
    const sourceKey = `${source}::${edge.sourceHandle ?? ''}`;
    const targetKey = `${target}::${edge.targetHandle ?? ''}`;
    const [a, b] = sourceKey < targetKey ? [sourceKey, targetKey] : [targetKey, sourceKey];
    const key = `${a}||${b}`;
    const entry = pairs.get(key) ?? { a, b, forward: false, reverse: false };
    if (sourceKey === a && targetKey === b) {
      entry.forward = true;
    } else {
      entry.reverse = true;
    }
    pairs.set(key, entry);
  });
  let changed = false;
  const normalized = edges.map((edge) => {
    const source = edge.source;
    const target = edge.target;
    if (!source || !target) return edge;
    const sourceKey = `${source}::${edge.sourceHandle ?? ''}`;
    const targetKey = `${target}::${edge.targetHandle ?? ''}`;
    const [a, b] = sourceKey < targetKey ? [sourceKey, targetKey] : [targetKey, sourceKey];
    const entry = pairs.get(`${a}||${b}`);
    const hasBoth = Boolean(entry?.forward && entry?.reverse);
    const desiredOffset =
      hasBoth && entry ? (sourceKey === entry.a && targetKey === entry.b ? 1 : -1) : 0;
    const data = edge.data;
    const currentOffset = data?.parallelOffset ?? 0;
    const hasControlType = Boolean(data?.controlType);
    const resolvedData = ensureEdgeData(edge);
    const desiredColor = CONTROL_STYLE[resolvedData.controlType].color;
    const desiredDash = CONTROL_STYLE[resolvedData.controlType].edgeDash;
    const needsStroke = edge.style?.stroke == null;
    const needsWidth = edge.style?.strokeWidth == null;
    const needsDash = edge.style?.strokeDasharray == null && desiredDash !== undefined;
    const nextStyle =
      needsStroke || needsWidth || needsDash
        ? {
            ...edge.style,
            stroke: (edge.style?.stroke as string | undefined) ?? desiredColor,
            strokeWidth:
              (edge.style?.strokeWidth as number | undefined) ?? EDGE_STROKE_WIDTH,
            strokeDasharray: edge.style?.strokeDasharray ?? desiredDash,
            zIndex: (edge.style?.zIndex as number | undefined) ?? 1000,
          }
        : edge.style;
    const nextMarkerEnd =
      edge.markerEnd ??
      ({
        type: MarkerType.ArrowClosed,
        color: (nextStyle?.stroke as string | undefined) ?? desiredColor,
      } as const);
    const needsStyle = nextStyle !== edge.style;
    const needsMarker = edge.markerEnd == null;
    const needsType = edge.type !== 'logicEdge';
    const needsData = currentOffset !== desiredOffset || !hasControlType;
    if (!needsData && !needsStyle && !needsMarker && !needsType) {
      return edge;
    }
    changed = true;
    return {
      ...edge,
      type: 'logicEdge',
      data: { ...resolvedData, parallelOffset: desiredOffset },
      style: nextStyle,
      markerEnd: nextMarkerEnd,
    };
  });
  return changed ? normalized : edges;
}

function LogicEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  markerEnd,
  markerStart,
}: EdgeProps<LogicEdgeData>) {
  const offsetSign = data?.parallelOffset ?? 0;
  let adjustedSourceX = sourceX;
  let adjustedSourceY = sourceY;
  let adjustedTargetX = targetX;
  let adjustedTargetY = targetY;
  if (offsetSign !== 0) {
    const useForward = typeof source === 'string' && typeof target === 'string' && source < target;
    const baseDx = useForward ? targetX - sourceX : sourceX - targetX;
    const baseDy = useForward ? targetY - sourceY : sourceY - targetY;
    const length = Math.hypot(baseDx, baseDy) || 1;
    const nx = -baseDy / length;
    const ny = baseDx / length;
    const offset = EDGE_PARALLEL_OFFSET * offsetSign;
    adjustedSourceX = sourceX + nx * offset;
    adjustedSourceY = sourceY + ny * offset;
    adjustedTargetX = targetX + nx * offset;
    adjustedTargetY = targetY + ny * offset;
  }
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: adjustedSourceX,
    sourceY: adjustedSourceY,
    targetX: adjustedTargetX,
    targetY: adjustedTargetY,
    sourcePosition,
    targetPosition,
  });
  const label = data
    ? buildEdgeLabel(data.controlType, data.condition, data.note, data.validations)
    : undefined;
  const hasInteractiveLabel = Boolean(label) || Boolean(data?.onEdit);

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {hasInteractiveLabel ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan cursor-pointer"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              data?.onEdit?.(id);
            }}
          >
            {label ?? <div className="h-6 w-6" />}
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
    const isFunction = data.sectionType === 'function';
    const isLoop = data.sectionType === 'while' || data.sectionType === 'for';
    const isCatch = data.sectionType === 'catch';
    const allowValidations =
      data.sectionType === 'function' ||
      data.sectionType === 'class' ||
      data.sectionType === 'interface';
    const catchForm = isCatch ? parseCatchValue(data.catchException ?? '') : null;
    return {
      ...base,
      label: data.label ?? '',
      note: data.note ?? '',
      entryNodeId: data.entryNodeId ?? '',
      functionArgs: data.functionArgs?.map((arg) => ({ ...arg })) ?? [],
      functionReturnType: data.functionReturnType ?? '',
      functionReturnValue: data.functionReturnValue ?? '',
      loopCondition: isLoop ? data.loopCondition ?? '' : '',
      catchExceptionType: catchForm?.exceptionType ?? '',
      catchExceptionOther: catchForm?.exceptionOther ?? '',
      classConstructorArgs: data.classConstructorArgs?.map((arg) => ({ ...arg })) ?? [],
      classMembers: data.classMembers?.map((arg) => ({ ...arg })) ?? [],
      classMethods:
        data.classMethods?.map((method) => ({
          ...method,
          args: method.args?.map((arg) => ({ ...arg })) ?? [],
        })) ?? [],
      interfaceMembers: data.interfaceMembers?.map((arg) => ({ ...arg })) ?? [],
      interfaceMethods:
        data.interfaceMethods?.map((method) => ({
          ...method,
          args: method.args?.map((arg) => ({ ...arg })) ?? [],
        })) ?? [],
      validations: allowValidations
        ? data.validations?.map((rule) => ({ ...rule })) ?? []
        : [],
    };
  }
  if (node.type !== 'logicNode') return base;
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
  const nodeBg = controlStyle?.nodeBg ?? getBaseNodeTint(data.nodeKind);
  const showLabel = label.length > 0;

  return (
    <div
      className="rounded-md border-2 px-5 py-4 min-w-[160px] min-h-[72px] text-base font-medium text-slate-900 backdrop-blur-md shadow-lg ring-1 ring-white/40"
      style={{
        borderColor,
        backgroundColor: toRgba(nodeBg, 0.35),
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
      {showLabel ? <div className="text-center text-base font-semibold">{label}</div> : null}
      {data.condition ? (
        <div className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
          条件式: {data.condition}
        </div>
      ) : null}
      {data.note ? (
        <div className="mt-1 text-sm text-gray-500 whitespace-pre-wrap">補足: {data.note}</div>
      ) : null}
      <Handle type="source" position={Position.Left} id="h-left" />
      <Handle type="source" position={Position.Right} id="h-right" />
      <Handle type="source" position={Position.Top} id="h-top" />
      <Handle type="source" position={Position.Bottom} id="h-bottom" />
    </div>
  );
}

function MemoNode({ data, selected }: NodeProps<MemoNodeData>) {
  return (
    <div className="relative h-full w-full rounded-lg border border-white/60 bg-amber-50/60 p-3 text-sm text-slate-900 backdrop-blur-md shadow-lg ring-1 ring-white/40">
      <NodeResizer isVisible={selected} minWidth={MEMO_MIN_WIDTH} minHeight={MEMO_MIN_HEIGHT} />
      <div className="text-xs font-semibold text-amber-700">メモ</div>
      {data.text?.trim().length > 0 ? (
        <div className="mt-2 whitespace-pre-wrap text-sm text-gray-900">{data.text}</div>
      ) : (
        <div className="mt-2 text-xs text-amber-600">内容を入力してください</div>
      )}
    </div>
  );
}

function StampNode({ id, data }: NodeProps<StampNodeData>) {
  const stamp = STAMP_OPTIONS.find((option) => option.id === data.stamp);
  return (
    <div className="group relative flex h-full w-full items-center justify-center rounded-full border border-white/60 bg-white/50 backdrop-blur-md shadow-lg ring-1 ring-white/50">
      <button
        type="button"
        className="absolute -right-2 -top-2 hidden h-5 w-5 items-center justify-center rounded-full border border-white/70 bg-white/80 text-[10px] text-gray-600 shadow-sm group-hover:flex"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          data.onDelete?.(id);
        }}
      >
        ×
      </button>
      <div className="text-2xl" aria-label={stamp?.label ?? 'スタンプ'}>
        {stamp?.emoji ?? '❓'}
      </div>
    </div>
  );
}

function SectionNode({ data, selected }: NodeProps<SectionNodeData>) {
  const style = CONTROL_STYLE[data.sectionType];
  const sectionBg = toRgba(style.nodeBg ?? '#f8fafc', 0.28);
  const details: { label: string; value: string }[] = [];
  if (data.sectionType === 'function') {
    const args = formatTypedFields(data.functionArgs);
    if (args.length > 0) {
      details.push({ label: '引数', value: args.join('\n') });
    }
    const returns = data.functionReturnType?.trim() ?? '';
    if (returns.length > 0) {
      details.push({ label: '返り値の型', value: returns });
    }
    const returnValue = data.functionReturnValue?.trim() ?? '';
    if (returnValue.length > 0) {
      details.push({ label: '返り値', value: returnValue });
    }
  }
  if (data.sectionType === 'class') {
    const ctorArgs = formatTypedFields(data.classConstructorArgs);
    if (ctorArgs.length > 0) {
      details.push({ label: 'コンストラクタ引数', value: ctorArgs.join('\n') });
    }
    const members = formatTypedFields(data.classMembers);
    if (members.length > 0) {
      details.push({ label: 'メンバ変数', value: members.join('\n') });
    }
    if (data.classMethods && data.classMethods.length > 0) {
      data.classMethods.forEach((method, index) => {
        const lines: string[] = [];
        if (method.name && method.name.trim().length > 0) {
          lines.push(`名前: ${method.name}`);
        }
        const methodArgs = formatTypedFields(method.args);
        if (methodArgs.length > 0) {
          lines.push(`引数:\n${methodArgs.join('\n')}`);
        }
        if (method.returns && method.returns.trim().length > 0) {
          lines.push(`返り値: ${method.returns}`);
        }
        if (method.note && method.note.trim().length > 0) {
          lines.push(`補足: ${method.note}`);
        }
        if (lines.length > 0) {
          details.push({ label: `メソッド${index + 1}`, value: lines.join('\n') });
        }
      });
    }
  }
  if (data.sectionType === 'interface') {
    const members = formatTypedFields(data.interfaceMembers);
    if (members.length > 0) {
      details.push({ label: 'プロパティ', value: members.join('\n') });
    }
    if (data.interfaceMethods && data.interfaceMethods.length > 0) {
      data.interfaceMethods.forEach((method, index) => {
        const lines: string[] = [];
        if (method.name && method.name.trim().length > 0) {
          lines.push(`名前: ${method.name}`);
        }
        const methodArgs = formatTypedFields(method.args);
        if (methodArgs.length > 0) {
          lines.push(`引数:\n${methodArgs.join('\n')}`);
        }
        if (method.returns && method.returns.trim().length > 0) {
          lines.push(`返り値: ${method.returns}`);
        }
        if (method.note && method.note.trim().length > 0) {
          lines.push(`補足: ${method.note}`);
        }
        if (lines.length > 0) {
          details.push({ label: `メソッド${index + 1}`, value: lines.join('\n') });
        }
      });
    }
  }
  if (data.sectionType === 'while' || data.sectionType === 'for') {
    const loopCondition = data.loopCondition?.trim() ?? '';
    if (loopCondition.length > 0) {
      details.push({ label: '条件式', value: loopCondition });
    }
  }
  if (data.sectionType === 'catch') {
    const exceptionValue = data.catchException?.trim() ?? '';
    if (exceptionValue.length > 0) {
      details.push({ label: '例外種別', value: exceptionValue });
    }
  }
  if (
    data.sectionType === 'function' ||
    data.sectionType === 'class' ||
    data.sectionType === 'interface'
  ) {
    const validationLines = formatValidationRules(data.validations);
    if (validationLines.length > 0) {
      details.push({ label: 'validation', value: validationLines.join('\n') });
    }
  }
  if (data.sectionType !== 'main' && data.note && data.note.trim().length > 0) {
    details.push({ label: '補足', value: data.note });
  }
  return (
    <div
      className="relative h-full w-full rounded-xl border-2 border-dashed p-3 text-sm text-slate-800"
      style={{
        borderColor: style.color,
        backgroundColor: 'transparent',
        zIndex: -1,
        pointerEvents: 'none'
      }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={SECTION_MIN_WIDTH}
        minHeight={SECTION_MIN_HEIGHT}
      />
      <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: style.color, pointerEvents: 'auto' }}>
        {style.label}
      </div>
      {data.label && data.label.trim().length > 0 ? (
        <div className="mt-1 text-sm font-semibold text-gray-900 whitespace-pre-wrap" style={{ pointerEvents: 'auto' }}>
          {data.label}
        </div>
      ) : null}
      {details.length > 0 ? (
        <div className="mt-2 space-y-1 text-xs text-gray-700" style={{ pointerEvents: 'auto' }}>
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
  memoNode: MemoNode,
  stampNode: StampNode,
};

const edgeTypes = {
  logicEdge: LogicEdge,
};

export default function FlowVisualization() {
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<LogicEdgeData>([]);
  const [savedFlows, setSavedFlows] = useState<SavedFlowSummary[]>([]);
  const [isLoadingFlows, setIsLoadingFlows] = useState(false);
  const [isSavingFlow, setIsSavingFlow] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
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
  const [selectedEdgeControl, setSelectedEdgeControl] =
    useState<EdgeControlType>(DEFAULT_EDGE_CONTROL);
  const [edgeForm, setEdgeForm] = useState<EdgeFormState>({ ...EMPTY_EDGE_FORM });
  const [pendingStamp, setPendingStamp] = useState<StampType | null>(null);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportedText, setExportedText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [currentFlowName, setCurrentFlowName] = useState<string | null>(null);
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

  const fetchSavedFlows = useCallback(async () => {
    setIsLoadingFlows(true);
    setSaveError(null);
    try {
      const list = await apiFetch<SavedFlowSummary[]>('/flows', { method: 'GET' });
      setSavedFlows(list ?? []);
    } catch {
      setSaveError('保存データの取得に失敗しました。');
    } finally {
      setIsLoadingFlows(false);
    }
  }, []);

  useEffect(() => {
    void fetchSavedFlows();
  }, [fetchSavedFlows]);

  useEffect(() => {
    const normalized = normalizeParallelOffsets(edges);
    if (normalized !== edges) {
      setEdges(normalized);
    }
  }, [edges, setEdges]);

  const updateFlow = useCallback(async () => {
    if (!currentFlowId) {
      return;
    }

    const snapshot = {
      nodes: nodes.map(serializeNode),
      edges: edges.map(serializeEdge),
      nextNodeSeq: nextNodeSeq.current,
      nextEdgeSeq: nextEdgeSeq.current,
    };

    try {
      await apiFetch<unknown>(`/flows/${currentFlowId}`, {
        method: 'PUT',
        body: JSON.stringify({ snapshot }),
      });
      await fetchSavedFlows(); // 保存後にリストを更新
    } catch (error) {
      console.error('上書き保存に失敗しました:', error);
    }
  }, [currentFlowId, nodes, edges, fetchSavedFlows]);


  const createLogicNode = useCallback(
    (params: {
      kind: NodeKind;
      label: string;
      position: XYPosition;
      controlType?: NodeControlType;
      condition?: string;
      note?: string;
      instanceOfSectionId?: string;
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
          instanceOfSectionId: params.instanceOfSectionId,
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
      entryNodeId?: string;
      functionArgs?: TypedField[];
      functionReturnType?: string;
      functionReturnValue?: string;
      loopCondition?: string;
      catchException?: string;
      classConstructorArgs?: TypedField[];
      classMembers?: TypedField[];
      classMethods?: ClassMethod[];
      interfaceMembers?: TypedField[];
      interfaceMethods?: ClassMethod[];
      validations?: ValidationRule[];
      style?: { width?: number; height?: number };
    }): Node<SectionNodeData> => {
      const seq = nextNodeSeq.current++;
      return {
        id: `section-${seq}`,
        type: 'sectionNode',
        position: params.position,
        style: {
          width: params.style?.width ?? SECTION_DEFAULT_WIDTH,
          height: params.style?.height ?? SECTION_DEFAULT_HEIGHT
        },
        data: {
          label: params.label,
          sectionType: params.sectionType,
          seq,
          note: params.note,
          entryNodeId: params.entryNodeId,
          functionArgs: params.functionArgs,
          functionReturnType: params.functionReturnType,
          functionReturnValue: params.functionReturnValue,
          loopCondition: params.loopCondition,
          catchException: params.catchException,
          classConstructorArgs: params.classConstructorArgs,
          classMembers: params.classMembers,
          classMethods: params.classMethods,
          interfaceMembers: params.interfaceMembers,
          interfaceMethods: params.interfaceMethods,
          validations: params.validations,
        },
      };
    },
    []
  );

  const createMemoNode = useCallback(
    (params: { text: string; position: XYPosition }): Node<MemoNodeData> => {
      const seq = nextNodeSeq.current++;
      return {
        id: `memo-${seq}`,
        type: 'memoNode',
        position: params.position,
        style: { width: MEMO_DEFAULT_WIDTH, height: MEMO_DEFAULT_HEIGHT },
        data: {
          text: params.text,
          seq,
        },
      };
    },
    []
  );

  const createStampNode = useCallback(
    (params: { stamp: StampType; position: XYPosition }): Node<StampNodeData> => {
      const seq = nextNodeSeq.current++;
      return {
        id: `stamp-${seq}`,
        type: 'stampNode',
        position: params.position,
        style: { width: STAMP_SIZE, height: STAMP_SIZE },
        data: {
          stamp: params.stamp,
          seq,
        },
      };
    },
    []
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (isSectionEntryConnection(nodes, params)) {
        setPendingConnection(null);
        return;
      }
      setPendingNodeClientPosition(null);
      setPendingNodeDelete(null);
      setPendingNodeEdit(null);
      setPendingEdgeEdit(null);
      setPendingMemoEdit(null);
      setPendingMemoClientPosition(null);
      setSelectedEdgeControl(DEFAULT_EDGE_CONTROL);
      setEdgeForm({ ...EMPTY_EDGE_FORM });
      setPendingConnection(params);
    },
    [nodes]
  );

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge<LogicEdgeData>, newConnection: Connection) => {
      if (isSectionEntryConnection(nodes, newConnection)) {
        return;
      }
      setPendingNodeClientPosition(null);
      setPendingNodeDelete(null);
      setPendingNodeEdit(null);
      setPendingEdgeEdit(null);
      setEdges((currentEdges) =>
        normalizeParallelOffsets(
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
        )
      );
    },
    [nodes, setEdges]
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
    setPendingMemoEdit(null);
    setPendingMemoClientPosition(null);
    setPendingStamp(null);
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

  // セクションサイズを動的に計算するヘルパー関数
  const calculateSectionSize = useCallback((
    nodes: Array<{ position: { x: number; y: number } }>,
    nodeWidth = 150, // 標準ノード幅
    nodeHeight = 40,  // 標準ノード高
    padding = 30,     // セクション内パディング（増量）
    bottomPadding = 40 // 下側に追加の余白
  ) => {
    if (nodes.length === 0) {
      return { width: 600, height: 150 }; // 最小幅を大幅に拡張
    }

    // 各ノードの境界を計算
    const minX = Math.min(...nodes.map(n => n.position.x));
    const maxX = Math.max(...nodes.map(n => n.position.x + nodeWidth));
    const minY = Math.min(...nodes.map(n => n.position.y));
    const maxY = Math.max(...nodes.map(n => n.position.y + nodeHeight));

    const width = Math.max(600, maxX - minX + padding * 2); // 最小幅を600pxに拡張
    const height = Math.max(150, maxY - minY + padding * 2 + 40 + bottomPadding); // 十分な高さを確保

    return { width, height };
  }, []);

  const applyTemplate = useCallback((templateId: TemplateType) => {
    const wrapper = wrapperRef.current;
    const instance = reactFlowInstance.current;
    if (!wrapper || !instance) return;

    const viewportCenter = {
      x: wrapper.clientWidth / 2,
      y: wrapper.clientHeight / 2,
    };
    const flowCenter = instance.screenToFlowPosition(viewportCenter);

    if (templateId === 'dfs') {
      // DFS（深さ優先探索）テンプレートの作成（見やすいレイアウト）
      const SECTION_MARGIN = 300; // セクション間のマージン（さらに拡大）
      const NODE_MARGIN = 150; // セクション内ノード間のマージン（さらに拡大）
      const SECTION_TO_NODE_MARGIN = 200; // セクションと外部ノード間のマージン（さらに拡大）
      const HORIZONTAL_SPACING = 400; // 水平方向の間隔（新規追加）

      const startNode = createLogicNode({
        kind: 'start',
        label: 'Start',
        position: { x: flowCenter.x, y: flowCenter.y - 600 },
      });

      // 関数呼び出しノード
      const functionCallNode = createLogicNode({
        kind: 'normal',
        label: 'DFS関数呼び出し',
        position: { x: flowCenter.x, y: flowCenter.y - 600 },
      });

      // DFS関数内のノード定義（シンプルで見やすく）
      const dfsFunctionNodes = [
        { position: { x: 200, y: 60 }, label: 'visited = new Set()' },
        { position: { x: 200, y: 60 + NODE_MARGIN }, label: 'result = []' },
        { position: { x: 200, y: 60 + NODE_MARGIN * 2 }, label: 'stack = [startNode]' },
        { position: { x: 200, y: 60 + NODE_MARGIN * 6 }, label: 'return result' },
      ];

      // DFS関数セクションのサイズを動的計算
      const dfsFunctionSize = calculateSectionSize(dfsFunctionNodes);

      // DFS関数セクション（Startノードから十分な間隔で配置）
      const dfsFunctionX = flowCenter.x - dfsFunctionSize.width / 2;
      const dfsFunctionY = flowCenter.y - 400;
      const dfsFunction = createSectionNode({
        sectionType: 'function',
        label: 'dfs(graph: Graph, startNode: Node) -> Array<Node>',
        position: { x: dfsFunctionX, y: dfsFunctionY },
        style: dfsFunctionSize,
      });

      // DFS関数内のノード（完全な初期化）
      const initVisitedNode = createLogicNode({
        kind: 'normal',
        label: 'visited = new Set()',
        position: { x: 200, y: 60 },
        instanceOfSectionId: dfsFunction.id,
      });
      initVisitedNode.parentNode = dfsFunction.id;
      initVisitedNode.extent = 'parent';

      const initResultNode = createLogicNode({
        kind: 'normal',
        label: 'result = []',
        position: { x: 200, y: 60 + NODE_MARGIN },
        instanceOfSectionId: dfsFunction.id,
      });
      initResultNode.parentNode = dfsFunction.id;
      initResultNode.extent = 'parent';

      const initStackNode = createLogicNode({
        kind: 'normal',
        label: 'stack = [startNode]',
        position: { x: 200, y: 60 + NODE_MARGIN * 2 },
        instanceOfSectionId: dfsFunction.id,
      });
      initStackNode.parentNode = dfsFunction.id;
      initStackNode.extent = 'parent';

      // While文内のノード定義（見やすく配置）
      const whileSectionNodes = [
        { position: { x: 200, y: 60 }, label: 'current = stack.pop()' },
        { position: { x: 200, y: 60 + NODE_MARGIN }, label: 'if (!visited.has(current))' },
        { position: { x: 200, y: 60 + NODE_MARGIN * 2 }, label: 'visited.add(current)' },
        { position: { x: 200, y: 60 + NODE_MARGIN * 3 }, label: 'result.push(current)' },
        { position: { x: 200, y: 60 + NODE_MARGIN * 4 }, label: 'neighbors = graph[current]' },
        { position: { x: 200, y: 60 + NODE_MARGIN * 5 }, label: 'for neighbor in neighbors' },
        { position: { x: 200, y: 60 + NODE_MARGIN * 6 }, label: 'if (!visited.has(neighbor))' },
        { position: { x: 200, y: 60 + NODE_MARGIN * 7 }, label: 'stack.push(neighbor)' },
      ];

      // While文セクションのサイズを動的計算
      const whileSectionSize = calculateSectionSize(whileSectionNodes);

      // While文セクション（DFS関数から適切な間隔で配置）
      const whileSectionX = flowCenter.x - whileSectionSize.width / 2;
      const whileSectionY = dfsFunctionY + dfsFunctionSize.height + SECTION_MARGIN;
      const whileSection = createSectionNode({
        sectionType: 'while',
        label: 'while (stack.length > 0)',
        position: { x: whileSectionX, y: whileSectionY },
        loopCondition: 'stack.length > 0',
        style: whileSectionSize,
      });

      // While文内のノード（完全なDFSアルゴリズム）
      const popNode = createLogicNode({
        kind: 'normal',
        label: 'current = stack.pop()',
        position: { x: 200, y: 60 },
        instanceOfSectionId: whileSection.id,
      });
      popNode.parentNode = whileSection.id;
      popNode.extent = 'parent';

      const visitedCheckIf = createLogicNode({
        kind: 'normal',
        label: 'if (!visited.has(current))',
        position: { x: 200, y: 60 + NODE_MARGIN },
        instanceOfSectionId: whileSection.id,
      });
      visitedCheckIf.parentNode = whileSection.id;
      visitedCheckIf.extent = 'parent';

      const markVisitedNode = createLogicNode({
        kind: 'normal',
        label: 'visited.add(current)',
        position: { x: 200, y: 60 + NODE_MARGIN * 2 },
        instanceOfSectionId: whileSection.id,
      });
      markVisitedNode.parentNode = whileSection.id;
      markVisitedNode.extent = 'parent';

      const addToResultNode = createLogicNode({
        kind: 'normal',
        label: 'result.push(current)',
        position: { x: 200, y: 60 + NODE_MARGIN * 3 },
        instanceOfSectionId: whileSection.id,
      });
      addToResultNode.parentNode = whileSection.id;
      addToResultNode.extent = 'parent';

      const getNeighborsNode = createLogicNode({
        kind: 'normal',
        label: 'neighbors = graph[current]',
        position: { x: 200, y: 60 + NODE_MARGIN * 4 },
        instanceOfSectionId: whileSection.id,
      });
      getNeighborsNode.parentNode = whileSection.id;
      getNeighborsNode.extent = 'parent';

      const forLoopNode = createLogicNode({
        kind: 'normal',
        label: 'for neighbor in neighbors',
        position: { x: 200, y: 60 + NODE_MARGIN * 5 },
        instanceOfSectionId: whileSection.id,
      });
      forLoopNode.parentNode = whileSection.id;
      forLoopNode.extent = 'parent';

      const neighborCheckNode = createLogicNode({
        kind: 'normal',
        label: 'if (!visited.has(neighbor))',
        position: { x: 200, y: 60 + NODE_MARGIN * 6 },
        instanceOfSectionId: whileSection.id,
      });
      neighborCheckNode.parentNode = whileSection.id;
      neighborCheckNode.extent = 'parent';

      const pushNeighborNode = createLogicNode({
        kind: 'normal',
        label: 'stack.push(neighbor)',
        position: { x: 200, y: 60 + NODE_MARGIN * 7 },
        instanceOfSectionId: whileSection.id,
      });
      pushNeighborNode.parentNode = whileSection.id;
      pushNeighborNode.extent = 'parent';

      // 関数の戻り値（関数内）
      const returnNode = createLogicNode({
        kind: 'normal',
        label: 'return result',
        position: { x: 200, y: 60 + NODE_MARGIN * 6 },
        instanceOfSectionId: dfsFunction.id,
      });
      returnNode.parentNode = dfsFunction.id;
      returnNode.extent = 'parent';

      // 関数呼び出し後の戻り値受け取り
      const resultReceiveNode = createLogicNode({
        kind: 'normal',
        label: 'result = DFS結果受け取り',
        position: { x: flowCenter.x, y: whileSectionY + whileSectionSize.height + SECTION_TO_NODE_MARGIN * 1.5 },
      });

      const endNode = createLogicNode({
        kind: 'end',
        label: 'End',
        position: { x: flowCenter.x, y: whileSectionY + whileSectionSize.height + SECTION_TO_NODE_MARGIN * 2 },
      });

      const newNodes = [
        startNode, functionCallNode, dfsFunction, initVisitedNode, initResultNode, initStackNode,
        whileSection, popNode, visitedCheckIf, markVisitedNode, addToResultNode,
        getNeighborsNode, forLoopNode, neighborCheckNode, pushNeighborNode,
        returnNode, resultReceiveNode, endNode
      ];

      // エッジを正しい形式で作成（完全なDFSフロー）
      const flowStyle = { ...CONTROL_STYLE.flow, zIndex: 1000 };
      const ifStyle = { ...CONTROL_STYLE.if, zIndex: 1000 };
      const newEdges: Edge<LogicEdgeData>[] = [
        // Start → 関数呼び出しノード
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: startNode.id,
          target: functionCallNode.id,
          sourceHandle: 'h-bottom',
          targetHandle: 'h-top',
          data: { controlType: 'flow', condition: '', note: 'graph, startNodeを準備', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // 関数呼び出しノード → DFS関数
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: functionCallNode.id,
          target: dfsFunction.id,
          sourceHandle: 'h-bottom',
          targetHandle: 'section-h-top',
          data: { controlType: 'flow', condition: '', note: '引数: graph, startNode', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // DFS関数内：visited初期化 → result初期化
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: initVisitedNode.id,
          target: initResultNode.id,
          sourceHandle: 'h-bottom',
          targetHandle: 'h-top',
          data: { controlType: 'flow', condition: '', note: '', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // result初期化 → stack初期化
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: initResultNode.id,
          target: initStackNode.id,
          sourceHandle: 'h-bottom',
          targetHandle: 'h-top',
          data: { controlType: 'flow', condition: '', note: '', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // stack初期化 → While文セクション
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: initStackNode.id,
          target: whileSection.id,
          sourceHandle: 'h-bottom',
          targetHandle: 'section-h-top',
          data: { controlType: 'flow', condition: '', note: '', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // While文内：完全なDFSフロー
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: popNode.id,
          target: visitedCheckIf.id,
          sourceHandle: 'h-bottom',
          targetHandle: 'h-top',
          data: { controlType: 'flow', condition: '', note: '① スタックからノードを取り出し', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // visited判定 → 訪問済み設定
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: visitedCheckIf.id,
          target: markVisitedNode.id,
          sourceHandle: 'h-bottom',
          targetHandle: 'h-top',
          data: { controlType: 'flow', condition: '', note: '② 未訪問の場合、visitedに追加', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // 訪問済み設定 → 結果に追加
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: markVisitedNode.id,
          target: addToResultNode.id,
          sourceHandle: 'h-bottom',
          targetHandle: 'h-top',
          data: { controlType: 'flow', condition: '', note: '③ 結果リストに追加', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // 結果追加 → 隣接ノード取得
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: addToResultNode.id,
          target: getNeighborsNode.id,
          sourceHandle: 'h-bottom',
          targetHandle: 'h-top',
          data: { controlType: 'flow', condition: '', note: '④ 隣接ノード取得', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // 隣接ノード取得 → forループ
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: getNeighborsNode.id,
          target: forLoopNode.id,
          sourceHandle: 'h-bottom',
          targetHandle: 'h-top',
          data: { controlType: 'flow', condition: '', note: '⑤ 各隣接ノードをチェック', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // forループ → 隣接ノード未訪問チェック
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: forLoopNode.id,
          target: neighborCheckNode.id,
          sourceHandle: 'h-bottom',
          targetHandle: 'h-top',
          data: { controlType: 'flow', condition: '', note: '⑤ 各隣接ノードが未訪問かチェック', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // 隣接ノード未訪問チェック → スタックにプッシュ
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: neighborCheckNode.id,
          target: pushNeighborNode.id,
          sourceHandle: 'h-bottom',
          targetHandle: 'h-top',
          data: { controlType: 'flow', condition: '', note: '⑥ 未訪問ならスタックに追加', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // While文終了後、関数内でreturn文実行（セクション内で完結）
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: initStackNode.id,
          target: returnNode.id,
          sourceHandle: 'h-right',
          targetHandle: 'h-left',
          data: { controlType: 'flow', condition: 'ループ完了後', note: 'While終了→return', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // DFS関数 → 結果受け取りノード（戻り値）
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: dfsFunction.id,
          target: resultReceiveNode.id,
          sourceHandle: 'section-h-bottom',
          targetHandle: 'h-top',
          data: { controlType: 'flow', condition: '', note: '戻り値: result配列', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // 戻り値受け取り → End
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: resultReceiveNode.id,
          target: endNode.id,
          sourceHandle: 'h-bottom',
          targetHandle: 'h-top',
          data: { controlType: 'flow', condition: '', note: 'DFS処理完了', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // visited.has(current) の FALSE 分岐（既に訪問済みの場合はスキップしてwhile先頭に戻る）
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: visitedCheckIf.id,
          target: popNode.id,
          sourceHandle: 'h-right',
          targetHandle: 'h-left',
          data: { controlType: 'if', condition: 'visited.has(current) === true', note: '既に訪問済み→スキップ', validations: [], parallelOffset: 0 },
          style: CONTROL_STYLE.if,
          markerEnd: { type: MarkerType.ArrowClosed, color: CONTROL_STYLE.if.color },
        },
        // neighbor未訪問チェックのFALSE分岐（訪問済みの場合は次のneighborへ）
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: neighborCheckNode.id,
          target: forLoopNode.id,
          sourceHandle: 'h-right',
          targetHandle: 'h-left',
          data: { controlType: 'if', condition: 'visited.has(neighbor) === true', note: '訪問済み→次のneighbor', validations: [], parallelOffset: 0 },
          style: CONTROL_STYLE.if,
          markerEnd: { type: MarkerType.ArrowClosed, color: CONTROL_STYLE.if.color },
        },
        // pushNeighborNode後にforループに戻る（次のneighborを処理）
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: pushNeighborNode.id,
          target: forLoopNode.id,
          sourceHandle: 'h-right',
          targetHandle: 'h-left',
          data: { controlType: 'flow', condition: '', note: '次のneighborを処理', validations: [], parallelOffset: 0 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
        // forLoop終了後、whileループの先頭に戻る（次のstack要素を処理）
        {
          id: `edge-${nextEdgeSeq.current++}`,
          type: 'logicEdge',
          source: forLoopNode.id,
          target: popNode.id,
          sourceHandle: 'h-bottom',
          targetHandle: 'h-bottom',
          data: { controlType: 'flow', condition: 'forループ終了', note: '次のstack要素を処理', validations: [], parallelOffset: 1 },
          style: flowStyle,
          markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
        },
      ];

      setNodes(prev => [...prev, ...newNodes]);
      setEdges(prev => normalizeParallelOffsets([...prev, ...newEdges]));
    }

    setIsTemplateModalOpen(false);
  }, [createLogicNode, createSectionNode, setNodes, setEdges, calculateSectionSize]);

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

  const saveCurrentFlow = useCallback(async () => {
    setIsSavingFlow(true);
    setSaveError(null);
    const now = new Date();
    const name = saveName.trim() || formatSaveLabel(now);
    const snapshot: FlowSnapshot = {
      version: FLOW_STORAGE_VERSION,
      nodes: nodes.map(serializeNode),
      edges: edges.map(serializeEdge),
      nextNodeSeq: nextNodeSeq.current,
      nextEdgeSeq: nextEdgeSeq.current,
    };
    try {
      const result = await apiFetch<{ id: string; name: string }>('/flows', {
        method: 'POST',
        body: JSON.stringify({ name, snapshot }),
      });

      if (result) {
        setCurrentFlowId(result.id);
        setCurrentFlowName(result.name);
      }

      await fetchSavedFlows();
      setSaveName('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('limit_reached')) {
        setSaveError('保存件数が上限(30件)に達しました。削除してから保存してください。');
      } else {
        setSaveError('保存に失敗しました。');
      }
    } finally {
      setIsSavingFlow(false);
    }
  }, [edges, fetchSavedFlows, nodes, saveName]);

  const generateFlowText = useCallback(() => {
    const lines: string[] = [];

    // ヘッダー
    lines.push('# Flow Structure Export');
    lines.push('');

    // ノード一覧
    lines.push('## Nodes');
    nodes.forEach(node => {
      const nodeData = node.data as FlowNodeData;

      if (node.type === 'logicNode') {
        const data = nodeData as LogicNodeData;
        const label = data.label || (data.nodeKind === 'start' ? 'Start' : data.nodeKind === 'end' ? 'End' : `Node-${data.seq}`);
        lines.push(`- [${data.nodeKind}] ${label} (id: ${node.id})`);
        if (data.condition) lines.push(`  - 条件: ${data.condition}`);
        if (data.note) lines.push(`  - 補足: ${data.note}`);
      } else if (node.type === 'sectionNode') {
        const data = nodeData as SectionNodeData;
        const label = data.label || CONTROL_STYLE[data.sectionType].label;
        lines.push(`- [${data.sectionType}] ${label} (id: ${node.id})`);

        if (data.sectionType === 'function') {
          if (data.functionArgs && data.functionArgs.length > 0) {
            lines.push(`  - 引数: ${data.functionArgs.map(arg => `${arg.name}: ${arg.type}`).join(', ')}`);
          }
          if (data.functionReturnType) lines.push(`  - 返り値型: ${data.functionReturnType}`);
          if (data.functionReturnValue) lines.push(`  - 返り値: ${data.functionReturnValue}`);
        } else if (data.sectionType === 'class') {
          if (data.classConstructorArgs && data.classConstructorArgs.length > 0) {
            lines.push(`  - コンストラクタ: ${data.classConstructorArgs.map(arg => `${arg.name}: ${arg.type}`).join(', ')}`);
          }
          if (data.classMembers && data.classMembers.length > 0) {
            lines.push(`  - メンバ: ${data.classMembers.map(member => `${member.name}: ${member.type}`).join(', ')}`);
          }
          if (data.classMethods && data.classMethods.length > 0) {
            data.classMethods.forEach((method, i) => {
              lines.push(`  - メソッド${i + 1}: ${method.name}(${method.args.map(arg => `${arg.name}: ${arg.type}`).join(', ')}) -> ${method.returns}`);
              if (method.note) lines.push(`    - 補足: ${method.note}`);
            });
          }
        } else if (data.sectionType === 'interface') {
          if (data.interfaceMembers && data.interfaceMembers.length > 0) {
            lines.push(`  - プロパティ: ${data.interfaceMembers.map(member => `${member.name}: ${member.type}`).join(', ')}`);
          }
          if (data.interfaceMethods && data.interfaceMethods.length > 0) {
            data.interfaceMethods.forEach((method, i) => {
              lines.push(`  - メソッド${i + 1}: ${method.name}(${method.args.map(arg => `${arg.name}: ${arg.type}`).join(', ')}) -> ${method.returns}`);
            });
          }
        } else if (data.sectionType === 'while' || data.sectionType === 'for') {
          if (data.loopCondition) lines.push(`  - 条件: ${data.loopCondition}`);
        } else if (data.sectionType === 'catch') {
          if (data.catchException) lines.push(`  - 例外: ${data.catchException}`);
        }

        if (data.note) lines.push(`  - 補足: ${data.note}`);
        if (data.validations && data.validations.length > 0) {
          lines.push(`  - バリデーション:`);
          data.validations.forEach(validation => {
            lines.push(`    - ${validation.target}: ${validation.rule} (${validation.message})`);
          });
        }
      } else if (node.type === 'memoNode') {
        const data = nodeData as MemoNodeData;
        lines.push(`- [memo] ${data.text.replace(/\n/g, ' ')} (id: ${node.id})`);
      } else if (node.type === 'stampNode') {
        const data = nodeData as StampNodeData;
        const stamp = STAMP_OPTIONS.find(s => s.id === data.stamp);
        lines.push(`- [stamp] ${stamp?.emoji} ${stamp?.label} (id: ${node.id})`);
      }
    });

    lines.push('');

    // エッジ一覧
    lines.push('## Edges');
    edges.forEach(edge => {
      const data = edge.data as LogicEdgeData;
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      const sourceName = sourceNode ? getNodeDisplayLabel(sourceNode) : edge.source;
      const targetName = targetNode ? getNodeDisplayLabel(targetNode) : edge.target;

      const controlLabel = data.controlType === 'flow' ? '通常' : CONTROL_STYLE[data.controlType]?.label || data.controlType;
      lines.push(`- [${controlLabel}] ${sourceName} → ${targetName}`);

      if (data.condition) lines.push(`  - 条件: ${data.condition}`);
      if (data.note) lines.push(`  - 補足: ${data.note}`);
      if (data.validations && data.validations.length > 0) {
        lines.push(`  - バリデーション:`);
        data.validations.forEach(validation => {
          lines.push(`    - ${validation.target}: ${validation.rule} (${validation.message})`);
        });
      }
    });

    lines.push('');
    lines.push('---');
    lines.push('Generated by LogicMap Flow Visualization Tool');

    return lines.join('\n');
  }, [nodes, edges]);

  const openExportModal = useCallback(() => {
    const text = generateFlowText();
    setExportedText(text);
    setIsExportModalOpen(true);
  }, [generateFlowText]);

  const closeExportModal = useCallback(() => {
    setIsExportModalOpen(false);
    setExportedText('');
    setIsCopied(false);
  }, []);

  const openClearModal = useCallback(() => {
    setIsClearModalOpen(true);
  }, []);

  const closeClearModal = useCallback(() => {
    setIsClearModalOpen(false);
  }, []);

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    nextNodeSeq.current = 1;
    nextEdgeSeq.current = 1;
    setCurrentFlowId(null);
    setCurrentFlowName(null);
    setIsClearModalOpen(false);
  }, [setNodes, setEdges]);

  const createNewCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    nextNodeSeq.current = 1;
    nextEdgeSeq.current = 1;
    setCurrentFlowId(null);
    setCurrentFlowName(null);
  }, [setNodes, setEdges]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportedText);
      setIsCopied(true);
      // 1.5秒後にモーダルを閉じる
      setTimeout(() => {
        setIsExportModalOpen(false);
        setExportedText('');
        setIsCopied(false);
      }, 1500);
    } catch (err) {
      console.error('コピーに失敗しました:', err);
      alert('コピーに失敗しました');
    }
  }, [exportedText]);

  const downloadFlowStructure = useCallback(() => {
    try {
      const blob = new Blob([exportedText], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `flow-structure-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ダウンロードに失敗しました:', err);
      alert('ダウンロードに失敗しました');
    }
  }, [exportedText]);

  const deleteSavedFlow = useCallback(
    async (flowId: string) => {
      setSaveError(null);
      try {
        await apiFetch<unknown>(`/flows/${flowId}`, { method: 'DELETE' });
        await fetchSavedFlows();
      } catch {
        setSaveError('削除に失敗しました。');
      }
    },
    [fetchSavedFlows]
  );

  const restoreSavedFlow = useCallback(
    async (flowId: string) => {
      setSaveError(null);
      try {
        const detail = await apiFetch<SavedFlowDetail>(`/flows/${flowId}`, { method: 'GET' });
        if (!detail?.snapshot) {
          setSaveError('保存データの復元に失敗しました。');
          return;
        }
        resetTransientState();
        const snapshot = detail.snapshot;
        const restoredNodes = snapshot.nodes.map(hydrateNode);
        const restoredEdges = normalizeParallelOffsets(snapshot.edges.map(hydrateEdge));
        setNodes(restoredNodes);
        setEdges(restoredEdges);
        const nextNode = snapshot.nextNodeSeq || getNextNodeSeqFromNodes(snapshot.nodes);
        const nextEdge = snapshot.nextEdgeSeq || getNextEdgeSeqFromEdges(snapshot.edges);
        nextNodeSeq.current = nextNode;
        nextEdgeSeq.current = nextEdge;
        setCurrentFlowId(flowId);
        setCurrentFlowName(detail.name);
      } catch {
        setSaveError('保存データの復元に失敗しました。');
      }
    },
    [resetTransientState, setEdges, setNodes]
  );

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

  const applyControlType = useCallback(
    (controlType: EdgeControlType) => {
      if (!pendingConnection?.source || !pendingConnection.target) {
        setPendingConnection(null);
        return;
      }
      const style = CONTROL_STYLE[controlType];
      const condition = buildConditionForControl(controlType, edgeForm);
      const note = normalizeText(edgeForm.note);
      const validations = edgeForm.validations.map((rule) => ({ ...rule }));
      const edgeId = `edge-${nextEdgeSeq.current++}`;
      const edge: Edge<LogicEdgeData> = {
        id: edgeId,
        type: 'logicEdge',
        source: pendingConnection.source,
        target: pendingConnection.target,
        sourceHandle: pendingConnection.sourceHandle ?? undefined,
        targetHandle: pendingConnection.targetHandle ?? undefined,
        label: buildEdgeLabel(controlType, condition, note, validations),
        style: {
          stroke: style.color,
          strokeWidth: EDGE_STROKE_WIDTH,
          strokeDasharray: style.edgeDash,
          zIndex: 1000,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: style.color },
        data: { controlType, condition, note, validations, parallelOffset: 0 },
      };

      setEdges((eds) => normalizeParallelOffsets(addEdge(edge, eds)));
      if (controlType !== 'flow') {
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.id === pendingConnection.source || node.id === pendingConnection.target) {
              if (node.type !== 'logicNode') return node;
              return {
                ...node,
                data: { ...(node.data as LogicNodeData), controlType },
              };
            }
            return node;
          })
        );
      }
      setPendingConnection(null);
    },
    [
      edgeForm.condition,
      edgeForm.note,
      edgeForm.validations,
      pendingConnection,
      setEdges,
      setNodes,
    ]
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
      const isClass = nodeModalOption.sectionType === 'class';
      const isInterface = nodeModalOption.sectionType === 'interface';
      const isLoop =
        nodeModalOption.sectionType === 'while' || nodeModalOption.sectionType === 'for';
      const isCatch = nodeModalOption.sectionType === 'catch';
      const allowNote = nodeModalOption.sectionType !== 'main';
      const allowValidations = isFunction || isClass || isInterface;
      const newSection = createSectionNode({
        sectionType: nodeModalOption.sectionType,
        label: normalizeText(nodeForm.label) ?? '',
        position: flowPosition,
        note: allowNote ? normalizeText(nodeForm.note) : undefined,
        entryNodeId: normalizeText(nodeForm.entryNodeId),
        functionArgs: isFunction ? nodeForm.functionArgs.map((arg) => ({ ...arg })) : undefined,
        functionReturnType: isFunction ? normalizeText(nodeForm.functionReturnType) : undefined,
        functionReturnValue: isFunction ? normalizeText(nodeForm.functionReturnValue) : undefined,
        loopCondition: isLoop ? normalizeText(nodeForm.loopCondition) : undefined,
        catchException: isCatch ? buildCatchValue(nodeForm) : undefined,
        classConstructorArgs: isClass
          ? nodeForm.classConstructorArgs.map((arg) => ({ ...arg }))
          : undefined,
        classMembers: isClass ? nodeForm.classMembers.map((arg) => ({ ...arg })) : undefined,
        classMethods: isClass
          ? nodeForm.classMethods.map((method) => ({
              ...method,
              args: method.args.map((arg) => ({ ...arg })),
            }))
          : undefined,
        interfaceMembers: isInterface
          ? nodeForm.interfaceMembers.map((arg) => ({ ...arg }))
          : undefined,
        interfaceMethods: isInterface
          ? nodeForm.interfaceMethods.map((method) => ({
              ...method,
              args: method.args.map((arg) => ({ ...arg })),
            }))
          : undefined,
        validations: allowValidations ? nodeForm.validations.map((rule) => ({ ...rule })) : [],
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
      let nextClassInstanceLabel: string | null = null;
      if (targetIsSection && nextIsSection) {
        const targetData = target.data as SectionNodeData;
        const nextSectionType = nodeModalOption.sectionType ?? 'function';
        if (targetData.sectionType === 'class' && nextSectionType === 'class') {
          const nextLabel = normalizeText(nodeForm.label) ?? '';
          const displayLabel =
            nextLabel.length > 0 ? nextLabel : CONTROL_STYLE.class.label;
          nextClassInstanceLabel = `new ${displayLabel}()`;
        }
      }
      const nextNodes = currentNodes.map((node) => {
        if (node.id === target.id) {
          if (nextIsSection) {
            const sectionType = nodeModalOption.sectionType ?? 'function';
            const width =
              typeof node.style?.width === 'number' ? node.style.width : SECTION_DEFAULT_WIDTH;
            const height =
              typeof node.style?.height === 'number' ? node.style.height : SECTION_DEFAULT_HEIGHT;
            const isFunction = sectionType === 'function';
            const isClass = sectionType === 'class';
            const isInterface = sectionType === 'interface';
            const isLoop = sectionType === 'while' || sectionType === 'for';
            const isCatch = sectionType === 'catch';
            const allowNote = sectionType !== 'main';
            const allowValidations = isFunction || isClass || isInterface;
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
                note: allowNote ? normalizeText(nodeForm.note) : undefined,
                entryNodeId: normalizeText(nodeForm.entryNodeId),
                functionArgs: isFunction
                  ? nodeForm.functionArgs.map((arg) => ({ ...arg }))
                  : undefined,
                functionReturnType: isFunction
                  ? normalizeText(nodeForm.functionReturnType)
                  : undefined,
                functionReturnValue: isFunction
                  ? normalizeText(nodeForm.functionReturnValue)
                  : undefined,
                loopCondition: isLoop ? normalizeText(nodeForm.loopCondition) : undefined,
                catchException: isCatch ? buildCatchValue(nodeForm) : undefined,
                classConstructorArgs: isClass
                  ? nodeForm.classConstructorArgs.map((arg) => ({ ...arg }))
                  : undefined,
                classMembers: isClass ? nodeForm.classMembers.map((arg) => ({ ...arg })) : undefined,
                classMethods: isClass
                  ? nodeForm.classMethods.map((method) => ({
                      ...method,
                      args: method.args.map((arg) => ({ ...arg })),
                    }))
                  : undefined,
                interfaceMembers: isInterface
                  ? nodeForm.interfaceMembers.map((arg) => ({ ...arg }))
                  : undefined,
                interfaceMethods: isInterface
                  ? nodeForm.interfaceMethods.map((method) => ({
                      ...method,
                      args: method.args.map((arg) => ({ ...arg })),
                    }))
                  : undefined,
                validations: allowValidations
                  ? nodeForm.validations.map((rule) => ({ ...rule }))
                  : [],
              },
            };
          }
          const isNormal = nodeModalOption.kind === 'normal';
          const label =
            nodeModalOption.kind === 'start' || nodeModalOption.kind === 'end'
              ? nodeModalOption.label
              : normalizeText(nodeForm.label) ?? nodeModalOption.nodeLabel ?? '';
          const controlType = (node.data as LogicNodeData).controlType;
          const instanceOfSectionId = (node.data as LogicNodeData).instanceOfSectionId;
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
              instanceOfSectionId,
            },
          };
        }
        if (nextClassInstanceLabel) {
          const nodeData = node.data as FlowNodeData;
          if (
            node.type === 'logicNode' &&
            (nodeData as LogicNodeData).instanceOfSectionId === target.id
          ) {
            return {
              ...node,
              data: {
                ...(node.data as LogicNodeData),
                label: nextClassInstanceLabel,
              },
            };
          }
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
    setPendingMemoEdit(null);
    setPendingMemoClientPosition(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
    setPendingNodeDelete({ id: node.id, label: getNodeDisplayLabel(node) });
  }, []);

  const openNodeEditModal = useCallback((node: Node<FlowNodeData>) => {
    setPendingConnection(null);
    setPendingNodeClientPosition(null);
    setPendingNodeDelete(null);
    setPendingEdgeEdit(null);
    setPendingMemoEdit(null);
    setPendingMemoClientPosition(null);
    setNodeModalOption(getNodeOptionForNode(node));
    setNodeForm(buildNodeFormFromNode(node));
    setPendingNodeEdit({ id: node.id });
  }, []);

  const deleteNodeById = useCallback(
    (nodeId: string) => {
      const removedIds = new Set([nodeId]);
      const removedNode = nodes.find((node) => node.id === nodeId);
      const removedIsSection = removedNode?.type === 'sectionNode';
      const removedIsClassSection =
        removedIsSection &&
        (removedNode?.data as SectionNodeData | undefined)?.sectionType === 'class';
      if (removedIsClassSection) {
        nodes.forEach((node) => {
          if (node.type !== 'logicNode') return;
          const data = node.data as LogicNodeData;
          if (data.instanceOfSectionId === nodeId) {
            removedIds.add(node.id);
          }
        });
      }
      setEdges((currentEdges) =>
        currentEdges.filter(
          (edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target)
        )
      );
      setNodes((currentNodes) => {
        return currentNodes
          .filter((node) => !removedIds.has(node.id))
          .map((node) => {
            if (node.type === 'sectionNode') {
              const sectionData = node.data as SectionNodeData;
              if (sectionData.entryNodeId === nodeId) {
                return {
                  ...node,
                  data: {
                    ...sectionData,
                    entryNodeId: undefined,
                  },
                };
              }
            }
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
      setPendingMemoEdit(null);
      setPendingMemoClientPosition(null);
      setMemoText('');
    },
    [nodes, setEdges, setNodes]
  );

  const createClassInstance = useCallback(
    (node: Node<FlowNodeData>) => {
      if (node.type !== 'sectionNode') return;
      const sectionData = node.data as SectionNodeData;
      if (sectionData.sectionType !== 'class') return;
      const classNode = node as Node<SectionNodeData>;
      const classPosition = classNode.positionAbsolute ?? classNode.position;
      const instanceCount = nodes.filter((item) => {
        if (item.type !== 'logicNode') return false;
        const data = item.data as LogicNodeData;
        return data.instanceOfSectionId === classNode.id;
      }).length;
      const instancePosition = {
        x: classPosition.x - INSTANCE_OFFSET_X,
        y: classPosition.y + instanceCount * INSTANCE_OFFSET_Y,
      };
      const instanceNode = createLogicNode({
        kind: 'normal',
        label: buildClassInstanceLabel(classNode),
        position: instancePosition,
        controlType: 'class',
        instanceOfSectionId: classNode.id,
      });
      setNodes((currentNodes) => [...currentNodes, instanceNode]);

      const style = CONTROL_STYLE.flow;
      const edgeId = `edge-${nextEdgeSeq.current++}`;
      const edge: Edge<LogicEdgeData> = {
        id: edgeId,
        type: 'logicEdge',
        source: classNode.id,
        target: instanceNode.id,
        label: buildEdgeLabel('flow', undefined, undefined, []),
        style: {
          stroke: style.color,
          strokeWidth: EDGE_STROKE_WIDTH,
          strokeDasharray: style.edgeDash,
          zIndex: 1000,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: style.color },
        data: { controlType: 'flow', validations: [] },
      };
      setEdges((currentEdges) => addEdge(edge, currentEdges));
    },
    [createLogicNode, nodes, setEdges, setNodes]
  );

  const findEdgeNearPointInSection = useCallback(
    (sectionId: string, point: XYPosition): Edge<LogicEdgeData> | null => {
      const nodeMap = new Map(nodes.map((node) => [node.id, node]));
      let closest: Edge<LogicEdgeData> | null = null;
      let bestDistance = EDGE_HIT_RADIUS + 1;
      const isInSection = (node?: Node<FlowNodeData>) =>
        Boolean(node) && (node?.id === sectionId || node?.parentNode === sectionId);

      edges.forEach((edge) => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        if (!isInSection(sourceNode) || !isInSection(targetNode)) return;
        if (!sourceNode || !targetNode) return;
        const sourceRect = getNodeRect(sourceNode);
        const targetRect = getNodeRect(targetNode);
        if (!sourceRect || !targetRect) return;
        const sourcePoint = getHandlePoint(sourceRect, edge.sourceHandle);
        const targetPoint = getHandlePoint(targetRect, edge.targetHandle);
        const mid = {
          x: (sourcePoint.x + targetPoint.x) / 2,
          y: (sourcePoint.y + targetPoint.y) / 2,
        };
        const distance = Math.hypot(point.x - mid.x, point.y - mid.y);
        if (distance <= EDGE_HIT_RADIUS && distance < bestDistance) {
          bestDistance = distance;
          closest = edge;
        }
      });

      return closest;
    },
    [edges, nodes]
  );

  const onNodeDoubleClick = useCallback(
    (event: ReactMouseEvent, node: Node<FlowNodeData>) => {
      event.preventDefault();
      event.stopPropagation();
      if (node.type === 'memoNode') {
        openMemoEditModal(node as Node<MemoNodeData>);
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
            setPendingNodeClientPosition(null);
            setPendingNodeDelete(null);
            setPendingConnection(null);
            setPendingNodeEdit(null);
            setPendingMemoEdit(null);
            setPendingMemoClientPosition(null);
            setSelectedEdgeControl(hitEdge.data?.controlType ?? DEFAULT_EDGE_CONTROL);
            const conditionValue = hitEdge.data?.condition ?? '';
            setEdgeForm({
              condition: conditionValue,
              note: hitEdge.data?.note ?? '',
              validations: hitEdge.data?.validations?.map((rule) => ({ ...rule })) ?? [],
            });
            setPendingEdgeEdit({ id: hitEdge.id });
            return;
          }
        }
      }
      openNodeEditModal(node);
    },
    [
      findEdgeNearPointInSection,
      openMemoEditModal,
      openNodeEditModal,
      setEdgeForm,
      setSelectedEdgeControl,
    ]
  );

  const openEdgeEditModal = useCallback((edge: Edge<LogicEdgeData>) => {
    setPendingNodeClientPosition(null);
    setPendingNodeDelete(null);
    setPendingConnection(null);
    setPendingNodeEdit(null);
    setPendingMemoEdit(null);
    setPendingMemoClientPosition(null);
    setSelectedEdgeControl(edge.data?.controlType ?? DEFAULT_EDGE_CONTROL);
    const conditionValue = edge.data?.condition ?? '';
    setEdgeForm({
      condition: conditionValue,
      note: edge.data?.note ?? '',
      validations: edge.data?.validations?.map((rule) => ({ ...rule })) ?? [],
    });
    setPendingEdgeEdit({ id: edge.id });
  }, []);

  const onEdgeDoubleClick = useCallback(
    (event: ReactMouseEvent, edge: Edge<LogicEdgeData>) => {
      event.preventDefault();
      event.stopPropagation();
      openEdgeEditModal(edge);
    },
    [openEdgeEditModal]
  );

  const openEdgeEditModalById = useCallback(
    (edgeId: string) => {
      const edge = edges.find((item) => item.id === edgeId);
      if (!edge) return;
      openEdgeEditModal(edge);
    },
    [edges, openEdgeEditModal]
  );

  const deleteEdgeById = useCallback(
    (edgeId: string) => {
      setEdges((currentEdges) =>
        normalizeParallelOffsets(currentEdges.filter((edge) => edge.id !== edgeId))
      );
      setPendingEdgeEdit(null);
    },
    [setEdges]
  );

  const updateEdgeControl = useCallback(
    (edgeId: string, controlType: EdgeControlType) => {
      const style = CONTROL_STYLE[controlType];
      const condition = buildConditionForControl(controlType, edgeForm);
      const note = normalizeText(edgeForm.note);
      const validations = edgeForm.validations.map((rule) => ({ ...rule }));
      setEdges((currentEdges) =>
        currentEdges.map((edge) => {
          if (edge.id !== edgeId) return edge;
          return {
            ...edge,
            type: 'logicEdge',
            label: buildEdgeLabel(controlType, condition, note, validations),
            style: {
              ...edge.style,
              stroke: style.color,
              strokeWidth: EDGE_STROKE_WIDTH,
              strokeDasharray: style.edgeDash,
              zIndex: 1000,
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: style.color },
            data: { ...edge.data, controlType, condition, note, validations },
          };
        })
      );
    },
    [
      edgeForm.condition,
      edgeForm.note,
      edgeForm.validations,
      setEdges,
    ]
  );

  const onEdgeControlChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedEdgeControl(event.target.value as EdgeControlType);
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
      if (draggedNode.type !== 'logicNode') return;
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

  const edgeModalContent = useMemo(() => {
    const isEdit = Boolean(pendingEdgeEdit);
    if (!pendingConnection && !pendingEdgeEdit) return null;
    const editingEdge = pendingEdgeEdit
      ? edges.find((edge) => edge.id === pendingEdgeEdit.id) ?? null
      : null;
    const sourceId = pendingConnection?.source ?? editingEdge?.source ?? null;
    const targetId = pendingConnection?.target ?? editingEdge?.target ?? null;
    const ifOptions = getIfControlOptions(
      sourceId,
      edges,
      editingEdge?.id ?? null,
      editingEdge?.data?.controlType ?? null
    );
    const availableEdgeControls = EDGE_CONTROL_OPTIONS.filter((type) => {
      if (type === 'if' || type === 'elif' || type === 'else') {
        return ifOptions.includes(type);
      }
      return true;
    });
    const conditionMeta = getConditionMeta(selectedEdgeControl);

    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
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
              {availableEdgeControls.map((type) => (
                <option key={type} value={type}>
                  {CONTROL_STYLE[type].modalLabel ?? CONTROL_STYLE[type].label}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-4 grid gap-3">
            {conditionMeta ? (
              <div>
                <label className="text-xs font-semibold text-gray-700">
                  {conditionMeta.label}
                </label>
                <input
                  type="text"
                  value={edgeForm.condition}
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                  onChange={(event) =>
                    setEdgeForm((current) => ({ ...current, condition: event.target.value }))
                  }
                  placeholder={conditionMeta.placeholder}
                />
              </div>
            ) : null}
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
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-700">validation</label>
                <button
                  type="button"
                  className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  onClick={() =>
                    setEdgeForm((current) => ({
                      ...current,
                      validations: [
                        ...current.validations,
                        { target: '', rule: '', message: '' },
                      ],
                    }))
                  }
                >
                  + 追加
                </button>
              </div>
              {edgeForm.validations.length === 0 ? (
                <div className="mt-2 text-xs text-gray-500">validationを追加してください。</div>
              ) : (
                <div className="mt-3 grid gap-3">
                  {edgeForm.validations.map((rule, index) => (
                    <div
                      key={`edge-validation-${index}`}
                      className="rounded-md border border-gray-200 p-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-xs font-semibold text-gray-700">
                          validation {index + 1}
                        </div>
                        <button
                          type="button"
                          className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                          onClick={() =>
                            setEdgeForm((current) => ({
                              ...current,
                              validations: current.validations.filter(
                                (_item, ruleIndex) => ruleIndex !== index
                              ),
                            }))
                          }
                        >
                          削除
                        </button>
                      </div>
                      <div className="mt-2 grid gap-2">
                        <div>
                          <label className="text-xs font-semibold text-gray-700">対象</label>
                          <input
                            type="text"
                            value={rule.target}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setEdgeForm((current) => ({
                                ...current,
                                validations: current.validations.map((item, ruleIndex) =>
                                  ruleIndex === index
                                    ? { ...item, target: event.target.value }
                                    : item
                                ),
                              }))
                            }
                            placeholder="例: input.age"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">ルール</label>
                          <input
                            type="text"
                            value={rule.rule}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setEdgeForm((current) => ({
                                ...current,
                                validations: current.validations.map((item, ruleIndex) =>
                                  ruleIndex === index
                                    ? { ...item, rule: event.target.value }
                                    : item
                                ),
                              }))
                            }
                            placeholder="例: > 0"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">
                            メッセージ/補足
                          </label>
                          <input
                            type="text"
                            value={rule.message}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setEdgeForm((current) => ({
                                ...current,
                                validations: current.validations.map((item, ruleIndex) =>
                                  ruleIndex === index
                                    ? { ...item, message: event.target.value }
                                    : item
                                ),
                              }))
                            }
                            placeholder="例: 必須入力"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
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
    edgeForm.validations,
    edges,
    onEdgeControlChange,
    pendingConnection,
    pendingEdgeEdit,
    selectedEdgeControl,
  ]);

  const memoModalContent = useMemo(() => {
    const isEdit = Boolean(pendingMemoEdit);
    if (!pendingMemoClientPosition && !pendingMemoEdit) return null;
    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <h3 className="text-lg font-semibold text-gray-900">
            {isEdit ? 'メモを編集' : 'メモを追加'}
          </h3>
          <p className="mt-1 text-sm text-gray-600">
            {isEdit ? 'メモ内容を変更できます。' : 'フロウ上に貼り付けるメモを入力してください。'}
          </p>
          <div className="mt-4">
            <label className="text-xs font-semibold text-gray-700">本文</label>
            <textarea
              value={memoText}
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
              rows={6}
              onChange={(event) => setMemoText(event.target.value)}
              placeholder="メモを入力"
            />
          </div>
          <div className="mt-5 flex items-center justify-end gap-2">
            {isEdit && pendingMemoEdit ? (
              <button
                type="button"
                className="mr-auto rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
                onClick={() => deleteNodeById(pendingMemoEdit.id)}
              >
                削除する
              </button>
            ) : null}
            <button
              type="button"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={cancelMemoModal}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="rounded-md bg-gray-900 px-3 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              onClick={isEdit ? applyMemoEdit : applyMemoCreation}
            >
              {isEdit ? '保存する' : '追加する'}
            </button>
          </div>
        </div>
      </div>
    );
  }, [
    applyMemoCreation,
    applyMemoEdit,
    cancelMemoModal,
    deleteNodeById,
    memoText,
    pendingMemoClientPosition,
    pendingMemoEdit,
  ]);

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
    const isInterfaceSection = isSection && selectedOption?.sectionType === 'interface';
    const isMainSection = isSection && selectedOption?.sectionType === 'main';
    const isLoopSection =
      isSection &&
      (selectedOption?.sectionType === 'while' || selectedOption?.sectionType === 'for');
    const loopPlaceholder =
      selectedOption?.sectionType === 'for' ? '例: for item in items' : '例: i < 10';
    const isCatchSection = isSection && selectedOption?.sectionType === 'catch';
    const allowSectionValidations =
      isSection &&
      (selectedOption?.sectionType === 'function' ||
        selectedOption?.sectionType === 'class' ||
        selectedOption?.sectionType === 'interface');

    return (
      <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
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
                        {isMainSection ? '表示名' : '表示名（関数名/クラス名）'}
                      </label>
                      <input
                        type="text"
                        value={nodeForm.label}
                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                        onChange={(event) =>
                          setNodeForm((current) => ({ ...current, label: event.target.value }))
                        }
                        placeholder={
                          isMainSection
                            ? '例: MainProcess'
                            : '例: fetchUser / UserService'
                        }
                      />
                    </div>
                    {isEdit && editingNode && editingNode.type === 'sectionNode' ? (
                      <div>
                        <label className="text-xs font-semibold text-gray-700">最初のノード</label>
                        {nodes.filter(
                          (node) =>
                            node.type === 'logicNode' && node.parentNode === editingNode.id
                        ).length === 0 ? (
                          <div className="mt-2 text-xs text-gray-500">
                            セクション内にノードがありません。
                          </div>
                        ) : (
                          <select
                            value={nodeForm.entryNodeId}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                entryNodeId: event.target.value,
                              }))
                            }
                          >
                            <option value="">未設定</option>
                            {nodes
                              .filter(
                                (node) =>
                                  node.type === 'logicNode' &&
                                  node.parentNode === editingNode.id
                              )
                              .map((node) => (
                                <option key={node.id} value={node.id}>
                                  {getNodeDisplayLabel(node)}
                                </option>
                              ))}
                          </select>
                        )}
                      </div>
                    ) : null}
                    {isFunctionSection ? (
                      <>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-700">引数</label>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() =>
                                setNodeForm((current) => ({
                                  ...current,
                                  functionArgs: [...current.functionArgs, { name: '', type: '' }],
                                }))
                              }
                            >
                              + 追加
                            </button>
                          </div>
                          {nodeForm.functionArgs.length === 0 ? (
                            <div className="mt-2 text-xs text-gray-500">
                              引数を追加してください。
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-2">
                              {nodeForm.functionArgs.map((arg, index) => (
                                <div
                                  key={`function-arg-${index}`}
                                  className="rounded-md border border-gray-200 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-gray-700">
                                      引数 {index + 1}
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                      onClick={() =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          functionArgs: current.functionArgs.filter(
                                            (_item, argIndex) => argIndex !== index
                                          ),
                                        }))
                                      }
                                    >
                                      削除
                                    </button>
                                  </div>
                                  <div className="mt-2 grid gap-2">
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        引数名
                                      </label>
                                      <input
                                        type="text"
                                        value={arg.name}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            functionArgs: current.functionArgs.map(
                                              (item, argIndex) =>
                                                argIndex === index
                                                  ? { ...item, name: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: userId"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        型
                                      </label>
                                      <input
                                        type="text"
                                        value={arg.type}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            functionArgs: current.functionArgs.map(
                                              (item, argIndex) =>
                                                argIndex === index
                                                  ? { ...item, type: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: string"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">
                            返り値の型
                          </label>
                          <input
                            type="text"
                            value={nodeForm.functionReturnType}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                functionReturnType: event.target.value,
                              }))
                            }
                            placeholder="例: UserResponse"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">返り値</label>
                          <input
                            type="text"
                            value={nodeForm.functionReturnValue}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                functionReturnValue: event.target.value,
                              }))
                            }
                            placeholder="例: user"
                          />
                        </div>
                      </>
                    ) : null}
                    {isClassSection ? (
                      <>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-700">
                              コンストラクタ引数
                            </label>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() =>
                                setNodeForm((current) => ({
                                  ...current,
                                  classConstructorArgs: [
                                    ...current.classConstructorArgs,
                                    { name: '', type: '' },
                                  ],
                                }))
                              }
                            >
                              + 追加
                            </button>
                          </div>
                          {nodeForm.classConstructorArgs.length === 0 ? (
                            <div className="mt-2 text-xs text-gray-500">
                              コンストラクタ引数を追加してください。
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-2">
                              {nodeForm.classConstructorArgs.map((arg, index) => (
                                <div
                                  key={`class-ctor-${index}`}
                                  className="rounded-md border border-gray-200 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-gray-700">
                                      引数 {index + 1}
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                      onClick={() =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          classConstructorArgs:
                                            current.classConstructorArgs.filter(
                                              (_item, argIndex) => argIndex !== index
                                            ),
                                        }))
                                      }
                                    >
                                      削除
                                    </button>
                                  </div>
                                  <div className="mt-2 grid gap-2">
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        引数名
                                      </label>
                                      <input
                                        type="text"
                                        value={arg.name}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            classConstructorArgs:
                                              current.classConstructorArgs.map(
                                                (item, argIndex) =>
                                                  argIndex === index
                                                    ? { ...item, name: event.target.value }
                                                    : item
                                              ),
                                          }))
                                        }
                                        placeholder="例: userId"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        型
                                      </label>
                                      <input
                                        type="text"
                                        value={arg.type}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            classConstructorArgs:
                                              current.classConstructorArgs.map(
                                                (item, argIndex) =>
                                                  argIndex === index
                                                    ? { ...item, type: event.target.value }
                                                    : item
                                              ),
                                          }))
                                        }
                                        placeholder="例: string"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-700">
                              メンバ変数
                            </label>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() =>
                                setNodeForm((current) => ({
                                  ...current,
                                  classMembers: [...current.classMembers, { name: '', type: '' }],
                                }))
                              }
                            >
                              + 追加
                            </button>
                          </div>
                          {nodeForm.classMembers.length === 0 ? (
                            <div className="mt-2 text-xs text-gray-500">
                              メンバ変数を追加してください。
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-2">
                              {nodeForm.classMembers.map((member, index) => (
                                <div
                                  key={`class-member-${index}`}
                                  className="rounded-md border border-gray-200 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-gray-700">
                                      メンバ {index + 1}
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                      onClick={() =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          classMembers: current.classMembers.filter(
                                            (_item, memberIndex) => memberIndex !== index
                                          ),
                                        }))
                                      }
                                    >
                                      削除
                                    </button>
                                  </div>
                                  <div className="mt-2 grid gap-2">
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        変数名
                                      </label>
                                      <input
                                        type="text"
                                        value={member.name}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            classMembers: current.classMembers.map(
                                              (item, memberIndex) =>
                                                memberIndex === index
                                                  ? { ...item, name: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: id"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        型
                                      </label>
                                      <input
                                        type="text"
                                        value={member.type}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            classMembers: current.classMembers.map(
                                              (item, memberIndex) =>
                                                memberIndex === index
                                                  ? { ...item, type: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: string"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        {isEdit && editingNode ? (
                          <div>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() => createClassInstance(editingNode)}
                            >
                              + 初期化ノードを追加
                            </button>
                          </div>
                        ) : null}
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-700">
                              メソッド一覧
                            </label>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() =>
                                setNodeForm((current) => ({
                                  ...current,
                                  classMethods: [
                                    ...current.classMethods,
                                    { name: '', args: [], returns: '', note: '' },
                                  ],
                                }))
                              }
                            >
                              + メソッドを追加
                            </button>
                          </div>
                          {nodeForm.classMethods.length === 0 ? (
                            <div className="mt-2 text-xs text-gray-500">
                              メソッドを追加してください。
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-3">
                              {nodeForm.classMethods.map((method, index) => (
                                <div
                                  key={`class-method-${index}`}
                                  className="rounded-md border border-gray-200 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-gray-700">
                                      メソッド {index + 1}
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                      onClick={() =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          classMethods: current.classMethods.filter(
                                            (_item, methodIndex) => methodIndex !== index
                                          ),
                                        }))
                                      }
                                    >
                                      削除
                                    </button>
                                  </div>
                                  <div className="mt-2 grid gap-2">
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                      メソッド名
                                    </label>
                                    <input
                                      type="text"
                                      value={method.name}
                                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            classMethods: current.classMethods.map(
                                              (item, methodIndex) =>
                                                methodIndex === index
                                                  ? { ...item, name: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: fetchUser"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-gray-700">
                                          メソッド引数
                                        </label>
                                        <button
                                          type="button"
                                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                          onClick={() =>
                                            setNodeForm((current) => ({
                                              ...current,
                                              classMethods: current.classMethods.map(
                                                (item, methodIndex) =>
                                                  methodIndex === index
                                                    ? {
                                                        ...item,
                                                        args: [
                                                          ...item.args,
                                                          { name: '', type: '' },
                                                        ],
                                                      }
                                                    : item
                                              ),
                                            }))
                                          }
                                        >
                                          + 追加
                                        </button>
                                      </div>
                                      {method.args.length === 0 ? (
                                        <div className="mt-2 text-xs text-gray-500">
                                          引数を追加してください。
                                        </div>
                                      ) : (
                                        <div className="mt-3 grid gap-2">
                                          {method.args.map((arg, argIndex) => (
                                            <div
                                              key={`class-method-${index}-arg-${argIndex}`}
                                              className="rounded-md border border-gray-200 p-3"
                                            >
                                              <div className="flex items-center justify-between">
                                                <div className="text-xs font-semibold text-gray-700">
                                                  引数 {argIndex + 1}
                                                </div>
                                                <button
                                                  type="button"
                                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                                  onClick={() =>
                                                    setNodeForm((current) => ({
                                                      ...current,
                                                      classMethods: current.classMethods.map(
                                                        (item, methodIndex) =>
                                                          methodIndex === index
                                                            ? {
                                                                ...item,
                                                                args: item.args.filter(
                                                                  (_arg, removeIndex) =>
                                                                    removeIndex !== argIndex
                                                                ),
                                                              }
                                                            : item
                                                      ),
                                                    }))
                                                  }
                                                >
                                                  削除
                                                </button>
                                              </div>
                                              <div className="mt-2 grid gap-2">
                                                <div>
                                                  <label className="text-xs font-semibold text-gray-700">
                                                    引数名
                                                  </label>
                                                  <input
                                                    type="text"
                                                    value={arg.name}
                                                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                    onChange={(event) =>
                                                      setNodeForm((current) => ({
                                                        ...current,
                                                        classMethods: current.classMethods.map(
                                                          (item, methodIndex) =>
                                                            methodIndex === index
                                                              ? {
                                                                  ...item,
                                                                  args: item.args.map(
                                                                    (argItem, itemIndex) =>
                                                                      itemIndex === argIndex
                                                                        ? {
                                                                            ...argItem,
                                                                            name: event.target.value,
                                                                          }
                                                                        : argItem
                                                                  ),
                                                                }
                                                              : item
                                                        ),
                                                      }))
                                                    }
                                                    placeholder="例: id"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-xs font-semibold text-gray-700">
                                                    型
                                                  </label>
                                                  <input
                                                    type="text"
                                                    value={arg.type}
                                                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                    onChange={(event) =>
                                                      setNodeForm((current) => ({
                                                        ...current,
                                                        classMethods: current.classMethods.map(
                                                          (item, methodIndex) =>
                                                            methodIndex === index
                                                              ? {
                                                                  ...item,
                                                                  args: item.args.map(
                                                                    (argItem, itemIndex) =>
                                                                      itemIndex === argIndex
                                                                        ? {
                                                                            ...argItem,
                                                                            type: event.target.value,
                                                                          }
                                                                        : argItem
                                                                  ),
                                                                }
                                                              : item
                                                        ),
                                                      }))
                                                    }
                                                    placeholder="例: string"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        メソッド返り値
                                      </label>
                                      <input
                                        type="text"
                                        value={method.returns}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            classMethods: current.classMethods.map(
                                              (item, methodIndex) =>
                                                methodIndex === index
                                                  ? { ...item, returns: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: User"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        補足コメント
                                      </label>
                                      <textarea
                                        value={method.note}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        rows={2}
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            classMethods: current.classMethods.map(
                                              (item, methodIndex) =>
                                                methodIndex === index
                                                  ? { ...item, note: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: 例外時はnullを返す"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                    {isInterfaceSection ? (
                      <>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-700">プロパティ</label>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() =>
                                setNodeForm((current) => ({
                                  ...current,
                                  interfaceMembers: [
                                    ...current.interfaceMembers,
                                    { name: '', type: '' },
                                  ],
                                }))
                              }
                            >
                              + 追加
                            </button>
                          </div>
                          {nodeForm.interfaceMembers.length === 0 ? (
                            <div className="mt-2 text-xs text-gray-500">
                              プロパティを追加してください。
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-2">
                              {nodeForm.interfaceMembers.map((member, index) => (
                                <div
                                  key={`interface-member-${index}`}
                                  className="rounded-md border border-gray-200 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-gray-700">
                                      プロパティ {index + 1}
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                      onClick={() =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          interfaceMembers: current.interfaceMembers.filter(
                                            (_item, memberIndex) => memberIndex !== index
                                          ),
                                        }))
                                      }
                                    >
                                      削除
                                    </button>
                                  </div>
                                  <div className="mt-2 grid gap-2">
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        名前
                                      </label>
                                      <input
                                        type="text"
                                        value={member.name}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            interfaceMembers: current.interfaceMembers.map(
                                              (item, memberIndex) =>
                                                memberIndex === index
                                                  ? { ...item, name: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: id"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        型
                                      </label>
                                      <input
                                        type="text"
                                        value={member.type}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            interfaceMembers: current.interfaceMembers.map(
                                              (item, memberIndex) =>
                                                memberIndex === index
                                                  ? { ...item, type: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: string"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-gray-700">
                              メソッド一覧
                            </label>
                            <button
                              type="button"
                              className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              onClick={() =>
                                setNodeForm((current) => ({
                                  ...current,
                                  interfaceMethods: [
                                    ...current.interfaceMethods,
                                    { name: '', args: [], returns: '', note: '' },
                                  ],
                                }))
                              }
                            >
                              + メソッドを追加
                            </button>
                          </div>
                          {nodeForm.interfaceMethods.length === 0 ? (
                            <div className="mt-2 text-xs text-gray-500">
                              メソッドを追加してください。
                            </div>
                          ) : (
                            <div className="mt-3 grid gap-3">
                              {nodeForm.interfaceMethods.map((method, index) => (
                                <div
                                  key={`interface-method-${index}`}
                                  className="rounded-md border border-gray-200 p-3"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-semibold text-gray-700">
                                      メソッド {index + 1}
                                    </div>
                                    <button
                                      type="button"
                                      className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                      onClick={() =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          interfaceMethods: current.interfaceMethods.filter(
                                            (_item, methodIndex) => methodIndex !== index
                                          ),
                                        }))
                                      }
                                    >
                                      削除
                                    </button>
                                  </div>
                                  <div className="mt-2 grid gap-2">
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        メソッド名
                                      </label>
                                      <input
                                        type="text"
                                        value={method.name}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            interfaceMethods: current.interfaceMethods.map(
                                              (item, methodIndex) =>
                                                methodIndex === index
                                                  ? { ...item, name: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: fetchUser"
                                      />
                                    </div>
                                    <div>
                                      <div className="flex items-center justify-between">
                                        <label className="text-xs font-semibold text-gray-700">
                                          メソッド引数
                                        </label>
                                        <button
                                          type="button"
                                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                          onClick={() =>
                                            setNodeForm((current) => ({
                                              ...current,
                                              interfaceMethods: current.interfaceMethods.map(
                                                (item, methodIndex) =>
                                                  methodIndex === index
                                                    ? {
                                                        ...item,
                                                        args: [
                                                          ...item.args,
                                                          { name: '', type: '' },
                                                        ],
                                                      }
                                                    : item
                                              ),
                                            }))
                                          }
                                        >
                                          + 追加
                                        </button>
                                      </div>
                                      {method.args.length === 0 ? (
                                        <div className="mt-2 text-xs text-gray-500">
                                          引数を追加してください。
                                        </div>
                                      ) : (
                                        <div className="mt-3 grid gap-2">
                                          {method.args.map((arg, argIndex) => (
                                            <div
                                              key={`interface-method-${index}-arg-${argIndex}`}
                                              className="rounded-md border border-gray-200 p-3"
                                            >
                                              <div className="flex items-center justify-between">
                                                <div className="text-xs font-semibold text-gray-700">
                                                  引数 {argIndex + 1}
                                                </div>
                                                <button
                                                  type="button"
                                                  className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                                  onClick={() =>
                                                    setNodeForm((current) => ({
                                                      ...current,
                                                      interfaceMethods: current.interfaceMethods.map(
                                                        (item, methodIndex) =>
                                                          methodIndex === index
                                                            ? {
                                                                ...item,
                                                                args: item.args.filter(
                                                                  (_arg, removeIndex) =>
                                                                    removeIndex !== argIndex
                                                                ),
                                                              }
                                                            : item
                                                      ),
                                                    }))
                                                  }
                                                >
                                                  削除
                                                </button>
                                              </div>
                                              <div className="mt-2 grid gap-2">
                                                <div>
                                                  <label className="text-xs font-semibold text-gray-700">
                                                    引数名
                                                  </label>
                                                  <input
                                                    type="text"
                                                    value={arg.name}
                                                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                    onChange={(event) =>
                                                      setNodeForm((current) => ({
                                                        ...current,
                                                        interfaceMethods: current.interfaceMethods.map(
                                                          (item, methodIndex) =>
                                                            methodIndex === index
                                                              ? {
                                                                  ...item,
                                                                  args: item.args.map(
                                                                    (argItem, itemIndex) =>
                                                                      itemIndex === argIndex
                                                                        ? {
                                                                            ...argItem,
                                                                            name: event.target.value,
                                                                          }
                                                                        : argItem
                                                                  ),
                                                                }
                                                              : item
                                                        ),
                                                      }))
                                                    }
                                                    placeholder="例: id"
                                                  />
                                                </div>
                                                <div>
                                                  <label className="text-xs font-semibold text-gray-700">
                                                    型
                                                  </label>
                                                  <input
                                                    type="text"
                                                    value={arg.type}
                                                    className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                                    onChange={(event) =>
                                                      setNodeForm((current) => ({
                                                        ...current,
                                                        interfaceMethods: current.interfaceMethods.map(
                                                          (item, methodIndex) =>
                                                            methodIndex === index
                                                              ? {
                                                                  ...item,
                                                                  args: item.args.map(
                                                                    (argItem, itemIndex) =>
                                                                      itemIndex === argIndex
                                                                        ? {
                                                                            ...argItem,
                                                                            type: event.target.value,
                                                                          }
                                                                        : argItem
                                                                  ),
                                                                }
                                                              : item
                                                        ),
                                                      }))
                                                    }
                                                    placeholder="例: string"
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        メソッド返り値
                                      </label>
                                      <input
                                        type="text"
                                        value={method.returns}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            interfaceMethods: current.interfaceMethods.map(
                                              (item, methodIndex) =>
                                                methodIndex === index
                                                  ? { ...item, returns: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: User"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs font-semibold text-gray-700">
                                        補足コメント
                                      </label>
                                      <textarea
                                        value={method.note}
                                        className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                        rows={2}
                                        onChange={(event) =>
                                          setNodeForm((current) => ({
                                            ...current,
                                            interfaceMethods: current.interfaceMethods.map(
                                              (item, methodIndex) =>
                                                methodIndex === index
                                                  ? { ...item, note: event.target.value }
                                                  : item
                                            ),
                                          }))
                                        }
                                        placeholder="例: optional"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </>
                    ) : null}
                    {isLoopSection ? (
                      <div>
                        <label className="text-xs font-semibold text-gray-700">条件式</label>
                        <input
                          type="text"
                          value={nodeForm.loopCondition}
                          className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                          onChange={(event) =>
                            setNodeForm((current) => ({
                              ...current,
                              loopCondition: event.target.value,
                            }))
                          }
                          placeholder={loopPlaceholder}
                        />
                      </div>
                    ) : null}
                    {isCatchSection ? (
                      <>
                        <div>
                          <label className="text-xs font-semibold text-gray-700">例外種別</label>
                          <select
                            value={nodeForm.catchExceptionType}
                            className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                            onChange={(event) =>
                              setNodeForm((current) => ({
                                ...current,
                                catchExceptionType: event.target.value,
                              }))
                            }
                          >
                            <option value="">選択してください</option>
                            {CATCH_OPTIONS.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </div>
                        {nodeForm.catchExceptionType === 'other' ? (
                          <div>
                            <label className="text-xs font-semibold text-gray-700">
                              例外詳細
                            </label>
                            <input
                              type="text"
                              value={nodeForm.catchExceptionOther}
                              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                              onChange={(event) =>
                                setNodeForm((current) => ({
                                  ...current,
                                  catchExceptionOther: event.target.value,
                                }))
                              }
                              placeholder="例: CustomNotFoundError"
                            />
                          </div>
                        ) : null}
                      </>
                    ) : null}
                    {allowSectionValidations ? (
                      <div>
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold text-gray-700">validation</label>
                          <button
                            type="button"
                            className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            onClick={() =>
                              setNodeForm((current) => ({
                                ...current,
                                validations: [
                                  ...current.validations,
                                  { target: '', rule: '', message: '' },
                                ],
                              }))
                            }
                          >
                            + 追加
                          </button>
                        </div>
                        {nodeForm.validations.length === 0 ? (
                          <div className="mt-2 text-xs text-gray-500">
                            validationを追加してください。
                          </div>
                        ) : (
                          <div className="mt-3 grid gap-3">
                            {nodeForm.validations.map((rule, index) => (
                              <div
                                key={`section-validation-${index}`}
                                className="rounded-md border border-gray-200 p-3"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="text-xs font-semibold text-gray-700">
                                    validation {index + 1}
                                  </div>
                                  <button
                                    type="button"
                                    className="text-xs font-semibold text-rose-600 hover:text-rose-700"
                                    onClick={() =>
                                      setNodeForm((current) => ({
                                        ...current,
                                        validations: current.validations.filter(
                                          (_item, ruleIndex) => ruleIndex !== index
                                        ),
                                      }))
                                    }
                                  >
                                    削除
                                  </button>
                                </div>
                                <div className="mt-2 grid gap-2">
                                  <div>
                                    <label className="text-xs font-semibold text-gray-700">
                                      対象
                                    </label>
                                    <input
                                      type="text"
                                      value={rule.target}
                                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                      onChange={(event) =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          validations: current.validations.map((item, ruleIndex) =>
                                            ruleIndex === index
                                              ? { ...item, target: event.target.value }
                                              : item
                                          ),
                                        }))
                                      }
                                      placeholder="例: input.age"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold text-gray-700">
                                      ルール
                                    </label>
                                    <input
                                      type="text"
                                      value={rule.rule}
                                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                      onChange={(event) =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          validations: current.validations.map((item, ruleIndex) =>
                                            ruleIndex === index
                                              ? { ...item, rule: event.target.value }
                                              : item
                                          ),
                                        }))
                                      }
                                      placeholder="例: required"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-semibold text-gray-700">
                                      メッセージ/補足
                                    </label>
                                    <input
                                      type="text"
                                      value={rule.message}
                                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                                      onChange={(event) =>
                                        setNodeForm((current) => ({
                                          ...current,
                                          validations: current.validations.map((item, ruleIndex) =>
                                            ruleIndex === index
                                              ? { ...item, message: event.target.value }
                                              : item
                                          ),
                                        }))
                                      }
                                      placeholder="例: 必須入力"
                                    />
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}
                    {isMainSection ? null : (
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
                    )}
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
    createClassInstance,
    nodeForm.classConstructorArgs,
    nodeForm.classMembers,
    nodeForm.classMethods,
    nodeForm.catchExceptionOther,
    nodeForm.catchExceptionType,
    nodeForm.condition,
    nodeForm.functionArgs,
    nodeForm.functionReturnValue,
    nodeForm.functionReturnType,
    nodeForm.interfaceMembers,
    nodeForm.interfaceMethods,
    nodeForm.label,
    nodeForm.loopCondition,
    nodeForm.note,
    nodeForm.entryNodeId,
    nodeForm.validations,
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

  const templateModalContent = useMemo(() => {
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
  }, [isTemplateModalOpen, applyTemplate, closeTemplateModal]);

  const exportModalContent = useMemo(() => {
    if (!isExportModalOpen) return null;
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">フロー構造エクスポート</h3>
            <div className="flex gap-2">
              <button
                type="button"
                className={`rounded-md border px-3 py-1 text-xs font-semibold ${
                  isCopied
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
                onClick={copyToClipboard}
                disabled={isCopied}
              >
                {isCopied ? '✓ コピーしました' : '📋 コピー'}
              </button>
              <button
                type="button"
                className="rounded-md border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100"
                onClick={downloadFlowStructure}
              >
                💾 ダウンロード
              </button>
              <button
                type="button"
                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                onClick={closeExportModal}
              >
                閉じる
              </button>
            </div>
          </div>
          <div className="mt-4">
            <textarea
              value={exportedText}
              readOnly
              className="w-full h-96 p-3 text-xs font-mono bg-gray-50 border border-gray-300 rounded-md resize-none"
              style={{ whiteSpace: 'pre' }}
            />
          </div>
        </div>
      </div>
    );
  }, [isExportModalOpen, exportedText, isCopied, copyToClipboard, downloadFlowStructure, closeExportModal]);

  const clearModalContent = useMemo(() => {
    if (!isClearModalOpen) return null;
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">キャンバスをクリア</h3>
          </div>
          <div className="mb-6">
            <p className="text-sm text-gray-600">
              すべてのノード、エッジ、セクション、メモ、スタンプが削除されます。
              <br />
              この操作は元に戻せません。続行しますか？
            </p>
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={closeClearModal}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
              onClick={clearCanvas}
            >
              クリアする
            </button>
          </div>
        </div>
      </div>
    );
  }, [isClearModalOpen, closeClearModal, clearCanvas]);

  return (
    <div
      className="relative h-full w-full bg-gradient-to-br from-slate-50 via-slate-100 to-sky-50"
      ref={wrapperRef}
      onDoubleClickCapture={onWrapperDoubleClickCapture}
      onClickCapture={onWrapperClickCapture}
    >
      <div className="absolute left-3 top-3 z-30 flex max-w-[calc(100%-1.5rem)] flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-gray-200 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm">
          <span className="text-xs text-gray-500">保存</span>
          <input
            type="text"
            value={saveName}
            className="w-52 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
            onChange={(event) => setSaveName(event.target.value)}
            placeholder="保存名（空なら日時）"
          />
          <button
            type="button"
            className={`rounded-md px-3 py-1 text-xs font-semibold text-white ${
              isSavingFlow ? 'bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'
            }`}
            onClick={saveCurrentFlow}
            disabled={isSavingFlow}
          >
            {isSavingFlow ? '保存中...' : '保存する'}
          </button>
        </div>
        {saveError ? (
          <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 shadow-sm">
            {saveError}
          </div>
        ) : null}
        {savedFlows.length > 0 ? (
          <div className="flex flex-wrap gap-2 rounded-md border border-gray-200 bg-white/80 px-3 py-2 text-xs text-gray-900 shadow-sm">
            {savedFlows.map((flow) => (
              <div
                key={flow.id}
                className="flex items-center overflow-hidden rounded-full border border-gray-200 bg-white"
              >
                <button
                  type="button"
                  className="max-w-[180px] truncate px-3 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50"
                  onClick={() => restoreSavedFlow(flow.id)}
                  title={flow.name}
                >
                  {flow.name}
                </button>
                <button
                  type="button"
                  className="border-l border-gray-200 px-2 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50"
                  onClick={() => deleteSavedFlow(flow.id)}
                  aria-label="保存データを削除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : isLoadingFlows ? (
          <div className="rounded-md border border-gray-200 bg-white/80 px-3 py-2 text-xs text-gray-500 shadow-sm">
            保存データを読み込み中...
          </div>
        ) : null}
      </div>
      <div className="absolute right-3 top-3 z-30 flex flex-col items-end gap-2">
        {currentFlowId && (
          <div className="rounded-md border border-gray-200 bg-white/95 px-3 py-2 text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <div className="font-semibold text-gray-900">{currentFlowName}</div>
              <button
                type="button"
                className="rounded border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                onClick={updateFlow}
              >
                💾 上書き保存
              </button>
            </div>
          </div>
        )}
        <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-white/90 px-3 py-2 text-xs font-semibold text-gray-900 shadow-sm">
          <button
            type="button"
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            onClick={openTemplateModal}
          >
            📐 テンプレート
          </button>
          <button
            type="button"
            className="rounded-md border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100"
            onClick={createNewCanvas}
          >
            📄 新規
          </button>
          <button
            type="button"
            className="rounded-md border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100"
            onClick={openExportModal}
          >
            📋 エクスポート
          </button>
          <button
            type="button"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
            onClick={openClearModal}
          >
            🗑️ クリア
          </button>
          <button
            type="button"
            className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
            onClick={openMemoCreateModal}
          >
            + メモ
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">スタンプ</span>
            <select
              value={pendingStamp ?? ''}
              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-xs text-gray-900"
              onChange={(event) =>
                setPendingStamp(event.target.value ? (event.target.value as StampType) : null)
              }
            >
              <option value="">選択</option>
              {STAMP_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.emoji} {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {pendingStamp ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 shadow-sm">
            クリックでスタンプを配置
          </div>
        ) : null}
      </div>
      <div className="absolute right-3 top-24 z-30 rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-900 shadow-sm">
        <div className="font-semibold">Debug: Pane Event</div>
        {debugEvent ? (
          <>
            <div className="mt-1">type: {debugEvent.type}</div>
            <div>
              pos: {debugEvent.x}, {debugEvent.y}
            </div>
            <div>count: {debugEvent.count}</div>
          </>
        ) : (
          <div className="mt-1">none</div>
        )}
      </div>
      <ReactFlow
        nodes={nodesForRender}
        edges={edgesForRender}
        className="rounded-2xl border border-white/50 bg-white/35 backdrop-blur-xl shadow-xl"
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
      >
        <Controls />
        <MiniMap />
        <Background gap={12} size={1} />
      </ReactFlow>
      {edgeModalContent}
      {memoModalContent}
      {nodeModalContent}
      {nodeDeleteContent}
      {templateModalContent}
      {exportModalContent}
      {clearModalContent}
    </div>
  );
}
