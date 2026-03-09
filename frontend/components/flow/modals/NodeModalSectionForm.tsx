import type { Dispatch, SetStateAction } from 'react';
import type { Node } from 'reactflow';

import { CATCH_OPTIONS } from '../constants';
import type { FlowNodeData, NodeFormState, SectionType } from '../types';
import { getNodeDisplayLabel } from '../utils';
import { NodeModalInnerElementEditor } from './NodeModalInnerElementEditor';
import { NodeModalMethodList } from './NodeModalMethodList';
import { NodeModalTypedFieldList } from './NodeModalTypedFieldList';
import { NodeModalValidationList } from './NodeModalValidationList';
import {
  EmptyMessage,
  FieldLabel,
  fieldClassName,
  secondaryButtonClassName,
  TextAreaField,
  TextInputField,
} from './NodeModalShared';

type Props = {
  isEdit: boolean;
  editingNode: Node<FlowNodeData> | null;
  nodes: Node<FlowNodeData>[];
  nodeForm: NodeFormState;
  setNodeForm: Dispatch<SetStateAction<NodeFormState>>;
  sectionType: SectionType;
  createClassInstance: (node: Node<FlowNodeData>) => void;
};

export function NodeModalSectionForm({
  isEdit,
  editingNode,
  nodes,
  nodeForm,
  setNodeForm,
  sectionType,
  createClassInstance,
}: Props) {
  const editingSectionNode =
    isEdit && editingNode?.type === 'sectionNode' ? editingNode : null;
  const editableLogicNodes = editingSectionNode
    ? nodes.filter(
        (node) => node.type === 'logicNode' && node.parentNode === editingSectionNode.id
      )
    : [];
  const isFunction = sectionType === 'function';
  const isClass = sectionType === 'class';
  const isInterface = sectionType === 'interface';
  const isMain = sectionType === 'main';
  const isLoop = sectionType === 'while' || sectionType === 'for';
  const isConditional = sectionType === 'if' || sectionType === 'elif';
  const isCatch = sectionType === 'catch';
  const isTryOrElse = sectionType === 'try' || sectionType === 'else';
  const allowValidations = isFunction || isClass || isInterface;
  const loopLabel = sectionType === 'for' ? '反復式' : '継続条件';
  const loopPlaceholder = sectionType === 'for' ? '例: item in items' : '例: i < 10';
  const nameFieldConfig = isFunction
    ? { label: '関数名', placeholder: '例: fetchUser' }
    : isClass
    ? { label: 'クラス名', placeholder: '例: UserService' }
    : isInterface
    ? { label: 'インターフェース名', placeholder: '例: UserRepository' }
    : isMain
    ? { label: 'メイン処理名', placeholder: '例: MainProcess' }
    : isConditional
    ? { label: '条件式', placeholder: sectionType === 'if' ? '例: user != null' : '例: retryCount < 3' }
    : null;
  const notePlaceholder = isFunction || isClass || isInterface
    ? '目的や制約、利用時の補足を入力'
    : isLoop
    ? 'ループの意図や終了条件の補足を入力'
    : isConditional || isTryOrElse
    ? '分岐や例外処理の補足を入力'
    : '補足コメントを入力';

  return (
    <>
      {nameFieldConfig ? (
        <TextInputField
          label={nameFieldConfig.label}
          value={nodeForm.label}
          onChange={(value) =>
            setNodeForm((current) => ({ ...current, label: value }))
          }
          placeholder={nameFieldConfig.placeholder}
        />
      ) : null}

      {editingSectionNode ? (
        <div>
          <FieldLabel>最初のノード</FieldLabel>
          {editableLogicNodes.length === 0 ? (
            <EmptyMessage>セクション内にノードがありません。</EmptyMessage>
          ) : (
            <select
              value={nodeForm.entryNodeId}
              className={fieldClassName}
              onChange={(event) =>
                setNodeForm((current) => ({
                  ...current,
                  entryNodeId: event.target.value,
                }))
              }
            >
              <option value="">未設定</option>
              {editableLogicNodes.map((node) => (
                <option key={node.id} value={node.id}>
                  {getNodeDisplayLabel(node)}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : null}

      {isFunction ? (
        <>
          <NodeModalTypedFieldList
            fieldKey="functionArgs"
            label="引数"
            itemLabel="引数"
            emptyMessage="引数を追加してください。"
            nameLabel="引数名"
            typeLabel="型"
            namePlaceholder="例: userId"
            typePlaceholder="例: string"
            nodeForm={nodeForm}
            setNodeForm={setNodeForm}
          />
          <TextInputField
            label="返り値の型"
            value={nodeForm.functionReturnType}
            onChange={(value) =>
              setNodeForm((current) => ({ ...current, functionReturnType: value }))
            }
            placeholder="例: UserResponse"
          />
          <TextInputField
            label="返り値"
            value={nodeForm.functionReturnValue}
            onChange={(value) =>
              setNodeForm((current) => ({ ...current, functionReturnValue: value }))
            }
            placeholder="例: user"
          />
        </>
      ) : null}

      {isClass ? (
        <>
          <NodeModalTypedFieldList
            fieldKey="classConstructorArgs"
            label="コンストラクタ引数"
            itemLabel="引数"
            emptyMessage="コンストラクタ引数を追加してください。"
            nameLabel="引数名"
            typeLabel="型"
            namePlaceholder="例: userId"
            typePlaceholder="例: string"
            nodeForm={nodeForm}
            setNodeForm={setNodeForm}
          />
          <NodeModalTypedFieldList
            fieldKey="classMembers"
            label="メンバ変数"
            itemLabel="メンバ"
            emptyMessage="メンバ変数を追加してください。"
            nameLabel="変数名"
            typeLabel="型"
            namePlaceholder="例: id"
            typePlaceholder="例: string"
            nodeForm={nodeForm}
            setNodeForm={setNodeForm}
          />
          {isEdit && editingNode ? (
            <div>
              <button
                type="button"
                className={secondaryButtonClassName}
                onClick={() => createClassInstance(editingNode)}
              >
                + 初期化ノードを追加
              </button>
            </div>
          ) : null}
          <NodeModalMethodList
            fieldKey="classMethods"
            label="メソッド一覧"
            emptyMessage="メソッドを追加してください。"
            notePlaceholder="例: 例外時はnullを返す"
            nodeForm={nodeForm}
            setNodeForm={setNodeForm}
          />
        </>
      ) : null}

      {isInterface ? (
        <>
          <NodeModalTypedFieldList
            fieldKey="interfaceMembers"
            label="プロパティ"
            itemLabel="プロパティ"
            emptyMessage="プロパティを追加してください。"
            nameLabel="名前"
            typeLabel="型"
            namePlaceholder="例: id"
            typePlaceholder="例: string"
            nodeForm={nodeForm}
            setNodeForm={setNodeForm}
          />
          <NodeModalMethodList
            fieldKey="interfaceMethods"
            label="メソッド一覧"
            emptyMessage="メソッドを追加してください。"
            notePlaceholder="例: optional"
            nodeForm={nodeForm}
            setNodeForm={setNodeForm}
          />
        </>
      ) : null}

      {isLoop ? (
        <TextInputField
          label={loopLabel}
          value={nodeForm.loopCondition}
          onChange={(value) =>
            setNodeForm((current) => ({ ...current, loopCondition: value }))
          }
          placeholder={loopPlaceholder}
        />
      ) : null}

      {isCatch ? (
        <>
          <div>
            <FieldLabel>例外種別</FieldLabel>
            <select
              value={nodeForm.catchExceptionType}
              className={fieldClassName}
              onChange={(event) =>
                setNodeForm((current) => ({
                  ...current,
                  catchExceptionType: event.target.value,
                }))
              }
            >
              <option value="">選択してください</option>
              {CATCH_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {nodeForm.catchExceptionType === 'other' ? (
            <TextInputField
              label="例外詳細"
              value={nodeForm.catchExceptionOther}
              onChange={(value) =>
                setNodeForm((current) => ({
                  ...current,
                  catchExceptionOther: value,
                }))
              }
              placeholder="例: UserNotFoundException"
            />
          ) : null}
        </>
      ) : null}

      {allowValidations ? (
        <NodeModalValidationList nodeForm={nodeForm} setNodeForm={setNodeForm} />
      ) : null}

      {isMain ? null : (
        <TextAreaField
          label="補足コメント"
          value={nodeForm.note}
          onChange={(value) =>
            setNodeForm((current) => ({ ...current, note: value }))
          }
          placeholder={notePlaceholder}
        />
      )}

      {!isEdit ? (
        <NodeModalInnerElementEditor
          sectionType={sectionType}
          nodeForm={nodeForm}
          setNodeForm={setNodeForm}
        />
      ) : null}
    </>
  );
}
