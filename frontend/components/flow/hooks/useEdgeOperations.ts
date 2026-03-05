import {
  useCallback,
  type ChangeEvent,
  type Dispatch,
  type MutableRefObject,
  type MouseEvent as ReactMouseEvent,
  type SetStateAction,
} from 'react';
import { addEdge, type Connection, type Edge, type Node, type XYPosition, MarkerType } from 'reactflow';

import {
  CONTROL_STYLE,
  DEFAULT_EDGE_CONTROL,
  EDGE_HIT_RADIUS,
  EDGE_STROKE_WIDTH,
  EMPTY_EDGE_FORM,
} from '../constants';
import type { EdgeControlType, EdgeFormState, FlowNodeData, LogicEdgeData } from '../types';
import {
  buildConditionForControl,
  buildEdgeLabel,
  ensureEdgeData,
  getHandlePoint,
  getNodeRect,
  isSectionEntryConnection,
  normalizeParallelOffsets,
  normalizeText,
} from '../utils';

type UseEdgeOperationsParams = {
  nodes: Node<FlowNodeData>[];
  edges: Edge<LogicEdgeData>[];
  setNodes: Dispatch<SetStateAction<Node<FlowNodeData>[]>>;
  setEdges: Dispatch<SetStateAction<Edge<LogicEdgeData>[]>>;
  pendingConnection: Connection | null;
  setPendingConnection: Dispatch<SetStateAction<Connection | null>>;
  pendingEdgeEdit: { id: string } | null;
  setPendingEdgeEdit: Dispatch<SetStateAction<{ id: string } | null>>;
  selectedEdgeControl: EdgeControlType;
  setSelectedEdgeControl: Dispatch<SetStateAction<EdgeControlType>>;
  edgeForm: EdgeFormState;
  setEdgeForm: Dispatch<SetStateAction<EdgeFormState>>;
  nextEdgeSeqRef: MutableRefObject<number>;
  setPendingNodeClientPosition: Dispatch<SetStateAction<XYPosition | null>>;
  setPendingNodeDelete: Dispatch<SetStateAction<{ id: string; label: string } | null>>;
  setPendingNodeEdit: Dispatch<SetStateAction<{ id: string } | null>>;
  setPendingMemoEdit: Dispatch<SetStateAction<{ id: string } | null>>;
  setPendingMemoClientPosition: Dispatch<SetStateAction<XYPosition | null>>;
};

export function useEdgeOperations({
  nodes,
  edges,
  setNodes,
  setEdges,
  pendingConnection,
  setPendingConnection,
  pendingEdgeEdit,
  setPendingEdgeEdit,
  selectedEdgeControl,
  setSelectedEdgeControl,
  edgeForm,
  setEdgeForm,
  nextEdgeSeqRef,
  setPendingNodeClientPosition,
  setPendingNodeDelete,
  setPendingNodeEdit,
  setPendingMemoEdit,
  setPendingMemoClientPosition,
}: UseEdgeOperationsParams) {
  const onConnect = useCallback(
    (params: Connection) => {
      if (isSectionEntryConnection(nodes, params)) {
        setPendingConnection(null);
        return;
      }
      setPendingNodeClientPosition(null);
      setPendingNodeDelete(null);
      setPendingNodeEdit(null);
      setPendingEdgeEdit(null);
      setPendingMemoEdit(null);
      setPendingMemoClientPosition(null);
      setSelectedEdgeControl(DEFAULT_EDGE_CONTROL);
      setEdgeForm({ ...EMPTY_EDGE_FORM });
      setPendingConnection(params);
    },
    [
      nodes,
      setEdgeForm,
      setPendingConnection,
      setPendingEdgeEdit,
      setPendingMemoClientPosition,
      setPendingMemoEdit,
      setPendingNodeClientPosition,
      setPendingNodeDelete,
      setPendingNodeEdit,
      setSelectedEdgeControl,
    ]
  );

  const onEdgeUpdate = useCallback(
    (oldEdge: Edge<LogicEdgeData>, newConnection: Connection) => {
      if (isSectionEntryConnection(nodes, newConnection)) {
        return;
      }
      setPendingNodeClientPosition(null);
      setPendingNodeDelete(null);
      setPendingNodeEdit(null);
      setPendingEdgeEdit(null);
      setEdges((currentEdges) =>
        normalizeParallelOffsets(
          currentEdges.map((edge) => {
            if (edge.id !== oldEdge.id) return edge;
            return {
              ...edge,
              source: newConnection.source ?? edge.source,
              target: newConnection.target ?? edge.target,
              sourceHandle: newConnection.sourceHandle ?? edge.sourceHandle,
              targetHandle: newConnection.targetHandle ?? edge.targetHandle,
            };
          })
        )
      );
    },
    [
      nodes,
      setEdges,
      setPendingEdgeEdit,
      setPendingNodeClientPosition,
      setPendingNodeDelete,
      setPendingNodeEdit,
    ]
  );

  const applyControlType = useCallback(
    (controlType: EdgeControlType) => {
      if (!pendingConnection?.source || !pendingConnection.target) {
        setPendingConnection(null);
        return;
      }
      const style = CONTROL_STYLE[controlType];
      const condition = buildConditionForControl(controlType, edgeForm);
      const note = normalizeText(edgeForm.note);
      const validations = edgeForm.validations.map((rule) => ({ ...rule }));
      const edgeId = `edge-${nextEdgeSeqRef.current++}`;
      const edge: Edge<LogicEdgeData> = {
        id: edgeId,
        type: 'logicEdge',
        source: pendingConnection.source,
        target: pendingConnection.target,
        sourceHandle: pendingConnection.sourceHandle ?? undefined,
        targetHandle: pendingConnection.targetHandle ?? undefined,
        label: buildEdgeLabel(controlType, condition, note, validations),
        style: {
          stroke: style.color,
          strokeWidth: EDGE_STROKE_WIDTH,
          strokeDasharray: style.edgeDash,
          zIndex: 1000,
        },
        markerEnd: { type: MarkerType.ArrowClosed, color: style.color },
        data: { controlType, condition, note, validations, parallelOffset: 0 },
      };

      setEdges((currentEdges) => normalizeParallelOffsets(addEdge(edge, currentEdges)));
      if (controlType !== 'flow') {
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.id === pendingConnection.source || node.id === pendingConnection.target) {
              if (node.type !== 'logicNode') return node;
              return {
                ...node,
                data: { ...node.data, controlType },
              };
            }
            return node;
          })
        );
      }
      setPendingConnection(null);
    },
    [edgeForm, nextEdgeSeqRef, pendingConnection, setEdges, setNodes, setPendingConnection]
  );

  const findEdgeNearPointInSection = useCallback(
    (sectionId: string, point: XYPosition): Edge<LogicEdgeData> | null => {
      const nodeMap = new Map(nodes.map((node) => [node.id, node]));
      let closest: Edge<LogicEdgeData> | null = null;
      let bestDistance = EDGE_HIT_RADIUS + 1;
      const isInSection = (node?: Node<FlowNodeData>) =>
        Boolean(node) && (node?.id === sectionId || node?.parentNode === sectionId);

      edges.forEach((edge) => {
        const sourceNode = nodeMap.get(edge.source);
        const targetNode = nodeMap.get(edge.target);
        if (!isInSection(sourceNode) || !isInSection(targetNode)) return;
        if (!sourceNode || !targetNode) return;
        const sourceRect = getNodeRect(sourceNode);
        const targetRect = getNodeRect(targetNode);
        if (!sourceRect || !targetRect) return;
        const sourcePoint = getHandlePoint(sourceRect, edge.sourceHandle);
        const targetPoint = getHandlePoint(targetRect, edge.targetHandle);
        const mid = {
          x: (sourcePoint.x + targetPoint.x) / 2,
          y: (sourcePoint.y + targetPoint.y) / 2,
        };
        const distance = Math.hypot(point.x - mid.x, point.y - mid.y);
        if (distance <= EDGE_HIT_RADIUS && distance < bestDistance) {
          bestDistance = distance;
          closest = edge;
        }
      });

      return closest;
    },
    [edges, nodes]
  );

  const openEdgeEditModal = useCallback(
    (edge: Edge<LogicEdgeData>) => {
      const edgeData = ensureEdgeData(edge);
      setPendingNodeClientPosition(null);
      setPendingNodeDelete(null);
      setPendingConnection(null);
      setPendingNodeEdit(null);
      setPendingMemoEdit(null);
      setPendingMemoClientPosition(null);
      setSelectedEdgeControl(edgeData.controlType ?? DEFAULT_EDGE_CONTROL);
      setEdgeForm({
        condition: edgeData.condition ?? '',
        note: edgeData.note ?? '',
        validations: edgeData.validations?.map((rule) => ({ ...rule })) ?? [],
      });
      setPendingEdgeEdit({ id: edge.id });
    },
    [
      setEdgeForm,
      setPendingConnection,
      setPendingEdgeEdit,
      setPendingMemoClientPosition,
      setPendingMemoEdit,
      setPendingNodeClientPosition,
      setPendingNodeDelete,
      setPendingNodeEdit,
      setSelectedEdgeControl,
    ]
  );

  const onEdgeDoubleClick = useCallback(
    (event: ReactMouseEvent, edge: Edge<LogicEdgeData>) => {
      event.preventDefault();
      event.stopPropagation();
      openEdgeEditModal(edge);
    },
    [openEdgeEditModal]
  );

  const openEdgeEditModalById = useCallback(
    (edgeId: string) => {
      const edge = edges.find((item) => item.id === edgeId);
      if (!edge) return;
      openEdgeEditModal(edge);
    },
    [edges, openEdgeEditModal]
  );

  const deleteEdgeById = useCallback(
    (edgeId: string) => {
      setEdges((currentEdges) =>
        normalizeParallelOffsets(currentEdges.filter((edge) => edge.id !== edgeId))
      );
      setPendingEdgeEdit(null);
    },
    [setEdges, setPendingEdgeEdit]
  );

  const updateEdgeControl = useCallback(
    (edgeId: string, controlType: EdgeControlType) => {
      const style = CONTROL_STYLE[controlType];
      const condition = buildConditionForControl(controlType, edgeForm);
      const note = normalizeText(edgeForm.note);
      const validations = edgeForm.validations.map((rule) => ({ ...rule }));
      setEdges((currentEdges) =>
        currentEdges.map((edge) => {
          if (edge.id !== edgeId) return edge;
          return {
            ...edge,
            type: 'logicEdge',
            label: buildEdgeLabel(controlType, condition, note, validations),
            style: {
              ...edge.style,
              stroke: style.color,
              strokeWidth: EDGE_STROKE_WIDTH,
              strokeDasharray: style.edgeDash,
              zIndex: 1000,
            },
            markerEnd: { type: MarkerType.ArrowClosed, color: style.color },
            data: { ...ensureEdgeData(edge), controlType, condition, note, validations },
          };
        })
      );
    },
    [edgeForm, setEdges]
  );

  const onEdgeControlChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      setSelectedEdgeControl(event.target.value as EdgeControlType);
    },
    [setSelectedEdgeControl]
  );

  const closeEdgeModal = useCallback(() => {
    setPendingConnection(null);
    setPendingEdgeEdit(null);
  }, [setPendingConnection, setPendingEdgeEdit]);

  const applySelectedControl = useCallback(() => {
    if (pendingConnection) {
      applyControlType(selectedEdgeControl);
      return;
    }
    if (pendingEdgeEdit) {
      updateEdgeControl(pendingEdgeEdit.id, selectedEdgeControl);
      setPendingEdgeEdit(null);
    }
  }, [
    applyControlType,
    pendingConnection,
    pendingEdgeEdit,
    selectedEdgeControl,
    setPendingEdgeEdit,
    updateEdgeControl,
  ]);

  return {
    onConnect,
    onEdgeUpdate,
    findEdgeNearPointInSection,
    openEdgeEditModal,
    onEdgeDoubleClick,
    openEdgeEditModalById,
    deleteEdgeById,
    updateEdgeControl,
    onEdgeControlChange,
    closeEdgeModal,
    applySelectedControl,
  };
}
