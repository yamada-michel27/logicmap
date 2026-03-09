import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import {
  addEdge,
  MarkerType,
  type Connection,
  type Edge,
  type Node,
  type XYPosition,
} from 'reactflow';

import {
  CONTROL_STYLE,
  EDGE_STROKE_WIDTH,
  EMPTY_NODE_FORM,
  INSTANCE_OFFSET_X,
  INSTANCE_OFFSET_Y,
  SECTION_DEFAULT_HEIGHT,
  SECTION_DEFAULT_WIDTH,
} from '../constants';
import {
  buildLogicNodeData,
  buildSectionNodeData,
  type CreateLogicNodeParams,
} from '../services/nodeFactoryService';
import type {
  FlowNodeData,
  LogicEdgeData,
  LogicNodeData,
  NodeFormState,
  NodeOption,
  SectionNodeData,
} from '../types';
import {
  buildClassInstanceLabel,
  buildEdgeLabel,
  getNodeDisplayLabel,
  getNodeOptionForNode,
} from '../utils';

type Params = {
  nodes: Node<FlowNodeData>[];
  setNodes: Dispatch<SetStateAction<Node<FlowNodeData>[]>>;
  setEdges: Dispatch<SetStateAction<Edge<LogicEdgeData>[]>>;
  nextEdgeSeqRef: MutableRefObject<number>;
  setPendingConnection: Dispatch<SetStateAction<Connection | null>>;
  setPendingNodeClientPosition: Dispatch<SetStateAction<XYPosition | null>>;
  setPendingMemoClientPosition: Dispatch<SetStateAction<XYPosition | null>>;
  setPendingNodeDelete: Dispatch<SetStateAction<{ id: string; label: string } | null>>;
  pendingNodeEdit: { id: string } | null;
  setPendingNodeEdit: Dispatch<SetStateAction<{ id: string } | null>>;
  setPendingMemoEdit: Dispatch<SetStateAction<{ id: string } | null>>;
  setPendingEdgeEdit: Dispatch<SetStateAction<{ id: string } | null>>;
  nodeModalOption: NodeOption | null;
  setNodeModalOption: Dispatch<SetStateAction<NodeOption | null>>;
  nodeForm: NodeFormState;
  setNodeForm: Dispatch<SetStateAction<NodeFormState>>;
  setMemoText: Dispatch<SetStateAction<string>>;
  updateParentSectionSize: (parentSectionId: string) => void;
  buildNodeFormFromNode: (node: Node<FlowNodeData>) => NodeFormState;
  createLogicNode: (params: CreateLogicNodeParams) => Node<LogicNodeData>;
};

export function useNodeEditingActions({
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
}: Params) {
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
          const nextLabel = nodeForm.label.trim();
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

            return {
              ...node,
              type: 'sectionNode',
              parentNode: undefined,
              extent: undefined,
              position: absolutePos,
              style: { width, height },
              data: buildSectionNodeData(targetSeq, sectionType, nodeForm),
            };
          }

          const data = node.data as LogicNodeData;
          const keepParent = !targetIsSection;

          return {
            ...node,
            type: 'logicNode',
            parentNode: keepParent ? node.parentNode : undefined,
            extent: keepParent ? node.extent : undefined,
            position: keepParent ? node.position : absolutePos,
            style: keepParent ? node.style : undefined,
            data: buildLogicNodeData(targetSeq, nodeModalOption, nodeForm, {
              controlType: data.controlType,
              instanceOfSectionId: data.instanceOfSectionId,
            }),
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
      const instanceNode = createLogicNode({
        kind: 'normal',
        label: buildClassInstanceLabel(classNode),
        position: {
          x: classPosition.x - INSTANCE_OFFSET_X,
          y: classPosition.y + instanceCount * INSTANCE_OFFSET_Y,
        },
        controlType: 'class',
        instanceOfSectionId: classNode.id,
      });
      setNodes((currentNodes) => [...currentNodes, instanceNode]);

      const style = CONTROL_STYLE.flow;
      const edge: Edge<LogicEdgeData> = {
        id: `edge-${nextEdgeSeqRef.current++}`,
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
    cancelNodeEdit,
    applyNodeEdit,
    openNodeDeleteModal,
    openNodeEditModal,
    deleteNodeById,
    createClassInstance,
  };
}
