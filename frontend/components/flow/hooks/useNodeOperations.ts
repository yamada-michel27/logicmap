import {
  useCallback,
  type Dispatch,
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

import { useNodeCreationActions } from './useNodeCreationActions';
import { useNodeEditingActions } from './useNodeEditingActions';
import {
  buildLogicNode,
  buildMemoNode,
  buildSectionNode,
  buildStampNode,
  buildVariableNode,
  type CreateLogicNodeParams,
  type CreateMemoNodeParams,
  type CreateSectionNodeParams,
  type CreateStampNodeParams,
  type CreateVariableNodeParams,
} from '../services/nodeFactoryService';
import type {
  FlowNodeData,
  LogicEdgeData,
  LogicNodeData,
  NodeFormState,
  NodeOption,
  StampType,
  VariableNodeData,
  MemoNodeData,
  SectionNodeData,
  StampNodeData,
} from '../types';

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
    (params: CreateLogicNodeParams): Node<LogicNodeData> =>
      buildLogicNode(nextNodeSeqRef.current++, params),
    [nextNodeSeqRef]
  );

  const createSectionNode = useCallback(
    (params: CreateSectionNodeParams): Node<SectionNodeData> =>
      buildSectionNode(nextNodeSeqRef.current++, params),
    [nextNodeSeqRef]
  );

  const createMemoNode = useCallback(
    (params: CreateMemoNodeParams): Node<MemoNodeData> =>
      buildMemoNode(nextNodeSeqRef.current++, params),
    [nextNodeSeqRef]
  );

  const createStampNode = useCallback(
    (params: CreateStampNodeParams): Node<StampNodeData> =>
      buildStampNode(nextNodeSeqRef.current++, params),
    [nextNodeSeqRef]
  );

  const createVariableNode = useCallback(
    (params: CreateVariableNodeParams): Node<VariableNodeData> =>
      buildVariableNode(nextNodeSeqRef.current++, params),
    [nextNodeSeqRef]
  );

  const {
    openNodeModalAtClient,
    applyNodeCreation,
    cancelNodeCreation,
  } = useNodeCreationActions({
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
  });

  const {
    cancelNodeEdit,
    applyNodeEdit,
    openNodeDeleteModal,
    openNodeEditModal,
    deleteNodeById,
    createClassInstance,
  } = useNodeEditingActions({
    nodes,
    setNodes,
    setEdges,
    nextEdgeSeqRef,
    setPendingConnection,
    setPendingNodeClientPosition,
    setPendingMemoClientPosition,
    setPendingNodeDelete,
    pendingNodeEdit,
    setPendingNodeEdit,
    setPendingMemoEdit,
    setPendingEdgeEdit,
    nodeModalOption,
    setNodeModalOption,
    nodeForm,
    setNodeForm,
    setMemoText,
    updateParentSectionSize,
    buildNodeFormFromNode,
    createLogicNode,
  });

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
