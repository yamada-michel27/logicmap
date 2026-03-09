import { useCallback, useState } from 'react';
import type { Connection, XYPosition } from 'reactflow';

import {
  DEFAULT_EDGE_CONTROL,
  EMPTY_EDGE_FORM,
  EMPTY_NODE_FORM,
} from '../constants';
import type {
  EdgeControlType,
  EdgeFormState,
  NodeFormState,
  NodeOption,
  StampType,
  VariableNodeData,
} from '../types';
import { createDefaultVariableForm } from '../services/flowInteractionService';

type NodeDeleteTarget = { id: string; label: string };
type EditTarget = { id: string };

export function useFlowModalState() {
  const [pendingConnection, setPendingConnection] = useState<Connection | null>(null);
  const [pendingNodeClientPosition, setPendingNodeClientPosition] = useState<XYPosition | null>(null);
  const [pendingMemoClientPosition, setPendingMemoClientPosition] = useState<XYPosition | null>(null);
  const [pendingNodeDelete, setPendingNodeDelete] = useState<NodeDeleteTarget | null>(null);
  const [pendingNodeEdit, setPendingNodeEdit] = useState<EditTarget | null>(null);
  const [pendingMemoEdit, setPendingMemoEdit] = useState<EditTarget | null>(null);
  const [pendingEdgeEdit, setPendingEdgeEdit] = useState<EditTarget | null>(null);
  const [pendingVariableEdit, setPendingVariableEdit] = useState<EditTarget | null>(null);

  const [nodeModalOption, setNodeModalOption] = useState<NodeOption | null>(null);
  const [nodeForm, setNodeForm] = useState<NodeFormState>({ ...EMPTY_NODE_FORM });
  const [memoText, setMemoText] = useState('');
  const [variableForm, setVariableForm] = useState<VariableNodeData>(createDefaultVariableForm);
  const [selectedEdgeControl, setSelectedEdgeControl] = useState<EdgeControlType>(DEFAULT_EDGE_CONTROL);
  const [edgeForm, setEdgeForm] = useState<EdgeFormState>({ ...EMPTY_EDGE_FORM });
  const [pendingStamp, setPendingStamp] = useState<StampType | null>(null);

  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);

  const resetTransientState = useCallback(() => {
    setPendingConnection(null);
    setPendingNodeClientPosition(null);
    setPendingMemoClientPosition(null);
    setPendingNodeDelete(null);
    setPendingNodeEdit(null);
    setPendingMemoEdit(null);
    setPendingEdgeEdit(null);
    setNodeModalOption(null);
    setNodeForm({ ...EMPTY_NODE_FORM });
    setMemoText('');
    setSelectedEdgeControl(DEFAULT_EDGE_CONTROL);
    setEdgeForm({ ...EMPTY_EDGE_FORM });
    setPendingStamp(null);
  }, [
    setEdgeForm,
    setMemoText,
    setNodeForm,
    setNodeModalOption,
    setPendingConnection,
    setPendingEdgeEdit,
    setPendingMemoClientPosition,
    setPendingMemoEdit,
    setPendingNodeClientPosition,
    setPendingNodeDelete,
    setPendingNodeEdit,
    setPendingStamp,
    setSelectedEdgeControl,
  ]);

  const cancelMemoModal = useCallback(() => {
    setPendingMemoClientPosition(null);
    setPendingMemoEdit(null);
    setMemoText('');
  }, [setMemoText, setPendingMemoClientPosition, setPendingMemoEdit]);

  const resetVariableEditState = useCallback(() => {
    setPendingVariableEdit(null);
    setVariableForm(createDefaultVariableForm());
  }, [setPendingVariableEdit, setVariableForm]);

  const closeTemplateModal = useCallback(() => {
    setIsTemplateModalOpen(false);
  }, [setIsTemplateModalOpen]);

  return {
    pendingConnection,
    setPendingConnection,
    pendingNodeClientPosition,
    setPendingNodeClientPosition,
    pendingMemoClientPosition,
    setPendingMemoClientPosition,
    pendingNodeDelete,
    setPendingNodeDelete,
    pendingNodeEdit,
    setPendingNodeEdit,
    pendingMemoEdit,
    setPendingMemoEdit,
    pendingEdgeEdit,
    setPendingEdgeEdit,
    pendingVariableEdit,
    setPendingVariableEdit,
    nodeModalOption,
    setNodeModalOption,
    nodeForm,
    setNodeForm,
    memoText,
    setMemoText,
    variableForm,
    setVariableForm,
    selectedEdgeControl,
    setSelectedEdgeControl,
    edgeForm,
    setEdgeForm,
    pendingStamp,
    setPendingStamp,
    isTemplateModalOpen,
    setIsTemplateModalOpen,
    resetTransientState,
    cancelMemoModal,
    resetVariableEditState,
    closeTemplateModal,
  };
}
