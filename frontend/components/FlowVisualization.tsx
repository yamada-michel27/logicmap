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

import type {
  NodeKind,
  SectionType,
  EdgeControlType,
  NodeControlType,
  PythonType,
  TypedField,
  ValidationRule,
  ClassMethod,
  LogicNodeData,
  SectionNodeData,
  MemoNodeData,
  StampNodeData,
  VariableOperationType,
  VariableScope,
  VariableNodeData,
  TypeNodeData,
  FlowNodeData,
  LogicEdgeData,
  StoredNode,
  StoredEdge,
  FlowSnapshot,
  SavedFlowSummary,
  SavedFlowDetail,
  NodeRect,
  StyleKey,
  InnerElement,
  NodeFormState,
  EdgeFormState,
  NodeOption,
  StampType,
  TemplateType,
} from './flow/types';
import {
  EDGE_CONTROL_OPTIONS,
  PYTHON_TYPE_OPTIONS,
  STAMP_OPTIONS,
  TEMPLATE_OPTIONS,
} from './flow/types';
import {
  CONTROL_STYLE,
  SECTION_MIN_WIDTH,
  SECTION_MIN_HEIGHT,
  SECTION_DEFAULT_WIDTH,
  SECTION_DEFAULT_HEIGHT,
  MEMO_MIN_WIDTH,
  MEMO_MIN_HEIGHT,
  MEMO_DEFAULT_WIDTH,
  MEMO_DEFAULT_HEIGHT,
  STAMP_SIZE,
  EDGE_STROKE_WIDTH,
  EDGE_PARALLEL_OFFSET,
  EDGE_HIT_RADIUS,
  INSTANCE_OFFSET_X,
  INSTANCE_OFFSET_Y,
  DEFAULT_EDGE_CONTROL,
  FLOW_STORAGE_VERSION,
  EMPTY_NODE_FORM,
  EMPTY_EDGE_FORM,
  NODE_OPTIONS,
  CATCH_OPTIONS,
} from './flow/constants';
import { apiFetch } from './flow/api';
import {
  toRgba,
  getNodeRect,
  getHandlePoint,
  findSectionAtPoint,
  getBaseNodeTint,
  getLogicNodeLabel,
  getNodeDisplayLabel,
  buildClassInstanceLabel,
  getNodeOptionForNode,
  isEventFromNodeOrEdge,
  normalizeText,
  cloneJson,
  formatSaveLabel,
  formatTypedFields,
  formatValidationRules,
  parseCatchValue,
  buildCatchValue,
  getAvailableInnerElements,
  createEdge,
  buildConditionForControl,
  getConditionMeta,
  isSectionEntryConnection,
  getIfControlOptions,
  buildEdgeLabel,
  ensureEdgeData,
  normalizeParallelOffsets,
} from './flow/utils';
import {
  serializeNode,
  serializeEdge,
  hydrateNode,
  hydrateEdge,
  getNextNodeSeqFromNodes,
  getNextEdgeSeqFromEdges,
} from './flow/serialization';
import EdgeModal from './flow/modals/EdgeModal';
import MemoModal from './flow/modals/MemoModal';
import VariableModal from './flow/modals/VariableModal';
import NodeModal from './flow/modals/NodeModal';


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
  const [isHovered, setIsHovered] = useState(false);
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

  // エッジホバー効果を含むカスタマイズスタイル
  const enhancedStyle = {
    ...style,
    strokeWidth: isHovered ? 8 : (style?.strokeWidth || 2),
    cursor: 'pointer',
    transition: 'stroke-width 0.2s ease',
  };

  return (
    <>
      {/* 実際に見えるエッジ */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={enhancedStyle}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      {/* 透明なクリック可能エリアをEdgeLabelRendererで表示 */}
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: 'transparent',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            cursor: 'pointer',
            pointerEvents: 'all',
            zIndex: 2000,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onDoubleClick={(event: React.MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (data?.onEdit) {
              data.onEdit(id);
            }
          }}
        />
      </EdgeLabelRenderer>
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
      // Phase7: 内部要素は編集時には空で初期化（追加のみサポート）
      innerElements: [],
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

function VariableNode({ data }: NodeProps<VariableNodeData>) {
  // Phase8: 宣言/変更モードに対応
  const isDeclareMode = data.operationType === 'declare' || !data.operationType; // 後方互換性
  const isAssignMode = data.operationType === 'assign';

  const typeInfo = isDeclareMode && data.pythonType ?
    PYTHON_TYPE_OPTIONS.find((option) => option.id === data.pythonType) : null;
  const displayName = typeInfo?.name ?? data.pythonType;
  const description = typeInfo?.description ?? '';

  // 型に応じた色設定
  const getTypeColor = (pythonType?: PythonType) => {
    if (!pythonType) {
      // 変更モードのデフォルト色
      return { bg: '#f0f9ff', border: '#0284c7', text: '#0c4a6e' }; // 水色系
    }
    switch (pythonType) {
      case 'int':
      case 'float':
        return { bg: '#dcfce7', border: '#16a34a', text: '#15803d' }; // 数値型: 緑
      case 'str':
        return { bg: '#fef3c7', border: '#f59e0b', text: '#d97706' }; // 文字列型: 黄
      case 'bool':
        return { bg: '#ddd6fe', border: '#8b5cf6', text: '#7c3aed' }; // ブール型: 紫
      case 'list':
      case 'tuple':
      case 'set':
        return { bg: '#e0f2fe', border: '#0ea5e9', text: '#0284c7' }; // コレクション型: 青
      case 'dict':
        return { bg: '#fce7f3', border: '#ec4899', text: '#db2777' }; // 辞書型: ピンク
      case 'None':
        return { bg: '#f3f4f6', border: '#6b7280', text: '#4b5563' }; // None型: グレー
      case 'Optional':
      case 'Union':
      case 'Any':
        return { bg: '#fed7aa', border: '#f97316', text: '#ea580c' }; // 特殊型: オレンジ
      default:
        return { bg: '#f8fafc', border: '#64748b', text: '#475569' }; // デフォルト: グレー
    }
  };

  // Phase8: モードに応じた表示文字列を生成
  const getDisplayInfo = (data: VariableNodeData) => {
    if (isDeclareMode) {
      // 宣言モードの場合: 型情報を生成
      if (!data.pythonType) return { title: '変数宣言', subtitle: '' };

      let typeStr: string = data.pythonType;
      switch (data.pythonType) {
        case 'list':
        case 'tuple':
        case 'set':
          if (data.elementType) {
            typeStr = `${data.pythonType}[${data.elementType}]`;
          }
          break;
        case 'dict':
          if (data.keyType && data.valueType) {
            typeStr = `dict[${data.keyType}, ${data.valueType}]`;
          }
          break;
        case 'Optional':
          if (data.innerType) {
            typeStr = `Optional[${data.innerType}]`;
          }
          break;
        case 'Union':
          if (data.unionTypes && data.unionTypes.length > 0) {
            typeStr = `Union[${data.unionTypes.join(', ')}]`;
          }
          break;
      }
      return { title: typeStr, subtitle: description };
    } else {
      // 変更モードの場合
      return {
        title: '変数変更',
        subtitle: data.targetVariable ? `${data.targetVariable} = ${data.newValue || '?'}` : ''
      };
    }
  };

  const colors = getTypeColor(data.pythonType);
  const { title, subtitle } = getDisplayInfo(data);

  return (
    <div
      className="relative h-full w-full rounded-lg border-2 p-3 text-sm shadow-lg"
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        color: colors.text
      }}
    >
      <Handle type="target" position={Position.Left} id="h-left" />
      <Handle type="source" position={Position.Right} id="h-right" />
      <Handle type="target" position={Position.Top} id="h-top" />
      <Handle type="source" position={Position.Bottom} id="h-bottom" />

      <div className="flex flex-col h-full p-3 overflow-hidden">
        {/* ヘッダー: モードに応じたタイトル */}
        <div className="text-center mb-2">
          <div className="font-bold text-sm break-words leading-tight" style={{ color: colors.text }}>
            {title}
          </div>
          <div className="text-xs opacity-70 truncate">{subtitle}</div>
        </div>

        {/* メイン情報: モードに応じた表示 */}
        <div className="flex flex-col space-y-2">
          {isDeclareMode && (
            <>
              {/* 宣言モード: 変数名と初期値 */}
              {data.variableName && data.variableName.trim() && (
                <div className="text-center">
                  <div className="text-xs text-gray-600">変数名:</div>
                  <div className="font-semibold text-sm break-words px-1 leading-tight" style={{ color: colors.text }}>
                    {data.variableName}
                  </div>
                </div>
              )}

              {data.initialValue && data.initialValue.trim() && (
                <div className="text-center">
                  <div className="text-xs text-gray-600">初期値:</div>
                  <div className="font-mono text-xs break-all px-1 leading-tight" style={{ color: colors.text }}>
                    {data.initialValue}
                  </div>
                </div>
              )}

              {data.scope && (
                <div className="text-center">
                  <div className="text-xs text-gray-600">スコープ:</div>
                  <div className="text-xs px-1 leading-tight" style={{ color: colors.text }}>
                    {data.scope === 'global' ? 'グローバル' : 'ローカル'}
                  </div>
                </div>
              )}

              {/* 型固有情報の表示 */}
              {(data.pythonType && ['list', 'tuple', 'set'].includes(data.pythonType) && data.elementType) && (
                <div className="text-center">
                  <div className="text-xs text-gray-600">要素型:</div>
                  <div className="text-xs px-1 leading-tight" style={{ color: colors.text }}>
                    {data.elementType}
                  </div>
                </div>
              )}

              {(data.pythonType === 'dict' && (data.keyType || data.valueType)) && (
                <div className="text-center">
                  {data.keyType && (
                    <div>
                      <div className="text-xs text-gray-600">キー型:</div>
                      <div className="text-xs px-1 leading-tight" style={{ color: colors.text }}>
                        {data.keyType}
                      </div>
                    </div>
                  )}
                  {data.valueType && (
                    <div>
                      <div className="text-xs text-gray-600">値型:</div>
                      <div className="text-xs px-1 leading-tight" style={{ color: colors.text }}>
                        {data.valueType}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {(data.pythonType === 'Optional' && data.innerType) && (
                <div className="text-center">
                  <div className="text-xs text-gray-600">内部型:</div>
                  <div className="text-xs px-1 leading-tight" style={{ color: colors.text }}>
                    {data.innerType}
                  </div>
                </div>
              )}

              {(data.pythonType === 'Union' && data.unionTypes && data.unionTypes.length > 0) && (
                <div className="text-center">
                  <div className="text-xs text-gray-600">Union型:</div>
                  <div className="text-xs px-1 leading-tight" style={{ color: colors.text }}>
                    {data.unionTypes.join(', ')}
                  </div>
                </div>
              )}
            </>
          )}

          {isAssignMode && (
            <>
              {/* 変更モード: 対象変数と新しい値 */}
              {data.targetVariable && (
                <div className="text-center">
                  <div className="text-xs text-gray-600">変数:</div>
                  <div className="font-semibold text-sm break-words px-1 leading-tight" style={{ color: colors.text }}>
                    {data.targetVariable}
                  </div>
                </div>
              )}

              {data.newValue && (
                <div className="text-center">
                  <div className="text-xs text-gray-600">新しい値:</div>
                  <div className="font-mono text-xs break-all px-1 leading-tight" style={{ color: colors.text }}>
                    {data.newValue}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 共通: 補足コメント */}
          {data.note && data.note.trim() && (
            <div className="border-t border-gray-300 pt-2 mt-2">
              <div className="text-xs text-gray-600 text-center">補足:</div>
              <div className="text-xs leading-tight break-words px-1" style={{ color: colors.text }}>
                {data.note}
              </div>
            </div>
          )}

          {/* 未設定時のメッセージ */}
          {isDeclareMode && !data.variableName && !data.initialValue && (
            <div className="text-center text-xs opacity-60">
              未設定
            </div>
          )}
          {isAssignMode && !data.targetVariable && !data.newValue && (
            <div className="text-center text-xs opacity-60">
              未設定
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionNode({ data, selected }: NodeProps<SectionNodeData>) {
  const style = CONTROL_STYLE[data.sectionType] || CONTROL_STYLE.flow;
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
        zIndex: -10,
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
  variableNode: VariableNode, // Phase8: 新しい変数ノード
  typeNode: VariableNode, // 後方互換性のため
};

const edgeTypes = {
  logicEdge: LogicEdge,
};

type FlowVisualizationProps = {
  initialFlowId?: string | null;
};

export default function FlowVisualization({ initialFlowId }: FlowVisualizationProps) {
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
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportedText, setExportedText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);
  const [pythonCode, setPythonCode] = useState('');
  const [isPythonGenerating, setIsPythonGenerating] = useState(false);
  const [isPythonImportModalOpen, setIsPythonImportModalOpen] = useState(false);
  const [pythonInputCode, setPythonInputCode] = useState('');
  const [isCanvasGenerating, setIsCanvasGenerating] = useState(false);
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
        resizable: true,
      } as Node<SectionNodeData>;
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

  const createVariableNode = useCallback(
    (params: {
      operationType: VariableOperationType;
      position: XYPosition;
      // 宣言モード用
      pythonType?: PythonType;
      variableName?: string;
      initialValue?: string;
      scope?: VariableScope;
      // 変更モード用
      targetVariable?: string;
      newValue?: string;
      // 型固有パラメータ
      elementType?: string;
      keyType?: string;
      valueType?: string;
      innerType?: string;
      unionTypes?: string[];
      genericParams?: string;
      note?: string;
    }): Node<VariableNodeData> => {
      const seq = nextNodeSeq.current++;

      // 入力内容に基づいて動的にサイズを計算
      const calculateVariableNodeSize = () => {
        let baseHeight = 120; // ベース高さ
        let width = 200; // 固定幅

        // モードに応じて高さを調整
        if (params.operationType === 'declare') {
          // 宣言モードの場合
          if (params.variableName && params.variableName.trim()) {
            baseHeight += 40; // 変数名セクション
          }
          if (params.initialValue && params.initialValue.trim()) {
            baseHeight += 40; // 初期値セクション
          }
          // 型固有フィールドの追加
          if (params.pythonType && ['list', 'tuple', 'set'].includes(params.pythonType) && params.elementType) {
            baseHeight += 20; // 要素型表示
          }
          if (params.pythonType === 'dict' && (params.keyType || params.valueType)) {
            baseHeight += 20; // キー・値型表示
          }
          if (params.pythonType === 'Optional' && params.innerType) {
            baseHeight += 20; // 内部型表示
          }
          if (params.pythonType === 'Union' && params.unionTypes && params.unionTypes.length > 0) {
            baseHeight += 20; // Union型表示
          }
        } else if (params.operationType === 'assign') {
          // 変更モードの場合
          if (params.targetVariable && params.targetVariable.trim()) {
            baseHeight += 40; // 対象変数セクション
          }
          if (params.newValue && params.newValue.trim()) {
            baseHeight += 40; // 新しい値セクション
          }
        }

        if (params.note && params.note.trim()) {
          baseHeight += 50; // 補足セクション（区切り線とテキスト）
        }

        // 最小・最大サイズの制限
        const minHeight = 100;
        const maxHeight = 300;

        return {
          width,
          height: Math.max(minHeight, Math.min(maxHeight, baseHeight))
        };
      };

      const size = calculateVariableNodeSize();

      return {
        id: `variable-${seq}`,
        type: 'variableNode',
        position: params.position,
        style: { width: size.width, height: size.height },
        data: {
          operationType: params.operationType,
          seq,
          // 宣言モード用フィールド
          pythonType: params.pythonType,
          variableName: params.variableName,
          initialValue: params.initialValue,
          scope: params.scope || 'global',
          // 変更モード用フィールド
          targetVariable: params.targetVariable,
          newValue: params.newValue,
          // 型固有パラメータ
          elementType: params.elementType,
          keyType: params.keyType,
          valueType: params.valueType,
          innerType: params.innerType,
          unionTypes: params.unionTypes,
          genericParams: params.genericParams,
          // 共通フィールド
          note: params.note,
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

  // Phase7: サイズ更新中フラグを管理
  const updatingSizeRef = useRef<Set<string>>(new Set());
  // Phase7: ドラッグ中フラグを管理（完全な無限ループ防止）
  const isDraggingRef = useRef(false);

  // Phase7: 親セクションのサイズを子要素に合わせて動的調整
  const updateParentSectionSize = useCallback((parentSectionId: string) => {
    // ドラッグ中は完全にサイズ更新を停止（無限ループ防止）
    if (isDraggingRef.current) {
      return;
    }

    // 既に更新中の場合はスキップ（無限ループ防止）
    if (updatingSizeRef.current.has(parentSectionId)) {
      return;
    }

    updatingSizeRef.current.add(parentSectionId);

    setNodes((currentNodes) => {
      // 親セクションと子要素を取得
      const parentSection = currentNodes.find(node => node.id === parentSectionId && node.type === 'sectionNode');
      if (!parentSection) {
        updatingSizeRef.current.delete(parentSectionId);
        return currentNodes;
      }

      const childNodes = currentNodes.filter(node => node.parentNode === parentSectionId);
      if (childNodes.length === 0) {
        updatingSizeRef.current.delete(parentSectionId);
        return currentNodes;
      }

      // 子要素の位置を基に新しいサイズを計算
      const newSize = calculateSectionSize(childNodes);

      // 現在のサイズと比較して変更が必要かチェック（無限ループ防止）
      const currentWidth = typeof parentSection.style?.width === 'number' ? parentSection.style.width : 0;
      const currentHeight = typeof parentSection.style?.height === 'number' ? parentSection.style.height : 0;

      // サイズに大きな変更がない場合は更新しない
      if (Math.abs(currentWidth - newSize.width) < 10 && Math.abs(currentHeight - newSize.height) < 10) {
        updatingSizeRef.current.delete(parentSectionId);
        return currentNodes;
      }

      // 親セクションのサイズを更新
      const updatedNodes = currentNodes.map(node => {
        if (node.id === parentSectionId) {
          return {
            ...node,
            style: {
              ...node.style,
              width: newSize.width,
              height: newSize.height,
            },
          };
        }
        return node;
      });

      // 更新完了後にフラグをクリア
      setTimeout(() => {
        updatingSizeRef.current.delete(parentSectionId);
      }, 200);

      return updatedNodes;
    });
  }, [calculateSectionSize, setNodes]);

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

  const generateFlowData = useCallback(() => {
    // 新しいJSON形式でのエクスポート
    const exportData = {
      version: "2.0.0",
      format: "LogicMap Flow Structure",
      exportedAt: new Date().toISOString(),
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        flowName: currentFlowName || "Untitled Flow"
      },
      nodes: nodes.map(node => {
        const nodeData = node.data as FlowNodeData;

        // DOMから実際のサイズを取得
        const element = document.querySelector(`[data-id="${node.id}"]`);
        let actualWidth = node.width;
        let actualHeight = node.height;

        if (element && !actualWidth) {
          const rect = element.getBoundingClientRect();
          actualWidth = rect.width;
          actualHeight = rect.height;
        }

        // 基本ノード情報
        const baseNode = {
          id: node.id,
          type: node.type,
          position: {
            x: node.position.x,
            y: node.position.y
          },
          size: {
            width: actualWidth || (typeof node.style?.width === 'number' ? node.style.width : 160),
            height: actualHeight || (typeof node.style?.height === 'number' ? node.style.height : 80)
          },
          parentNode: node.parentNode || null,
          extent: node.extent || null,
          expandParent: node.expandParent || null,
          style: node.style || {},
          className: node.className || null,
          selected: node.selected || false,
          dragging: node.dragging || false
        };

        // ノードタイプ別のデータ
        if (node.type === 'logicNode') {
          const data = nodeData as LogicNodeData;
          return {
            ...baseNode,
            data: {
              seq: data.seq,
              nodeKind: data.nodeKind || 'normal',
              label: data.label,
              condition: data.condition,
              note: data.note,
              validations: (data as any).validations || []
            }
          };
        } else if (node.type === 'sectionNode') {
          const data = nodeData as SectionNodeData;
          return {
            ...baseNode,
            data: {
              label: data.label,
              sectionType: data.sectionType,
              note: data.note,
              validations: data.validations || [],
              // function関連
              functionArgs: data.functionArgs || [],
              functionReturnType: data.functionReturnType,
              functionReturnValue: data.functionReturnValue,
              // class関連
              classConstructorArgs: data.classConstructorArgs || [],
              classMembers: data.classMembers || [],
              classMethods: data.classMethods || [],
              // interface関連
              interfaceMembers: data.interfaceMembers || [],
              interfaceMethods: data.interfaceMethods || [],
              // loop関連
              loopCondition: data.loopCondition,
              // catch関連
              catchException: data.catchException
            }
          };
        } else if (node.type === 'memoNode') {
          const data = nodeData as MemoNodeData;
          return {
            ...baseNode,
            data: {
              text: data.text
            }
          };
        } else if (node.type === 'typeNode') {
          const data = nodeData as TypeNodeData;
          return {
            ...baseNode,
            data: {
              pythonType: data.pythonType,
              seq: data.seq || nextNodeSeq,
              variableName: data.variableName,
              initialValue: data.initialValue,
              elementType: data.elementType,
              keyType: data.keyType,
              valueType: data.valueType,
              innerType: data.innerType,
              unionTypes: data.unionTypes,
              note: data.note,
              genericParams: data.genericParams
            }
          };
        } else if (node.type === 'stampNode') {
          const data = nodeData as StampNodeData;
          return {
            ...baseNode,
            data: {
              stamp: data.stamp
            }
          };
        } else {
          return {
            ...baseNode,
            data: nodeData
          };
        }
      }),
      edges: edges.map(edge => {
        const data = edge.data as LogicEdgeData;
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle || null,
          targetHandle: edge.targetHandle || null,
          type: edge.type || null,
          animated: edge.animated || false,
          style: edge.style || {},
          className: edge.className || null,
          selected: edge.selected || false,
          data: {
            controlType: data.controlType,
            condition: data.condition,
            note: data.note,
            validations: data.validations || []
          }
        };
      })
    };

    return JSON.stringify(exportData, null, 2);
  }, [nodes, edges, currentFlowName]);

  const generateFlowTextLegacy = useCallback(() => {
    const lines: string[] = [];

    // ヘッダー
    lines.push('# Flow Structure Export');
    lines.push('');

    // ノード一覧
    lines.push('## Nodes');
    nodes.forEach(node => {
      const nodeData = node.data as FlowNodeData;

      // 座標・サイズ情報を取得
      const position = node.position;
      const width = node.width || (typeof node.style?.width === 'number' ? node.style.width : 'auto');
      const height = node.height || (typeof node.style?.height === 'number' ? node.style.height : 'auto');
      const positionInfo = `位置: (${Math.round(position.x)}, ${Math.round(position.y)})`;
      const sizeInfo = `サイズ: ${width} × ${height}`;

      if (node.type === 'logicNode') {
        const data = nodeData as LogicNodeData;
        const nodeKind = data.nodeKind || 'normal';
        const label = data.label || (nodeKind === 'start' ? 'Start' : nodeKind === 'end' ? 'End' : `Node-${data.seq}`);
        lines.push(`- [${nodeKind}] ${label} (id: ${node.id})`);
        lines.push(`  - ${positionInfo}, ${sizeInfo}`);
        if (node.parentNode) lines.push(`  - 親: ${node.parentNode}`);
        if (data.condition) lines.push(`  - 条件: ${data.condition}`);
        if (data.note) lines.push(`  - 補足: ${data.note}`);
      } else if (node.type === 'sectionNode') {
        const data = nodeData as SectionNodeData;
        const sectionType = data.sectionType || 'function';
        const sectionStyle = CONTROL_STYLE[sectionType] || CONTROL_STYLE.flow;
        const label = data.label || sectionStyle.label;
        lines.push(`- [${sectionType}] ${label} (id: ${node.id})`);
        lines.push(`  - ${positionInfo}, ${sizeInfo}`);
        if (node.parentNode) lines.push(`  - 親: ${node.parentNode}`);

        if (sectionType === 'function') {
          if (data.functionArgs && data.functionArgs.length > 0) {
            lines.push(`  - 引数: ${data.functionArgs.map(arg => `${arg.name}: ${arg.type}`).join(', ')}`);
          }
          if (data.functionReturnType) lines.push(`  - 返り値型: ${data.functionReturnType}`);
          if (data.functionReturnValue) lines.push(`  - 返り値: ${data.functionReturnValue}`);
        } else if (sectionType === 'class') {
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
        } else if (sectionType === 'interface') {
          if (data.interfaceMembers && data.interfaceMembers.length > 0) {
            lines.push(`  - プロパティ: ${data.interfaceMembers.map(member => `${member.name}: ${member.type}`).join(', ')}`);
          }
          if (data.interfaceMethods && data.interfaceMethods.length > 0) {
            data.interfaceMethods.forEach((method, i) => {
              lines.push(`  - メソッド${i + 1}: ${method.name}(${method.args.map(arg => `${arg.name}: ${arg.type}`).join(', ')}) -> ${method.returns}`);
            });
          }
        } else if (sectionType === 'while' || sectionType === 'for') {
          if (data.loopCondition) lines.push(`  - 条件: ${data.loopCondition}`);
        } else if (sectionType === 'catch') {
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
        lines.push(`  - ${positionInfo}, ${sizeInfo}`);
      } else if (node.type === 'typeNode') {
        const data = nodeData as TypeNodeData;
        const typeInfo = PYTHON_TYPE_OPTIONS.find(t => t.id === data.pythonType);
        lines.push(`- [type] ${data.pythonType}${data.genericParams ? `[${data.genericParams}]` : ''} (id: ${node.id})`);
        lines.push(`  - ${positionInfo}, ${sizeInfo}`);
        if (typeInfo) lines.push(`  - 説明: ${typeInfo.description}`);
        if (data.note) lines.push(`  - 補足: ${data.note}`);
      } else if (node.type === 'stampNode') {
        const data = nodeData as StampNodeData;
        const stamp = STAMP_OPTIONS.find(s => s.id === data.stamp);
        lines.push(`- [stamp] ${stamp?.emoji} ${stamp?.label} (id: ${node.id})`);
        lines.push(`  - ${positionInfo}, ${sizeInfo}`);
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
    const text = generateFlowData();
    setExportedText(text);
    setIsExportModalOpen(true);
  }, [generateFlowData]);

  const closeExportModal = useCallback(() => {
    setIsExportModalOpen(false);
    setExportedText('');
    setIsCopied(false);
  }, []);

  const openImportModal = useCallback(() => {
    setIsImportModalOpen(true);
  }, []);

  const closeImportModal = useCallback(() => {
    setIsImportModalOpen(false);
    setImportText('');
  }, []);

  // Pythonコード生成関数
  const generatePythonCode = useCallback(async () => {
    setIsPythonGenerating(true);
    setPythonCode('');
    setIsPythonModalOpen(true);

    try {
      // FlowSnapshotを作成
      const snapshot: FlowSnapshot = {
        version: 1,
        nodes: nodes.map(node => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
          width: node.width,
          height: node.height
        })),
        edges: edges.map(edge => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          data: edge.data
        })),
        nextNodeSeq: nextNodeSeq.current,
        nextEdgeSeq: nextEdgeSeq.current
      };

      // Python サービスにリクエスト
      const pythonServiceUrl = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:8001';
      const response = await fetch(`${pythonServiceUrl}/api/v1/canvas-to-python`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snapshot: snapshot,
          options: {
            include_comments: true,
            include_docstrings: true
          }
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPythonCode(data.code);
      } else {
        setPythonCode(`// エラーが発生しました\n${data.error || '不明なエラー'}`);
      }
    } catch (error) {
      console.error('Python code generation failed:', error);
      setPythonCode(`// エラーが発生しました\n${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsPythonGenerating(false);
    }
  }, [nodes, edges]);

  const closePythonModal = useCallback(() => {
    setIsPythonModalOpen(false);
    setPythonCode('');
    setIsPythonGenerating(false);
  }, []);

  // PythonコードからCanvas生成
  const generateCanvasFromPython = useCallback(async () => {
    setIsCanvasGenerating(true);

    try {
      // Python サービスにリクエスト
      const pythonServiceUrl = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:8001';
      const response = await fetch(`${pythonServiceUrl}/api/v1/python-to-canvas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: pythonInputCode,
          options: {
            include_comments: true,
            include_docstrings: true
          }
        }),
      });

      const data = await response.json();

      if (data.success) {
        const snapshot = data.snapshot;

        // 現在のキャンバスをクリア
        setNodes([]);
        setEdges([]);

        // 新しいノードとエッジをセット
        const newNodes = snapshot.nodes.map((node: any) => {
          console.log(`[FRONTEND_SIZE] Processing node ${node.id}: type=${node.type}, width=${node.width}, height=${node.height}`);

          return {
            ...node,
            position: node.position,
            // Pythonで計算された動的サイズを強制的に適用
            style: {
              width: node.width || (node.type === 'sectionNode' ? SECTION_DEFAULT_WIDTH : 160),
              height: node.height || (node.type === 'sectionNode' ? SECTION_DEFAULT_HEIGHT : 80),
              ...node.style
            }
          };
        });

        const newEdges = snapshot.edges.map((edge: any) => ({
          ...edge,
          type: 'logicEdge',
          animated: false,
        }));

        setNodes(newNodes);
        setEdges(newEdges);

        // シーケンス番号を更新
        nextNodeSeq.current = snapshot.nextNodeSeq;
        nextEdgeSeq.current = snapshot.nextEdgeSeq;

        // モーダルを閉じる
        setIsPythonImportModalOpen(false);
        setPythonInputCode('');
      } else {
        alert(`Canvas生成に失敗しました: ${data.error || '不明なエラー'}`);
      }
    } catch (error) {
      console.error('Canvas generation failed:', error);
      alert(`Canvas生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsCanvasGenerating(false);
    }
  }, [pythonInputCode]);

  const closePythonImportModal = useCallback(() => {
    setIsPythonImportModalOpen(false);
    setPythonInputCode('');
    setIsCanvasGenerating(false);
  }, []);

  // Mermaidもどきテキストからノードとエッジを解析する関数
  const parseImportData = useCallback((text: string) => {
    try {
      // JSONフォーマットかどうか確認
      const data = JSON.parse(text);

      // バージョンチェック
      if (!data.version || !data.format || data.format !== "LogicMap Flow Structure") {
        throw new Error("このファイルは対応していない形式です。LogicMap形式のファイルを選択してください。");
      }

      // バージョン互換性チェック
      const supportedVersions = ["2.0.0"];
      if (!supportedVersions.includes(data.version)) {
        throw new Error(`サポートされていないバージョンです: ${data.version}。サポート版: ${supportedVersions.join(', ')}`);
      }

      // 座標データの完全性チェック
      const invalidNodes = data.nodes.filter((node: any) =>
        !node.position ||
        typeof node.position.x !== 'number' ||
        typeof node.position.y !== 'number' ||
        !node.size ||
        typeof node.size.width !== 'number' ||
        typeof node.size.height !== 'number'
      );

      if (invalidNodes.length > 0) {
        throw new Error(`座標またはサイズ情報が不完全なノードがあります（${invalidNodes.length}個）。自動配置は廃止されました。すべてのノードに正確な座標とサイズが必要です。`);
      }

      // ID重複チェック（既存ノードとの照合）
      const existingNodeIds = nodes.map(n => n.id);
      const existingEdgeIds = edges.map(e => e.id);
      const importNodeIds = data.nodes.map((n: any) => n.id);
      const importEdgeIds = data.edges.map((e: any) => e.id);

      const duplicateNodeIds = importNodeIds.filter((id: string) => existingNodeIds.includes(id));
      const duplicateEdgeIds = importEdgeIds.filter((id: string) => existingEdgeIds.includes(id));

      // ID重複対応: サフィックスを追加
      const generateUniqueId = (baseId: string, existingIds: string[]): string => {
        let newId = baseId;
        let counter = 1;
        while (existingIds.includes(newId)) {
          newId = `${baseId}_import_${counter}`;
          counter++;
        }
        return newId;
      };

      const idMapping: Record<string, string> = {};

      // ノードのID重複解決
      data.nodes.forEach((node: any) => {
        if (duplicateNodeIds.includes(node.id)) {
          const newId = generateUniqueId(node.id, [...existingNodeIds, ...Object.values(idMapping)]);
          idMapping[node.id] = newId;
          node.id = newId;
        }
      });

      // エッジのID重複解決とノード参照更新
      data.edges.forEach((edge: any) => {
        if (duplicateEdgeIds.includes(edge.id)) {
          const newId = generateUniqueId(edge.id, [...existingEdgeIds, ...Object.values(idMapping)]);
          edge.id = newId;
        }

        // ソース・ターゲットのノードIDが変更されている場合は更新
        if (idMapping[edge.source]) {
          edge.source = idMapping[edge.source];
        }
        if (idMapping[edge.target]) {
          edge.target = idMapping[edge.target];
        }
      });

      // 親子関係のID更新
      data.nodes.forEach((node: any) => {
        if (node.parentNode && idMapping[node.parentNode]) {
          node.parentNode = idMapping[node.parentNode];
        }
      });

      return {
        nodes: data.nodes,
        edges: data.edges,
        metadata: data.metadata
      };

    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("JSONフォーマットが正しくありません。新しいLogicMap形式のファイルを使用してください。");
      }
      throw error;
    }
  }, [nodes, edges]);

  const parseImportTextLegacy = useCallback((text: string) => {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const newNodes: Node[] = [];
    const newEdges: Edge[] = [];
    let nodeCounter = 1;
    let edgeCounter = 1;
    let currentSection = '';

    // 自動配置用の設定
    const GRID_SPACING_X = 200;
    const GRID_SPACING_Y = 150;
    const NODES_PER_ROW = 4;
    let autoPositionIndex = 0;

    let i = 0;
    while (i < lines.length) {
      const line = lines[i];

      // セクションヘッダーをチェック
      if (line.toLowerCase().startsWith('## nodes')) {
        currentSection = 'nodes';
        i++;
        continue;
      } else if (line.toLowerCase().startsWith('## edges')) {
        currentSection = 'edges';
        i++;
        continue;
      } else if (line.startsWith('#') || line.startsWith('---') || line.startsWith('Generated by')) {
        // その他のヘッダーやフッターをスキップ
        i++;
        continue;
      }

      if (currentSection === 'nodes' && line.startsWith('- [')) {
        // ノード定義の解析
        console.log(`[DEBUG] Processing node line: "${line}"`);
        const nodeHeaderMatch = line.match(/^-\s*\[([^\]]+)\]\s+(.+?)\s*\(id:\s*([^)]+)\)/);
        console.log(`[DEBUG] Node header match: ${!!nodeHeaderMatch}`);
        if (nodeHeaderMatch) {
          const [, nodeType, labelText, originalId] = nodeHeaderMatch;
          const label = labelText.trim();
          console.log(`[DEBUG] Node: type=${nodeType}, label=${label}, id=${originalId}`);

          // 次の行から追加情報を読み取る
          let position = { x: 0, y: 0 };
          let style = { width: 160, height: 80 };
          let additionalData: any = {};
          let hasPosition = false;
          let parentNodeId: string | undefined = undefined;

          i++;
          while (i < lines.length && lines[i].startsWith('  - ')) {
            const subLine = lines[i].trim();

            // 位置情報の解析
            const positionMatch = subLine.match(/位置:\s*\((\d+),\s*(\d+)\),\s*サイズ:\s*(\d+)\s*×\s*(\d+)/);
            console.log(`[DEBUG] Position parsing for ${originalId}: line="${subLine}", match=${!!positionMatch}`);
            if (positionMatch) {
              const [, x, y, width, height] = positionMatch;
              position = { x: parseInt(x), y: parseInt(y) };
              style = { width: parseInt(width), height: parseInt(height) };
              hasPosition = true;
              console.log(`[DEBUG] Parsed position for ${originalId}: (${x}, ${y}), size: ${width}x${height}`);
            }

            // 親子関係の解析
            const parentMatch = subLine.match(/親:\s*(.+)$/);
            if (parentMatch) {
              parentNodeId = parentMatch[1];
            }

            // 条件の解析
            const conditionMatch = subLine.match(/条件:\s*(.+)$/);
            if (conditionMatch) {
              additionalData.condition = conditionMatch[1];
            }

            // 引数の解析
            const argsMatch = subLine.match(/引数:\s*(.+)$/);
            if (argsMatch) {
              additionalData.args = argsMatch[1];
            }

            // 返り値の解析
            const returnMatch = subLine.match(/返り値:\s*(.+)$/);
            if (returnMatch) {
              additionalData.returnValue = returnMatch[1];
            }

            // 補足の解析
            const noteMatch = subLine.match(/補足:\s*(.+)$/);
            if (noteMatch) {
              additionalData.note = noteMatch[1];
            }

            i++;
          }
          i--; // 次のループでインクリメントされるので調整

          // 位置情報がない場合のみ自動配置
          if (!hasPosition) {
            // ノードタイプに応じた配置戦略
            if (nodeType === 'start') {
              // 開始ノードは左上に配置
              position = { x: 50, y: 50 };
            } else if (nodeType === 'end') {
              // 終了ノードは右下に配置（仮の位置、後で調整）
              position = { x: 600, y: 400 };
            } else if (nodeType === 'function' || nodeType === 'main' || nodeType === 'class' || nodeType === 'interface') {
              // セクションノードは上部に配置
              const sectionRow = Math.floor(autoPositionIndex / NODES_PER_ROW);
              const sectionCol = autoPositionIndex % NODES_PER_ROW;
              position = {
                x: sectionCol * (GRID_SPACING_X + 50) + 100, // セクションは横に広めに配置
                y: 50 + sectionRow * 200 // セクションの高さも考慮して縦間隔を広く
              };
            } else {
              // その他のノードはグリッド配置
              const row = Math.floor(autoPositionIndex / NODES_PER_ROW);
              const col = autoPositionIndex % NODES_PER_ROW;
              position = {
                x: col * GRID_SPACING_X + 50,
                y: row * GRID_SPACING_Y + 200 // 関数ノードの下に配置
              };
            }
            autoPositionIndex++;
          }

          // ノードタイプのマッピング
          const mappedNodeType = (() => {
            switch (nodeType) {
              case 'start': case 'end': case 'normal': case 'if': case 'elif':
                return 'logicNode';
              case 'function': case 'main': case 'class': case 'interface': case 'try': case 'catch': case 'for': case 'while':
                return 'sectionNode';
              default:
                return 'logicNode';
            }
          })();

          let nodeData: any;

          if (mappedNodeType === 'sectionNode') {
            // sectionNodeの場合
            nodeData = {
              id: originalId,
              type: mappedNodeType,
              position,
              data: {
                label,
                sectionType: nodeType as SectionType,
                ...additionalData
              },
              style: {
                ...style,
                width: Math.max(style.width || 160, 200), // sectionは少し大きめに
                height: Math.max(style.height || 80, 100)
              }
            };
          } else {
            // logicNodeの場合
            nodeData = {
              id: originalId,
              type: mappedNodeType,
              position,
              data: {
                label,
                nodeKind: nodeType as NodeKind || 'normal',
                seq: nodeCounter++,
                ...additionalData
              },
              style
            };

            // 親子関係を明示的に設定
            if (parentNodeId) {
              nodeData.parentNode = parentNodeId;
              nodeData.extent = 'parent' as const;
            }
          }

          newNodes.push(nodeData as Node);
        }
      } else if (currentSection === 'edges' && line.startsWith('- [')) {
        // エッジ定義の解析
        const edgeMatch = line.match(/^-\s*\[([^\]]+)\]\s+(.+?)\s*→\s*(.+)$/);
        if (edgeMatch) {
          const [, edgeType, sourceName, targetName] = edgeMatch;

          // ソースとターゲットのノードを探す
          const sourceNode = newNodes.find(n => {
            const labelMatch = n.data?.label === sourceName.trim();
            const partialMatch = n.data?.label?.includes(sourceName.trim());
            return labelMatch || partialMatch;
          });

          const targetNode = newNodes.find(n => {
            const labelMatch = n.data?.label === targetName.trim();
            const partialMatch = n.data?.label?.includes(targetName.trim());
            return labelMatch || partialMatch;
          });


          if (sourceNode && targetNode) {
            let edgeData: any = {
              id: `edge-${edgeCounter++}`,
              source: sourceNode.id,
              target: targetNode.id,
              type: 'logicEdge',
              data: {
                controlType: 'sequence' as const,
                condition: '',
                note: '',
                validations: [],
                parallelOffset: 0
              }
            };

            // エッジタイプに基づく制御タイプの設定
            if (edgeType.includes('if')) {
              edgeData.data.controlType = 'if';
            } else if (edgeType.includes('elif')) {
              edgeData.data.controlType = 'elif';
            }

            // 条件や補足の解析（次の行から）
            let j = i + 1;
            while (j < lines.length && lines[j].startsWith('  - ')) {
              const subLine = lines[j].trim();
              const conditionMatch = subLine.match(/-\s*条件:\s*(.+)$/);
              if (conditionMatch) {
                edgeData.data.condition = conditionMatch[1];
              }
              const noteMatch = subLine.match(/-\s*補足:\s*(.+)$/);
              if (noteMatch) {
                edgeData.data.note = noteMatch[1];
              }
              j++;
            }

            newEdges.push(edgeData as Edge);
          }
        }
      }

      i++;
    }

    // 親子関係の処理（座標は最後に一括変換）
    let processedNodes = [...newNodes];

    // 1. まずセクション同士の親子関係を処理（絶対座標のまま）
    processedNodes = processedNodes.map(node => {
      // 明示的な親子関係が既に設定されている場合はスキップ
      if (node.parentNode) return node;

      if (node.type === 'sectionNode') {
        // 元の絶対座標を保持した他のセクションと比較
        const otherSections = newNodes.filter(n => n.type === 'sectionNode' && n.id !== node.id);
        console.log(`[DEBUG] Processing section ${node.id}, found ${otherSections.length} other sections`);

        // 他のセクションを面積の大きい順にソート（大きなセクションから親を探す）
        const sortedOtherSections = otherSections.sort((a, b) => {
          const aSize = (Number(a.style?.width) || 200) * (Number(a.style?.height) || 100);
          const bSize = (Number(b.style?.width) || 200) * (Number(b.style?.height) || 100);
          return bSize - aSize; // 大きいものから
        });

        // このセクションを含む最小のセクションを親とする（元の絶対座標で比較）
        const parentSection = sortedOtherSections.find(otherSection => {
          const otherPos = otherSection.position;
          const otherSize = {
            width: Number(otherSection.style?.width) || 200,
            height: Number(otherSection.style?.height) || 100
          };
          const nodePos = newNodes.find(n => n.id === node.id)?.position;
          const nodeSize = {
            width: Number(node.style?.width) || 200,
            height: Number(node.style?.height) || 100
          };

          if (!nodePos) return false;

          // このノード全体が他のセクション内に含まれているかチェック
          const isContained = nodePos.x >= otherPos.x &&
                 nodePos.y >= otherPos.y &&
                 nodePos.x + nodeSize.width <= otherPos.x + otherSize.width &&
                 nodePos.y + nodeSize.height <= otherPos.y + otherSize.height;

          console.log(`[DEBUG] Checking if ${node.id} is contained in ${otherSection.id}:`);
          console.log(`  - nodePos: (${nodePos.x}, ${nodePos.y}), nodeSize: ${nodeSize.width}x${nodeSize.height}`);
          console.log(`  - otherPos: (${otherPos.x}, ${otherPos.y}), otherSize: ${otherSize.width}x${otherSize.height}`);
          console.log(`  - nodeRange: x:${nodePos.x}-${nodePos.x + nodeSize.width}, y:${nodePos.y}-${nodePos.y + nodeSize.height}`);
          console.log(`  - otherRange: x:${otherPos.x}-${otherPos.x + otherSize.width}, y:${otherPos.y}-${otherPos.y + otherSize.height}`);
          console.log(`  - checks: left=${nodePos.x >= otherPos.x}, top=${nodePos.y >= otherPos.y}, right=${nodePos.x + nodeSize.width <= otherPos.x + otherSize.width}, bottom=${nodePos.y + nodeSize.height <= otherPos.y + otherSize.height}`);
          console.log(`  - isContained: ${isContained}`);

          return isContained;
        });

        if (parentSection) {
          console.log(`[DEBUG] Setting parent for section ${node.id}: parent=${parentSection.id}`);
          return {
            ...node,
            parentNode: parentSection.id,
            extent: 'parent' as const
          };
        }
      }

      return node;
    });

    // 2. 次にlogicNodeの親子関係を処理（絶対座標のまま）
    processedNodes = processedNodes.map(node => {
      // 明示的な親子関係が既に設定されている場合
      if (node.parentNode) {
        return node;
      }

      // logicNodeで明示的な親子関係がない場合の階層的推測
      if (node.type === 'logicNode' && !node.parentNode) {
        // 元の絶対座標を保持した状態でセクションと比較
        const sectionNodes = newNodes.filter(n => n.type === 'sectionNode');

        // セクションを面積の小さい順にソート（最も具体的な親を見つけるため）
        const sortedSections = sectionNodes.sort((a, b) => {
          const aSize = (Number(a.style?.width) || 200) * (Number(a.style?.height) || 100);
          const bSize = (Number(b.style?.width) || 200) * (Number(b.style?.height) || 100);
          return aSize - bSize;
        });

        // 最も小さい（＝最も具体的な）セクションから検索
        const parentSection = sortedSections.find(sectionNode => {
          const sectionPos = sectionNode.position;
          const sectionSize = {
            width: Number(sectionNode.style?.width) || 200,
            height: Number(sectionNode.style?.height) || 100
          };
          const nodePos = node.position;

          return nodePos.x >= sectionPos.x &&
                 nodePos.x <= sectionPos.x + sectionSize.width &&
                 nodePos.y >= sectionPos.y + 50 &&
                 nodePos.y <= sectionPos.y + sectionSize.height;
        });

        if (parentSection) {
          return {
            ...node,
            parentNode: parentSection.id,
            extent: 'parent' as const
          };
        }
      }

      return node;
    });

    // 3. 最後に親子関係が設定されたノードの座標を相対座標に変換
    processedNodes = processedNodes.map(node => {
      if (node.parentNode) {
        const parentNode = newNodes.find(n => n.id === node.parentNode);
        if (parentNode) {
          return {
            ...node,
            position: {
              x: node.position.x - parentNode.position.x,
              y: node.position.y - parentNode.position.y
            }
          };
        }
      }
      return node;
    });

    return { nodes: processedNodes, edges: newEdges };
  }, []);

  const importFlowFromText = useCallback(() => {
    try {
      const { nodes, edges, metadata } = parseImportData(importText);

      if (nodes.length === 0) {
        alert('有効なノード定義が見つかりませんでした。');
        return;
      }

      setNodes(nodes);
      setEdges(edges);

      // シーケンス番号を更新
      const maxNodeSeq = nodes.length > 0 ? nodes.length + 1 : 1;
      const maxEdgeSeq = edges.length > 0 ? edges.length + 1 : 1;
      nextNodeSeq.current = maxNodeSeq;
      nextEdgeSeq.current = maxEdgeSeq;

      closeImportModal();

      // インポート成功メッセージ（メタデータ情報も含む）
      const message = metadata?.flowName
        ? `「${metadata.flowName}」をインポートしました。\n${nodes.length}個のノードと${edges.length}個のエッジを復元しました。`
        : `${nodes.length}個のノードと${edges.length}個のエッジをインポートしました。`;
      alert(message);
    } catch (error) {
      console.error('インポート中にエラーが発生しました:', error);
      const errorMessage = error instanceof Error ? error.message : 'インポート中にエラーが発生しました。';
      alert(errorMessage);
    }
  }, [importText, parseImportData, setNodes, setEdges, closeImportModal]);

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
      const blob = new Blob([exportedText], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = currentFlowName || 'flow-structure';
      link.download = `${fileName}.logicmap.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ダウンロードに失敗しました:', err);
      alert('ダウンロードに失敗しました');
    }
  }, [exportedText, currentFlowName]);

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

  // 初期フローIDが指定されている場合の自動読み込み
  useEffect(() => {
    if (initialFlowId) {
      restoreSavedFlow(initialFlowId);
    }
  }, [initialFlowId, restoreSavedFlow]);

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

      // Phase7: 内部要素の自動生成
      let createdNodes = [newSection];
      let createdEdges: Edge[] = [];

      if (nodeForm.innerElements.length > 0) {
        const sortedElements = nodeForm.innerElements.sort((a, b) => a.order - b.order);
        let previousNodeId = newSection.id;

        for (let i = 0; i < sortedElements.length; i++) {
          const element = sortedElements[i];
          const basePosition = {
            x: flowPosition.x + (i * 150) - (sortedElements.length - 1) * 75, // 要素を横に並べる
            y: flowPosition.y + 120, // セクションの下に配置
          };

          let newNode: Node;
          if (element.type === 'section') {
            newNode = createSectionNode({
              sectionType: element.sectionType!,
              label: `${element.label}_${i + 1}`,
              position: basePosition,
            });
            // 子セクションを親セクション内に配置
            newNode.parentNode = newSection.id;
            newNode.extent = 'parent';
            newNode.position = {
              x: basePosition.x - flowPosition.x,
              y: basePosition.y - flowPosition.y,
            };
          } else {
            newNode = createLogicNode({
              kind: element.nodeKind!,
              label: element.nodeKind === 'normal' ? `処理_${i + 1}` : element.nodeKind!,
              position: basePosition,
            });
            // 子ノードを親セクション内に配置
            newNode.parentNode = newSection.id;
            newNode.extent = 'parent';
            newNode.position = {
              x: basePosition.x - flowPosition.x,
              y: basePosition.y - flowPosition.y,
            };
          }

          createdNodes.push(newNode);

          // フロー接続を作成（前の要素と現在の要素を接続）
          if (i === 0) {
            // 最初の要素はセクションのエントリポイントに接続
            // entryNodeIdが設定されている場合はそれを優先
            const entryNodeId = normalizeText(nodeForm.entryNodeId);
            if (entryNodeId) {
              const entryEdge = createEdge({
                source: entryNodeId,
                target: newNode.id,
                controlType: 'flow',
              });
              createdEdges.push(entryEdge);
            }
          } else {
            // 前の要素から現在の要素への接続
            const flowEdge = createEdge({
              source: previousNodeId,
              target: newNode.id,
              controlType: 'flow',
            });
            createdEdges.push(flowEdge);
          }

          previousNodeId = newNode.id;
        }
      }

      setNodes((currentNodes) => [...createdNodes, ...currentNodes]);
      if (createdEdges.length > 0) {
        setEdges((currentEdges) => [...createdEdges, ...currentEdges]);
      }

      // Phase7: 内部要素が追加された場合は親セクションのサイズを調整
      if (nodeForm.innerElements.length > 0) {
        setTimeout(() => {
          updateParentSectionSize(newSection.id);
        }, 100);
      }

      setPendingNodeClientPosition(null);
      setNodeModalOption(null);
      setNodeForm({ ...EMPTY_NODE_FORM });
      return;
    }

    // Phase8: 変数ノードの作成
    if (nodeModalOption.kind === 'variable' || nodeModalOption.kind === 'type') {
      const newVariableNode = createVariableNode({
        operationType: variableForm.operationType,
        position: flowPosition,
        // 宣言モード用
        pythonType: variableForm.pythonType,
        variableName: variableForm.variableName ? normalizeText(variableForm.variableName) : undefined,
        initialValue: variableForm.initialValue ? normalizeText(variableForm.initialValue) : undefined,
        scope: variableForm.scope,
        // 変更モード用
        targetVariable: variableForm.targetVariable ? normalizeText(variableForm.targetVariable) : undefined,
        newValue: variableForm.newValue ? normalizeText(variableForm.newValue) : undefined,
        // 型固有パラメータ
        elementType: variableForm.elementType ? normalizeText(variableForm.elementType) : undefined,
        keyType: variableForm.keyType ? normalizeText(variableForm.keyType) : undefined,
        valueType: variableForm.valueType ? normalizeText(variableForm.valueType) : undefined,
        innerType: variableForm.innerType ? normalizeText(variableForm.innerType) : undefined,
        unionTypes: variableForm.unionTypes?.filter(t => t.trim()).length ?
          variableForm.unionTypes.filter(t => t.trim()) : undefined,
        genericParams: variableForm.genericParams ? normalizeText(variableForm.genericParams) : undefined,
        note: variableForm.note ? normalizeText(variableForm.note) : undefined,
      });
      setNodes((currentNodes) => [...currentNodes, newVariableNode]);
      setPendingNodeClientPosition(null);
      setNodeModalOption(null);
      setNodeForm({ ...EMPTY_NODE_FORM });
      setVariableForm({
        operationType: 'declare',
        seq: 0,
        pythonType: 'str',
        variableName: '',
        initialValue: '',
        scope: 'global',
        note: ''
      });
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
    createVariableNode,
    nodeForm,
    nodeModalOption,
    pendingNodeClientPosition,
    setNodes,
    variableForm,
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

      // Phase7: 削除されるノードの親セクションIDを保存（サイズ更新用）
      const parentSectionId = removedNode?.parentNode;

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

      // Phase7: 削除後に親セクションのサイズを調整
      if (parentSectionId) {
        setTimeout(() => {
          updateParentSectionSize(parentSectionId);
        }, 100);
      }
    },
    [nodes, setEdges, setNodes, updateParentSectionSize]
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

  // Phase7: ドラッグ開始時にフラグを設定
  const onNodeDragStart = useCallback<NodeDragHandler>(
    (_event, _node) => {
      isDraggingRef.current = true;
    },
    []
  );

  const onNodeDragStop = useCallback<NodeDragHandler>(
    (_event, draggedNode) => {
      // Phase7: ドラッグ終了時にフラグをクリア
      isDraggingRef.current = false;

      const instance = reactFlowInstance.current;
      if (!instance) return;

      // Phase7: セクションノードとlogicノードの両方を処理
      const isLogicNode = draggedNode.type === 'logicNode';
      const isSectionNode = draggedNode.type === 'sectionNode';

      if (!isLogicNode && !isSectionNode) return;

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

      // Phase7: 親子関係のバリデーション（循環参照防止）
      const isValidParentChild = (childId: string, parentId: string): boolean => {
        try {
          // 自己参照チェック
          if (childId === parentId) {
            return false;
          }

          // 親ノードがsectionNodeかチェック
          const parentNode = sectionNodes.find(node => node.id === parentId);
          if (!parentNode) {
            return false; // 親がセクションノードでない場合は無効
          }

          // 循環参照チェック：親の階層を上に辿って子ノードが含まれていないかチェック
          const allNodes = instance.getNodes();
          let currentParent: string | undefined = parentId;
          const visitedParents = new Set<string>(); // 無限ループ防止

          while (currentParent) {
            if (visitedParents.has(currentParent)) {
              // 無限ループを検出
              return false;
            }
            visitedParents.add(currentParent);

            const parent = allNodes.find(node => node.id === currentParent);
            if (!parent) break;

            if (parent.parentNode === childId) {
              // 循環参照を発見
              return false;
            }

            currentParent = parent.parentNode;

            // 安全のため最大階層数を制限
            if (visitedParents.size > 20) {
              return false;
            }
          }

          return true;
        } catch (error) {
          console.error('Error in parent-child validation:', error);
          return false; // エラーが発生した場合は安全のため無効とする
        }
      };

      // 元の親セクションIDを保存（サイズ更新用）
      const oldParentId = draggedNode.parentNode;
      let newParentId: string | undefined = undefined;

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== draggedNode.id) return node;
          if (parentSection) {
            // Phase7: 親子関係の妥当性チェック
            if (!isValidParentChild(draggedNode.id, parentSection.id)) {
              console.warn(`Invalid parent-child relationship: ${draggedNode.id} -> ${parentSection.id} (circular reference or self-reference)`);
              return node; // 無効な親子関係の場合は変更しない
            }

            const parentRect = getNodeRect(parentSection);
            if (!parentRect) return node;
            const absolutePos = draggedNode.positionAbsolute ?? draggedNode.position;
            newParentId = parentSection.id;
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

      // Phase7: 親セクションのサイズを更新
      // logicNodeの移動時のみサイズ更新を実行（sectionNodeの移動時は無限ループ防止のためスキップ）
      if (isLogicNode) {
        // 少し遅延させてReact Flowの位置更新完了後にサイズ調整
        setTimeout(() => {
          if (oldParentId) {
            updateParentSectionSize(oldParentId);
          }
          if (newParentId && newParentId !== oldParentId) {
            updateParentSectionSize(newParentId);
          }
        }, 150);
      }
    },
    [setNodes, updateParentSectionSize]
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
        <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
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

  const pythonModalContent = useMemo(() => {
    if (!isPythonModalOpen) return null;

    const copyPythonCode = () => {
      navigator.clipboard.writeText(pythonCode).then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      }).catch((err) => {
        console.error('コピーに失敗しました:', err);
      });
    };

    const downloadPythonFile = () => {
      const blob = new Blob([pythonCode], { type: 'text/x-python' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'generated_code.py';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    };

    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-4xl max-h-[80vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">🐍 生成されたPythonコード</h3>
            <div className="flex gap-2">
              <button
                type="button"
                className={`rounded-md border px-3 py-1 text-xs font-semibold ${
                  isCopied
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
                onClick={copyPythonCode}
                disabled={isPythonGenerating}
              >
                {isCopied ? '✓ コピー済み' : '📋 コピー'}
              </button>
              <button
                type="button"
                className="rounded-md border border-green-200 bg-green-50 px-3 py-1 text-xs font-semibold text-green-700 hover:bg-green-100"
                onClick={downloadPythonFile}
                disabled={isPythonGenerating || !pythonCode}
              >
                💾 ダウンロード
              </button>
              <button
                type="button"
                className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
                onClick={closePythonModal}
              >
                ✕ 閉じる
              </button>
            </div>
          </div>
          {isPythonGenerating ? (
            <div className="flex items-center justify-center p-8">
              <div className="text-center">
                <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-gray-600">Pythonコードを生成中...</p>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <pre className="h-96 overflow-auto rounded-md border border-gray-300 bg-gray-50 p-4 text-sm font-mono">
                <code className="text-gray-800">{pythonCode}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  }, [isPythonModalOpen, pythonCode, isPythonGenerating, isCopied, closePythonModal]);

  const pythonImportModalContent = useMemo(() => {
    if (!isPythonImportModalOpen) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="w-full max-w-4xl rounded-lg bg-white p-6 shadow-lg max-h-[90vh] overflow-y-auto">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              📝 PythonコードからCanvas生成
            </h3>
            <button
              type="button"
              className="rounded-md p-2 text-gray-500 hover:text-gray-700"
              onClick={closePythonImportModal}
            >
              ✕
            </button>
          </div>

          <div className="mb-4">
            <p className="mb-3 text-sm text-gray-600">
              Pythonコードを入力してCanvasを生成します。
            </p>
            <textarea
              value={pythonInputCode}
              onChange={(e) => setPythonInputCode(e.target.value)}
              placeholder="def example_function(a: int, b: int) -> int:&#10;    result = a + b&#10;    return result&#10;&#10;if __name__ == '__main__':&#10;    print(example_function(1, 2))"
              className="w-full h-96 rounded-md border border-gray-300 p-3 font-mono text-sm resize-none focus:border-blue-500 focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={closePythonImportModal}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="rounded-md bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 disabled:opacity-50"
              onClick={generateCanvasFromPython}
              disabled={!pythonInputCode.trim() || isCanvasGenerating}
            >
              {isCanvasGenerating ? '生成中...' : 'Canvas生成'}
            </button>
          </div>
        </div>
      </div>
    );
  }, [isPythonImportModalOpen, pythonInputCode, isCanvasGenerating, closePythonImportModal, generateCanvasFromPython]);

  const importModalContent = useMemo(() => {
    if (!isImportModalOpen) return null;
    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Mermaidもどきインポート</h3>
            <button
              type="button"
              className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              onClick={closeImportModal}
            >
              閉じる
            </button>
          </div>
          <div className="mb-4">
            <p className="text-sm text-gray-600 mb-3">
              Mermaidもどき形式のテキストを入力してフローを再現できます。
            </p>
            <div className="text-xs text-gray-500 mb-3">
              <strong>形式例:</strong>
              <pre className="bg-gray-100 p-2 rounded mt-1">
                {`- [normal] データ処理 (id: node-1)
  - 位置: (100, 200), サイズ: 150 × 80
- [normal] 結果出力 (id: node-2)
  - 位置: (300, 200), サイズ: 150 × 80
- [通常] データ処理 → 結果出力`}
              </pre>
            </div>
          </div>
          <div className="mb-4">
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Mermaidもどきテキストをここに入力してください..."
              className="w-full h-64 p-3 text-sm font-mono bg-white border border-gray-300 rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              style={{ whiteSpace: 'pre' }}
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              onClick={closeImportModal}
            >
              キャンセル
            </button>
            <button
              type="button"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={importFlowFromText}
              disabled={!importText.trim()}
            >
              インポートする
            </button>
          </div>
        </div>
      </div>
    );
  }, [isImportModalOpen, importText, closeImportModal, importFlowFromText]);

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
            className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
            onClick={openImportModal}
          >
            📥 インポート
          </button>
          <button
            type="button"
            className="rounded-md border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 hover:bg-orange-100"
            onClick={generatePythonCode}
          >
            🐍 Python生成
          </button>
          <button
            type="button"
            className="rounded-md border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700 hover:bg-purple-100"
            onClick={() => setIsPythonImportModalOpen(true)}
          >
            📝 Python→Canvas
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
      {nodeDeleteContent}
      {templateModalContent}
      {exportModalContent}
      {pythonModalContent}
      {pythonImportModalContent}
      {importModalContent}
      {clearModalContent}
    </div>
  );
}
