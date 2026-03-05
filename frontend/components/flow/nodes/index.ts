import { LogicNode } from './LogicNode';
import { MemoNode } from './MemoNode';
import { StampNode } from './StampNode';
import { VariableNode } from './VariableNode';
import { SectionNode } from './SectionNode';

export const nodeTypes = {
  logicNode: LogicNode,
  sectionNode: SectionNode,
  memoNode: MemoNode,
  stampNode: StampNode,
  variableNode: VariableNode,
  typeNode: VariableNode, // 後方互換性のため
};
