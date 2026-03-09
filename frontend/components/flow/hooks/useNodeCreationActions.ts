import {
  useCallback,
  type Dispatch,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type {
  Connection,
  Edge,
  Node,
  ReactFlowInstance,
  XYPosition,
} from 'reactflow';

import { EMPTY_NODE_FORM } from '../constants';
import { createDefaultVariableForm } from '../services/flowInteractionService';
import {
  buildLogicNodeParams,
  buildSectionNodeParams,
  buildVariableNodeParams,
  type CreateLogicNodeParams,
  type CreateSectionNodeParams,
  type CreateVariableNodeParams,
} from '../services/nodeFactoryService';
import type {
  FlowNodeData,
  InnerElement,
  LogicEdgeData,
  LogicNodeData,
  NodeFormState,
  NodeOption,
  SectionNodeData,
  StampType,
  VariableNodeData,
} from '../types';
import {
  createEdge,
  findSectionAtPoint,
  getNodeRect,
  isEventFromNodeOrEdge,
} from '../utils';

type Params = {
  wrapperRef: MutableRefObject<HTMLDivElement | null>;
  reactFlowInstance: MutableRefObject<ReactFlowInstance | null>;
  pendingNodeClientPosition: XYPosition | null;
  setPendingConnection: Dispatch<SetStateAction<Connection | null>>;
  setPendingNodeClientPosition: Dispatch<SetStateAction<XYPosition | null>>;
  setPendingMemoClientPosition: Dispatch<SetStateAction<XYPosition | null>>;
  setPendingNodeDelete: Dispatch<SetStateAction<{ id: string; label: string } | null>>;
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
  setNodes: Dispatch<SetStateAction<Node<FlowNodeData>[]>>;
  setEdges: Dispatch<SetStateAction<Edge<LogicEdgeData>[]>>;
  updateParentSectionSize: (parentSectionId: string) => void;
  createLogicNode: (params: CreateLogicNodeParams) => Node<LogicNodeData>;
  createSectionNode: (params: CreateSectionNodeParams) => Node<SectionNodeData>;
  createVariableNode: (params: CreateVariableNodeParams) => Node<VariableNodeData>;
};

function createInnerElementNode(params: {
  element: InnerElement;
  index: number;
  total: number;
  flowPosition: XYPosition;
  parentSectionId: string;
  createLogicNode: (params: CreateLogicNodeParams) => Node<LogicNodeData>;
  createSectionNode: (params: CreateSectionNodeParams) => Node<SectionNodeData>;
}): Node<FlowNodeData> {
  const {
    element,
    index,
    total,
    flowPosition,
    parentSectionId,
    createLogicNode,
    createSectionNode,
  } = params;
  const basePosition = {
    x: flowPosition.x + index * 150 - (total - 1) * 75,
    y: flowPosition.y + 120,
  };

  if (element.type === 'section') {
    const childSection = createSectionNode({
      sectionType: element.sectionType!,
      label: `${element.label}_${index + 1}`,
      position: basePosition,
    });

    return {
      ...childSection,
      parentNode: parentSectionId,
      extent: 'parent',
      position: {
        x: basePosition.x - flowPosition.x,
        y: basePosition.y - flowPosition.y,
      },
    };
  }

  const childLogic = createLogicNode({
    kind: element.nodeKind!,
    label: element.nodeKind === 'normal' ? `処理_${index + 1}` : element.nodeKind!,
    position: basePosition,
  });

  return {
    ...childLogic,
    parentNode: parentSectionId,
    extent: 'parent',
    position: {
      x: basePosition.x - flowPosition.x,
      y: basePosition.y - flowPosition.y,
    },
  };
}

export function useNodeCreationActions({
  wrapperRef,
  reactFlowInstance,
  pendingNodeClientPosition,
  setPendingConnection,
  setPendingNodeClientPosition,
  setPendingMemoClientPosition,
  setPendingNodeDelete,
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
  setNodes,
  setEdges,
  updateParentSectionSize,
  createLogicNode,
  createSectionNode,
  createVariableNode,
}: Params) {
  const resetNodeCreationState = useCallback(() => {
    setPendingNodeClientPosition(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
  }, [setNodeForm, setNodeModalOption, setPendingNodeClientPosition]);

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

      const newSection = createSectionNode(
        buildSectionNodeParams(nodeModalOption.sectionType, nodeForm, flowPosition)
      );
      const createdNodes: Node<FlowNodeData>[] = [newSection];
      const createdEdges: Edge<LogicEdgeData>[] = [];

      if (nodeForm.innerElements.length > 0) {
        const sortedElements = [...nodeForm.innerElements].sort((a, b) => a.order - b.order);
        let previousNodeId = newSection.id;

        for (let index = 0; index < sortedElements.length; index += 1) {
          const element = sortedElements[index];
          const newNode = createInnerElementNode({
            element,
            index,
            total: sortedElements.length,
            flowPosition,
            parentSectionId: newSection.id,
            createLogicNode,
            createSectionNode,
          });

          createdNodes.push(newNode);

          if (index === 0) {
            if (nodeForm.entryNodeId.trim()) {
              createdEdges.push(
                createEdge({
                  source: nodeForm.entryNodeId.trim(),
                  target: newNode.id,
                  controlType: 'flow',
                })
              );
            }
          } else {
            createdEdges.push(
              createEdge({
                source: previousNodeId,
                target: newNode.id,
                controlType: 'flow',
              })
            );
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

      resetNodeCreationState();
      return;
    }

    if (nodeModalOption.kind === 'variable' || nodeModalOption.kind === 'type') {
      const newVariableNode = createVariableNode(
        buildVariableNodeParams(variableForm, flowPosition)
      );

      setNodes((currentNodes) => [...currentNodes, newVariableNode]);
      resetNodeCreationState();
      setVariableForm(createDefaultVariableForm());
      return;
    }

    const sectionNodes = instance
      .getNodes()
      .filter((node): node is Node<SectionNodeData> => node.type === 'sectionNode');
    const parentSection = findSectionAtPoint(flowPosition, sectionNodes);
    const baseNode = createLogicNode(buildLogicNodeParams(nodeModalOption, nodeForm, flowPosition));
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
    resetNodeCreationState();
  }, [
    createLogicNode,
    createSectionNode,
    createVariableNode,
    nodeForm,
    nodeModalOption,
    pendingNodeClientPosition,
    reactFlowInstance,
    resetNodeCreationState,
    setEdges,
    setNodes,
    setPendingNodeClientPosition,
    setVariableForm,
    updateParentSectionSize,
    variableForm,
  ]);

  const cancelNodeCreation = useCallback(() => {
    resetNodeCreationState();
  }, [resetNodeCreationState]);

  return {
    openNodeModalAtClient,
    applyNodeCreation,
    cancelNodeCreation,
  };
}
