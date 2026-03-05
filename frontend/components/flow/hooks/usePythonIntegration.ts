import { useCallback, useState, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { Edge, Node } from 'reactflow';

import { SECTION_DEFAULT_HEIGHT, SECTION_DEFAULT_WIDTH } from '../constants';
import type { FlowNodeData, FlowSnapshot, LogicEdgeData } from '../types';

type UsePythonIntegrationParams = {
  nodes: Node<FlowNodeData>[];
  edges: Edge<LogicEdgeData>[];
  setNodes: Dispatch<SetStateAction<Node<FlowNodeData>[]>>;
  setEdges: Dispatch<SetStateAction<Edge<LogicEdgeData>[]>>;
  nextNodeSeq: MutableRefObject<number>;
  nextEdgeSeq: MutableRefObject<number>;
};

type PythonCodeResponse = {
  success: boolean;
  code?: string;
  error?: string;
};

type PythonCanvasNode = Node<FlowNodeData> & {
  width?: number;
  height?: number;
};

type PythonCanvasEdge = Edge<LogicEdgeData>;

type PythonCanvasResponse = {
  success: boolean;
  snapshot?: {
    nodes: PythonCanvasNode[];
    edges: PythonCanvasEdge[];
    nextNodeSeq: number;
    nextEdgeSeq: number;
  };
  error?: string;
};

export function usePythonIntegration({
  nodes,
  edges,
  setNodes,
  setEdges,
  nextNodeSeq,
  nextEdgeSeq,
}: UsePythonIntegrationParams) {
  const [isPythonModalOpen, setIsPythonModalOpen] = useState(false);
  const [pythonCode, setPythonCode] = useState('');
  const [isPythonGenerating, setIsPythonGenerating] = useState(false);
  const [isPythonImportModalOpen, setIsPythonImportModalOpen] = useState(false);
  const [pythonInputCode, setPythonInputCode] = useState('');
  const [isCanvasGenerating, setIsCanvasGenerating] = useState(false);
  const [isPythonCopied, setIsPythonCopied] = useState(false);

  const generatePythonCode = useCallback(async () => {
    setIsPythonGenerating(true);
    setPythonCode('');
    setIsPythonModalOpen(true);

    try {
      const snapshot: FlowSnapshot = {
        version: 1,
        nodes: nodes.map((node) => ({
          id: node.id,
          type: node.type,
          position: node.position,
          data: node.data,
          width: node.width,
          height: node.height,
        })),
        edges: edges.map((edge) => ({
          id: edge.id,
          source: edge.source,
          target: edge.target,
          data: edge.data,
        })),
        nextNodeSeq: nextNodeSeq.current,
        nextEdgeSeq: nextEdgeSeq.current,
      };

      const pythonServiceUrl = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:8001';
      const response = await fetch(`${pythonServiceUrl}/api/v1/canvas-to-python`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          snapshot,
          options: {
            include_comments: true,
            include_docstrings: true,
          },
        }),
      });

      const data = (await response.json()) as PythonCodeResponse;
      if (data.success) {
        setPythonCode(data.code ?? '');
      } else {
        setPythonCode(`// エラーが発生しました\n${data.error || '不明なエラー'}`);
      }
    } catch (error) {
      console.error('Python code generation failed:', error);
      setPythonCode(
        `// エラーが発生しました\n${error instanceof Error ? error.message : '不明なエラー'}`
      );
    } finally {
      setIsPythonGenerating(false);
    }
  }, [edges, nextEdgeSeq, nextNodeSeq, nodes]);

  const closePythonModal = useCallback(() => {
    setIsPythonModalOpen(false);
    setPythonCode('');
    setIsPythonGenerating(false);
    setIsPythonCopied(false);
  }, []);

  const openPythonImportModal = useCallback(() => {
    setIsPythonImportModalOpen(true);
  }, []);

  const closePythonImportModal = useCallback(() => {
    setIsPythonImportModalOpen(false);
    setPythonInputCode('');
    setIsCanvasGenerating(false);
  }, []);

  const generateCanvasFromPython = useCallback(async () => {
    setIsCanvasGenerating(true);

    try {
      const pythonServiceUrl = process.env.NEXT_PUBLIC_PYTHON_SERVICE_URL || 'http://localhost:8001';
      const response = await fetch(`${pythonServiceUrl}/api/v1/python-to-canvas`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: pythonInputCode,
          options: {
            include_comments: true,
            include_docstrings: true,
          },
        }),
      });

      const data = (await response.json()) as PythonCanvasResponse;
      if (!data.success || !data.snapshot) {
        alert(`Canvas生成に失敗しました: ${data.error || '不明なエラー'}`);
        return;
      }

      const snapshot = data.snapshot;
      const newNodes = snapshot.nodes.map((node) => ({
        ...node,
        position: node.position,
        style: {
          width: node.width || (node.type === 'sectionNode' ? SECTION_DEFAULT_WIDTH : 160),
          height: node.height || (node.type === 'sectionNode' ? SECTION_DEFAULT_HEIGHT : 80),
          ...node.style,
        },
      }));
      const newEdges = snapshot.edges.map((edge) => ({
        ...edge,
        type: 'logicEdge',
        animated: false,
      }));

      setNodes(newNodes);
      setEdges(newEdges);
      nextNodeSeq.current = snapshot.nextNodeSeq;
      nextEdgeSeq.current = snapshot.nextEdgeSeq;
      setIsPythonImportModalOpen(false);
      setPythonInputCode('');
    } catch (error) {
      console.error('Canvas generation failed:', error);
      alert(`Canvas生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsCanvasGenerating(false);
    }
  }, [nextEdgeSeq, nextNodeSeq, pythonInputCode, setEdges, setNodes]);

  const copyPythonCode = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(pythonCode);
      setIsPythonCopied(true);
      setTimeout(() => setIsPythonCopied(false), 2000);
    } catch (error) {
      console.error('コピーに失敗しました:', error);
    }
  }, [pythonCode]);

  const downloadPythonFile = useCallback(() => {
    const blob = new Blob([pythonCode], { type: 'text/x-python' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'generated_code.py';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [pythonCode]);

  return {
    isPythonModalOpen,
    pythonCode,
    isPythonGenerating,
    isPythonImportModalOpen,
    pythonInputCode,
    setPythonInputCode,
    isCanvasGenerating,
    isPythonCopied,
    generatePythonCode,
    closePythonModal,
    openPythonImportModal,
    closePythonImportModal,
    generateCanvasFromPython,
    copyPythonCode,
    downloadPythonFile,
  };
}
