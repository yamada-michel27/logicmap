import {
  useCallback,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { MarkerType, type Edge, type Node, type ReactFlowInstance } from 'reactflow';

import { CONTROL_STYLE } from '../constants';
import type {
  FlowNodeData,
  LogicEdgeData,
  LogicNodeData,
  SectionNodeData,
  TemplateType,
} from '../types';
import { normalizeParallelOffsets } from '../utils';

type UseTemplatesParams = {
  wrapperRef: MutableRefObject<HTMLDivElement | null>;
  reactFlowInstance: MutableRefObject<ReactFlowInstance | null>;
  createLogicNode: (params: {
    kind: LogicNodeData['nodeKind'];
    label: string;
    position: { x: number; y: number };
    controlType?: LogicNodeData['controlType'];
    condition?: string;
    note?: string;
    instanceOfSectionId?: string;
  }) => Node<LogicNodeData>;
  createSectionNode: (params: {
    sectionType: SectionNodeData['sectionType'];
    label: string;
    position: { x: number; y: number };
    note?: string;
    entryNodeId?: string;
    functionArgs?: SectionNodeData['functionArgs'];
    functionReturnType?: string;
    functionReturnValue?: string;
    loopCondition?: string;
    catchException?: string;
    classConstructorArgs?: SectionNodeData['classConstructorArgs'];
    classMembers?: SectionNodeData['classMembers'];
    classMethods?: SectionNodeData['classMethods'];
    interfaceMembers?: SectionNodeData['interfaceMembers'];
    interfaceMethods?: SectionNodeData['interfaceMethods'];
    validations?: SectionNodeData['validations'];
    style?: { width?: number; height?: number };
  }) => Node<SectionNodeData>;
  calculateSectionSize: (
    nodes: Array<{ position: { x: number; y: number } }>,
    nodeWidth?: number,
    nodeHeight?: number,
    padding?: number,
    bottomPadding?: number
  ) => { width: number; height: number };
  setNodes: Dispatch<SetStateAction<Node<FlowNodeData>[]>>;
  setEdges: Dispatch<SetStateAction<Edge<LogicEdgeData>[]>>;
  nextEdgeSeqRef: MutableRefObject<number>;
  setIsTemplateModalOpen: Dispatch<SetStateAction<boolean>>;
};

export function useTemplates({
  wrapperRef,
  reactFlowInstance,
  createLogicNode,
  createSectionNode,
  calculateSectionSize,
  setNodes,
  setEdges,
  nextEdgeSeqRef,
  setIsTemplateModalOpen,
}: UseTemplatesParams) {
  const applyTemplate = useCallback(
    (templateId: TemplateType) => {
      const wrapper = wrapperRef.current;
      const instance = reactFlowInstance.current;
      if (!wrapper || !instance) return;

      const viewportCenter = {
        x: wrapper.clientWidth / 2,
        y: wrapper.clientHeight / 2,
      };
      const flowCenter = instance.screenToFlowPosition(viewportCenter);

      if (templateId === 'dfs') {
        const SECTION_MARGIN = 300;
        const NODE_MARGIN = 150;
        const SECTION_TO_NODE_MARGIN = 200;

        const startNode = createLogicNode({
          kind: 'start',
          label: 'Start',
          position: { x: flowCenter.x, y: flowCenter.y - 600 },
        });

        const functionCallNode = createLogicNode({
          kind: 'normal',
          label: 'DFS関数呼び出し',
          position: { x: flowCenter.x, y: flowCenter.y - 600 },
        });

        const dfsFunctionNodes = [
          { position: { x: 200, y: 60 }, label: 'visited = new Set()' },
          { position: { x: 200, y: 60 + NODE_MARGIN }, label: 'result = []' },
          { position: { x: 200, y: 60 + NODE_MARGIN * 2 }, label: 'stack = [startNode]' },
          { position: { x: 200, y: 60 + NODE_MARGIN * 6 }, label: 'return result' },
        ];

        const dfsFunctionSize = calculateSectionSize(dfsFunctionNodes);
        const dfsFunctionX = flowCenter.x - dfsFunctionSize.width / 2;
        const dfsFunctionY = flowCenter.y - 400;
        const dfsFunction = createSectionNode({
          sectionType: 'function',
          label: 'dfs(graph: Graph, startNode: Node) -> Array<Node>',
          position: { x: dfsFunctionX, y: dfsFunctionY },
          style: dfsFunctionSize,
        });

        const initVisitedNode = createLogicNode({
          kind: 'normal',
          label: 'visited = new Set()',
          position: { x: 200, y: 60 },
          instanceOfSectionId: dfsFunction.id,
        });
        initVisitedNode.parentNode = dfsFunction.id;
        initVisitedNode.extent = 'parent';

        const initResultNode = createLogicNode({
          kind: 'normal',
          label: 'result = []',
          position: { x: 200, y: 60 + NODE_MARGIN },
          instanceOfSectionId: dfsFunction.id,
        });
        initResultNode.parentNode = dfsFunction.id;
        initResultNode.extent = 'parent';

        const initStackNode = createLogicNode({
          kind: 'normal',
          label: 'stack = [startNode]',
          position: { x: 200, y: 60 + NODE_MARGIN * 2 },
          instanceOfSectionId: dfsFunction.id,
        });
        initStackNode.parentNode = dfsFunction.id;
        initStackNode.extent = 'parent';

        const whileSectionNodes = [
          { position: { x: 200, y: 60 }, label: 'current = stack.pop()' },
          { position: { x: 200, y: 60 + NODE_MARGIN }, label: 'if (!visited.has(current))' },
          { position: { x: 200, y: 60 + NODE_MARGIN * 2 }, label: 'visited.add(current)' },
          { position: { x: 200, y: 60 + NODE_MARGIN * 3 }, label: 'result.push(current)' },
          { position: { x: 200, y: 60 + NODE_MARGIN * 4 }, label: 'neighbors = graph[current]' },
          { position: { x: 200, y: 60 + NODE_MARGIN * 5 }, label: 'for neighbor in neighbors' },
          { position: { x: 200, y: 60 + NODE_MARGIN * 6 }, label: 'if (!visited.has(neighbor))' },
          { position: { x: 200, y: 60 + NODE_MARGIN * 7 }, label: 'stack.push(neighbor)' },
        ];

        const whileSectionSize = calculateSectionSize(whileSectionNodes);
        const whileSectionX = flowCenter.x - whileSectionSize.width / 2;
        const whileSectionY = dfsFunctionY + dfsFunctionSize.height + SECTION_MARGIN;
        const whileSection = createSectionNode({
          sectionType: 'while',
          label: 'while (stack.length > 0)',
          position: { x: whileSectionX, y: whileSectionY },
          loopCondition: 'stack.length > 0',
          style: whileSectionSize,
        });

        const popNode = createLogicNode({
          kind: 'normal',
          label: 'current = stack.pop()',
          position: { x: 200, y: 60 },
          instanceOfSectionId: whileSection.id,
        });
        popNode.parentNode = whileSection.id;
        popNode.extent = 'parent';

        const visitedCheckIf = createLogicNode({
          kind: 'normal',
          label: 'if (!visited.has(current))',
          position: { x: 200, y: 60 + NODE_MARGIN },
          instanceOfSectionId: whileSection.id,
        });
        visitedCheckIf.parentNode = whileSection.id;
        visitedCheckIf.extent = 'parent';

        const markVisitedNode = createLogicNode({
          kind: 'normal',
          label: 'visited.add(current)',
          position: { x: 200, y: 60 + NODE_MARGIN * 2 },
          instanceOfSectionId: whileSection.id,
        });
        markVisitedNode.parentNode = whileSection.id;
        markVisitedNode.extent = 'parent';

        const addToResultNode = createLogicNode({
          kind: 'normal',
          label: 'result.push(current)',
          position: { x: 200, y: 60 + NODE_MARGIN * 3 },
          instanceOfSectionId: whileSection.id,
        });
        addToResultNode.parentNode = whileSection.id;
        addToResultNode.extent = 'parent';

        const getNeighborsNode = createLogicNode({
          kind: 'normal',
          label: 'neighbors = graph[current]',
          position: { x: 200, y: 60 + NODE_MARGIN * 4 },
          instanceOfSectionId: whileSection.id,
        });
        getNeighborsNode.parentNode = whileSection.id;
        getNeighborsNode.extent = 'parent';

        const forLoopNode = createLogicNode({
          kind: 'normal',
          label: 'for neighbor in neighbors',
          position: { x: 200, y: 60 + NODE_MARGIN * 5 },
          instanceOfSectionId: whileSection.id,
        });
        forLoopNode.parentNode = whileSection.id;
        forLoopNode.extent = 'parent';

        const neighborCheckNode = createLogicNode({
          kind: 'normal',
          label: 'if (!visited.has(neighbor))',
          position: { x: 200, y: 60 + NODE_MARGIN * 6 },
          instanceOfSectionId: whileSection.id,
        });
        neighborCheckNode.parentNode = whileSection.id;
        neighborCheckNode.extent = 'parent';

        const pushNeighborNode = createLogicNode({
          kind: 'normal',
          label: 'stack.push(neighbor)',
          position: { x: 200, y: 60 + NODE_MARGIN * 7 },
          instanceOfSectionId: whileSection.id,
        });
        pushNeighborNode.parentNode = whileSection.id;
        pushNeighborNode.extent = 'parent';

        const returnNode = createLogicNode({
          kind: 'normal',
          label: 'return result',
          position: { x: 200, y: 60 + NODE_MARGIN * 6 },
          instanceOfSectionId: dfsFunction.id,
        });
        returnNode.parentNode = dfsFunction.id;
        returnNode.extent = 'parent';

        const resultReceiveNode = createLogicNode({
          kind: 'normal',
          label: 'result = DFS結果受け取り',
          position: { x: flowCenter.x, y: whileSectionY + whileSectionSize.height + SECTION_TO_NODE_MARGIN * 1.5 },
        });

        const endNode = createLogicNode({
          kind: 'end',
          label: 'End',
          position: { x: flowCenter.x, y: whileSectionY + whileSectionSize.height + SECTION_TO_NODE_MARGIN * 2 },
        });

        const newNodes = [
          startNode, functionCallNode, dfsFunction, initVisitedNode, initResultNode, initStackNode,
          whileSection, popNode, visitedCheckIf, markVisitedNode, addToResultNode,
          getNeighborsNode, forLoopNode, neighborCheckNode, pushNeighborNode,
          returnNode, resultReceiveNode, endNode,
        ];

        const flowStyle = { ...CONTROL_STYLE.flow, zIndex: 1000 };
        const newEdges: Edge<LogicEdgeData>[] = [
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: startNode.id,
            target: functionCallNode.id,
            sourceHandle: 'h-bottom',
            targetHandle: 'h-top',
            data: { controlType: 'flow', condition: '', note: 'graph, startNodeを準備', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: functionCallNode.id,
            target: dfsFunction.id,
            sourceHandle: 'h-bottom',
            targetHandle: 'section-h-top',
            data: { controlType: 'flow', condition: '', note: '引数: graph, startNode', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: initVisitedNode.id,
            target: initResultNode.id,
            sourceHandle: 'h-bottom',
            targetHandle: 'h-top',
            data: { controlType: 'flow', condition: '', note: '', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: initResultNode.id,
            target: initStackNode.id,
            sourceHandle: 'h-bottom',
            targetHandle: 'h-top',
            data: { controlType: 'flow', condition: '', note: '', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: initStackNode.id,
            target: whileSection.id,
            sourceHandle: 'h-bottom',
            targetHandle: 'section-h-top',
            data: { controlType: 'flow', condition: '', note: '', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: popNode.id,
            target: visitedCheckIf.id,
            sourceHandle: 'h-bottom',
            targetHandle: 'h-top',
            data: { controlType: 'flow', condition: '', note: '① スタックからノードを取り出し', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: visitedCheckIf.id,
            target: markVisitedNode.id,
            sourceHandle: 'h-bottom',
            targetHandle: 'h-top',
            data: { controlType: 'flow', condition: '', note: '② 未訪問の場合、visitedに追加', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: markVisitedNode.id,
            target: addToResultNode.id,
            sourceHandle: 'h-bottom',
            targetHandle: 'h-top',
            data: { controlType: 'flow', condition: '', note: '③ 結果リストに追加', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: addToResultNode.id,
            target: getNeighborsNode.id,
            sourceHandle: 'h-bottom',
            targetHandle: 'h-top',
            data: { controlType: 'flow', condition: '', note: '④ 隣接ノード取得', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: getNeighborsNode.id,
            target: forLoopNode.id,
            sourceHandle: 'h-bottom',
            targetHandle: 'h-top',
            data: { controlType: 'flow', condition: '', note: '⑤ 各隣接ノードをチェック', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: forLoopNode.id,
            target: neighborCheckNode.id,
            sourceHandle: 'h-bottom',
            targetHandle: 'h-top',
            data: { controlType: 'flow', condition: '', note: '⑤ 各隣接ノードが未訪問かチェック', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: neighborCheckNode.id,
            target: pushNeighborNode.id,
            sourceHandle: 'h-bottom',
            targetHandle: 'h-top',
            data: { controlType: 'flow', condition: '', note: '⑥ 未訪問ならスタックに追加', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: initStackNode.id,
            target: returnNode.id,
            sourceHandle: 'h-right',
            targetHandle: 'h-left',
            data: { controlType: 'flow', condition: 'ループ完了後', note: 'While終了→return', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: dfsFunction.id,
            target: resultReceiveNode.id,
            sourceHandle: 'section-h-bottom',
            targetHandle: 'h-top',
            data: { controlType: 'flow', condition: '', note: '戻り値: result配列', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: resultReceiveNode.id,
            target: endNode.id,
            sourceHandle: 'h-bottom',
            targetHandle: 'h-top',
            data: { controlType: 'flow', condition: '', note: 'DFS処理完了', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: visitedCheckIf.id,
            target: popNode.id,
            sourceHandle: 'h-right',
            targetHandle: 'h-left',
            data: { controlType: 'if', condition: 'visited.has(current) === true', note: '既に訪問済み→スキップ', validations: [], parallelOffset: 0 },
            style: CONTROL_STYLE.if,
            markerEnd: { type: MarkerType.ArrowClosed, color: CONTROL_STYLE.if.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: neighborCheckNode.id,
            target: forLoopNode.id,
            sourceHandle: 'h-right',
            targetHandle: 'h-left',
            data: { controlType: 'if', condition: 'visited.has(neighbor) === true', note: '訪問済み→次のneighbor', validations: [], parallelOffset: 0 },
            style: CONTROL_STYLE.if,
            markerEnd: { type: MarkerType.ArrowClosed, color: CONTROL_STYLE.if.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: pushNeighborNode.id,
            target: forLoopNode.id,
            sourceHandle: 'h-right',
            targetHandle: 'h-left',
            data: { controlType: 'flow', condition: '', note: '次のneighborを処理', validations: [], parallelOffset: 0 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
          {
            id: `edge-${nextEdgeSeqRef.current++}`,
            type: 'logicEdge',
            source: forLoopNode.id,
            target: popNode.id,
            sourceHandle: 'h-bottom',
            targetHandle: 'h-bottom',
            data: { controlType: 'flow', condition: 'forループ終了', note: '次のstack要素を処理', validations: [], parallelOffset: 1 },
            style: flowStyle,
            markerEnd: { type: MarkerType.ArrowClosed, color: flowStyle.color },
          },
        ];

        setNodes((prev) => [...prev, ...newNodes]);
        setEdges((prev) => normalizeParallelOffsets([...prev, ...newEdges]));
      }

      setIsTemplateModalOpen(false);
    },
    [
      calculateSectionSize,
      createLogicNode,
      createSectionNode,
      nextEdgeSeqRef,
      reactFlowInstance,
      setEdges,
      setIsTemplateModalOpen,
      setNodes,
      wrapperRef,
    ]
  );

  return {
    applyTemplate,
  };
}
