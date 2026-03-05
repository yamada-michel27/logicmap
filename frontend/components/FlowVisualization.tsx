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
  FlowNodeData,
  LogicEdgeData,
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
  EMPTY_NODE_FORM,
  EMPTY_EDGE_FORM,
  NODE_OPTIONS,
  CATCH_OPTIONS,
} from './flow/constants';
import {
  toRgba,
  getNodeRect,
  findSectionAtPoint,
  getBaseNodeTint,
  getLogicNodeLabel,
  getNodeDisplayLabel,
  buildClassInstanceLabel,
  getNodeOptionForNode,
  isEventFromNodeOrEdge,
  normalizeText,
  formatTypedFields,
  formatValidationRules,
  parseCatchValue,
  buildCatchValue,
  getAvailableInnerElements,
  createEdge,
  buildConditionForControl,
  getConditionMeta,
  getIfControlOptions,
  buildEdgeLabel,
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

    return (
      <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-4xl max-h-[80vh] overflow-y-auto rounded-lg bg-white p-6 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">🐍 生成されたPythonコード</h3>
            <div className="flex gap-2">
              <button
                type="button"
                className={`rounded-md border px-3 py-1 text-xs font-semibold ${
                  isPythonCopied
                    ? 'border-green-200 bg-green-50 text-green-700'
                    : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
                onClick={copyPythonCode}
                disabled={isPythonGenerating}
              >
                {isPythonCopied ? '✓ コピー済み' : '📋 コピー'}
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
  }, [
    closePythonModal,
    copyPythonCode,
    downloadPythonFile,
    isPythonCopied,
    isPythonGenerating,
    isPythonModalOpen,
    pythonCode,
  ]);

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
  }, [
    closePythonImportModal,
    generateCanvasFromPython,
    isCanvasGenerating,
    isPythonImportModalOpen,
    pythonInputCode,
    setPythonInputCode,
  ]);

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
  }, [closeImportModal, importFlowFromText, importText, isImportModalOpen, setImportText]);

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
            onClick={openPythonImportModal}
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
