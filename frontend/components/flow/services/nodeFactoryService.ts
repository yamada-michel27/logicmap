import type { Node, XYPosition } from 'reactflow';

import {
  MEMO_DEFAULT_HEIGHT,
  MEMO_DEFAULT_WIDTH,
  SECTION_DEFAULT_HEIGHT,
  SECTION_DEFAULT_WIDTH,
  STAMP_SIZE,
} from '../constants';
import type {
  ClassMethod,
  LogicNodeData,
  MemoNodeData,
  NodeControlType,
  NodeFormState,
  NodeKind,
  NodeOption,
  PythonType,
  SectionNodeData,
  SectionType,
  StampNodeData,
  StampType,
  TypedField,
  ValidationRule,
  VariableNodeData,
  VariableOperationType,
  VariableScope,
} from '../types';
import { buildCatchValue, normalizeText } from '../utils';

export type CreateLogicNodeParams = {
  kind: NodeKind;
  label: string;
  position: XYPosition;
  controlType?: NodeControlType;
  condition?: string;
  note?: string;
  instanceOfSectionId?: string;
};

export type CreateSectionNodeParams = {
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
};

export type CreateMemoNodeParams = {
  text: string;
  position: XYPosition;
};

export type CreateStampNodeParams = {
  stamp: StampType;
  position: XYPosition;
};

export type CreateVariableNodeParams = {
  operationType: VariableOperationType;
  position: XYPosition;
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

function cloneTypedFields(items: TypedField[] = []) {
  return items.map((item) => ({ ...item }));
}

function cloneClassMethods(items: ClassMethod[] = []) {
  return items.map((method) => ({
    ...method,
    args: cloneTypedFields(method.args ?? []),
  }));
}

function cloneValidationRules(items: ValidationRule[] = []) {
  return items.map((rule) => ({ ...rule }));
}

function buildSectionNodePayload(sectionType: SectionType, nodeForm: NodeFormState) {
  const isFunction = sectionType === 'function';
  const isClass = sectionType === 'class';
  const isInterface = sectionType === 'interface';
  const isLoop = sectionType === 'while' || sectionType === 'for';
  const isCatch = sectionType === 'catch';
  const allowNote = sectionType !== 'main';
  const allowValidations = isFunction || isClass || isInterface;

  return {
    label: normalizeText(nodeForm.label) ?? '',
    sectionType,
    note: allowNote ? normalizeText(nodeForm.note) : undefined,
    entryNodeId: normalizeText(nodeForm.entryNodeId),
    functionArgs: isFunction ? cloneTypedFields(nodeForm.functionArgs) : undefined,
    functionReturnType: isFunction ? normalizeText(nodeForm.functionReturnType) : undefined,
    functionReturnValue: isFunction ? normalizeText(nodeForm.functionReturnValue) : undefined,
    loopCondition: isLoop ? normalizeText(nodeForm.loopCondition) : undefined,
    catchException: isCatch ? buildCatchValue(nodeForm) : undefined,
    classConstructorArgs: isClass ? cloneTypedFields(nodeForm.classConstructorArgs) : undefined,
    classMembers: isClass ? cloneTypedFields(nodeForm.classMembers) : undefined,
    classMethods: isClass ? cloneClassMethods(nodeForm.classMethods) : undefined,
    interfaceMembers: isInterface ? cloneTypedFields(nodeForm.interfaceMembers) : undefined,
    interfaceMethods: isInterface ? cloneClassMethods(nodeForm.interfaceMethods) : undefined,
    validations: allowValidations ? cloneValidationRules(nodeForm.validations) : [],
  };
}

function buildLogicNodePayload(
  option: NodeOption,
  nodeForm: NodeFormState,
  extras?: {
    controlType?: NodeControlType;
    instanceOfSectionId?: string;
  }
) {
  const kind = option.kind as NodeKind;
  const label =
    kind === 'start' || kind === 'end'
      ? option.label
      : normalizeText(nodeForm.label) ?? option.nodeLabel ?? '';

  return {
    label,
    nodeKind: kind,
    controlType: extras?.controlType,
    condition: kind === 'normal' ? normalizeText(nodeForm.condition) : undefined,
    note: normalizeText(nodeForm.note),
    instanceOfSectionId: extras?.instanceOfSectionId,
  };
}

export function buildSectionNodeData(
  seq: number,
  sectionType: SectionType,
  nodeForm: NodeFormState
): SectionNodeData {
  return {
    ...buildSectionNodePayload(sectionType, nodeForm),
    seq,
  };
}

export function buildLogicNodeData(
  seq: number,
  option: NodeOption,
  nodeForm: NodeFormState,
  extras?: {
    controlType?: NodeControlType;
    instanceOfSectionId?: string;
  }
): LogicNodeData {
  return {
    ...buildLogicNodePayload(option, nodeForm, extras),
    seq,
  };
}

export function buildSectionNodeParams(
  sectionType: SectionType,
  nodeForm: NodeFormState,
  position: XYPosition
): CreateSectionNodeParams {
  return {
    ...buildSectionNodePayload(sectionType, nodeForm),
    position,
  };
}

export function buildLogicNodeParams(
  option: NodeOption,
  nodeForm: NodeFormState,
  position: XYPosition,
  extras?: {
    controlType?: NodeControlType;
    instanceOfSectionId?: string;
  }
): CreateLogicNodeParams {
  const payload = buildLogicNodePayload(option, nodeForm, extras);

  return {
    kind: payload.nodeKind,
    label: payload.label ?? '',
    position,
    controlType: payload.controlType,
    condition: payload.condition,
    note: payload.note,
    instanceOfSectionId: payload.instanceOfSectionId,
  };
}

export function buildVariableNodeParams(
  variableForm: VariableNodeData,
  position: XYPosition
): CreateVariableNodeParams {
  return {
    operationType: variableForm.operationType,
    position,
    pythonType: variableForm.pythonType,
    variableName: variableForm.variableName
      ? normalizeText(variableForm.variableName)
      : undefined,
    initialValue: variableForm.initialValue
      ? normalizeText(variableForm.initialValue)
      : undefined,
    scope: variableForm.scope,
    targetVariable: variableForm.targetVariable
      ? normalizeText(variableForm.targetVariable)
      : undefined,
    newValue: variableForm.newValue ? normalizeText(variableForm.newValue) : undefined,
    elementType: variableForm.elementType ? normalizeText(variableForm.elementType) : undefined,
    keyType: variableForm.keyType ? normalizeText(variableForm.keyType) : undefined,
    valueType: variableForm.valueType ? normalizeText(variableForm.valueType) : undefined,
    innerType: variableForm.innerType ? normalizeText(variableForm.innerType) : undefined,
    unionTypes: variableForm.unionTypes?.filter((value) => value.trim()).length
      ? variableForm.unionTypes.filter((value) => value.trim())
      : undefined,
    genericParams: variableForm.genericParams
      ? normalizeText(variableForm.genericParams)
      : undefined,
    note: variableForm.note ? normalizeText(variableForm.note) : undefined,
  };
}

export function buildLogicNode(
  seq: number,
  params: CreateLogicNodeParams
): Node<LogicNodeData> {
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
}

export function buildSectionNode(
  seq: number,
  params: CreateSectionNodeParams
): Node<SectionNodeData> {
  return {
    id: `section-${seq}`,
    type: 'sectionNode',
    position: params.position,
    style: {
      width: params.style?.width ?? SECTION_DEFAULT_WIDTH,
      height: params.style?.height ?? SECTION_DEFAULT_HEIGHT,
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
}

export function buildMemoNode(
  seq: number,
  params: CreateMemoNodeParams
): Node<MemoNodeData> {
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
}

export function buildStampNode(
  seq: number,
  params: CreateStampNodeParams
): Node<StampNodeData> {
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
}

export function buildVariableNode(
  seq: number,
  params: CreateVariableNodeParams
): Node<VariableNodeData> {
  let baseHeight = 120;
  const width = 200;

  if (params.operationType === 'declare') {
    if (params.variableName && params.variableName.trim()) {
      baseHeight += 40;
    }
    if (params.initialValue && params.initialValue.trim()) {
      baseHeight += 40;
    }
    if (
      params.pythonType &&
      ['list', 'tuple', 'set'].includes(params.pythonType) &&
      params.elementType
    ) {
      baseHeight += 20;
    }
    if (params.pythonType === 'dict' && (params.keyType || params.valueType)) {
      baseHeight += 20;
    }
    if (params.pythonType === 'Optional' && params.innerType) {
      baseHeight += 20;
    }
    if (params.pythonType === 'Union' && params.unionTypes && params.unionTypes.length > 0) {
      baseHeight += 20;
    }
  } else if (params.operationType === 'assign') {
    if (params.targetVariable && params.targetVariable.trim()) {
      baseHeight += 40;
    }
    if (params.newValue && params.newValue.trim()) {
      baseHeight += 40;
    }
  }

  if (params.note && params.note.trim()) {
    baseHeight += 50;
  }

  const size = {
    width,
    height: Math.max(100, Math.min(300, baseHeight)),
  };

  return {
    id: `variable-${seq}`,
    type: 'variableNode',
    position: params.position,
    style: { width: size.width, height: size.height },
    data: {
      operationType: params.operationType,
      seq,
      pythonType: params.pythonType,
      variableName: params.variableName,
      initialValue: params.initialValue,
      scope: params.scope || 'global',
      targetVariable: params.targetVariable,
      newValue: params.newValue,
      elementType: params.elementType,
      keyType: params.keyType,
      valueType: params.valueType,
      innerType: params.innerType,
      unionTypes: params.unionTypes,
      genericParams: params.genericParams,
      note: params.note,
    },
  };
}
