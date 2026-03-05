import {
  useCallback,
  useRef,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from 'react';
import { type Node, type NodeDragHandler, type ReactFlowInstance } from 'reactflow';

import type { FlowNodeData, SectionNodeData } from '../types';
import { findSectionAtPoint, getNodeRect } from '../utils';

type UseDragDropParams = {
  reactFlowInstance: MutableRefObject<ReactFlowInstance | null>;
  setNodes: Dispatch<SetStateAction<Node<FlowNodeData>[]>>;
};

export function useDragDrop({ reactFlowInstance, setNodes }: UseDragDropParams) {
  const updatingSizeRef = useRef<Set<string>>(new Set());
  const isDraggingRef = useRef(false);

  const calculateSectionSize = useCallback(
    (
      nodes: Array<{ position: { x: number; y: number } }>,
      nodeWidth = 150,
      nodeHeight = 40,
      padding = 30,
      bottomPadding = 40
    ) => {
      if (nodes.length === 0) {
        return { width: 600, height: 150 };
      }

      const minX = Math.min(...nodes.map((node) => node.position.x));
      const maxX = Math.max(...nodes.map((node) => node.position.x + nodeWidth));
      const minY = Math.min(...nodes.map((node) => node.position.y));
      const maxY = Math.max(...nodes.map((node) => node.position.y + nodeHeight));

      const width = Math.max(600, maxX - minX + padding * 2);
      const height = Math.max(150, maxY - minY + padding * 2 + 40 + bottomPadding);

      return { width, height };
    },
    []
  );

  const updateParentSectionSize = useCallback(
    (parentSectionId: string) => {
      if (isDraggingRef.current) {
        return;
      }

      if (updatingSizeRef.current.has(parentSectionId)) {
        return;
      }

      updatingSizeRef.current.add(parentSectionId);

      setNodes((currentNodes) => {
        const parentSection = currentNodes.find(
          (node) => node.id === parentSectionId && node.type === 'sectionNode'
        );
        if (!parentSection) {
          updatingSizeRef.current.delete(parentSectionId);
          return currentNodes;
        }

        const childNodes = currentNodes.filter((node) => node.parentNode === parentSectionId);
        if (childNodes.length === 0) {
          updatingSizeRef.current.delete(parentSectionId);
          return currentNodes;
        }

        const newSize = calculateSectionSize(childNodes);
        const currentWidth =
          typeof parentSection.style?.width === 'number' ? parentSection.style.width : 0;
        const currentHeight =
          typeof parentSection.style?.height === 'number' ? parentSection.style.height : 0;

        if (
          Math.abs(currentWidth - newSize.width) < 10 &&
          Math.abs(currentHeight - newSize.height) < 10
        ) {
          updatingSizeRef.current.delete(parentSectionId);
          return currentNodes;
        }

        const updatedNodes = currentNodes.map((node) => {
          if (node.id === parentSectionId) {
            return {
              ...node,
              style: {
                ...node.style,
                width: newSize.width,
                height: newSize.height,
              },
            };
          }
          return node;
        });

        setTimeout(() => {
          updatingSizeRef.current.delete(parentSectionId);
        }, 200);

        return updatedNodes;
      });
    },
    [calculateSectionSize, setNodes]
  );

  const onNodeDragStart = useCallback<NodeDragHandler>(() => {
    isDraggingRef.current = true;
  }, []);

  const onNodeDragStop = useCallback<NodeDragHandler>(
    (_event, draggedNode) => {
      isDraggingRef.current = false;

      const instance = reactFlowInstance.current;
      if (!instance) return;

      const isLogicNode = draggedNode.type === 'logicNode';
      const isSectionNode = draggedNode.type === 'sectionNode';
      if (!isLogicNode && !isSectionNode) return;

      const sectionNodes = instance
        .getNodes()
        .filter((node): node is Node<SectionNodeData> => node.type === 'sectionNode');
      const draggedRect = getNodeRect(draggedNode);
      const focusPoint = draggedRect
        ? {
            x: draggedRect.x + draggedRect.width / 2,
            y: draggedRect.y + draggedRect.height / 2,
          }
        : draggedNode.positionAbsolute ?? draggedNode.position;
      const parentSection = findSectionAtPoint(focusPoint, sectionNodes);

      const isValidParentChild = (childId: string, parentId: string): boolean => {
        try {
          if (childId === parentId) {
            return false;
          }

          const parentNode = sectionNodes.find((node) => node.id === parentId);
          if (!parentNode) {
            return false;
          }

          const allNodes = instance.getNodes();
          let currentParent: string | undefined = parentId;
          const visitedParents = new Set<string>();

          while (currentParent) {
            if (visitedParents.has(currentParent)) {
              return false;
            }
            visitedParents.add(currentParent);

            const parent = allNodes.find((node) => node.id === currentParent);
            if (!parent) break;

            if (parent.parentNode === childId) {
              return false;
            }

            currentParent = parent.parentNode;
            if (visitedParents.size > 20) {
              return false;
            }
          }

          return true;
        } catch (error) {
          console.error('Error in parent-child validation:', error);
          return false;
        }
      };

      const oldParentId = draggedNode.parentNode;
      let newParentId: string | undefined;

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== draggedNode.id) return node;
          if (parentSection) {
            if (!isValidParentChild(draggedNode.id, parentSection.id)) {
              console.warn(
                `Invalid parent-child relationship: ${draggedNode.id} -> ${parentSection.id} (circular reference or self-reference)`
              );
              return node;
            }

            const parentRect = getNodeRect(parentSection);
            if (!parentRect) return node;
            const absolutePos = draggedNode.positionAbsolute ?? draggedNode.position;
            newParentId = parentSection.id;
            return {
              ...node,
              parentNode: parentSection.id,
              extent: 'parent',
              position: {
                x: absolutePos.x - parentRect.x,
                y: absolutePos.y - parentRect.y,
              },
            };
          }
          if (node.parentNode) {
            const absolutePos = draggedNode.positionAbsolute ?? draggedNode.position;
            return {
              ...node,
              parentNode: undefined,
              extent: undefined,
              position: absolutePos,
            };
          }
          return node;
        })
      );

      if (isLogicNode) {
        setTimeout(() => {
          if (oldParentId) {
            updateParentSectionSize(oldParentId);
          }
          if (newParentId && newParentId !== oldParentId) {
            updateParentSectionSize(newParentId);
          }
        }, 150);
      }
    },
    [reactFlowInstance, setNodes, updateParentSectionSize]
  );

  return {
    calculateSectionSize,
    updateParentSectionSize,
    onNodeDragStart,
    onNodeDragStop,
  };
}
