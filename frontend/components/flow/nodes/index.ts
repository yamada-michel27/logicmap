import { LogicNode } from './LogicNode';
import { SectionNode } from './SectionNode';
import { MemoNode } from './MemoNode';
import { StampNode } from './StampNode';
import { VariableNode } from './VariableNode';

export { LogicNode, SectionNode, MemoNode, StampNode, VariableNode };

export const nodeTypes = {
  logicNode: LogicNode,
  sectionNode: SectionNode,
  memoNode: MemoNode,
  stampNode: StampNode,
  variableNode: VariableNode,
  typeNode: VariableNode, // 後方互換性のため
};
