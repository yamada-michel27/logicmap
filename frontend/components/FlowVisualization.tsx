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

type FlowNodeData = LogicNodeData | SectionNodeData;

type LogicEdgeData = {
  controlType: EdgeControlType;
  condition?: string;
  note?: string;
  validations?: ValidationRule[];
  parallelOffset?: number;
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
const EDGE_STROKE_WIDTH = 3;
const EDGE_PARALLEL_OFFSET = 24;
const INSTANCE_OFFSET_X = 220;
const INSTANCE_OFFSET_Y = 80;
const DEFAULT_EDGE_CONTROL: EdgeControlType = 'flow';

type NodeFormState = {
  label: string;
  condition: string;
  note: string;
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

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={style}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
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
    useState<EdgeControlType>(DEFAULT_EDGE_CONTROL);
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

  useEffect(() => {
    const normalized = normalizeParallelOffsets(edges);
    if (normalized !== edges) {
      setEdges(normalized);
    }
  }, [edges, setEdges]);

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
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: style.color },
        data: { controlType: 'flow', validations: [] },
      };
      setEdges((currentEdges) => addEdge(edge, currentEdges));
    },
    [createLogicNode, nodes, setEdges, setNodes]
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
      const conditionValue = edge.data?.condition ?? '';
      setEdgeForm({
        condition: conditionValue,
        note: edge.data?.note ?? '',
        validations: edge.data?.validations?.map((rule) => ({ ...rule })) ?? [],
      });
      setPendingEdgeEdit({ id: edge.id });
    },
    []
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
