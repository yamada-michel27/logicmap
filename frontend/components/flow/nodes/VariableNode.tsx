import { Handle, Position, type NodeProps } from 'reactflow';
import { PYTHON_TYPE_OPTIONS } from '../types';
import type { PythonType, VariableNodeData } from '../types';

function getTypeColor(pythonType?: PythonType) {
  if (!pythonType) {
    return { bg: '#f0f9ff', border: '#0284c7', text: '#0c4a6e' };
  }
  switch (pythonType) {
    case 'int':
    case 'float':
      return { bg: '#dcfce7', border: '#16a34a', text: '#15803d' };
    case 'str':
      return { bg: '#fef3c7', border: '#f59e0b', text: '#d97706' };
    case 'bool':
      return { bg: '#ddd6fe', border: '#8b5cf6', text: '#7c3aed' };
    case 'list':
    case 'tuple':
    case 'set':
      return { bg: '#e0f2fe', border: '#0ea5e9', text: '#0284c7' };
    case 'dict':
      return { bg: '#fce7f3', border: '#ec4899', text: '#db2777' };
    case 'None':
      return { bg: '#f3f4f6', border: '#6b7280', text: '#4b5563' };
    case 'Optional':
    case 'Union':
    case 'Any':
      return { bg: '#fed7aa', border: '#f97316', text: '#ea580c' };
    default:
      return { bg: '#f8fafc', border: '#64748b', text: '#475569' };
  }
}

function getDisplayInfo(data: VariableNodeData, isDeclareMode: boolean, description: string) {
  if (isDeclareMode) {
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
    return {
      title: '変数変更',
      subtitle: data.targetVariable ? `${data.targetVariable} = ${data.newValue || '?'}` : ''
    };
  }
}

export function VariableNode({ data }: NodeProps<VariableNodeData>) {
  const isDeclareMode = data.operationType === 'declare' || !data.operationType;
  const isAssignMode = data.operationType === 'assign';

  const typeInfo = isDeclareMode && data.pythonType ?
    PYTHON_TYPE_OPTIONS.find((option) => option.id === data.pythonType) : null;
  const description = typeInfo?.description ?? '';

  const colors = getTypeColor(data.pythonType);
  const { title, subtitle } = getDisplayInfo(data, isDeclareMode, description);

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
        <div className="text-center mb-2">
          <div className="font-bold text-sm break-words leading-tight" style={{ color: colors.text }}>
            {title}
          </div>
          <div className="text-xs opacity-70 truncate">{subtitle}</div>
        </div>

        <div className="flex flex-col space-y-2">
          {isDeclareMode && (
            <>
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

          {data.note && data.note.trim() && (
            <div className="border-t border-gray-300 pt-2 mt-2">
              <div className="text-xs text-gray-600 text-center">補足:</div>
              <div className="text-xs leading-tight break-words px-1" style={{ color: colors.text }}>
                {data.note}
              </div>
            </div>
          )}

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
