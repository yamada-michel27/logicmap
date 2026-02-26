import ast
from typing import List, Dict, Tuple
from app.models.canvas import (
    FlowSnapshot, StoredNode, StoredEdge, SectionNodeData, LogicNodeData,
    TypedField, ClassMethod, LogicEdgeData
)
from uuid import uuid4

class PythonToCanvasConverter:
    def __init__(self, options: Dict):
        self.options = options
        self.node_seq = 1
        self.edge_seq = 1

    def convert(self, code: str) -> FlowSnapshot:
        """PythonコードをキャンバスJSONに変換"""
        try:
            tree = ast.parse(code)
        except SyntaxError as e:
            raise ValueError(f"Invalid Python syntax: {e}")

        nodes: List[StoredNode] = []
        edges: List[StoredEdge] = []

        # ASTを走査してノードを生成
        x_offset = 100
        y_offset = 100
        y_spacing = 200

        current_y = y_offset
        for node in tree.body:
            canvas_nodes = self._convert_ast_node(node, x_offset, current_y)
            for canvas_node in canvas_nodes:
                if canvas_node:
                    nodes.append(canvas_node)
                    current_y += y_spacing

        # 簡単なエッジ接続（隣接するノードを接続）
        for i in range(len(nodes) - 1):
            edge = self._create_edge(nodes[i].id, nodes[i + 1].id)
            edges.append(edge)

        return FlowSnapshot(
            version=1,
            nodes=nodes,
            edges=edges,
            nextNodeSeq=self.node_seq,
            nextEdgeSeq=self.edge_seq
        )

    def _convert_ast_node(self, node: ast.AST, x: float, y: float) -> List[StoredNode]:
        """ASTノードを対応するキャンバスノードに変換（複数のノードを返す可能性）"""

        if isinstance(node, ast.FunctionDef):
            return self._create_function_nodes(node, x, y)
        elif isinstance(node, ast.ClassDef):
            return [self._create_class_node(node, x, y)]
        elif isinstance(node, ast.If) and self._is_main_guard(node):
            return self._create_main_nodes(node, x, y)
        else:
            # その他の文は LogicNode として扱う
            return [self._create_logic_node(node, x, y)]

    def _create_function_nodes(self, node: ast.FunctionDef, x: float, y: float) -> List[StoredNode]:
        """関数定義からSectionNodeとその内部のLogicNodeを作成"""
        nodes = []

        # まず関数のSectionNodeを作成
        function_node = self._create_function_node(node, x, y)
        nodes.append(function_node)

        # 関数内のLogicNodeを作成（少し右にずらして配置）
        logic_x = x + 50
        logic_y = y + 50
        logic_spacing = 40

        current_logic_y = logic_y
        for stmt in node.body:
            # ドキュメント文字列はスキップ
            if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant) and isinstance(stmt.value.value, str):
                continue

            # 制御構造は展開して処理
            if isinstance(stmt, ast.While):
                while_nodes = self._expand_control_structure(stmt, logic_x, current_logic_y)
                nodes.extend(while_nodes)
                current_logic_y += len(while_nodes) * logic_spacing
            else:
                logic_node = self._create_logic_node(stmt, logic_x, current_logic_y)
                nodes.append(logic_node)
                current_logic_y += logic_spacing

        return nodes

    def _create_function_node(self, node: ast.FunctionDef, x: float, y: float) -> StoredNode:
        """関数定義からSectionNodeを作成"""

        # 引数の抽出
        function_args = []
        for arg in node.args.args:
            arg_type = "Any"
            if arg.annotation:
                arg_type = ast.unparse(arg.annotation) if hasattr(ast, 'unparse') else str(arg.annotation)
            function_args.append(TypedField(name=arg.arg, type=arg_type))

        # 戻り値の型
        return_type = "None"
        if node.returns:
            return_type = ast.unparse(node.returns) if hasattr(ast, 'unparse') else str(node.returns)

        # ドキュメント文字列の抽出
        docstring = ast.get_docstring(node) or ""

        data = SectionNodeData(
            label=node.name,
            sectionType="function",
            seq=self.node_seq,
            note=docstring,
            functionArgs=function_args,
            functionReturnType=return_type
        )

        self.node_seq += 1

        return StoredNode(
            id=str(uuid4()),
            type="sectionNode",
            position={"x": x, "y": y},
            data=data,
            width=200,
            height=100
        )

    def _create_class_node(self, node: ast.ClassDef, x: float, y: float) -> StoredNode:
        """クラス定義からSectionNodeを作成"""

        # メソッドの抽出
        class_methods = []
        constructor_args = []

        for item in node.body:
            if isinstance(item, ast.FunctionDef):
                if item.name == "__init__":
                    # コンストラクタの引数（selfを除く）
                    for arg in item.args.args[1:]:  # selfをスキップ
                        arg_type = "Any"
                        if arg.annotation:
                            arg_type = ast.unparse(arg.annotation) if hasattr(ast, 'unparse') else str(arg.annotation)
                        constructor_args.append(TypedField(name=arg.arg, type=arg_type))
                else:
                    # 通常のメソッド
                    method_args = []
                    for arg in item.args.args[1:]:  # selfをスキップ
                        arg_type = "Any"
                        if arg.annotation:
                            arg_type = ast.unparse(arg.annotation) if hasattr(ast, 'unparse') else str(arg.annotation)
                        method_args.append(TypedField(name=arg.arg, type=arg_type))

                    return_type = "None"
                    if item.returns:
                        return_type = ast.unparse(item.returns) if hasattr(ast, 'unparse') else str(item.returns)

                    docstring = ast.get_docstring(item) or ""

                    class_methods.append(ClassMethod(
                        name=item.name,
                        args=method_args,
                        returns=return_type,
                        note=docstring
                    ))

        # クラスのドキュメント文字列
        docstring = ast.get_docstring(node) or ""

        data = SectionNodeData(
            label=node.name,
            sectionType="class",
            seq=self.node_seq,
            note=docstring,
            classConstructorArgs=constructor_args,
            classMethods=class_methods
        )

        self.node_seq += 1

        return StoredNode(
            id=str(uuid4()),
            type="sectionNode",
            position={"x": x, "y": y},
            data=data,
            width=250,
            height=150
        )

    def _create_main_nodes(self, node: ast.If, x: float, y: float) -> List[StoredNode]:
        """if __name__ == "__main__": ブロックからメインノードとその内部のLogicNodeを作成"""
        nodes = []

        # まずmainのSectionNodeを作成
        main_node = self._create_main_node(node, x, y)
        nodes.append(main_node)

        # main内のLogicNodeを作成（少し右にずらして配置）
        logic_x = x + 50
        logic_y = y + 50
        logic_spacing = 40

        for i, stmt in enumerate(node.body):
            logic_node = self._create_logic_node(stmt, logic_x, logic_y + i * logic_spacing)
            nodes.append(logic_node)

        return nodes

    def _create_main_node(self, node: ast.If, x: float, y: float) -> StoredNode:
        """if __name__ == "__main__": ブロックからメインノードを作成"""

        data = SectionNodeData(
            label="メイン処理",
            sectionType="main",
            seq=self.node_seq,
            note="プログラムのエントリポイント"
        )

        self.node_seq += 1

        return StoredNode(
            id=str(uuid4()),
            type="sectionNode",
            position={"x": x, "y": y},
            data=data,
            width=200,
            height=80
        )

    def _create_logic_node(self, node: ast.AST, x: float, y: float) -> StoredNode:
        """その他の文からLogicNodeを作成"""

        # ASTノードをコードに戻す（簡易版）
        code_text = ""
        try:
            if hasattr(ast, 'unparse'):
                code_text = ast.unparse(node)
            else:
                code_text = f"{type(node).__name__} statement"
        except:
            code_text = f"{type(node).__name__} statement"

        data = LogicNodeData(
            label=code_text[:50] + ("..." if len(code_text) > 50 else ""),
            nodeKind="normal",
            seq=self.node_seq,
            note=code_text
        )

        self.node_seq += 1

        return StoredNode(
            id=str(uuid4()),
            type="logicNode",
            position={"x": x, "y": y},
            data=data,
            width=180,
            height=60
        )

    def _is_main_guard(self, node: ast.If) -> bool:
        """if __name__ == "__main__": かどうかをチェック"""
        if not isinstance(node.test, ast.Compare):
            return False

        if not isinstance(node.test.left, ast.Name) or node.test.left.id != "__name__":
            return False

        if len(node.test.ops) != 1 or not isinstance(node.test.ops[0], ast.Eq):
            return False

        if len(node.test.comparators) != 1:
            return False

        comparator = node.test.comparators[0]
        return isinstance(comparator, ast.Constant) and comparator.value == "__main__"

    def _create_edge(self, source_id: str, target_id: str) -> StoredEdge:
        """2つのノード間にエッジを作成"""

        data = LogicEdgeData(controlType="flow")

        edge = StoredEdge(
            id=str(uuid4()),
            source=source_id,
            target=target_id,
            data=data
        )

        self.edge_seq += 1
        return edge

    def _expand_control_structure(self, node: ast.AST, x: float, y: float) -> List[StoredNode]:
        """制御構造（while、ifなど）を複数のLogicNodeに展開"""
        nodes = []
        spacing = 40

        if isinstance(node, ast.While):
            # while条件
            condition_text = ast.unparse(node.test) if hasattr(ast, 'unparse') else 'while condition'
            condition_node = self._create_logic_node_with_text(f"while {condition_text}:", x, y, "normal")
            nodes.append(condition_node)

            # while本体の各文
            current_y = y + spacing
            for stmt in node.body:
                if isinstance(stmt, ast.If):
                    # if文をさらに展開
                    if_condition = ast.unparse(stmt.test) if hasattr(ast, 'unparse') else 'if condition'
                    if_node = self._create_logic_node_with_text(f"if {if_condition}:", x + 20, current_y, "normal")
                    nodes.append(if_node)
                    current_y += spacing

                    # if本体
                    for if_stmt in stmt.body:
                        if_body_text = ast.unparse(if_stmt) if hasattr(ast, 'unparse') else 'statement'
                        if_body_node = self._create_logic_node_with_text(if_body_text, x + 40, current_y, "normal")
                        nodes.append(if_body_node)
                        current_y += spacing

                    # elif/else部分
                    for elif_stmt in getattr(stmt, 'orelse', []):
                        if isinstance(elif_stmt, ast.If):
                            elif_condition = ast.unparse(elif_stmt.test) if hasattr(ast, 'unparse') else 'elif condition'
                            elif_node = self._create_logic_node_with_text(f"elif {elif_condition}:", x + 20, current_y, "normal")
                            nodes.append(elif_node)
                            current_y += spacing

                            for elif_body_stmt in elif_stmt.body:
                                elif_body_text = ast.unparse(elif_body_stmt) if hasattr(ast, 'unparse') else 'statement'
                                elif_body_node = self._create_logic_node_with_text(elif_body_text, x + 40, current_y, "normal")
                                nodes.append(elif_body_node)
                                current_y += spacing
                        else:
                            # else文
                            else_node = self._create_logic_node_with_text("else:", x + 20, current_y, "normal")
                            nodes.append(else_node)
                            current_y += spacing

                            else_text = ast.unparse(elif_stmt) if hasattr(ast, 'unparse') else 'statement'
                            else_body_node = self._create_logic_node_with_text(else_text, x + 40, current_y, "normal")
                            nodes.append(else_body_node)
                            current_y += spacing
                else:
                    # 通常の文
                    stmt_text = ast.unparse(stmt) if hasattr(ast, 'unparse') else 'statement'
                    stmt_node = self._create_logic_node_with_text(stmt_text, x + 20, current_y, "normal")
                    nodes.append(stmt_node)
                    current_y += spacing

        return nodes

    def _create_logic_node_with_text(self, text: str, x: float, y: float, node_kind: str = "normal") -> StoredNode:
        """指定されたテキストでLogicNodeを作成"""
        data = LogicNodeData(
            label=text[:50] + ("..." if len(text) > 50 else ""),
            nodeKind=node_kind,
            seq=self.node_seq,
            note=text
        )

        self.node_seq += 1

        return StoredNode(
            id=str(uuid4()),
            type="logicNode",
            position={"x": x, "y": y},
            data=data,
            width=180,
            height=60
        )