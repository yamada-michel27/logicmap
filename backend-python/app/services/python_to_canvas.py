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

        current_y = y_offset
        for node in tree.body:
            canvas_nodes = self._convert_ast_node(node, x_offset, current_y)
            for canvas_node in canvas_nodes:
                if canvas_node:
                    nodes.append(canvas_node)

            # 次のセクションのY位置を計算（セクションの高さ + 内容の高さを考慮）
            if canvas_nodes:
                section_height = self._calculate_section_height(canvas_nodes)
                current_y += section_height + 80  # セクション間の余白

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
        """関数定義からSectionNodeとその内部のLogicNodeを作成（適切なレイアウト計算付き）"""
        print(f"Creating function nodes for: {node.name}")
        all_nodes = []

        # まず関数セクションを仮のサイズで作成
        function_node = self._create_function_node_with_size(node, x, y, 300, 200)
        all_nodes.append(function_node)

        # 関数内のすべてのノードを段階的にレイアウト計算
        all_body_nodes = []
        current_stmt_y = 80  # 関数ヘッダーの下から開始
        logic_spacing = 40
        section_spacing = 50  # セクション間のスペース
        function_inner_margin = 20  # 関数セクション内のマージン
        max_content_width = 300

        for stmt in node.body:
            # ドキュメント文字列はスキップ
            if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Constant) and isinstance(stmt.value.value, str):
                continue

            stmt_x = x + function_inner_margin
            stmt_y = y + current_stmt_y

            # 制御構造はセクションとして処理（関数内に配置）
            if isinstance(stmt, ast.While):
                print(f"Creating while section for statement: {ast.unparse(stmt) if hasattr(ast, 'unparse') else 'while statement'}")
                while_section_nodes = self._create_while_section(stmt, stmt_x, stmt_y, function_node.id)
                all_body_nodes.extend(while_section_nodes)

                # while セクションの実際の高さを取得
                while_section = while_section_nodes[0]  # 最初のノードがセクションノード
                actual_height = while_section.height + section_spacing
                max_content_width = max(max_content_width, while_section.width + function_inner_margin * 2)
                current_stmt_y += actual_height

            elif isinstance(stmt, ast.If):
                if_section_nodes = self._create_if_section(stmt, stmt_x, stmt_y, function_node.id)
                all_body_nodes.extend(if_section_nodes)

                # if/elif/else セクション群の実際の高さを計算
                total_if_height = self._calculate_total_section_height(if_section_nodes) + section_spacing
                max_section_width = max([n.width for n in if_section_nodes if n.type == "sectionNode"], default=300)
                max_content_width = max(max_content_width, max_section_width + function_inner_margin * 2)
                current_stmt_y += total_if_height

            elif isinstance(stmt, ast.For):
                for_section_nodes = self._create_for_section(stmt, stmt_x, stmt_y, function_node.id)
                all_body_nodes.extend(for_section_nodes)

                # for セクションの実際の高さを取得
                for_section = for_section_nodes[0]  # 最初のノードがセクションノード
                actual_height = for_section.height + section_spacing
                max_content_width = max(max_content_width, for_section.width + function_inner_margin * 2)
                current_stmt_y += actual_height

            else:
                print(f"Creating logic node for statement: {type(stmt).__name__} - {ast.unparse(stmt) if hasattr(ast, 'unparse') else 'statement'}")
                logic_node = self._create_logic_node(stmt, 0, 0)

                # 関数内に配置
                logic_node.position = {
                    "x": stmt_x,
                    "y": stmt_y
                }
                logic_node.width = max_content_width - function_inner_margin * 2
                logic_node.height = 28
                logic_node.data.instanceOfSectionId = function_node.id

                all_body_nodes.append(logic_node)
                current_stmt_y += logic_node.height + logic_spacing

        # 関数セクションのサイズを正確に再計算
        final_content_height = current_stmt_y + 40  # 下部マージン
        final_section_width = max_content_width + 20  # 追加マージン
        final_section_height = max(final_content_height, 150)

        print(f"[FUNCTION_SIZE] Function '{node.name}' size calculation:")
        print(f"[FUNCTION_SIZE]   current_stmt_y: {current_stmt_y}")
        print(f"[FUNCTION_SIZE]   max_content_width: {max_content_width}")
        print(f"[FUNCTION_SIZE]   final_content_height: {final_content_height}")
        print(f"[FUNCTION_SIZE]   final_section_width: {final_section_width}")
        print(f"[FUNCTION_SIZE]   final_section_height: {final_section_height}")
        print(f"[FUNCTION_SIZE]   total_body_nodes: {len(all_body_nodes)}")

        # 関数セクションのサイズを更新
        function_node.width = final_section_width
        function_node.height = final_section_height

        print(f"[FUNCTION_SIZE] Updated function node: width={function_node.width}, height={function_node.height}")

        # 全てのノードを返す
        all_nodes.extend(all_body_nodes)
        return all_nodes

    def _calculate_total_section_height(self, section_nodes: List[StoredNode]) -> float:
        """セクション群（if/elif/else等）の総高さを計算"""
        if not section_nodes:
            return 0

        # sectionNodeのみを抽出して、Y座標の範囲を計算
        section_y_positions = []
        for node in section_nodes:
            if node.type == "sectionNode":
                section_y_positions.append(node.position["y"])
                section_y_positions.append(node.position["y"] + (node.height or 200))

        if not section_y_positions:
            return 220  # デフォルト高さ

        return max(section_y_positions) - min(section_y_positions)

    def _calculate_section_size_from_content(self, content_nodes: List[StoredNode], total_content_height: float) -> Dict[str, float]:
        """セクション内のノードに基づいてセクションサイズを計算"""
        print(f"[SIZE_CALC] Starting size calculation - node count: {len(content_nodes)}, total_height: {total_content_height}")

        if not content_nodes:
            print("[SIZE_CALC] No content nodes, returning default size")
            return {"width": 320, "height": 150}

        # 最大幅を計算（全ノードの幅を調べる）
        max_node_width = 0
        logic_node_count = 0

        for i, node in enumerate(content_nodes):
            if node.type == "logicNode":
                logic_node_count += 1
                # ノードのテキスト長に基づく幅を推定
                text_length = len(node.data.label or "")
                estimated_width = max(200, min(600, text_length * 8 + 40))
                print(f"[SIZE_CALC] LogicNode {i}: text='{node.data.label[:50]}...' len={text_length} estimated_width={estimated_width}")
                max_node_width = max(max_node_width, estimated_width)
            elif node.type == "sectionNode":
                # ネストしたセクションの幅も考慮
                section_width = getattr(node, 'width', 300)
                print(f"[SIZE_CALC] SectionNode {i}: label='{node.data.label}' width={section_width}")
                max_node_width = max(max_node_width, section_width)

        print(f"[SIZE_CALC] Max node width: {max_node_width}, Logic node count: {logic_node_count}")

        # セクション幅を計算（内容に余裕を持たせる）
        width_option1 = 320  # 最小幅
        width_option2 = max_node_width + 60  # ノード幅+マージン
        width_option3 = 300 + (logic_node_count * 15)  # ノード数に応じた拡張

        calculated_width = max(width_option1, width_option2, width_option3)
        print(f"[SIZE_CALC] Width calculation: min={width_option1}, node+margin={width_option2}, count_based={width_option3} → final={calculated_width}")

        # セクション高さを計算
        height_option1 = 150  # 最小高さ
        height_option2 = total_content_height + 120  # コンテンツ高さ+ヘッダー・マージン
        height_option3 = 100 + (logic_node_count * 10)  # ノード数に応じた拡張

        calculated_height = max(height_option1, height_option2, height_option3)
        print(f"[SIZE_CALC] Height calculation: min={height_option1}, content+margin={height_option2}, count_based={height_option3} → final={calculated_height}")

        result = {
            "width": calculated_width,
            "height": calculated_height
        }
        print(f"[SIZE_CALC] Final result: {result}")
        return result

    def _create_function_node_with_size(self, node: ast.FunctionDef, x: float, y: float, width: float, height: float) -> StoredNode:
        """サイズ指定付きで関数定義からSectionNodeを作成"""

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
            width=width,
            height=height
        )

    def _calculate_section_height(self, canvas_nodes: List[StoredNode]) -> float:
        """セクションの全体高さを計算"""
        if not canvas_nodes:
            return 0

        # セクションノード（最初のノード）とその内部ノードの最大Y座標を取得
        max_y = 0
        min_y = float('inf')

        for node in canvas_nodes:
            node_y = node.position["y"]
            node_height = node.height or 60
            min_y = min(min_y, node_y)
            max_y = max(max_y, node_y + node_height)

        return max_y - min_y

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

        # main内のLogicNodeを先に生成
        logic_nodes = []
        logic_spacing = 35

        for i, stmt in enumerate(node.body):
            logic_node = self._create_logic_node(stmt, 0, i * logic_spacing)  # 相対位置
            logic_nodes.append(logic_node)

        # mainセクションのサイズを計算
        node_count = len(logic_nodes)
        content_height = max(len(logic_nodes) * logic_spacing + 40, 100)

        # ノード数に応じて幅を調整
        section_width = max(300 + (node_count * 8), 280)  # 最低280, ノード数×8px追加
        section_height = max(content_height + 80, 120)    # ヘッダー分を追加、最低120

        # mainセクションを作成
        main_node = self._create_main_node_with_size(node, x, y, section_width, section_height)
        nodes.append(main_node)

        # LogicNodeをmainセクション内に配置
        logic_start_x = x + 20
        logic_start_y = y + 60

        for logic_node in logic_nodes:
            logic_node.position = {
                "x": logic_start_x,
                "y": logic_start_y + logic_node.position["y"]
            }
            # LogicNodeのサイズをセクション幅に合わせて調整
            logic_node.width = section_width - 60  # セクション幅 - 左右余白
            logic_node.height = 28

            # セクションIDを設定してノードを所属させる（辞書形式でアクセス）
            if hasattr(logic_node.data, '__dict__'):
                logic_node.data.instanceOfSectionId = main_node.id
            elif isinstance(logic_node.data, dict):
                logic_node.data['instanceOfSectionId'] = main_node.id
            else:
                # pydanticモデルの場合
                try:
                    logic_node.data.instanceOfSectionId = main_node.id
                except Exception as e:
                    print(f"Failed to set instanceOfSectionId for main: {e}")

            nodes.append(logic_node)

        return nodes

    def _create_main_node_with_size(self, node: ast.If, x: float, y: float, width: float, height: float) -> StoredNode:
        """サイズ指定付きでif __name__ == "__main__": ブロックからメインノードを作成"""

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
            width=width,
            height=height
        )

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

    def _create_logic_node(self, node: ast.AST, x: float, y: float, section_id: str = None) -> StoredNode:
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
            note=code_text,
            instanceOfSectionId=section_id
        )

        self.node_seq += 1

        return StoredNode(
            id=str(uuid4()),
            type="logicNode",
            position={"x": x, "y": y},
            data=data,
            width=200,
            height=28
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

    def _expand_control_structure(self, node: ast.AST, x: float, y: float, section_id: str = None) -> List[StoredNode]:
        """制御構造（while、ifなど）を複数のLogicNodeに展開"""
        nodes = []
        spacing = 35  # より密な配置

        if isinstance(node, ast.While):
            # while条件
            condition_text = ast.unparse(node.test) if hasattr(ast, 'unparse') else 'while condition'
            condition_node = self._create_logic_node_with_text(f"while {condition_text}:", x, y, "normal", section_id=section_id)
            nodes.append(condition_node)

            # while本体の各文
            current_y = y + spacing
            for stmt in node.body:
                if isinstance(stmt, ast.If):
                    # if文をさらに展開
                    if_condition = ast.unparse(stmt.test) if hasattr(ast, 'unparse') else 'if condition'
                    if_node = self._create_logic_node_with_text(f"if {if_condition}:", x + 15, current_y, "normal", section_id=section_id)
                    nodes.append(if_node)
                    current_y += spacing

                    # if本体
                    for if_stmt in stmt.body:
                        if_body_text = ast.unparse(if_stmt) if hasattr(ast, 'unparse') else 'statement'
                        if_body_node = self._create_logic_node_with_text(if_body_text, x + 30, current_y, "normal", section_id=section_id)
                        nodes.append(if_body_node)
                        current_y += spacing

                    # elif/else部分
                    for elif_stmt in getattr(stmt, 'orelse', []):
                        if isinstance(elif_stmt, ast.If):
                            elif_condition = ast.unparse(elif_stmt.test) if hasattr(ast, 'unparse') else 'elif condition'
                            elif_node = self._create_logic_node_with_text(f"elif {elif_condition}:", x + 15, current_y, "normal", section_id=section_id)
                            nodes.append(elif_node)
                            current_y += spacing

                            for elif_body_stmt in elif_stmt.body:
                                elif_body_text = ast.unparse(elif_body_stmt) if hasattr(ast, 'unparse') else 'statement'
                                elif_body_node = self._create_logic_node_with_text(elif_body_text, x + 30, current_y, "normal", section_id=section_id)
                                nodes.append(elif_body_node)
                                current_y += spacing
                        else:
                            # else文
                            else_node = self._create_logic_node_with_text("else:", x + 15, current_y, "normal", section_id=section_id)
                            nodes.append(else_node)
                            current_y += spacing

                            else_text = ast.unparse(elif_stmt) if hasattr(ast, 'unparse') else 'statement'
                            else_body_node = self._create_logic_node_with_text(else_text, x + 30, current_y, "normal", section_id=section_id)
                            nodes.append(else_body_node)
                            current_y += spacing
                else:
                    # 通常の文
                    stmt_text = ast.unparse(stmt) if hasattr(ast, 'unparse') else 'statement'
                    stmt_node = self._create_logic_node_with_text(stmt_text, x + 15, current_y, "normal", section_id=section_id)
                    nodes.append(stmt_node)
                    current_y += spacing

        return nodes

    def _create_while_section(self, node: ast.While, x: float, y: float, parent_section_id: str = None) -> List[StoredNode]:
        """while文からwhileセクションとその中身を作成"""
        nodes = []
        logic_spacing = 35

        # while文の条件を取得
        condition_text = ast.unparse(node.test) if hasattr(ast, 'unparse') else 'while condition'

        # まず仮のサイズでwhileセクションを作成
        while_section = self._create_while_node_with_size(node, condition_text, x, y, 300, 200, parent_section_id)
        nodes.append(while_section)

        # while文のボディ内のlogicNodeを作成
        logic_nodes = []
        current_y = 0

        for stmt in node.body:
            if isinstance(stmt, ast.If):
                # ネストしたif文もsectionNodeとして作成、while sectionのIDを渡す
                if_section_nodes = self._create_if_section(stmt, 0, current_y, while_section.id)
                logic_nodes.extend(if_section_nodes)
                current_y += 200  # ifセクションの高さ分をスキップ
            else:
                logic_node = self._create_logic_node(stmt, 0, current_y)
                logic_nodes.append(logic_node)
                current_y += logic_spacing

        # whileセクションのサイズを実際のコンテンツに基づいて再計算
        calculated_size = self._calculate_section_size_from_content(logic_nodes, current_y)
        section_width = calculated_size["width"]
        section_height = calculated_size["height"]

        # サイズを更新
        while_section.width = section_width
        while_section.height = section_height

        # LogicNodeをwhileセクション内に配置
        logic_start_x = x + 20
        logic_start_y = y + 80

        for logic_node in logic_nodes:
            logic_node.position = {
                "x": logic_start_x,
                "y": logic_start_y + logic_node.position["y"]
            }
            logic_node.width = section_width - 60
            logic_node.height = 28

            # セクションIDを設定
            if hasattr(logic_node.data, '__dict__'):
                logic_node.data.instanceOfSectionId = while_section.id
            elif isinstance(logic_node.data, dict):
                logic_node.data['instanceOfSectionId'] = while_section.id
            else:
                try:
                    logic_node.data.instanceOfSectionId = while_section.id
                except Exception:
                    pass

            nodes.append(logic_node)

        return nodes

    def _create_while_node_with_size(self, node: ast.While, condition_text: str, x: float, y: float, width: float, height: float, parent_section_id: str = None) -> StoredNode:
        """サイズ指定付きでwhile文からSectionNodeを作成"""

        data = SectionNodeData(
            label=f"while {condition_text}",
            sectionType="while",
            seq=self.node_seq,
            note=f"while {condition_text}",
            loopCondition=condition_text,
            instanceOfSectionId=parent_section_id
        )

        self.node_seq += 1

        return StoredNode(
            id=str(uuid4()),
            type="sectionNode",
            position={"x": x, "y": y},
            data=data,
            width=width,
            height=height
        )

    def _create_if_section(self, node: ast.If, x: float, y: float, parent_section_id: str = None) -> List[StoredNode]:
        """if/elif/else文の完全な構造をsectionNodeとして作成"""
        all_nodes = []
        current_y = y
        section_spacing = 220  # セクション間のスペース

        # 1. if文の処理
        if_nodes = self._create_single_if_section(node, x, current_y, "if", parent_section_id)
        all_nodes.extend(if_nodes)
        current_y += section_spacing

        # 2. elif/else文の処理
        current_node = node
        while hasattr(current_node, 'orelse') and current_node.orelse:
            orelse = current_node.orelse
            if len(orelse) == 1 and isinstance(orelse[0], ast.If):
                # elif文
                elif_node = orelse[0]
                elif_nodes = self._create_single_if_section(elif_node, x, current_y, "elif", parent_section_id)
                all_nodes.extend(elif_nodes)
                current_y += section_spacing
                current_node = elif_node
            else:
                # else文
                else_nodes = self._create_else_section(orelse, x, current_y, parent_section_id)
                all_nodes.extend(else_nodes)
                break

        return all_nodes

    def _create_single_if_section(self, node: ast.If, x: float, y: float, section_type: str, parent_section_id: str = None) -> List[StoredNode]:
        """単一のif/elifセクションを作成"""
        nodes = []
        logic_spacing = 35

        # 条件を取得
        condition_text = ast.unparse(node.test) if hasattr(ast, 'unparse') else f'{section_type} condition'

        # セクション内のlogicNodeを作成
        logic_nodes = []
        current_body_y = 0

        for stmt in node.body:
            logic_node = self._create_logic_node(stmt, 0, current_body_y)
            logic_nodes.append(logic_node)
            current_body_y += logic_spacing

        # セクションのサイズを実際のコンテンツに基づいて計算
        calculated_size = self._calculate_section_size_from_content(logic_nodes, current_body_y)
        section_width = calculated_size["width"]
        section_height = calculated_size["height"]

        # セクションを作成
        section_node = self._create_condition_section_node(section_type, condition_text, x, y, section_width, section_height, parent_section_id)
        nodes.append(section_node)

        # LogicNodeをセクション内に配置
        logic_start_x = x + 20
        logic_start_y = y + 80

        for logic_node in logic_nodes:
            logic_node.position = {
                "x": logic_start_x,
                "y": logic_start_y + logic_node.position["y"]
            }
            logic_node.width = section_width - 60
            logic_node.height = 28
            logic_node.data.instanceOfSectionId = section_node.id
            nodes.append(logic_node)

        return nodes

    def _create_else_section(self, statements: List[ast.stmt], x: float, y: float, parent_section_id: str = None) -> List[StoredNode]:
        """elseセクションを作成"""
        nodes = []
        logic_spacing = 35

        # セクション内のlogicNodeを作成
        logic_nodes = []
        current_body_y = 0

        for stmt in statements:
            logic_node = self._create_logic_node(stmt, 0, current_body_y)
            logic_nodes.append(logic_node)
            current_body_y += logic_spacing

        # セクションのサイズを実際のコンテンツに基づいて計算
        calculated_size = self._calculate_section_size_from_content(logic_nodes, current_body_y)
        section_width = calculated_size["width"]
        section_height = calculated_size["height"]

        # elseセクションを作成
        section_node = self._create_condition_section_node("else", "else", x, y, section_width, section_height, parent_section_id)
        nodes.append(section_node)

        # LogicNodeをセクション内に配置
        logic_start_x = x + 20
        logic_start_y = y + 80

        for logic_node in logic_nodes:
            logic_node.position = {
                "x": logic_start_x,
                "y": logic_start_y + logic_node.position["y"]
            }
            logic_node.width = section_width - 60
            logic_node.height = 28
            logic_node.data.instanceOfSectionId = section_node.id
            nodes.append(logic_node)

        return nodes

    def _create_condition_section_node(self, section_type: str, label_text: str, x: float, y: float, width: float, height: float, parent_section_id: str = None) -> StoredNode:
        """条件分岐セクション（if/elif/else）用のSectionNodeを作成"""
        data = SectionNodeData(
            label=f"{section_type} {label_text}" if section_type != "else" else "else",
            sectionType=section_type,
            seq=self.node_seq,
            note=f"{section_type} {label_text}" if section_type != "else" else "else",
            instanceOfSectionId=parent_section_id
        )

        self.node_seq += 1

        return StoredNode(
            id=str(uuid4()),
            type="sectionNode",
            position={"x": x, "y": y},
            data=data,
            width=width,
            height=height
        )

    def _create_if_node_with_size(self, node: ast.If, condition_text: str, x: float, y: float, width: float, height: float, parent_section_id: str = None) -> StoredNode:
        """サイズ指定付きでif文からSectionNodeを作成"""

        data = SectionNodeData(
            label=f"if {condition_text}",
            sectionType="if",
            seq=self.node_seq,
            note=f"if {condition_text}",
            instanceOfSectionId=parent_section_id
        )

        self.node_seq += 1

        return StoredNode(
            id=str(uuid4()),
            type="sectionNode",
            position={"x": x, "y": y},
            data=data,
            width=width,
            height=height
        )

    def _create_for_section(self, node: ast.For, x: float, y: float, parent_section_id: str = None) -> List[StoredNode]:
        """for文からforセクションとその中身を作成"""
        nodes = []
        logic_spacing = 35

        # for文の条件を取得
        target = ast.unparse(node.target) if hasattr(ast, 'unparse') else 'item'
        iter_expr = ast.unparse(node.iter) if hasattr(ast, 'unparse') else 'iterable'
        condition_text = f"{target} in {iter_expr}"

        # for文のボディ内のlogicNodeを作成
        logic_nodes = []
        current_y = 0

        for stmt in node.body:
            logic_node = self._create_logic_node(stmt, 0, current_y)
            logic_nodes.append(logic_node)
            current_y += logic_spacing

        # forセクションのサイズを計算
        node_count = len(logic_nodes)
        content_height = max(current_y + 40, 120)
        section_width = max(300 + (node_count * 8), 280)
        section_height = max(content_height + 80, 150)

        # forセクションを作成
        for_section = self._create_for_node_with_size(node, condition_text, x, y, section_width, section_height, parent_section_id)
        nodes.append(for_section)

        # LogicNodeをforセクション内に配置
        logic_start_x = x + 20
        logic_start_y = y + 80

        for logic_node in logic_nodes:
            logic_node.position = {
                "x": logic_start_x,
                "y": logic_start_y + logic_node.position["y"]
            }
            logic_node.width = section_width - 60
            logic_node.height = 28

            # セクションIDを設定
            if hasattr(logic_node.data, '__dict__'):
                logic_node.data.instanceOfSectionId = for_section.id
            elif isinstance(logic_node.data, dict):
                logic_node.data['instanceOfSectionId'] = for_section.id
            else:
                try:
                    logic_node.data.instanceOfSectionId = for_section.id
                except Exception:
                    pass

            nodes.append(logic_node)

        return nodes

    def _create_for_node_with_size(self, node: ast.For, condition_text: str, x: float, y: float, width: float, height: float, parent_section_id: str = None) -> StoredNode:
        """サイズ指定付きでfor文からSectionNodeを作成"""

        data = SectionNodeData(
            label=f"for {condition_text}",
            sectionType="for",
            seq=self.node_seq,
            note=f"for {condition_text}",
            loopCondition=condition_text,
            instanceOfSectionId=parent_section_id
        )

        self.node_seq += 1

        return StoredNode(
            id=str(uuid4()),
            type="sectionNode",
            position={"x": x, "y": y},
            data=data,
            width=width,
            height=height
        )

    def _create_logic_node_with_text(self, text: str, x: float, y: float, node_kind: str = "normal", control_type: str = None, condition: str = None, section_id: str = None) -> StoredNode:
        """指定されたテキストでLogicNodeを作成"""

        # while文、if文などの制御構造を識別
        if text.strip().startswith(('while ', 'for ', 'if ', 'elif ', 'else:')):
            if control_type is None:
                if text.strip().startswith(('while ', 'for ')):
                    control_type = "loop"
                    condition = text.strip()
                elif text.strip().startswith(('if ', 'elif ', 'else:')):
                    control_type = "condition"
                    condition = text.strip()

        data = LogicNodeData(
            label=text[:50] + ("..." if len(text) > 50 else ""),
            nodeKind=node_kind,
            seq=self.node_seq,
            controlType=control_type,
            condition=condition,
            note=text,
            instanceOfSectionId=section_id
        )

        self.node_seq += 1

        return StoredNode(
            id=str(uuid4()),
            type="logicNode",
            position={"x": x, "y": y},
            data=data,
            width=200,
            height=28
        )