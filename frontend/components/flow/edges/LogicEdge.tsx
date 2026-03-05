import { useState } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from 'reactflow';
import { EDGE_PARALLEL_OFFSET } from '../constants';
import { buildEdgeLabel } from '../utils';
import type { LogicEdgeData } from '../types';

export function LogicEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  data,
  markerEnd,
  markerStart,
}: EdgeProps<LogicEdgeData>) {
  const [isHovered, setIsHovered] = useState(false);
  const offsetSign = data?.parallelOffset ?? 0;
  let adjustedSourceX = sourceX;
  let adjustedSourceY = sourceY;
  let adjustedTargetX = targetX;
  let adjustedTargetY = targetY;
  if (offsetSign !== 0) {
    const useForward = typeof source === 'string' && typeof target === 'string' && source < target;
    const baseDx = useForward ? targetX - sourceX : sourceX - targetX;
    const baseDy = useForward ? targetY - sourceY : sourceY - targetY;
    const length = Math.hypot(baseDx, baseDy) || 1;
    const nx = -baseDy / length;
    const ny = baseDx / length;
    const offset = EDGE_PARALLEL_OFFSET * offsetSign;
    adjustedSourceX = sourceX + nx * offset;
    adjustedSourceY = sourceY + ny * offset;
    adjustedTargetX = targetX + nx * offset;
    adjustedTargetY = targetY + ny * offset;
  }
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX: adjustedSourceX,
    sourceY: adjustedSourceY,
    targetX: adjustedTargetX,
    targetY: adjustedTargetY,
    sourcePosition,
    targetPosition,
  });
  const label = data
    ? buildEdgeLabel(data.controlType, data.condition, data.note, data.validations)
    : undefined;
  const hasInteractiveLabel = Boolean(label) || Boolean(data?.onEdit);

  const enhancedStyle = {
    ...style,
    strokeWidth: isHovered ? 8 : (style?.strokeWidth || 2),
    cursor: 'pointer',
    transition: 'stroke-width 0.2s ease',
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={enhancedStyle}
        markerEnd={markerEnd}
        markerStart={markerStart}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            background: 'transparent',
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            cursor: 'pointer',
            pointerEvents: 'all',
            zIndex: 2000,
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onDoubleClick={(event: React.MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();
            if (data?.onEdit) {
              data.onEdit(id);
            }
          }}
        />
      </EdgeLabelRenderer>
      {hasInteractiveLabel ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan cursor-pointer"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
            onDoubleClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              data?.onEdit?.(id);
            }}
          >
            {label ?? <div className="h-6 w-6" />}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
