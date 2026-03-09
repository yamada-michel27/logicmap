import type { Node } from 'reactflow';

import type {
  FlowNodeData,
  PythonType,
  VariableNodeData,
  VariableScope,
} from '../types';

export type DeclaredVariableInfo = {
  type: PythonType;
  scope: VariableScope;
  nodeId: string;
  initialValue: string;
};

export type TypeCompatibilityResult = {
  isValid: boolean;
  message?: string;
};

const DEFAULT_VARIABLE_FORM: VariableNodeData = {
  operationType: 'declare',
  seq: 0,
  pythonType: 'str',
  variableName: '',
  initialValue: '',
  scope: 'global',
  note: '',
};

export function createDefaultVariableForm(): VariableNodeData {
  return { ...DEFAULT_VARIABLE_FORM };
}

export function collectDeclaredVariables(
  nodes: Node<FlowNodeData>[]
): Map<string, DeclaredVariableInfo> {
  const declaredVariables = new Map<string, DeclaredVariableInfo>();

  nodes.forEach((node) => {
    if ((node.type === 'variableNode' || node.type === 'typeNode') && node.data) {
      const data = node.data as VariableNodeData;
      if ((data.operationType === 'declare' || !data.operationType) && data.variableName && data.pythonType) {
        declaredVariables.set(data.variableName, {
          type: data.pythonType,
          scope: data.scope || 'global',
          nodeId: node.id,
          initialValue: data.initialValue ?? '',
        });
      }
    }
  });

  return declaredVariables;
}

export function validateVariableTypeCompatibility(
  declaredVariables: Map<string, DeclaredVariableInfo>,
  targetVariable: string,
  newValue: string
): TypeCompatibilityResult {
  const varInfo = declaredVariables.get(targetVariable);
  if (!varInfo) {
    return { isValid: false, message: '変数が見つかりません' };
  }
  if (!newValue || newValue.trim() === '') {
    return { isValid: false, message: '値を入力してください' };
  }

  const trimmedValue = newValue.trim();
  switch (varInfo.type) {
    case 'int': {
      const isInt = /^-?\d+$/.test(trimmedValue);
      return { isValid: isInt, message: isInt ? undefined : '整数を入力してください（例: 123, -456）' };
    }
    case 'float': {
      const isFloat = /^-?\d+(\.\d+)?$/.test(trimmedValue) && !isNaN(Number(trimmedValue));
      return { isValid: isFloat, message: isFloat ? undefined : '数値を入力してください（例: 3.14, -2.5）' };
    }
    case 'bool': {
      const isBool = ['True', 'False', 'true', 'false'].includes(trimmedValue);
      return { isValid: isBool, message: isBool ? undefined : 'True または False を入力してください' };
    }
    case 'str': {
      const isStr = /^["'].*["']$/.test(trimmedValue) || trimmedValue.length > 0;
      return { isValid: isStr, message: isStr ? undefined : '文字列を入力してください（例: "hello", \'world\'）' };
    }
    case 'list': {
      const isList = /^\[.*\]$/.test(trimmedValue);
      return { isValid: isList, message: isList ? undefined : 'リスト形式で入力してください（例: [1, 2, 3]）' };
    }
    case 'dict': {
      const isDict = /^\{.*\}$/.test(trimmedValue);
      return { isValid: isDict, message: isDict ? undefined : '辞書形式で入力してください（例: {"key": "value"})' };
    }
    case 'tuple': {
      const isTuple = /^\(.*\)$/.test(trimmedValue);
      return { isValid: isTuple, message: isTuple ? undefined : 'タプル形式で入力してください（例: (1, 2, 3)）' };
    }
    case 'set': {
      const isSet = /^\{.*\}$/.test(trimmedValue) && !trimmedValue.includes(':');
      return { isValid: isSet, message: isSet ? undefined : 'セット形式で入力してください（例: {1, 2, 3}）' };
    }
    case 'None': {
      const isNone = trimmedValue === 'None';
      return { isValid: isNone, message: isNone ? undefined : 'None を入力してください' };
    }
    default:
      return { isValid: true };
  }
}

export function isDoubleClickWithinThreshold(
  lastClickAt: number | null,
  now: number,
  thresholdMs = 320
): boolean {
  return lastClickAt !== null && now - lastClickAt < thresholdMs;
}
