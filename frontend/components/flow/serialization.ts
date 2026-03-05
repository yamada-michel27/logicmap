import type { Node, Edge } from 'reactflow';

import type {
  FlowNodeData,
  LogicNodeData,
  SectionNodeData,
  MemoNodeData,
  StampNodeData,
  TypeNodeData,
  LogicEdgeData,
  StoredNode,
  StoredEdge,
} from './types';
import { DEFAULT_EDGE_CONTROL } from './constants';
import { cloneJson, ensureEdgeData } from './utils';

export function serializeNode(node: Node<FlowNodeData>): StoredNode {
  let data: FlowNodeData;
  if (node.type === 'stampNode') {
    const stampData = node.data as StampNodeData;
    data = { stamp: stampData.stamp, seq: stampData.seq };
  } else if (node.type === 'memoNode') {
    const memoData = node.data as MemoNodeData;
    data = { text: memoData.text, seq: memoData.seq };
  } else if (node.type === 'typeNode') {
    const typeData = node.data as TypeNodeData;
    data = {
      operationType: typeData.operationType,
      pythonType: typeData.pythonType,
      seq: typeData.seq,
      variableName: typeData.variableName,
      initialValue: typeData.initialValue,
      elementType: typeData.elementType,
      keyType: typeData.keyType,
      valueType: typeData.valueType,
      innerType: typeData.innerType,
      unionTypes: typeData.unionTypes,
      note: typeData.note,
      genericParams: typeData.genericParams,
    };
  } else if (node.type === 'logicNode') {
    const logicData = node.data as LogicNodeData;
    data = {
      label: logicData.label,
      nodeKind: logicData.nodeKind,
      seq: logicData.seq,
      controlType: logicData.controlType,
      condition: logicData.condition,
      note: logicData.note,
      instanceOfSectionId: logicData.instanceOfSectionId,
    };
  } else {
    data = node.data as SectionNodeData;
  }
  return {
    id: node.id,
    type: node.type,
    position: { ...node.position },
    data: cloneJson(data),
    parentNode: node.parentNode,
    extent: node.extent,
    style: node.style ? { ...node.style } : undefined,
    width: node.width,
    height: node.height,
  };
}

export function serializeEdge(edge: Edge<LogicEdgeData>): StoredEdge {
  const data = ensureEdgeData(edge);
  return {
    id: edge.id,
    type: 'logicEdge',
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    data: cloneJson({
      controlType: data.controlType,
      condition: data.condition,
      note: data.note,
      validations: data.validations ?? [],
      parallelOffset: data.parallelOffset ?? 0,
    }),
  };
}

export function hydrateNode(node: StoredNode): Node<FlowNodeData> {
  return {
    ...node,
    position: { ...node.position },
    data: cloneJson(node.data),
    style: node.style ? { ...node.style } : undefined,
  };
}

export function hydrateEdge(edge: StoredEdge): Edge<LogicEdgeData> {
  const base = {
    ...edge,
    type: 'logicEdge',
    data: edge.data ?? { controlType: DEFAULT_EDGE_CONTROL },
  };
  return {
    ...base,
    data: ensureEdgeData(base as Edge<LogicEdgeData>),
  };
}

export function getNextNodeSeqFromNodes(nodes: StoredNode[]) {
  const maxSeq = nodes.reduce((max, node) => {
    const seq = (node.data as FlowNodeData).seq;
    return typeof seq === 'number' && seq > max ? seq : max;
  }, 0);
  return Math.max(1, maxSeq + 1);
}

export function getNextEdgeSeqFromEdges(edges: StoredEdge[]) {
  const maxSeq = edges.reduce((max, edge) => {
    const match = edge.id.match(/edge-(\d+)/);
    const seq = match ? Number(match[1]) : 0;
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return Math.max(1, maxSeq + 1);
}
