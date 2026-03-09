import { useCallback, useMemo } from 'react';
import type { Node } from 'reactflow';

import type {
  FlowNodeData,
  PythonType,
  VariableScope,
} from '../types';
import {
  collectDeclaredVariables,
  validateVariableTypeCompatibility,
} from '../services/flowInteractionService';

type DeclaredVariableInfo = {
  type: PythonType;
  scope: VariableScope;
  nodeId: string;
};

export function useVariableRegistryState(nodes: Node<FlowNodeData>[]) {
  const declaredVariables = useMemo<Map<string, DeclaredVariableInfo>>(
    () => collectDeclaredVariables(nodes),
    [nodes]
  );

  const validateTypeCompatibility = useCallback(
    (targetVariable: string, newValue: string): { isValid: boolean; message?: string } =>
      validateVariableTypeCompatibility(declaredVariables, targetVariable, newValue),
    [declaredVariables]
  );

  return {
    declaredVariables,
    validateTypeCompatibility,
  };
}
