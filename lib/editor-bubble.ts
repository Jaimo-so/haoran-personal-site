import { Selection, TextSelection } from '@tiptap/pm/state'

export function shouldShowEditorBubble(selection: Selection, isEditable: boolean) {
  return isEditable && !selection.empty && selection instanceof TextSelection
}
