from typing import Any, Dict, List, Optional, Union, Literal
from pydantic import BaseModel

# フロントエンドの型定義に対応

class TypedField(BaseModel):
    name: str
    type: str

class ValidationRule(BaseModel):
    target: str
    rule: str
    message: str

class ClassMethod(BaseModel):
    name: str
    args: List[TypedField]
    returns: str
    note: str

# ノード種類
NodeKind = Literal['start', 'end', 'normal']
SectionType = Literal['function', 'class', 'interface', 'main', 'try', 'catch', 'while', 'for', 'if', 'elif', 'else']
NodeControlType = Literal['flow', 'condition', 'loop', 'function', 'class']

class LogicNodeData(BaseModel):
    label: Optional[str] = None
    nodeKind: NodeKind
    seq: int
    controlType: Optional[NodeControlType] = None
    condition: Optional[str] = None
    note: Optional[str] = None
    instanceOfSectionId: Optional[str] = None

class SectionNodeData(BaseModel):
    label: str
    sectionType: SectionType
    seq: int
    controlType: Optional[NodeControlType] = None
    note: Optional[str] = None
    entryNodeId: Optional[str] = None
    instanceOfSectionId: Optional[str] = None
    functionArgs: Optional[List[TypedField]] = None
    functionReturnType: Optional[str] = None
    functionReturnValue: Optional[str] = None
    loopCondition: Optional[str] = None
    catchException: Optional[str] = None
    classConstructorArgs: Optional[List[TypedField]] = None
    classMembers: Optional[List[TypedField]] = None
    classMethods: Optional[List[ClassMethod]] = None
    interfaceMembers: Optional[List[TypedField]] = None
    interfaceMethods: Optional[List[ClassMethod]] = None
    validations: Optional[List[ValidationRule]] = None

class MemoNodeData(BaseModel):
    text: str
    seq: int

StampType = Literal['question', 'idea', 'warn', 'check', 'test', 'todo', 'consult']

class StampNodeData(BaseModel):
    stamp: StampType
    seq: int

# Union型でノードデータを表現
FlowNodeData = Union[LogicNodeData, SectionNodeData, MemoNodeData, StampNodeData]

class LogicEdgeData(BaseModel):
    controlType: NodeControlType
    condition: Optional[str] = None
    note: Optional[str] = None
    validations: Optional[List[ValidationRule]] = None

class StoredNode(BaseModel):
    id: str
    type: str
    position: Dict[str, float]  # {x: float, y: float}
    data: Any  # より柔軟にするため Any 型にする
    width: Optional[float] = None
    height: Optional[float] = None

class StoredEdge(BaseModel):
    id: str
    source: str
    target: str
    data: Any  # より柔軟にするため Any 型にする

class FlowSnapshot(BaseModel):
    version: int
    nodes: List[StoredNode]
    edges: List[StoredEdge]
    nextNodeSeq: int
    nextEdgeSeq: int