import type { Node, Edge, Connection, XYPosition } from 'reactflow';
import { MarkerType } from 'reactflow';

import type {
  NodeKind,
  SectionType,
  EdgeControlType,
  LogicNodeData,
  SectionNodeData,
  MemoNodeData,
  StampNodeData,
  TypeNodeData,
  VariableNodeData,
  FlowNodeData,
  LogicEdgeData,
  NodeRect,
  NodeFormState,
  EdgeFormState,
  ValidationRule,
  TypedField,
  InnerElement,
  NodeOption,
} from './types';
import {
  CONTROL_STYLE,
  NODE_OPTIONS,
  CATCH_OPTIONS,
  DEFAULT_EDGE_CONTROL,
  EDGE_STROKE_WIDTH,
  EDGE_PARALLEL_OFFSET,
} from './constants';

export function toRgba(hex: string, alpha: number) {
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

export function getNodeRect(node: Node<FlowNodeData>): NodeRect | null {
  const width =
    node.width ?? (typeof node.style?.width === 'number' ? node.style.width : undefined);
  const height =
    node.height ?? (typeof node.style?.height === 'number' ? node.style.height : undefined);
  if (!width || !height) return null;
  const position = node.positionAbsolute ?? node.position;
  return { x: position.x, y: position.y, width, height };
}

export function getHandlePoint(rect: NodeRect, handleId?: string | null) {
  const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  if (!handleId) return center;
  const id = handleId.toLowerCase();
  if (id.includes('left')) return { x: rect.x, y: rect.y + rect.height / 2 };
  if (id.includes('right')) return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
  if (id.includes('top')) return { x: rect.x + rect.width / 2, y: rect.y };
  if (id.includes('bottom')) return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
  return center;
}

export function findSectionAtPoint(
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

export function getBaseNodeTint(nodeKind: NodeKind) {
  if (nodeKind === 'start') return '#ecfdf5';
  if (nodeKind === 'end') return '#fff1f2';
  if (nodeKind === 'break') return '#fecaca';
  if (nodeKind === 'continue') return '#fed7aa';
  if (nodeKind === 'return') return '#d1fae5';
  return '#ffffff';
}

export function getLogicNodeLabel(data: LogicNodeData) {
  if (data.label && data.label.length > 0) return data.label;
  if (data.nodeKind === 'start') return 'Start';
  if (data.nodeKind === 'end') return 'End';
  if (data.nodeKind === 'break') return 'break';
  if (data.nodeKind === 'continue') return 'continue';
  if (data.nodeKind === 'return') return 'return';
  return '通常';
}

export function getNodeDisplayLabel(node: Node<FlowNodeData>) {
  if (node.type === 'sectionNode') {
    const data = node.data as SectionNodeData;
    const sectionStyle = CONTROL_STYLE[data.sectionType] || CONTROL_STYLE.flow;
    return data.label || sectionStyle.label;
  }
  if (node.type === 'memoNode') return 'メモ';
  if (node.type === 'stampNode') return 'スタンプ';
  if (node.type === 'typeNode') {
    const data = node.data as TypeNodeData;
    return data.pythonType + (data.genericParams ? `[${data.genericParams}]` : '');
  }
  return getLogicNodeLabel(node.data as LogicNodeData);
}

export function buildClassInstanceLabel(classNode: Node<SectionNodeData>) {
  const baseLabel = classNode.data.label?.trim() ?? '';
  const displayLabel = baseLabel.length > 0 ? baseLabel : CONTROL_STYLE.class.label;
  return `new ${displayLabel}()`;
}

export function getNodeOptionForNode(node: Node<FlowNodeData>): NodeOption | null {
  if (node.type === 'sectionNode') {
    const data = node.data as SectionNodeData;
    return (
      NODE_OPTIONS.find(
        (option) => option.kind === 'section' && option.sectionType === data.sectionType
      ) ?? null
    );
  }
  if (node.type === 'typeNode') {
    return NODE_OPTIONS.find((option) => option.kind === 'type') ?? null;
  }
  if (node.type !== 'logicNode') return null;
  const data = node.data as LogicNodeData;
  return NODE_OPTIONS.find((option) => option.kind === data.nodeKind) ?? null;
}

export function isEventFromNodeOrEdge(event: React.MouseEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest('.react-flow__node, .react-flow__edge'));
}

export function normalizeText(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function cloneJson<T>(value: T): T {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}

export function formatSaveLabel(date: Date) {
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTypedFields(items?: TypedField[]) {
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

export function formatValidationRules(items?: ValidationRule[]) {
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

export function formatValidationLabel(rule: ValidationRule) {
  const target = rule.target?.trim() ?? '';
  const content = rule.rule?.trim() ?? '';
  const message = rule.message?.trim() ?? '';
  const base = [target, content].filter((value) => value.length > 0).join(' ');
  if (message.length > 0) {
    return base.length > 0 ? `${base} (${message})` : message;
  }
  return base;
}

export function parseCatchValue(value: string) {
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

export function buildCatchValue(form: NodeFormState) {
  if (form.catchExceptionType === 'other') {
    return normalizeText(form.catchExceptionOther);
  }
  return normalizeText(form.catchExceptionType);
}

export function getAvailableInnerElements(sectionType: SectionType): { type: 'section' | 'node', sectionType?: SectionType, nodeKind?: NodeKind, label: string }[] {
  const available = [];

  if (sectionType === 'function') {
    available.push(
      { type: 'section' as const, sectionType: 'for' as const, label: 'for文' },
      { type: 'section' as const, sectionType: 'while' as const, label: 'while文' },
      { type: 'section' as const, sectionType: 'if' as const, label: 'if文' },
      { type: 'section' as const, sectionType: 'elif' as const, label: 'elif文' },
      { type: 'section' as const, sectionType: 'else' as const, label: 'else文' },
      { type: 'node' as const, nodeKind: 'return' as const, label: 'return' },
      { type: 'node' as const, nodeKind: 'normal' as const, label: '処理ノード' }
    );
  } else if (sectionType === 'class') {
    available.push(
      { type: 'section' as const, sectionType: 'for' as const, label: 'for文' },
      { type: 'section' as const, sectionType: 'while' as const, label: 'while文' },
      { type: 'section' as const, sectionType: 'if' as const, label: 'if文' },
      { type: 'section' as const, sectionType: 'elif' as const, label: 'elif文' },
      { type: 'section' as const, sectionType: 'else' as const, label: 'else文' },
      { type: 'node' as const, nodeKind: 'normal' as const, label: '処理ノード' }
    );
  } else if (sectionType === 'for' || sectionType === 'while') {
    available.push(
      { type: 'section' as const, sectionType: 'if' as const, label: 'if文' },
      { type: 'section' as const, sectionType: 'elif' as const, label: 'elif文' },
      { type: 'section' as const, sectionType: 'else' as const, label: 'else文' },
      { type: 'node' as const, nodeKind: 'break' as const, label: 'break' },
      { type: 'node' as const, nodeKind: 'continue' as const, label: 'continue' },
      { type: 'node' as const, nodeKind: 'normal' as const, label: '処理ノード' }
    );
  } else if (sectionType === 'if' || sectionType === 'elif' || sectionType === 'else') {
    available.push(
      { type: 'section' as const, sectionType: 'for' as const, label: 'for文' },
      { type: 'section' as const, sectionType: 'while' as const, label: 'while文' },
      { type: 'section' as const, sectionType: 'if' as const, label: 'if文' },
      { type: 'section' as const, sectionType: 'elif' as const, label: 'elif文' },
      { type: 'section' as const, sectionType: 'else' as const, label: 'else文' },
      { type: 'node' as const, nodeKind: 'break' as const, label: 'break' },
      { type: 'node' as const, nodeKind: 'continue' as const, label: 'continue' },
      { type: 'node' as const, nodeKind: 'return' as const, label: 'return' },
      { type: 'node' as const, nodeKind: 'normal' as const, label: '処理ノード' }
    );
  }

  return available;
}

export function createEdge(params: {
  source: string;
  target: string;
  controlType: EdgeControlType;
  condition?: string;
  note?: string;
}): Edge<LogicEdgeData> {
  const style = CONTROL_STYLE[params.controlType] || CONTROL_STYLE.flow;
  return {
    id: `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    type: 'logicEdge',
    source: params.source,
    target: params.target,
    sourceHandle: 'h-bottom',
    targetHandle: 'h-top',
    data: {
      controlType: params.controlType,
      condition: params.condition || '',
      note: params.note || '',
      validations: [],
      parallelOffset: 0
    },
    style: { ...style, zIndex: 1000 },
    markerEnd: { type: MarkerType.ArrowClosed, color: style.color },
  };
}

export function buildConditionForControl(controlType: EdgeControlType, form: EdgeFormState) {
  if (controlType === 'flow') return undefined;
  return normalizeText(form.condition);
}

export function getConditionMeta(controlType: EdgeControlType) {
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

export function isSectionEntryConnection(
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

export function getIfControlOptions(
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

export function buildEdgeLabel(
  controlType: EdgeControlType,
  condition?: string,
  note?: string,
  validations?: ValidationRule[]
) {
  const controlStyle = CONTROL_STYLE[controlType] || CONTROL_STYLE.flow;
  const controlLabel = controlStyle.label;
  const normalizedCondition = condition?.trim() ?? '';
  const normalizedNote = note?.trim() ?? '';
  const validationItems = (validations ?? [])
    .map((rule) => formatValidationLabel(rule))
    .filter((value) => value.length > 0)
    .map((value) => ({ text: `validation: ${value}`, color: '#0f172a' }));
  const items = [
    controlLabel.length > 0 ? { text: controlLabel, color: controlStyle.color } : null,
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

export function ensureEdgeData(edge: Edge<LogicEdgeData>): LogicEdgeData {
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

export function normalizeParallelOffsets(edges: Edge<LogicEdgeData>[]) {
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
    const controlStyle = CONTROL_STYLE[resolvedData.controlType] || CONTROL_STYLE.flow;
    const desiredColor = controlStyle.color;
    const desiredDash = controlStyle.edgeDash;
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
