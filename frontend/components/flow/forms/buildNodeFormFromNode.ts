import { type Node } from 'reactflow';
import { EMPTY_NODE_FORM } from '../constants';
import { parseCatchValue } from '../utils';
import type { FlowNodeData, LogicNodeData, SectionNodeData, NodeFormState } from '../types';

export function buildNodeFormFromNode(node: Node<FlowNodeData>): NodeFormState {
  const base = { ...EMPTY_NODE_FORM };
  if (node.type === 'sectionNode') {
    const data = node.data as SectionNodeData;
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
