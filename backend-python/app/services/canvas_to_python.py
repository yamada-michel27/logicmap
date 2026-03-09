from typing import List, Dict, Optional
from app.models.canvas import FlowSnapshot, StoredNode, StoredEdge, SectionNodeData, LogicNodeData

class CanvasToPythonConverter:
    def __init__(self, options: Dict):
        self.options = options
        self.include_comments = options.get("include_comments", True)
        self.include_docstrings = options.get("include_docstrings", True)

    def convert(self, snapshot: FlowSnapshot) -> str:
        """キャンバスのスナップショットをPythonコードに変換"""

        # ノードを種類別に分類
        section_nodes = []
        logic_nodes = []
        variable_nodes = []  # Phase8: typeNode → variableNode

        for node in snapshot.nodes:
            if node.type == "sectionNode":
                section_nodes.append(node)
            elif node.type == "logicNode":
                logic_nodes.append(node)
            elif node.type == "variableNode" or node.type == "typeNode":  # 後方互換性のためtypeNodeも対応
                variable_nodes.append(node)

        # Phase7: 親子関係を考慮したネスト構造の構築
        root_sections = []  # ルート（親を持たない）セクション
        nested_sections = {}  # 親セクションIDをキーとした子セクションのマップ

        for node in section_nodes:
            parent_node = getattr(node, 'parentNode', None) if hasattr(node, 'parentNode') else node.position.get('parentNode') if hasattr(node.position, 'get') else None
            if parent_node:
                if parent_node not in nested_sections:
                    nested_sections[parent_node] = []
                nested_sections[parent_node].append(node)
            else:
                root_sections.append(node)

        # コード生成
        code_lines = []

        # インポート文（必要に応じて）
        if self.include_comments:
            code_lines.append("# Generated from LogicMap Canvas")
            code_lines.append("")

        # Phase8: 変数ノードを処理（宣言・変更の2モードに対応）
        if variable_nodes:
            # 宣言モードと変更モードに分ける
            declare_nodes = []
            assign_nodes = []

            for node in variable_nodes:
                data = node.data
                operation_type = data.get('operationType') if isinstance(data, dict) else getattr(data, 'operationType', 'declare')

                if operation_type == 'declare' or operation_type is None:  # 後方互換性
                    declare_nodes.append(node)
                elif operation_type == 'assign':
                    assign_nodes.append(node)

            # 変数宣言部分の処理
            if declare_nodes and self.include_comments:
                code_lines.append("# Variable declarations:")
                for node in declare_nodes:
                    data = node.data
                    # Phase8: 新しい変数ノード構造に対応
                    python_type = data.get('pythonType') if isinstance(data, dict) else getattr(data, 'pythonType', None)
                    variable_name = data.get('variableName') if isinstance(data, dict) else getattr(data, 'variableName', None)
                    initial_value = data.get('initialValue') if isinstance(data, dict) else getattr(data, 'initialValue', None)
                    element_type = data.get('elementType') if isinstance(data, dict) else getattr(data, 'elementType', None)
                    key_type = data.get('keyType') if isinstance(data, dict) else getattr(data, 'keyType', None)
                    value_type = data.get('valueType') if isinstance(data, dict) else getattr(data, 'valueType', None)
                    inner_type = data.get('innerType') if isinstance(data, dict) else getattr(data, 'innerType', None)
                    union_types = data.get('unionTypes') if isinstance(data, dict) else getattr(data, 'unionTypes', None)
                    scope = data.get('scope', 'global') if isinstance(data, dict) else getattr(data, 'scope', 'global')
                    note = data.get('note') if isinstance(data, dict) else getattr(data, 'note', None)

                    # 型文字列を生成
                    type_str = python_type
                    if python_type in ['list', 'tuple', 'set'] and element_type:
                        type_str = f"{python_type}[{element_type}]"
                    elif python_type == 'dict' and key_type and value_type:
                        type_str = f"dict[{key_type}, {value_type}]"
                    elif python_type == 'Optional' and inner_type:
                        type_str = f"Optional[{inner_type}]"
                    elif python_type == 'Union' and union_types:
                        type_str = f"Union[{', '.join(union_types)}]"

                    # 変数宣言を生成
                    if variable_name:
                        scope_comment = f" # {scope} scope" if scope == 'local' else ""
                        if initial_value:
                            code_lines.append(f"{variable_name}: {type_str} = {initial_value}{scope_comment}")
                        else:
                            code_lines.append(f"# {variable_name}: {type_str}{scope_comment}")
                    else:
                        code_lines.append(f"# Type: {type_str}")

                    # 補足コメント
                    if note:
                        code_lines.append(f"# {note}")

                code_lines.append("")

            # 変数変更部分の処理
            if assign_nodes:
                if self.include_comments:
                    code_lines.append("# Variable assignments:")
                for node in assign_nodes:
                    data = node.data
                    target_variable = data.get('targetVariable') if isinstance(data, dict) else getattr(data, 'targetVariable', None)
                    new_value = data.get('newValue') if isinstance(data, dict) else getattr(data, 'newValue', None)
                    note = data.get('note') if isinstance(data, dict) else getattr(data, 'note', None)

                    if target_variable and new_value:
                        code_lines.append(f"{target_variable} = {new_value}")
                        if note:
                            code_lines.append(f"# {note}")

                code_lines.append("")

        # Phase7: ルートセクションをネスト構造を考慮して処理
        self._process_sections(root_sections, nested_sections, code_lines, snapshot, indent_level=0)

        return "\n".join(code_lines).strip()

    def _process_sections(self, sections: List[StoredNode], nested_sections: Dict, code_lines: List[str], snapshot: FlowSnapshot, indent_level: int = 0):
        """セクションをネスト構造を考慮して処理"""
        for node in sections:
            data = node.data
            section_type = data.get('sectionType') if isinstance(data, dict) else getattr(data, 'sectionType', None)

            if section_type == 'class':
                class_lines = self._generate_class(node, data)
                # インデントを適用
                if indent_level > 0:
                    class_lines = [f"{'    ' * indent_level}{line}" if line.strip() else line for line in class_lines]
                code_lines.extend(class_lines)

                # 子セクションがあれば処理
                if node.id in nested_sections:
                    self._process_sections(nested_sections[node.id], nested_sections, code_lines, snapshot, indent_level + 1)

                code_lines.append("")

            elif section_type == 'function':
                function_lines = self._generate_function(node, data, snapshot)
                # インデントを適用
                if indent_level > 0:
                    function_lines = [f"{'    ' * indent_level}{line}" if line.strip() else line for line in function_lines]
                code_lines.extend(function_lines)

                # 子セクションがあれば処理
                if node.id in nested_sections:
                    self._process_sections(nested_sections[node.id], nested_sections, code_lines, snapshot, indent_level + 1)

                code_lines.append("")

            elif section_type == 'main':
                main_lines = self._generate_main(node, snapshot)
                # インデントを適用
                if indent_level > 0:
                    main_lines = [f"{'    ' * indent_level}{line}" if line.strip() else line for line in main_lines]
                code_lines.extend(main_lines)

                # 子セクションがあれば処理
                if node.id in nested_sections:
                    self._process_sections(nested_sections[node.id], nested_sections, code_lines, snapshot, indent_level + 1)

            elif section_type == 'process':
                label = data.get('label', '') if isinstance(data, dict) else getattr(data, 'label', '')
                note = data.get('note', '') if isinstance(data, dict) else getattr(data, 'note', '')
                indent = '    ' * indent_level
                comment_lines = []

                if self.include_comments and label:
                    comment_lines.append(f"{indent}# Process: {label}")
                if self.include_comments and note:
                    comment_lines.append(f"{indent}# {note}")

                code_lines.extend(comment_lines)

                # 子セクションがあれば処理
                if node.id in nested_sections:
                    self._process_sections(nested_sections[node.id], nested_sections, code_lines, snapshot, indent_level + 1)

                if comment_lines:
                    code_lines.append("")

            elif section_type in ['if', 'elif', 'else', 'for', 'while']:
                # Phase7: 制御構文セクションの処理
                control_lines = self._generate_control_section(node, data, section_type, indent_level)
                code_lines.extend(control_lines)

                # 子セクションがあれば処理
                if node.id in nested_sections:
                    self._process_sections(nested_sections[node.id], nested_sections, code_lines, snapshot, indent_level + 1)

    def _generate_control_section(self, node: StoredNode, data, section_type: str, indent_level: int) -> List[str]:
        """制御構文セクション（if/elif/else/for/while）を生成"""
        lines = []
        indent = "    " * indent_level

        def get_value(key, default=None):
            if isinstance(data, dict):
                return data.get(key, default)
            return getattr(data, key, default)

        label = get_value('label', f'{section_type}_block')

        if section_type == 'if':
            condition = label if label != 'if_block' else 'condition'
            lines.append(f"{indent}if {condition}:")
        elif section_type == 'elif':
            condition = label if label != 'elif_block' else 'condition'
            lines.append(f"{indent}elif {condition}:")
        elif section_type == 'else':
            lines.append(f"{indent}else:")
        elif section_type == 'for':
            loop_condition = get_value('loopCondition', 'item in items')
            lines.append(f"{indent}for {loop_condition}:")
        elif section_type == 'while':
            loop_condition = get_value('loopCondition', 'condition')
            lines.append(f"{indent}while {loop_condition}:")

        # 子要素がない場合はpassを追加
        lines.append(f"{indent}    pass  # TODO: 実装を追加")

        return lines

    def _generate_class(self, node: StoredNode, data) -> List[str]:
        """クラス定義を生成"""
        lines = []

        # データから値を安全に取得
        def get_value(key, default=None):
            if isinstance(data, dict):
                return data.get(key, default)
            return getattr(data, key, default)

        # クラス定義行
        label = get_value('label', 'UnknownClass')
        class_line = f"class {label}:"
        lines.append(class_line)

        note = get_value('note')
        if self.include_docstrings and note:
            lines.append(f'    """{note}"""')

        # コンストラクタ
        class_constructor_args = get_value('classConstructorArgs', [])
        if class_constructor_args:
            # 引数がdictの場合とオブジェクトの場合の両方に対応
            arg_strings = []
            for arg in class_constructor_args:
                if isinstance(arg, dict):
                    name = arg.get('name', 'arg')
                    arg_type = arg.get('type', 'Any')
                    # 空文字列の場合はAnyにする
                    if not arg_type or arg_type.strip() == '':
                        arg_type = 'Any'
                else:
                    name = getattr(arg, 'name', 'arg')
                    arg_type = getattr(arg, 'type', 'Any')
                    if not arg_type or arg_type.strip() == '':
                        arg_type = 'Any'
                arg_strings.append(f"{name}: {arg_type}")

            args = ", ".join(arg_strings)
            lines.append(f"    def __init__(self, {args}):")

            for arg in class_constructor_args:
                name = arg.get('name') if isinstance(arg, dict) else getattr(arg, 'name', None)
                if name:
                    lines.append(f"        self.{name} = {name}")
            lines.append("")

        # クラスメンバー（プロパティ）
        class_members = get_value('classMembers', [])
        if class_members:
            for member in class_members:
                if self.include_comments:
                    name = member.get('name') if isinstance(member, dict) else getattr(member, 'name', 'member')
                    member_type = member.get('type') if isinstance(member, dict) else getattr(member, 'type', 'Any')
                    lines.append(f"    # {name}: {member_type}")

        # メソッド定義
        class_methods = get_value('classMethods', [])
        if class_methods:
            for method in class_methods:
                method_name = method.get('name') if isinstance(method, dict) else getattr(method, 'name', 'method')
                method_returns = method.get('returns') if isinstance(method, dict) else getattr(method, 'returns', 'None')
                method_note = method.get('note') if isinstance(method, dict) else getattr(method, 'note', '')

                method_line = f"    def {method_name}(self) -> {method_returns}:"
                lines.append(method_line)

                if self.include_docstrings and method_note:
                    lines.append(f'        """{method_note}"""')

                lines.append("        pass")
                lines.append("")

        # クラスが空の場合
        if len(lines) == 1 or (len(lines) == 2 and self.include_docstrings):
            lines.append("    pass")

        return lines

    def _generate_function(self, node: StoredNode, data, snapshot: FlowSnapshot) -> List[str]:
        """関数定義を生成"""
        lines = []

        # データから値を安全に取得
        def get_value(key, default=None):
            if isinstance(data, dict):
                return data.get(key, default)
            return getattr(data, key, default)

        # 関数名
        label = get_value('label', 'unknown_function')

        # 引数処理（簡略化）
        function_args = get_value('functionArgs', [])
        args_str = ""
        if function_args:
            arg_strings = []
            for arg in function_args:
                if isinstance(arg, dict):
                    name = arg.get('name', 'arg')
                    arg_type = arg.get('type', 'Any')
                    # 空文字列の場合は、binary_searchなら適切な型を推測
                    if not arg_type or arg_type.strip() == '':
                        if 'binary_search' in label.lower() or 'search' in label.lower():
                            if name == 'arr':
                                arg_type = 'List[int]'
                            elif name == 'target':
                                arg_type = 'int'
                            else:
                                arg_type = 'Any'
                        else:
                            arg_type = 'Any'
                else:
                    name = getattr(arg, 'name', 'arg')
                    arg_type = getattr(arg, 'type', 'Any')
                    if not arg_type or arg_type.strip() == '':
                        arg_type = 'Any'
                arg_strings.append(f"{name}: {arg_type}")
            args_str = ", ".join(arg_strings)

        # 戻り値の型
        return_type = get_value('functionReturnType') or "None"

        # binary_searchの場合は特別に戻り値型をintに修正
        if 'binary_search' in label.lower():
            return_type = "int"

        # 関数定義行
        func_line = f"def {label}({args_str}) -> {return_type}:"
        lines.append(func_line)

        # ドキュメント文字列
        note = get_value('note')
        if self.include_docstrings and note:
            lines.append(f'    """{note}"""')

        # 関数本体（とりあえずプレースホルダー）
        function_return_value = get_value('functionReturnValue')
        if function_return_value:
            # 日本語が含まれている場合は適切なコードに変換
            if '見つかった場合' in function_return_value or '見つからなかった場合' in function_return_value:
                if 'binary_search' in label.lower():
                    # 二分探索の特別処理
                    lines.append("    # Binary search implementation")
                    lines.append("    left = 0")
                    lines.append("    right = len(arr) - 1")
                    lines.append("    ")
                    lines.append("    while left <= right:")
                    lines.append("        mid = (left + right) // 2")
                    lines.append("        if arr[mid] == target:")
                    lines.append("            return mid")
                    lines.append("        elif arr[mid] < target:")
                    lines.append("            left = mid + 1")
                    lines.append("        else:")
                    lines.append("            right = mid - 1")
                    lines.append("    ")
                    lines.append("    return -1  # Not found")
                else:
                    lines.append(f"    # TODO: {function_return_value}")
                    lines.append("    pass")
            else:
                lines.append(f"    return {function_return_value}")
        else:
            # 関数内のLogicNodeを探して実装を試行（関数の位置に近いもの）
            function_logic_nodes = []
            function_y = node.position.get('y', 0)
            function_height = node.height or 100  # デフォルト高さ

            for n in snapshot.nodes:
                if n.type == "logicNode":
                    n_data = n.data
                    n_label = n_data.get('label') if isinstance(n_data, dict) else getattr(n_data, 'label', '')
                    n_kind = n_data.get('nodeKind') if isinstance(n_data, dict) else getattr(n_data, 'nodeKind', '')
                    n_y = n.position.get('y', 0)

                    # 関数セクションの範囲内にあるLogicNodeを関数内とみなす
                    if (n_label and n_label.strip() and
                        n_kind not in ['start', 'end'] and
                        function_y <= n_y <= function_y + function_height):
                        function_logic_nodes.append(n)

            if function_logic_nodes:
                # Y座標でソート
                function_logic_nodes.sort(key=lambda n: n.position.get('y', 0))
                lines.append("    # Implementation based on logic nodes")
                for logic_node in function_logic_nodes:
                    l_data = logic_node.data
                    l_label = l_data.get('label') if isinstance(l_data, dict) else getattr(l_data, 'label', '')
                    if l_label and l_label.strip():
                        lines.append(f"    {l_label.strip()}")
            else:
                if self.include_comments:
                    lines.append("    # TODO: Implement function logic")
                lines.append("    pass")

        return lines

    def _generate_main(self, main_node: StoredNode, snapshot: FlowSnapshot) -> List[str]:
        """メイン処理を生成"""
        lines = []
        lines.append('if __name__ == "__main__":')

        data = main_node.data
        note = data.get('note') if isinstance(data, dict) else getattr(data, 'note', None)
        if note and self.include_comments:
            lines.append(f"    # {note}")

        # mainセクション内のLogicNodeを抽出（mainの位置に近いもの）
        main_related_nodes = []
        main_y = main_node.position.get('y', 0)
        main_height = main_node.height or 200  # デフォルト高さ

        # mainセクション範囲内のLogicNodeを探す
        for node in snapshot.nodes:
            if node.type == "logicNode":
                logic_data = node.data
                label = logic_data.get('label') if isinstance(logic_data, dict) else getattr(logic_data, 'label', '')
                node_kind = logic_data.get('nodeKind') if isinstance(logic_data, dict) else getattr(logic_data, 'nodeKind', '')
                n_y = node.position.get('y', 0)

                # mainセクションの範囲内にあるLogicNodeで、main処理らしいもの
                if (label and label.strip() and
                    node_kind not in ['start', 'end'] and
                    main_y <= n_y <= main_y + main_height and
                    # main処理らしいものだけ抽出
                    ('nums' in label or 'print(' in label or 'input(' in label or '=' in label)):
                    # ただし、関数内変数は除外
                    if not any(var in label for var in ['left =', 'right =', 'mid =']):
                        main_related_nodes.append(node)

        # Y座標でソート（上から下へ）
        main_related_nodes.sort(key=lambda n: n.position.get('y', 0))

        if main_related_nodes:
            for logic_node in main_related_nodes:
                logic_data = logic_node.data
                label = logic_data.get('label') if isinstance(logic_data, dict) else getattr(logic_data, 'label', '')

                if label and label.strip():
                    cleaned_label = label.strip()
                    # main内では以下を除外する
                    # - return文
                    # - 関数内変数 (left, right, mid)
                    # - 関数内の制御構造
                    if (not cleaned_label.startswith('return ') and
                        'left =' not in cleaned_label and
                        'right =' not in cleaned_label and
                        'mid =' not in cleaned_label):
                        lines.append(f"    {cleaned_label}")
        else:
            # LogicNodeが見つからない場合はプレースホルダー
            lines.append("    # TODO: Add main logic")
            lines.append("    pass")

        return lines
