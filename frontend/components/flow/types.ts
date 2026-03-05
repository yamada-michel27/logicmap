import type { Node, Edge } from 'reactflow';

export type NodeKind = 'start' | 'end' | 'normal' | 'break' | 'continue' | 'return';
export type SectionType = 'function' | 'class' | 'interface' | 'main' | 'try' | 'catch' | 'while' | 'for' | 'if' | 'elif' | 'else';

export const EDGE_CONTROL_OPTIONS = ['flow', 'if', 'elif', 'else', 'break', 'continue'] as const;

export type EdgeControlType = (typeof EDGE_CONTROL_OPTIONS)[number];
export type NodeControlType = EdgeControlType | 'function' | 'class';

export const PYTHON_TYPE_OPTIONS = [
  { id: 'int', name: 'int', description: '整数型' },
  { id: 'float', name: 'float', description: '浮動小数点型' },
  { id: 'bool', name: 'bool', description: '真偽値型' },
  { id: 'str', name: 'str', description: '文字列型' },
  { id: 'list', name: 'list', description: 'リスト型' },
  { id: 'tuple', name: 'tuple', description: 'タプル型' },
  { id: 'dict', name: 'dict', description: '辞書型' },
  { id: 'set', name: 'set', description: '集合型' },
  { id: 'None', name: 'None', description: 'None型' },
  { id: 'Optional', name: 'Optional', description: 'オプショナル型' },
  { id: 'Union', name: 'Union', description: 'ユニオン型' },
  { id: 'Any', name: 'Any', description: '任意型' },
] as const;

export type PythonType = (typeof PYTHON_TYPE_OPTIONS)[number]['id'];

export type TypedField = {
  name: string;
  type: string;
};

export type ValidationRule = {
  target: string;
  rule: string;
  message: string;
};

export type ClassMethod = {
  name: string;
  args: TypedField[];
  returns: string;
  note: string;
};

export type LogicNodeData = {
  label?: string;
  nodeKind: NodeKind;
  seq: number;
  controlType?: NodeControlType;
  condition?: string;
  note?: string;
  instanceOfSectionId?: string;
};

export type SectionNodeData = {
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

export const STAMP_OPTIONS = [
  { id: 'question', emoji: '❓', label: '疑問' },
  { id: 'idea', emoji: '💡', label: 'アイデア' },
  { id: 'warn', emoji: '⚠️', label: '注意' },
  { id: 'check', emoji: '✅', label: '確認' },
  { id: 'test', emoji: '🧪', label: '検証' },
  { id: 'todo', emoji: '📝', label: 'TODO' },
  { id: 'consult', emoji: '🚩', label: '要相談' },
] as const;

export const TEMPLATE_OPTIONS = [
  { id: 'dfs', name: 'DFS（深さ優先探索）', description: 'スタックを使用した深さ優先探索' },
  { id: 'bfs', name: 'BFS（幅優先探索）', description: 'キューを使用した幅優先探索' },
  { id: 'binary_search', name: '二分探索', description: 'ソート済み配列での効率的な探索' },
  { id: 'a_star', name: 'A*探索', description: 'ヒューリスティックを使用した最短経路探索' },
] as const;

export type StampType = (typeof STAMP_OPTIONS)[number]['id'];
export type TemplateType = (typeof TEMPLATE_OPTIONS)[number]['id'];

export type MemoNodeData = {
  text: string;
  seq: number;
};

export type StampNodeData = {
  stamp: StampType;
  seq: number;
  onDelete?: (nodeId: string) => void;
};

export type VariableOperationType = 'declare' | 'assign';
export type VariableScope = 'global' | 'local';

export type VariableNodeData = {
  operationType: VariableOperationType;
  seq: number;
  pythonType?: PythonType;
  variableName?: string;
  initialValue?: string;
  scope?: VariableScope;
  targetVariable?: string;
  newValue?: string;
  elementType?: string;
  keyType?: string;
  valueType?: string;
  innerType?: string;
  unionTypes?: string[];
  genericParams?: string;
  note?: string;
};

export type TypeNodeData = VariableNodeData;

export type FlowNodeData = LogicNodeData | SectionNodeData | MemoNodeData | StampNodeData | VariableNodeData;

export type LogicEdgeData = {
  controlType: EdgeControlType;
  condition?: string;
  note?: string;
  validations?: ValidationRule[];
  parallelOffset?: number;
  onEdit?: (edgeId: string) => void;
};

export type StoredNode = Pick<
  Node<FlowNodeData>,
  'id' | 'type' | 'position' | 'data' | 'parentNode' | 'extent' | 'style' | 'width' | 'height'
>;

export type StoredEdge = Pick<
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

export type FlowSnapshot = {
  version: number;
  nodes: StoredNode[];
  edges: StoredEdge[];
  nextNodeSeq: number;
  nextEdgeSeq: number;
};

export type SavedFlowSummary = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type SavedFlowDetail = SavedFlowSummary & {
  snapshot: FlowSnapshot;
};

export type NodeRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type StyleKey = EdgeControlType | SectionType | 'return';

export type InnerElement = {
  id: string;
  type: 'section' | 'node';
  sectionType?: SectionType;
  nodeKind?: NodeKind;
  label: string;
  order: number;
};

export type NodeFormState = {
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
  innerElements: InnerElement[];
};

export type EdgeFormState = {
  condition: string;
  note: string;
  validations: ValidationRule[];
};

export type NodeOption = {
  label: string;
  kind: NodeKind | 'section' | 'variable' | 'type';
  sectionType?: SectionType;
  nodeLabel?: string;
};
