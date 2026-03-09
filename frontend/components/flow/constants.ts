import type {
  StyleKey,
  NodeFormState,
  EdgeFormState,
  NodeOption,
} from './types';

export const CONTROL_STYLE: Record<
  StyleKey,
  { label: string; color: string; edgeDash?: string; nodeBg?: string; modalLabel?: string }
> = {
  flow: { label: '', color: '#64748b', modalLabel: '通常（ラベルなし）', nodeBg: '#f8fafc' },
  while: { label: 'while', color: '#2563eb', edgeDash: '6 4', nodeBg: '#dbeafe' },
  for: { label: 'for', color: '#0f766e', edgeDash: '6 4', nodeBg: '#ccfbf1' },
  if: { label: 'if', color: '#4f46e5', nodeBg: '#e0e7ff' },
  elif: { label: 'elif', color: '#4f46e5', nodeBg: '#e0e7ff' },
  else: { label: 'else', color: '#4f46e5', nodeBg: '#e0e7ff' },
  break: { label: 'break', color: '#b91c1c', edgeDash: '4 4', nodeBg: '#fecaca' },
  continue: { label: 'continue', color: '#c2410c', edgeDash: '2 4', nodeBg: '#fed7aa' },
  return: { label: 'return', color: '#059669', nodeBg: '#d1fae5' },
  try: { label: 'try', color: '#15803d', edgeDash: '4 2', nodeBg: '#dcfce7' },
  catch: { label: 'catch', color: '#dc2626', edgeDash: '4 2', nodeBg: '#fecaca' },
  function: { label: 'function', color: '#0e7490', nodeBg: '#ecfeff' },
  class: { label: 'class', color: '#1d4ed8', nodeBg: '#eff6ff' },
  interface: { label: 'interface', color: '#0ea5e9', nodeBg: '#e0f2fe' },
  main: { label: 'main', color: '#f59e0b', nodeBg: '#fef3c7' },
};

export const SECTION_MIN_WIDTH = 240;
export const SECTION_MIN_HEIGHT = 160;
export const SECTION_DEFAULT_WIDTH = 320;
export const SECTION_DEFAULT_HEIGHT = 220;
export const MEMO_MIN_WIDTH = 180;
export const MEMO_MIN_HEIGHT = 120;
export const MEMO_DEFAULT_WIDTH = 260;
export const MEMO_DEFAULT_HEIGHT = 180;
export const STAMP_SIZE = 48;
export const EDGE_STROKE_WIDTH = 3;
export const EDGE_PARALLEL_OFFSET = 24;
export const EDGE_HIT_RADIUS = 28;
export const INSTANCE_OFFSET_X = 220;
export const INSTANCE_OFFSET_Y = 80;
export const DEFAULT_EDGE_CONTROL = 'flow' as const;
export const FLOW_STORAGE_VERSION = 1;
export const USER_ID_STORAGE_KEY = 'logicmap:user-id';
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? '';

export const EMPTY_NODE_FORM: NodeFormState = {
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
  innerElements: [],
};

export const EMPTY_EDGE_FORM: EdgeFormState = {
  condition: '',
  note: '',
  validations: [],
};

export const NODE_OPTIONS: NodeOption[] = [
  { label: 'Start', kind: 'start' },
  { label: 'End', kind: 'end' },
  { label: '通常', kind: 'normal', nodeLabel: '' },
  { label: CONTROL_STYLE.break.label, kind: 'break' },
  { label: CONTROL_STYLE.continue.label, kind: 'continue' },
  { label: CONTROL_STYLE.return.label, kind: 'return' },
  { label: CONTROL_STYLE.function.label, kind: 'section', sectionType: 'function' },
  { label: CONTROL_STYLE.class.label, kind: 'section', sectionType: 'class' },
  { label: CONTROL_STYLE.interface.label, kind: 'section', sectionType: 'interface' },
  { label: CONTROL_STYLE.main.label, kind: 'section', sectionType: 'main' },
  { label: CONTROL_STYLE.while.label, kind: 'section', sectionType: 'while' },
  { label: CONTROL_STYLE.for.label, kind: 'section', sectionType: 'for' },
  { label: CONTROL_STYLE.if.label, kind: 'section', sectionType: 'if' },
  { label: CONTROL_STYLE.elif.label, kind: 'section', sectionType: 'elif' },
  { label: CONTROL_STYLE.else.label, kind: 'section', sectionType: 'else' },
  { label: CONTROL_STYLE.try.label, kind: 'section', sectionType: 'try' },
  { label: CONTROL_STYLE.catch.label, kind: 'section', sectionType: 'catch' },
  { label: '変数ノード', kind: 'variable' },
];

export const NODE_OPTION_GROUPS: {
  id: 'node' | 'section';
  label: string;
  description: string;
  options: NodeOption[];
}[] = [
  {
    id: 'node',
    label: 'ノード',
    description: '処理や制御、変数などの単体要素を追加します。',
    options: NODE_OPTIONS.filter((option) => option.kind !== 'section'),
  },
  {
    id: 'section',
    label: 'セクション',
    description: '関数や条件分岐、ループなどのまとまりを追加します。',
    options: NODE_OPTIONS.filter((option) => option.kind === 'section'),
  },
];

export const CATCH_OPTIONS = [
  { value: 'NullPointerException', label: '参照エラー' },
  { value: 'IllegalArgumentException', label: '引数エラー' },
  { value: 'FileNotFoundException', label: 'ファイルエラー' },
  { value: 'NetworkException', label: '通信エラー' },
  { value: 'ValidationException', label: '検証エラー' },
  { value: 'other', label: 'その他' },
] as const;
