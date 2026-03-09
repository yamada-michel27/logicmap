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
NodeKind = Literal['start', 'end', 'normal', 'break', 'continue', 'return']
SectionType = Literal['function', 'class', 'interface', 'main', 'process', 'try', 'catch', 'while', 'for', 'if', 'elif', 'else']
NodeControlType = Literal['flow', 'condition', 'loop', 'function', 'class']
PythonType = Literal['int', 'float', 'bool', 'str', 'list', 'tuple', 'dict', 'set', 'None', 'Optional', 'Union', 'Any']
VariableOperationType = Literal['declare', 'assign']  # 宣言モード、変更モード
VariableScope = Literal['global', 'local']  # グローバル、ローカル

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

class VariableNodeData(BaseModel):
    # Phase8: 変数ノード統合
    operationType: VariableOperationType  # 宣言 or 変更
    seq: int

    # 宣言モード用フィールド
    pythonType: Optional[PythonType] = None  # 型（宣言モード時のみ必須）
    variableName: Optional[str] = None  # 変数名（宣言モード時のみ必須）
    initialValue: Optional[str] = None  # 初期値
    scope: VariableScope = 'global'  # 変数のスコープ

    # 変更モード用フィールド
    targetVariable: Optional[str] = None  # 変更対象の変数名（変更モード時のみ必須）
    newValue: Optional[str] = None  # 新しい値（変更モード時のみ必須）

    # 型固有のパラメータ（宣言モード時のみ使用）
    elementType: Optional[str] = None  # list, tuple, setの要素型
    keyType: Optional[str] = None  # dictのキー型
    valueType: Optional[str] = None  # dictの値型
    innerType: Optional[str] = None  # Optionalの内部型
    unionTypes: Optional[List[str]] = None  # Unionの型リスト
    genericParams: Optional[str] = None  # その他の型パラメータ用

    # 共通フィールド
    note: Optional[str] = None

# Union型でノードデータを表現
FlowNodeData = Union[LogicNodeData, SectionNodeData, MemoNodeData, StampNodeData, VariableNodeData]

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
