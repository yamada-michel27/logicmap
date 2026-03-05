import {
  useCallback,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  addEdge,
  type Connection,
  type Edge,
  MarkerType,
  type Node,
  type ReactFlowInstance,
  type XYPosition,
} from 'reactflow';

import {
  CONTROL_STYLE,
  EDGE_STROKE_WIDTH,
  EMPTY_NODE_FORM,
  INSTANCE_OFFSET_X,
  INSTANCE_OFFSET_Y,
  MEMO_DEFAULT_HEIGHT,
  MEMO_DEFAULT_WIDTH,
  SECTION_DEFAULT_HEIGHT,
  SECTION_DEFAULT_WIDTH,
  STAMP_SIZE,
} from '../constants';
import type {
  ClassMethod,
  FlowNodeData,
  LogicNodeData,
  LogicEdgeData,
  NodeFormState,
  NodeControlType,
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
  MemoNodeData,
} from '../types';
import {
  buildCatchValue,
  buildClassInstanceLabel,
  buildEdgeLabel,
  createEdge,
  findSectionAtPoint,
  getNodeDisplayLabel,
  getNodeOptionForNode,
  getNodeRect,
  isEventFromNodeOrEdge,
  normalizeText,
} from '../utils';

type UseNodeOperationsParams = {
  nodes: Node<FlowNodeData>[];
  setNodes: Dispatch<SetStateAction<Node<FlowNodeData>[]>>;
  setEdges: Dispatch<SetStateAction<Edge<LogicEdgeData>[]>>;
  nextNodeSeqRef: MutableRefObject<number>;
  nextEdgeSeqRef: MutableRefObject<number>;
  wrapperRef: MutableRefObject<HTMLDivElement | null>;
  reactFlowInstance: MutableRefObject<ReactFlowInstance | null>;
  pendingNodeClientPosition: XYPosition | null;
  setPendingConnection: Dispatch<SetStateAction<Connection | null>>;
  setPendingNodeClientPosition: Dispatch<SetStateAction<XYPosition | null>>;
  setPendingMemoClientPosition: Dispatch<SetStateAction<XYPosition | null>>;
  setPendingNodeDelete: Dispatch<SetStateAction<{ id: string; label: string } | null>>;
  pendingNodeEdit: { id: string } | null;
  setPendingNodeEdit: Dispatch<SetStateAction<{ id: string } | null>>;
  setPendingMemoEdit: Dispatch<SetStateAction<{ id: string } | null>>;
  setPendingEdgeEdit: Dispatch<SetStateAction<{ id: string } | null>>;
  setPendingStamp: Dispatch<SetStateAction<StampType | null>>;
  nodeModalOption: NodeOption | null;
  setNodeModalOption: Dispatch<SetStateAction<NodeOption | null>>;
  nodeForm: NodeFormState;
  setNodeForm: Dispatch<SetStateAction<NodeFormState>>;
  variableForm: VariableNodeData;
  setVariableForm: Dispatch<SetStateAction<VariableNodeData>>;
  setMemoText: Dispatch<SetStateAction<string>>;
  updateParentSectionSize: (parentSectionId: string) => void;
  buildNodeFormFromNode: (node: Node<FlowNodeData>) => NodeFormState;
};

export function useNodeOperations({
  nodes,
  setNodes,
  setEdges,
  nextNodeSeqRef,
  nextEdgeSeqRef,
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
}: UseNodeOperationsParams) {
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
      const seq = nextNodeSeqRef.current++;
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
    [nextNodeSeqRef]
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
      const seq = nextNodeSeqRef.current++;
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
    },
    [nextNodeSeqRef]
  );

  const createMemoNode = useCallback(
    (params: { text: string; position: XYPosition }): Node<MemoNodeData> => {
      const seq = nextNodeSeqRef.current++;
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
    [nextNodeSeqRef]
  );

  const createStampNode = useCallback(
    (params: { stamp: StampType; position: XYPosition }): Node<StampNodeData> => {
      const seq = nextNodeSeqRef.current++;
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
    [nextNodeSeqRef]
  );

  const createVariableNode = useCallback(
    (params: {
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
    }): Node<VariableNodeData> => {
      const seq = nextNodeSeqRef.current++;

      const calculateVariableNodeSize = () => {
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

        const minHeight = 100;
        const maxHeight = 300;

        return {
          width,
          height: Math.max(minHeight, Math.min(maxHeight, baseHeight)),
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
    },
    [nextNodeSeqRef]
  );

  const openNodeModalAtClient = useCallback(
    (event: ReactMouseEvent) => {
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
    },
    [
      setNodeForm,
      setNodeModalOption,
      setPendingConnection,
      setPendingEdgeEdit,
      setPendingMemoClientPosition,
      setPendingMemoEdit,
      setPendingNodeClientPosition,
      setPendingNodeDelete,
      setPendingNodeEdit,
      setPendingStamp,
      wrapperRef,
    ]
  );

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

      const createdNodes: Node<FlowNodeData>[] = [newSection];
      const createdEdges: Edge<LogicEdgeData>[] = [];

      if (nodeForm.innerElements.length > 0) {
        const sortedElements = [...nodeForm.innerElements].sort((a, b) => a.order - b.order);
        let previousNodeId = newSection.id;

        for (let i = 0; i < sortedElements.length; i++) {
          const element = sortedElements[i];
          const basePosition = {
            x: flowPosition.x + i * 150 - (sortedElements.length - 1) * 75,
            y: flowPosition.y + 120,
          };

          let newNode: Node<FlowNodeData>;
          if (element.type === 'section') {
            const childSection = createSectionNode({
              sectionType: element.sectionType!,
              label: `${element.label}_${i + 1}`,
              position: basePosition,
            });
            newNode = {
              ...childSection,
              parentNode: newSection.id,
              extent: 'parent',
              position: {
                x: basePosition.x - flowPosition.x,
                y: basePosition.y - flowPosition.y,
              },
            };
          } else {
            const childLogic = createLogicNode({
              kind: element.nodeKind!,
              label: element.nodeKind === 'normal' ? `処理_${i + 1}` : element.nodeKind!,
              position: basePosition,
            });
            newNode = {
              ...childLogic,
              parentNode: newSection.id,
              extent: 'parent',
              position: {
                x: basePosition.x - flowPosition.x,
                y: basePosition.y - flowPosition.y,
              },
            };
          }

          createdNodes.push(newNode);

          if (i === 0) {
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

    if (nodeModalOption.kind === 'variable' || nodeModalOption.kind === 'type') {
      const newVariableNode = createVariableNode({
        operationType: variableForm.operationType,
        position: flowPosition,
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
        elementType: variableForm.elementType
          ? normalizeText(variableForm.elementType)
          : undefined,
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
        note: '',
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
    reactFlowInstance,
    setEdges,
    setNodeForm,
    setNodeModalOption,
    setNodes,
    setPendingNodeClientPosition,
    setVariableForm,
    updateParentSectionSize,
    variableForm,
  ]);

  const cancelNodeCreation = useCallback(() => {
    setPendingNodeClientPosition(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
  }, [setNodeForm, setNodeModalOption, setPendingNodeClientPosition]);

  const cancelNodeEdit = useCallback(() => {
    setPendingNodeEdit(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
  }, [setNodeForm, setNodeModalOption, setPendingNodeEdit]);

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
          const displayLabel = nextLabel.length > 0 ? nextLabel : CONTROL_STYLE.class.label;
          nextClassInstanceLabel = `new ${displayLabel}()`;
        }
      }

      return currentNodes.map((node) => {
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
  }, [
    nodeForm,
    nodeModalOption,
    pendingNodeEdit,
    setEdges,
    setNodeForm,
    setNodeModalOption,
    setNodes,
    setPendingNodeEdit,
  ]);

  const openNodeDeleteModal = useCallback(
    (node: Node<FlowNodeData>) => {
      setPendingConnection(null);
      setPendingNodeClientPosition(null);
      setPendingNodeEdit(null);
      setPendingEdgeEdit(null);
      setPendingMemoEdit(null);
      setPendingMemoClientPosition(null);
      setNodeModalOption(null);
      setNodeForm({ ...EMPTY_NODE_FORM });
      setPendingNodeDelete({ id: node.id, label: getNodeDisplayLabel(node) });
    },
    [
      setNodeForm,
      setNodeModalOption,
      setPendingConnection,
      setPendingEdgeEdit,
      setPendingMemoClientPosition,
      setPendingMemoEdit,
      setPendingNodeClientPosition,
      setPendingNodeDelete,
      setPendingNodeEdit,
    ]
  );

  const openNodeEditModal = useCallback(
    (node: Node<FlowNodeData>) => {
      setPendingConnection(null);
      setPendingNodeClientPosition(null);
      setPendingNodeDelete(null);
      setPendingEdgeEdit(null);
      setPendingMemoEdit(null);
      setPendingMemoClientPosition(null);
      setNodeModalOption(getNodeOptionForNode(node));
      setNodeForm(buildNodeFormFromNode(node));
      setPendingNodeEdit({ id: node.id });
    },
    [
      buildNodeFormFromNode,
      setNodeForm,
      setNodeModalOption,
      setPendingConnection,
      setPendingEdgeEdit,
      setPendingMemoClientPosition,
      setPendingMemoEdit,
      setPendingNodeClientPosition,
      setPendingNodeDelete,
      setPendingNodeEdit,
    ]
  );

  const deleteNodeById = useCallback(
    (nodeId: string) => {
      const removedIds = new Set([nodeId]);
      const removedNode = nodes.find((node) => node.id === nodeId);
      const removedIsSection = removedNode?.type === 'sectionNode';
      const removedIsClassSection =
        removedIsSection &&
        (removedNode?.data as SectionNodeData | undefined)?.sectionType === 'class';
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
        currentEdges.filter((edge) => !removedIds.has(edge.source) && !removedIds.has(edge.target))
      );
      setNodes((currentNodes) =>
        currentNodes
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
          })
      );

      setPendingNodeDelete(null);
      setPendingMemoEdit(null);
      setPendingMemoClientPosition(null);
      setMemoText('');

      if (parentSectionId) {
        setTimeout(() => {
          updateParentSectionSize(parentSectionId);
        }, 100);
      }
    },
    [
      nodes,
      setEdges,
      setMemoText,
      setNodes,
      setPendingMemoClientPosition,
      setPendingMemoEdit,
      setPendingNodeDelete,
      updateParentSectionSize,
    ]
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
      const edgeId = `edge-${nextEdgeSeqRef.current++}`;
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
    [createLogicNode, nextEdgeSeqRef, nodes, setEdges, setNodes]
  );

  return {
    createLogicNode,
    createSectionNode,
    createMemoNode,
    createStampNode,
    createVariableNode,
    openNodeModalAtClient,
    applyNodeCreation,
    cancelNodeCreation,
    cancelNodeEdit,
    applyNodeEdit,
    openNodeDeleteModal,
    openNodeEditModal,
    deleteNodeById,
    createClassInstance,
  };
}
