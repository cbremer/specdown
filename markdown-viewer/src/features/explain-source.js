import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
import { DOCUMENT_MAX_DIAGRAM_CHARS } from '../core/document-limits.js';
import { canRestoreNonEditableFocus, trapFocus } from '../core/focus-trap.js';
import { createSdModal } from '../core/modal.js';

/** @typedef {ReturnType<typeof captureDocumentContext>} ExplainContext */
/** @typedef {{id:string,text:string,reveal:()=>void}} ExplainExcerpt */
/** @typedef {{text:string,sourceId:string,reveal:()=>void}} ExplainStep */
/** @typedef {{key:string,kind:string,label:string,preview:string,excerpts:ExplainExcerpt[], coverage?:string,fallback?:string,walkthrough?:ExplainStep[]}} ExplainScope */
/** @typedef {{node:Text,start:number,end:number}} ExplainRun */
/** @typedef {{element:Element, runs:ExplainRun[], source?:string, heading:Element|null}} ExplainBlock */

const explainHeadings = 'h1,h2,h3,h4,h5,h6';
const explainBlockSelector =
  explainHeadings + ',p,pre,li,td,th,dt,dd,figcaption,summary,blockquote,div';
const explainIgnore =
  'button,script,style,template,input,select,textarea,[hidden],[aria-hidden="true"],.annotation-badge,.annotation-popover,.mermaid-error';
/** @type {WeakMap<Node, number>} */
const explainIds = new WeakMap();
let nextExplainId = 0;
/** @type {((restore:boolean)=>void)|null} */
let explainSourceDismiss = null;

/** @param {Node} node */
function explainNodeId(node) {
  if (!explainIds.has(node)) explainIds.set(node, ++nextExplainId);
  return explainIds.get(node);
}

/** A narrow, position-preserving subset. Mermaid's sequence DB exposes messages
 * but not their original spans. Reject unrecognized statements as a unit so an
 * unsupported branch can never be flattened into unconditional messages.
 * @param {string} source
 */
export function parseExplainSequence(source) {
  if (source.length > DOCUMENT_MAX_DIAGRAM_CHARS) return null;
  /** @type {Map<string,string>} */
  const aliases = new Map();
  /** @type {string[]} */
  const branches = [];
  const steps = [];
  let header = false;
  let start = 0;
  for (const [index, raw] of source.split('\n').entries()) {
    const offset = start;
    start += raw.length + 1;
    const line = raw.trim();
    if (!line || (line.startsWith('%%') && !line.startsWith('%%{'))) continue;
    if (!header) {
      if (line !== 'sequenceDiagram') return null;
      header = true;
      continue;
    }
    if (line.includes(';') || line.includes('%%')) return null;
    const actor = /^(?:participant|actor)\s+([\w]+)(?:\s+as\s+(.+))?$/.exec(
      line
    );
    if (actor) {
      if ((actor[2] || actor[1]).length > 160) return null;
      aliases.set(actor[1], actor[2] || actor[1]);
      continue;
    }
    const branch = /^(alt|else)\s+(.+)$/.exec(line);
    if (branch) {
      if (
        branch[2].length > 160 ||
        (branch[1] === 'alt' && branches.length >= 8)
      )
        return null;
      if (branch[1] === 'alt') branches.push(branch[2]);
      else if (branches.length) branches[branches.length - 1] = branch[2];
      else return null;
      continue;
    }
    if (line === 'end') {
      if (!branches.length) return null;
      branches.pop();
      continue;
    }
    const message = /^([\w]+)\s*(?:--?>>?|--?\))\s*([\w]+)\s*:\s*(.+)$/.exec(
      line
    );
    if (!message) return null;
    steps.push({
      sender: aliases.get(message[1]) || message[1],
      recipient: aliases.get(message[2]) || message[2],
      message: message[3],
      branches: [...branches],
      line: index + 1,
      start: offset,
      end: offset + raw.trimEnd().length,
    });
  }
  return header && !branches.length && steps.length ? steps : null;
}

export function closeExplainSource() {
  explainSourceDismiss?.(false);
}

/** @param {string} source @param {number} start @param {number} end @param {number} line */
function explainDiagramSource(source, start, end, line) {
  closeExplainSource();
  const previous = document.activeElement;
  const modal = createSdModal({
    title: 'Diagram source · Line ' + line,
    onClose: () => explainSourceDismiss?.(true),
  });
  const pre = document.createElement('pre');
  const mark = document.createElement('mark');
  mark.textContent = source.slice(start, end);
  pre.append(source.slice(0, start), mark, source.slice(end));
  modal.body.append(pre);
  document.body.append(modal.scrim);
  const release = trapFocus(modal.dialog);
  explainSourceDismiss = (restore) => {
    release();
    modal.scrim.remove();
    explainSourceDismiss = null;
    if (restore && canRestoreNonEditableFocus(previous))
      previous.focus({ preventScroll: true });
  };
  modal.dialog.querySelector('button')?.focus();
  mark.scrollIntoView?.({ block: 'center' });
}

/** Avoid adding highlight wrappers to the reading surface. @param {Range} range @param {Element} owner */
function revealExplainRange(range, owner) {
  owner.scrollIntoView?.({ block: 'center' });
  const root = document.getElementById('markdown-content');
  const bounds = range.getBoundingClientRect?.();
  if (bounds?.height && root) {
    const frame = root.getBoundingClientRect();
    if (bounds.top < frame.top || bounds.top >= frame.bottom)
      root.scrollTop += bounds.top - frame.top - frame.height / 3;
  }
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
}

/** @param {Element} root @param {Range|null} selected @returns {ExplainBlock[]} */
function collectExplainBlocks(root, selected) {
  /** @type {ExplainBlock[]} */
  const blocks = [];
  let newParagraph = false;
  /** @type {Element|null} */
  let heading = null;
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        if (node instanceof Element && node.matches(explainIgnore))
          return NodeFilter.FILTER_REJECT;
        // Read the original source of a rendered diagram. A text selection within
        // the graphic itself can still quote just the selected SVG label.
        if (
          node instanceof Element &&
          node.parentElement?.matches('.diagram-container') &&
          (!selected ||
            (selected.comparePoint(node.parentElement, 0) === 0 &&
              selected.comparePoint(
                node.parentElement,
                node.parentElement.childNodes.length
              ) === 0))
        )
          return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (node instanceof Element && node.matches(explainHeadings))
      heading = node;
    if (selected && !selected.intersectsNode(node)) continue;
    if (node instanceof Element) {
      if (node.tagName === 'BR') newParagraph = true;
      if (
        node.matches('.diagram-container') &&
        (!selected ||
          (selected.comparePoint(node, 0) === 0 &&
            selected.comparePoint(node, node.childNodes.length) === 0))
      ) {
        const source = node
          .querySelector('.diagram-wrapper svg[data-mermaid-source]')
          ?.getAttribute('data-mermaid-source');
        if (source) blocks.push({ element: node, runs: [], source, heading });
      }
      continue;
    }
    if (!(node instanceof Text) || !node.parentElement) continue;
    const start = selected?.startContainer === node ? selected.startOffset : 0;
    const end =
      selected?.endContainer === node ? selected.endOffset : node.length;
    if (end <= start) continue;
    const element = node.parentElement.closest(explainBlockSelector) || root;
    let block = blocks[blocks.length - 1];
    if (
      newParagraph ||
      block?.element !== element ||
      block.source !== undefined
    ) {
      newParagraph = false;
      block = { element, runs: [], heading };
      blocks.push(block);
    }
    block.runs.push({ node, start, end });
  }
  return blocks.filter(
    (b) =>
      b.source !== undefined ||
      b.runs.some((r) => r.node.data.slice(r.start, r.end).trim())
  );
}

/** @param {ExplainBlock} block */
function explainBlockText(block) {
  return (
    block.source ??
    block.runs.map((r) => r.node.data.slice(r.start, r.end)).join('')
  );
}

/** @param {ExplainRun[]} runs @param {number} offset @param {boolean} atEnd */
function explainBoundary(runs, offset, atEnd) {
  for (const run of runs) {
    const length = run.end - run.start;
    if (offset < length || (atEnd && offset === length))
      return { node: run.node, offset: run.start + offset };
    offset -= length;
  }
  const last = runs[runs.length - 1];
  return { node: last.node, offset: last.end };
}

/** @param {ExplainBlock} block @param {number} start @param {number} end @param {string} text @param {ExplainContext} context @returns {ExplainExcerpt} */
function explainExcerpt(block, start, end, text, context) {
  const { element, source, runs } = block;
  if (source !== undefined) {
    return {
      id: `d${explainNodeId(element)}-${start}-${end}`,
      text,
      reveal() {
        if (!isDocumentContextCurrent(context) || !element.isConnected) return;
        element.scrollIntoView?.({ block: 'center' });
        explainDiagramSource(
          source,
          start,
          end,
          source.slice(0, start).split('\n').length
        );
      },
    };
  }
  const from = explainBoundary(runs, start, false);
  const to = explainBoundary(runs, end, true);
  return {
    id: `t${explainNodeId(from.node)}-${from.offset}-${explainNodeId(to.node)}-${to.offset}`,
    text,
    reveal() {
      if (
        !isDocumentContextCurrent(context) ||
        !element.contains(from.node) ||
        !element.contains(to.node)
      )
        return;
      const range = document.createRange();
      range.setStart(from.node, from.offset);
      range.setEnd(to.node, to.offset);
      revealExplainRange(range, from.node.parentElement || element);
    },
  };
}

/** @param {ExplainBlock} block @param {ExplainContext} context */
function explainSequenceSteps(block, context) {
  const parsed = parseExplainSequence(explainBlockText(block));
  if (!parsed) return null;
  const labels = block.element.querySelectorAll(
    '.diagram-wrapper svg .messageText'
  );
  const mapped =
    labels.length === parsed.length &&
    parsed.every((s, i) => labels[i].textContent?.trim() === s.message);
  return parsed.map((s, i) => {
    const prefix = s.branches.length ? s.branches.join(' / ') + ' — ' : '';
    const text = prefix + s.sender + ' → ' + s.recipient + ': ' + s.message;
    const excerpt = explainExcerpt(block, s.start, s.end, text, context);
    if (mapped) {
      const fallback = excerpt.reveal;
      excerpt.reveal = () => {
        if (!isDocumentContextCurrent(context)) return;
        if (!labels[i].isConnected) return fallback();
        const range = document.createRange();
        range.selectNodeContents(labels[i]);
        revealExplainRange(range, labels[i]);
      };
    }
    return excerpt;
  });
}

/** @param {Element|null} heading */
function explainHeadingName(heading) {
  if (!heading) return 'Opening text';
  const copy = heading.cloneNode(true);
  if (!(copy instanceof Element)) return 'Section';
  copy.querySelectorAll(explainIgnore).forEach((el) => el.remove());
  return copy.textContent?.trim().slice(0, 100) || 'Section';
}

/** @param {Element} element */
function isExplainMermaidCode(element) {
  return (
    element.matches('pre') && !!element.querySelector('code.language-mermaid')
  );
}

/** @param {string} kind @param {string} label @param {ExplainBlock[]} blocks @param {ExplainContext} context @returns {Omit<ExplainScope,'key'>} */
function makeExplainScope(kind, label, blocks, context) {
  /** @type {Omit<ExplainScope,'key'>} */
  const scope = { kind, label, preview: '', excerpts: [] };
  let remaining = 6000;
  /** @type {Set<Element|null>} */
  const covered = new Set();
  for (const block of blocks) {
    const text = explainBlockText(block);
    const diagram =
      block.source !== undefined || isExplainMermaidCode(block.element);
    const steps =
      diagram && kind !== 'selection'
        ? explainSequenceSteps(block, context)
        : null;
    if (kind === 'diagram') {
      if (steps)
        scope.walkthrough = steps.map((e) => ({
          text: e.text,
          sourceId: e.id,
          reveal: e.reveal,
        }));
      else
        scope.fallback =
          'A step-by-step walkthrough is available for sequence diagrams with messages and alt/else branches. View the diagram source below.';
    }
    const excerpts = function* () {
      if (steps) {
        yield* steps;
        return;
      }
      let offset = 0;
      while (offset < text.length) {
        let end = Math.min(text.length, offset + 1000);
        // Keep code citations tied to their original lines, including fenced
        // blocks with syntax highlighting split across several DOM text nodes.
        if (diagram || block.element.matches('pre')) {
          const newline = text.indexOf('\n', offset);
          if (newline >= offset && newline < end) end = newline + 1;
        }
        if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end--;
        const part = text.slice(offset, end);
        if (part.trim())
          yield explainExcerpt(block, offset, end, part, context);
        offset = end;
      }
    };
    for (const excerpt of excerpts()) {
      if (
        scope.excerpts.length >= 24 ||
        remaining < excerpt.text.length ||
        excerpt.text.length > 1000
      ) {
        const names = Array.from(covered, explainHeadingName);
        scope.coverage =
          (names.length
            ? 'Covered in source order: ' + names.join(', ') + '. '
            : '') +
          'Coverage stops before the next passage in “' +
          explainHeadingName(block.heading) +
          '”. Later source is outside this answer.';
        return scope;
      }
      scope.excerpts.push(excerpt);
      scope.preview ||= excerpt.text.trim().slice(0, 120);
      covered.add(block.heading);
      remaining -= excerpt.text.length;
    }
  }
  return scope;
}

/** The picker needs names and identities up front. Parse diagrams and build
 * ranges only once the reader uses the corresponding scope.
 * @param {string} kind @param {string} label @param {string} identity
 * @param {ExplainBlock[]} blocks @param {ExplainContext} context @returns {ExplainScope}
 */
function describeExplainScope(kind, label, identity, blocks, context) {
  /** @type {ReturnType<typeof makeExplainScope>|undefined} */
  let resolved;
  const resolve = () =>
    (resolved ||= makeExplainScope(kind, label, blocks, context));
  return {
    key: [context.generation, kind, identity].join(':'),
    kind,
    label,
    get excerpts() {
      return resolve().excerpts;
    },
    get preview() {
      return resolve().preview;
    },
    get coverage() {
      return resolve().coverage;
    },
    get walkthrough() {
      return resolve().walkthrough;
    },
    get fallback() {
      return resolve().fallback;
    },
  };
}

/** Capture before opening More. Selection offsets and source actions belong to
 * this render. The scope order is also the picker order.
 * @param {Range|null} [range] @param {Element|null} [focused] @returns {ExplainScope[]}
 */
export function captureExplainScopes(range, focused = document.activeElement) {
  const context = captureDocumentContext();
  const root = context.root;
  if (!root) return [];
  const selection = window.getSelection();
  if (range === undefined)
    range = selection?.rangeCount ? selection.getRangeAt(0) : null;
  if (
    range?.collapsed ||
    !root.contains(range?.commonAncestorContainer || null)
  )
    range = null;
  const blocks = collectExplainBlocks(root, null);
  if (!blocks.length) return [];
  /** @type {ExplainScope[]} */
  const scopes = [];
  const selected = range ? collectExplainBlocks(root, range) : [];
  let heading = selected[0]?.heading || null;
  if (range && selected.length) {
    scopes.push(
      describeExplainScope(
        'selection',
        heading ? 'Selection · ' + explainHeadingName(heading) : 'Selection',
        [
          explainNodeId(range.startContainer),
          range.startOffset,
          explainNodeId(range.endContainer),
          range.endOffset,
        ].join('-'),
        selected,
        context
      )
    );
  }
  const explicit = focused?.closest('pre,.diagram-container');
  const target = explicit ? blocks.find((b) => b.element === explicit) : null;
  if (target && !selected.length) heading = target.heading;
  if (!selected.length && !target) {
    const focusedBlock =
      focused && focused !== root && root.contains(focused)
        ? blocks.find((b) => b.element.contains(focused))
        : null;
    if (focusedBlock) heading = focusedBlock.heading;
    else {
      const top = root.getBoundingClientRect().top;
      let visible = blocks[0];
      for (const block of blocks) {
        const rect = block.element.getBoundingClientRect();
        if (rect.bottom > top) {
          visible = block;
          break;
        }
        if (rect.height) visible = block;
      }
      heading = visible.heading;
    }
  }
  let sectionBlocks = blocks;
  if (heading) {
    const first = blocks.findIndex((b) => b.element === heading);
    if (first >= 0) {
      const rank = Number(heading.tagName[1]);
      let end = first + 1;
      while (
        end < blocks.length &&
        !(
          blocks[end].element.matches(explainHeadings) &&
          Number(blocks[end].element.tagName[1]) <= rank
        )
      )
        end++;
      sectionBlocks = blocks.slice(first, end);
      scopes.push(
        describeExplainScope(
          'section',
          'Section · ' + explainHeadingName(heading),
          String(explainNodeId(heading)),
          sectionBlocks,
          context
        )
      );
    }
  }
  const documentScope = describeExplainScope(
    'document',
    'Whole document',
    String(explainNodeId(root)),
    blocks,
    context
  );
  if (!scopes.length && !target) scopes.push(documentScope);

  // A diagram opens fullscreen when tapped. Make it reachable directly from
  // More even when the reader has never put keyboard focus inside the figure.
  // Prefer blocks in the current section in a very large collection of fences.
  const localBlocks = new Set(sectionBlocks);
  /** @type {Map<string,number>} */
  const occurrences = new Map();
  /** @type {Map<Element,string>} */
  const headingNames = new Map();
  const targets = blocks
    .filter((b) => b.source !== undefined || b.element.matches('pre'))
    .map((b) => {
      const kind =
        b.source !== undefined || isExplainMermaidCode(b.element)
          ? 'diagram'
          : 'code';
      if (b.heading && !headingNames.has(b.heading))
        headingNames.set(b.heading, explainHeadingName(b.heading));
      const name =
        (kind === 'diagram' ? 'Diagram' : 'Code block') +
        (b.heading ? ' · ' + headingNames.get(b.heading) : '');
      const occurrence = (occurrences.get(name) || 0) + 1;
      occurrences.set(name, occurrence);
      return { block: b, kind, name, occurrence };
    });
  const offered = { diagram: 0, code: 0 };
  for (const { block: b, kind, name, occurrence } of [
    ...targets.filter((t) => localBlocks.has(t.block)),
    ...targets.filter((t) => !localBlocks.has(t.block)),
  ]) {
    const explicitTarget = b === target && !selected.length;
    const count = kind === 'diagram' ? ++offered.diagram : ++offered.code;
    if (count > 100 && !explicitTarget) continue;
    const label =
      (occurrences.get(name) || 0) > 1 ? name + ' (' + occurrence + ')' : name;
    const choice = describeExplainScope(
      kind,
      label,
      String(explainNodeId(b.element)),
      [b],
      context
    );
    if (explicitTarget) scopes.unshift(choice);
    else scopes.push(choice);
  }
  if (!scopes.includes(documentScope)) scopes.push(documentScope);
  return scopes;
}
