import {Fragment, Node, NodeType, ResolvedPos, Slice} from 'npm:prosemirror-model@latest';
import { AllSelection } from 'npm:prosemirror-state@latest';

import {Commands, CoreEditor, Extension} from '@kerebron/editor';
import {createNodeFromObject} from '@kerebron/editor/utilities';

function normalizeSiblings(fragment: Fragment, $context: ResolvedPos) {
  if (fragment.childCount < 2) return fragment
  for (let d = $context.depth; d >= 0; d--) {
    let parent = $context.node(d);
    let match = parent.contentMatchAt($context.index(d));
    let lastWrap: readonly NodeType[] | undefined, result: Node[] | null = [];
    fragment.forEach(node => {
      if (!result) return;
      let wrap = match.findWrapping(node.type), inLast;
      if (!wrap) return result = null
      if (inLast = result.length && lastWrap!.length && addToSibling(wrap, lastWrap!, node, result[result.length - 1], 0)) {
        result[result.length - 1] = inLast;
      } else {
        if (result.length) result[result.length - 1] = closeRight(result[result.length - 1], lastWrap!.length);
        let wrapped = withWrappers(node, wrap);
        result.push(wrapped);
        match = match.matchType(wrapped.type)!;
        lastWrap = wrap;
      }
    })
    if (result) return Fragment.from(result);
  }
  return fragment;
}

function withWrappers(node: Node, wrap: readonly NodeType[], from = 0) {
  for (let i = wrap.length - 1; i >= from; i--)
    node = wrap[i].create(null, Fragment.from(node));
  return node;
}

function addToSibling(wrap: readonly NodeType[], lastWrap: readonly NodeType[],
                      node: Node, sibling: Node, depth: number): Node | undefined {
  if (depth < wrap.length && depth < lastWrap.length && wrap[depth] == lastWrap[depth]) {
    let inner = addToSibling(wrap, lastWrap, node, sibling.lastChild!, depth + 1);
    if (inner) return sibling.copy(sibling.content.replaceChild(sibling.childCount - 1, inner));
    let match = sibling.contentMatchAt(sibling.childCount);
    if (match.matchType(depth == wrap.length - 1 ? node.type : wrap[depth + 1]))
      return sibling.copy(sibling.content.append(Fragment.from(withWrappers(node, wrap, depth + 1))));
  }
}

function closeRight(node: Node, depth: number) {
  if (depth == 0) return node;
  let fragment = node.content.replaceChild(node.childCount - 1, closeRight(node.lastChild!, depth - 1));
  let fill = node.contentMatchAt(node.childCount).fillBefore(Fragment.empty, true)!;
  return node.copy(fragment.append(fill));
}

function closeRange(fragment: Fragment, side: number, from: number, to: number, depth: number, openEnd: number) {
  let node = side < 0 ? fragment.firstChild! : fragment.lastChild!, inner = node.content;
  if (fragment.childCount > 1) openEnd = 0;
  if (depth < to - 1) inner = closeRange(inner, side, from, to, depth + 1, openEnd);
  if (depth >= from)
    inner = side < 0 ? node.contentMatchAt(0)!.fillBefore(inner, openEnd <= depth)!.append(inner)
      : inner.append(node.contentMatchAt(node.childCount)!.fillBefore(Fragment.empty, true)!);
  return fragment.replaceChild(side < 0 ? 0 : fragment.childCount - 1, node.copy(inner));
}

function closeSlice(slice: Slice, openStart: number, openEnd: number) {
  if (openStart < slice.openStart)
    slice = new Slice(closeRange(slice.content, -1, openStart, slice.openStart, 0, slice.openEnd), openStart, slice.openEnd);
  if (openEnd < slice.openEnd)
    slice = new Slice(closeRange(slice.content, 1, openEnd, slice.openEnd, 0, 0), slice.openStart, openEnd);
  return slice;
}

function sliceSingleNode(slice: Slice) {
  return slice.openStart == 0 && slice.openEnd == 0 && slice.content.childCount == 1 ? slice.content.firstChild : null;
}

function fixSlice(slice: Slice, $context: ResolvedPos): Slice {
  slice = Slice.maxOpen(normalizeSiblings(slice.content, $context), true)
  if (slice.openStart || slice.openEnd) {
    let openStart = 0, openEnd = 0;
    for (let node = slice.content.firstChild; openStart < slice.openStart && !node!.type.spec.isolating;
         openStart++, node = node!.firstChild) {}
    for (let node = slice.content.lastChild; openEnd < slice.openEnd && !node!.type.spec.isolating;
         openEnd++, node = node!.lastChild) {}
    slice = closeSlice(slice, openStart, openEnd);
  }
  return slice;
}

function sliceHasOnlyText(slice: Slice) {
  return slice.content.content.every(node => node.isInline);
}

export class SelectionExtension extends Extension {
  name = 'selection';
  private editor: CoreEditor;

  getCommands(editor: CoreEditor): Partial<Commands> {
    this.editor = editor;
    return {};
  }

  extractSelection() {
    const state = this.editor.state;
    const { from, to } = state.selection;
    const slice = state.doc.slice(from, to);

    if (sliceHasOnlyText(slice)) {
      const para = state.schema.nodes.paragraph.create(null, slice.content);
      return state.schema.topNodeType.createAndFill(null, [para]);
    }

    return state.schema.topNodeType.createAndFill(null, slice.content);
  }

  replaceSelection(otherDoc) {
    const preferPlain = false;
    const view = this.editor.view;

    let slice;

    if (otherDoc.type?.name === 'doc') {
      otherDoc = createNodeFromObject(otherDoc.toJSON(), this.editor.schema)

      slice = new Slice(otherDoc.content, 1, 1);
    } else {
      slice = otherDoc;
    }

    const $context = view.state.selection.$from;

    slice = fixSlice(slice, $context);

    let singleNode = sliceSingleNode(slice)
    let tr = singleNode
      ? view.state.tr.replaceSelectionWith(singleNode, preferPlain)
      : view.state.tr.replaceSelection(slice);
    view.dispatch(tr.scrollIntoView());
  }

  appendSelection(otherDoc) {
    const view = this.editor.view;
    const { state } = view;

    let slice;

    if (otherDoc.type?.name === 'doc') {
      otherDoc = createNodeFromObject(otherDoc.toJSON(), this.editor.schema);

      slice = new Slice(otherDoc.content, 1, 1);
    } else {
      slice = otherDoc;
    }

    const $context = view.state.selection.$from;

    slice = fixSlice(slice, $context);

    const tr = state.tr.insert(view.state.selection.to, slice.content);
    view.dispatch(tr.scrollIntoView());
  }

  selectAll() {
    const view = this.editor.view;
    const { state } = view;

    const tr = state.tr.setSelection(new AllSelection(state.doc));
    view.dispatch(tr);
  }
}
