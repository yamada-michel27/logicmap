import {
  useCallback,
  useEffect,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import type { Edge, Node } from 'reactflow';

import { apiFetch } from '../api';
import { FLOW_STORAGE_VERSION } from '../constants';
import {
  getNextEdgeSeqFromEdges,
  getNextNodeSeqFromNodes,
  hydrateEdge,
  hydrateNode,
  serializeEdge,
  serializeNode,
} from '../serialization';
import type {
  FlowNodeData,
  FlowSnapshot,
  LogicEdgeData,
  LogicNodeData,
  MemoNodeData,
  SavedFlowDetail,
  SavedFlowSummary,
  SectionNodeData,
  StampNodeData,
  TypeNodeData,
} from '../types';
import { formatSaveLabel, normalizeParallelOffsets } from '../utils';

type UseFlowPersistenceParams = {
  nodes: Node<FlowNodeData>[];
  edges: Edge<LogicEdgeData>[];
  setNodes: Dispatch<SetStateAction<Node<FlowNodeData>[]>>;
  setEdges: Dispatch<SetStateAction<Edge<LogicEdgeData>[]>>;
  nextNodeSeq: MutableRefObject<number>;
  nextEdgeSeq: MutableRefObject<number>;
  resetTransientState: () => void;
  initialFlowId?: string | null;
};

type ParsedImportData = {
  nodes: Node<FlowNodeData>[];
  edges: Edge<LogicEdgeData>[];
  metadata?: { flowName?: string };
};

export function useFlowPersistence({
  nodes,
  edges,
  setNodes,
  setEdges,
  nextNodeSeq,
  nextEdgeSeq,
  resetTransientState,
  initialFlowId,
}: UseFlowPersistenceParams) {
  const [savedFlows, setSavedFlows] = useState<SavedFlowSummary[]>([]);
  const [isLoadingFlows, setIsLoadingFlows] = useState(false);
  const [isSavingFlow, setIsSavingFlow] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [exportedText, setExportedText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [currentFlowId, setCurrentFlowId] = useState<string | null>(null);
  const [currentFlowName, setCurrentFlowName] = useState<string | null>(null);

  const fetchSavedFlows = useCallback(async () => {
    setIsLoadingFlows(true);
    setSaveError(null);
    try {
      const list = await apiFetch<SavedFlowSummary[]>('/flows', { method: 'GET' });
      setSavedFlows(list ?? []);
    } catch {
      setSaveError('保存データの取得に失敗しました。');
    } finally {
      setIsLoadingFlows(false);
    }
  }, []);

  const updateFlow = useCallback(async () => {
    if (!currentFlowId) {
      return;
    }

    const snapshot = {
      nodes: nodes.map(serializeNode),
      edges: edges.map(serializeEdge),
      nextNodeSeq: nextNodeSeq.current,
      nextEdgeSeq: nextEdgeSeq.current,
    };

    try {
      await apiFetch<unknown>(`/flows/${currentFlowId}`, {
        method: 'PUT',
        body: JSON.stringify({ snapshot }),
      });
      await fetchSavedFlows();
    } catch (error) {
      console.error('上書き保存に失敗しました:', error);
    }
  }, [currentFlowId, edges, fetchSavedFlows, nextEdgeSeq, nextNodeSeq, nodes]);

  const saveCurrentFlow = useCallback(async () => {
    setIsSavingFlow(true);
    setSaveError(null);
    const now = new Date();
    const name = saveName.trim() || formatSaveLabel(now);
    const snapshot: FlowSnapshot = {
      version: FLOW_STORAGE_VERSION,
      nodes: nodes.map(serializeNode),
      edges: edges.map(serializeEdge),
      nextNodeSeq: nextNodeSeq.current,
      nextEdgeSeq: nextEdgeSeq.current,
    };
    try {
      const result = await apiFetch<SavedFlowSummary>('/flows', {
        method: 'POST',
        body: JSON.stringify({ name, snapshot }),
      });

      if (result) {
        setCurrentFlowId(result.id);
        setCurrentFlowName(result.name);
      }

      await fetchSavedFlows();
      setSaveName('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('limit_reached')) {
        setSaveError('保存件数が上限(30件)に達しました。削除してから保存してください。');
      } else {
        setSaveError('保存に失敗しました。');
      }
    } finally {
      setIsSavingFlow(false);
    }
  }, [edges, fetchSavedFlows, nextEdgeSeq, nextNodeSeq, nodes, saveName]);

  const generateFlowData = useCallback(() => {
    const exportData = {
      version: '2.0.0',
      format: 'LogicMap Flow Structure',
      exportedAt: new Date().toISOString(),
      metadata: {
        totalNodes: nodes.length,
        totalEdges: edges.length,
        flowName: currentFlowName || 'Untitled Flow',
      },
      nodes: nodes.map((node) => {
        const nodeData = node.data as FlowNodeData;
        const element = document.querySelector(`[data-id="${node.id}"]`);
        let actualWidth = node.width;
        let actualHeight = node.height;

        if (element && !actualWidth) {
          const rect = element.getBoundingClientRect();
          actualWidth = rect.width;
          actualHeight = rect.height;
        }

        const baseNode = {
          id: node.id,
          type: node.type,
          position: {
            x: node.position.x,
            y: node.position.y,
          },
          size: {
            width: actualWidth || (typeof node.style?.width === 'number' ? node.style.width : 160),
            height:
              actualHeight || (typeof node.style?.height === 'number' ? node.style.height : 80),
          },
          parentNode: node.parentNode || null,
          extent: node.extent || null,
          expandParent: node.expandParent || null,
          style: node.style || {},
          className: node.className || null,
          selected: node.selected || false,
          dragging: node.dragging || false,
        };

        if (node.type === 'logicNode') {
          const data = nodeData as LogicNodeData;
          return {
            ...baseNode,
            data: {
              seq: data.seq,
              nodeKind: data.nodeKind || 'normal',
              label: data.label,
              condition: data.condition,
              note: data.note,
              validations: (data as { validations?: unknown[] }).validations || [],
            },
          };
        }

        if (node.type === 'sectionNode') {
          const data = nodeData as SectionNodeData;
          return {
            ...baseNode,
            data: {
              label: data.label,
              sectionType: data.sectionType,
              note: data.note,
              validations: data.validations || [],
              functionArgs: data.functionArgs || [],
              functionReturnType: data.functionReturnType,
              functionReturnValue: data.functionReturnValue,
              classConstructorArgs: data.classConstructorArgs || [],
              classMembers: data.classMembers || [],
              classMethods: data.classMethods || [],
              interfaceMembers: data.interfaceMembers || [],
              interfaceMethods: data.interfaceMethods || [],
              loopCondition: data.loopCondition,
              catchException: data.catchException,
            },
          };
        }

        if (node.type === 'memoNode') {
          const data = nodeData as MemoNodeData;
          return {
            ...baseNode,
            data: {
              text: data.text,
            },
          };
        }

        if (node.type === 'typeNode') {
          const data = nodeData as TypeNodeData;
          return {
            ...baseNode,
            data: {
              pythonType: data.pythonType,
              seq: data.seq || nextNodeSeq.current,
              variableName: data.variableName,
              initialValue: data.initialValue,
              elementType: data.elementType,
              keyType: data.keyType,
              valueType: data.valueType,
              innerType: data.innerType,
              unionTypes: data.unionTypes,
              note: data.note,
              genericParams: data.genericParams,
            },
          };
        }

        if (node.type === 'stampNode') {
          const data = nodeData as StampNodeData;
          return {
            ...baseNode,
            data: {
              stamp: data.stamp,
            },
          };
        }

        return {
          ...baseNode,
          data: nodeData,
        };
      }),
      edges: edges.map((edge) => {
        const data = edge.data as LogicEdgeData;
        return {
          id: edge.id,
          source: edge.source,
          target: edge.target,
          sourceHandle: edge.sourceHandle || null,
          targetHandle: edge.targetHandle || null,
          type: edge.type || null,
          animated: edge.animated || false,
          style: edge.style || {},
          className: edge.className || null,
          selected: edge.selected || false,
          data: {
            controlType: data.controlType,
            condition: data.condition,
            note: data.note,
            validations: data.validations || [],
          },
        };
      }),
    };

    return JSON.stringify(exportData, null, 2);
  }, [currentFlowName, edges, nextNodeSeq, nodes]);

  const openExportModal = useCallback(() => {
    const text = generateFlowData();
    setExportedText(text);
    setIsExportModalOpen(true);
  }, [generateFlowData]);

  const closeExportModal = useCallback(() => {
    setIsExportModalOpen(false);
    setExportedText('');
    setIsCopied(false);
  }, []);

  const openImportModal = useCallback(() => {
    setIsImportModalOpen(true);
  }, []);

  const closeImportModal = useCallback(() => {
    setIsImportModalOpen(false);
    setImportText('');
  }, []);

  const parseImportData = useCallback(
    (text: string): ParsedImportData => {
      try {
        const data = JSON.parse(text) as {
          version?: string;
          format?: string;
          nodes?: Array<Record<string, unknown>>;
          edges?: Array<Record<string, unknown>>;
          metadata?: { flowName?: string };
        };

        if (!data.version || !data.format || data.format !== 'LogicMap Flow Structure') {
          throw new Error(
            'このファイルは対応していない形式です。LogicMap形式のファイルを選択してください。'
          );
        }

        const supportedVersions = ['2.0.0'];
        if (!supportedVersions.includes(data.version)) {
          throw new Error(
            `サポートされていないバージョンです: ${data.version}。サポート版: ${supportedVersions.join(', ')}`
          );
        }

        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
          throw new Error('ノードまたはエッジのデータ形式が不正です。');
        }

        const invalidNodes = data.nodes.filter(
          (node) =>
            !node.position ||
            typeof (node.position as { x?: unknown }).x !== 'number' ||
            typeof (node.position as { y?: unknown }).y !== 'number' ||
            !node.size ||
            typeof (node.size as { width?: unknown }).width !== 'number' ||
            typeof (node.size as { height?: unknown }).height !== 'number'
        );

        if (invalidNodes.length > 0) {
          throw new Error(
            `座標またはサイズ情報が不完全なノードがあります（${invalidNodes.length}個）。自動配置は廃止されました。すべてのノードに正確な座標とサイズが必要です。`
          );
        }

        const existingNodeIds = nodes.map((n) => n.id);
        const existingEdgeIds = edges.map((e) => e.id);
        const importNodeIds = data.nodes.map((n) => String(n.id));
        const importEdgeIds = data.edges.map((e) => String(e.id));

        const duplicateNodeIds = importNodeIds.filter((id) => existingNodeIds.includes(id));
        const duplicateEdgeIds = importEdgeIds.filter((id) => existingEdgeIds.includes(id));

        const generateUniqueId = (baseId: string, existingIds: string[]): string => {
          let newId = baseId;
          let counter = 1;
          while (existingIds.includes(newId)) {
            newId = `${baseId}_import_${counter}`;
            counter += 1;
          }
          return newId;
        };

        const idMapping: Record<string, string> = {};

        data.nodes.forEach((node) => {
          const nodeId = String(node.id);
          if (duplicateNodeIds.includes(nodeId)) {
            const newId = generateUniqueId(nodeId, [...existingNodeIds, ...Object.values(idMapping)]);
            idMapping[nodeId] = newId;
            node.id = newId;
          }
        });

        data.edges.forEach((edge) => {
          const edgeId = String(edge.id);
          if (duplicateEdgeIds.includes(edgeId)) {
            edge.id = generateUniqueId(edgeId, [...existingEdgeIds, ...Object.values(idMapping)]);
          }

          const sourceId = String(edge.source);
          const targetId = String(edge.target);
          if (idMapping[sourceId]) {
            edge.source = idMapping[sourceId];
          }
          if (idMapping[targetId]) {
            edge.target = idMapping[targetId];
          }
        });

        data.nodes.forEach((node) => {
          const parentId = node.parentNode ? String(node.parentNode) : '';
          if (parentId && idMapping[parentId]) {
            node.parentNode = idMapping[parentId];
          }
        });

        return {
          nodes: data.nodes as Node<FlowNodeData>[],
          edges: data.edges as Edge<LogicEdgeData>[],
          metadata: data.metadata,
        };
      } catch (error) {
        if (error instanceof SyntaxError) {
          throw new Error(
            'JSONフォーマットが正しくありません。新しいLogicMap形式のファイルを使用してください。'
          );
        }
        throw error;
      }
    },
    [edges, nodes]
  );

  const importFlowFromText = useCallback(() => {
    try {
      const { nodes: importedNodes, edges: importedEdges, metadata } = parseImportData(importText);

      if (importedNodes.length === 0) {
        alert('有効なノード定義が見つかりませんでした。');
        return;
      }

      setNodes(importedNodes);
      setEdges(importedEdges);

      const maxNodeSeq = importedNodes.length > 0 ? importedNodes.length + 1 : 1;
      const maxEdgeSeq = importedEdges.length > 0 ? importedEdges.length + 1 : 1;
      nextNodeSeq.current = maxNodeSeq;
      nextEdgeSeq.current = maxEdgeSeq;

      closeImportModal();

      const message = metadata?.flowName
        ? `「${metadata.flowName}」をインポートしました。\n${importedNodes.length}個のノードと${importedEdges.length}個のエッジを復元しました。`
        : `${importedNodes.length}個のノードと${importedEdges.length}個のエッジをインポートしました。`;
      alert(message);
    } catch (error) {
      console.error('インポート中にエラーが発生しました:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'インポート中にエラーが発生しました。';
      alert(errorMessage);
    }
  }, [closeImportModal, importText, nextEdgeSeq, nextNodeSeq, parseImportData, setEdges, setNodes]);

  const openClearModal = useCallback(() => {
    setIsClearModalOpen(true);
  }, []);

  const closeClearModal = useCallback(() => {
    setIsClearModalOpen(false);
  }, []);

  const clearCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    nextNodeSeq.current = 1;
    nextEdgeSeq.current = 1;
    setIsClearModalOpen(false);
  }, [nextEdgeSeq, nextNodeSeq, setEdges, setNodes]);

  const createNewCanvas = useCallback(() => {
    setNodes([]);
    setEdges([]);
    nextNodeSeq.current = 1;
    nextEdgeSeq.current = 1;
    setCurrentFlowId(null);
    setCurrentFlowName(null);
  }, [nextEdgeSeq, nextNodeSeq, setEdges, setNodes]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(exportedText);
      setIsCopied(true);
      setTimeout(() => {
        setIsExportModalOpen(false);
        setExportedText('');
        setIsCopied(false);
      }, 1500);
    } catch (err) {
      console.error('コピーに失敗しました:', err);
      alert('コピーに失敗しました');
    }
  }, [exportedText]);

  const downloadFlowStructure = useCallback(() => {
    try {
      const blob = new Blob([exportedText], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const fileName = currentFlowName || 'flow-structure';
      link.download = `${fileName}.logicmap.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ダウンロードに失敗しました:', err);
      alert('ダウンロードに失敗しました');
    }
  }, [currentFlowName, exportedText]);

  const deleteSavedFlow = useCallback(
    async (flowId: string) => {
      setSaveError(null);
      try {
        await apiFetch<unknown>(`/flows/${flowId}`, { method: 'DELETE' });
        await fetchSavedFlows();
      } catch {
        setSaveError('削除に失敗しました。');
      }
    },
    [fetchSavedFlows]
  );

  const restoreSavedFlow = useCallback(
    async (flowId: string) => {
      setSaveError(null);
      try {
        const detail = await apiFetch<SavedFlowDetail>(`/flows/${flowId}`, { method: 'GET' });
        if (!detail?.snapshot) {
          setSaveError('保存データの復元に失敗しました。');
          return;
        }
        resetTransientState();
        const snapshot = detail.snapshot;
        const restoredNodes = snapshot.nodes.map(hydrateNode);
        const restoredEdges = normalizeParallelOffsets(snapshot.edges.map(hydrateEdge));
        setNodes(restoredNodes);
        setEdges(restoredEdges);
        const nextNode = snapshot.nextNodeSeq || getNextNodeSeqFromNodes(snapshot.nodes);
        const nextEdge = snapshot.nextEdgeSeq || getNextEdgeSeqFromEdges(snapshot.edges);
        nextNodeSeq.current = nextNode;
        nextEdgeSeq.current = nextEdge;
        setCurrentFlowId(flowId);
        setCurrentFlowName(detail.name);
      } catch {
        setSaveError('保存データの復元に失敗しました。');
      }
    },
    [nextEdgeSeq, nextNodeSeq, resetTransientState, setEdges, setNodes]
  );

  useEffect(() => {
    void fetchSavedFlows();
  }, [fetchSavedFlows]);

  useEffect(() => {
    if (initialFlowId) {
      void restoreSavedFlow(initialFlowId);
    }
  }, [initialFlowId, restoreSavedFlow]);

  return {
    savedFlows,
    isLoadingFlows,
    isSavingFlow,
    saveError,
    saveName,
    setSaveName,
    currentFlowId,
    currentFlowName,
    isExportModalOpen,
    exportedText,
    isCopied,
    isImportModalOpen,
    importText,
    setImportText,
    isClearModalOpen,
    saveCurrentFlow,
    updateFlow,
    openExportModal,
    closeExportModal,
    openImportModal,
    closeImportModal,
    importFlowFromText,
    openClearModal,
    closeClearModal,
    clearCanvas,
    createNewCanvas,
    copyToClipboard,
    downloadFlowStructure,
    deleteSavedFlow,
    restoreSavedFlow,
  };
}
