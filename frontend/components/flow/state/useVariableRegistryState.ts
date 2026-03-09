import { useCallback, useMemo } from 'react';
import type { Node } from 'reactflow';

import type {
  FlowNodeData,
} from '../types';
import {
  type DeclaredVariableInfo,
  collectDeclaredVariables,
  validateVariableTypeCompatibility,
} from '../services/flowInteractionService';

export type DeclaredVariableEntry = DeclaredVariableInfo & {
  name: string;
};

export function useVariableRegistryState(nodes: Node<FlowNodeData>[]) {
  const declaredVariables = useMemo<Map<string, DeclaredVariableInfo>>(
    () => collectDeclaredVariables(nodes),
    [nodes]
  );
  const declaredVariableEntries = useMemo<DeclaredVariableEntry[]>(
    () =>
      Array.from(declaredVariables.entries()).map(([name, info]) => ({
        name,
        ...info,
      })),
    [declaredVariables]
  );

  const validateTypeCompatibility = useCallback(
    (targetVariable: string, newValue: string): { isValid: boolean; message?: string } =>
      validateVariableTypeCompatibility(declaredVariables, targetVariable, newValue),
    [declaredVariables]
  );

  return {
    declaredVariables,
    declaredVariableEntries,
    validateTypeCompatibility,
  };
}
