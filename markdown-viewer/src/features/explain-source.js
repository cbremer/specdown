import {
  captureDocumentContext,
  isDocumentContextCurrent,
} from '../core/document-context.js';
import { DOCUMENT_MAX_DIAGRAM_CHARS } from '../core/document-limits.js';
import { canRestoreNonEditableFocus, trapFocus } from '../core/focus-trap.js';
import { createSdModal } from '../core/modal.js';

/** @typedef {ReturnType<typeof captureDocumentContext>} ExplainContext */
/** @typedef {{id:string,text:string,label:string,ariaLabel:string,reveal:()=>void}} ExplainExcerpt */
/** @typedef {{text:string,label:string,branchLabel:string,sourceId:string,reveal:()=>void}} ExplainStep */
/** @typedef {{key:string,kind:string,label:string,mark:()=>void,containingSection?:ExplainScope,sectionKey?:string,preview:string,excerpts:ExplainExcerpt[], coverage?:string,fallback?:string,walkthrough?:ExplainStep[]}} ExplainScope */
/** @typedef {{node:Text,start:number,end:number}} ExplainRun */
/** @typedef {{element:Element, runs:ExplainRun[], source?:string, heading:Element|null, paragraph?:number, firstLine?:number, blockNumber?:number,headingName?:string}} ExplainBlock */

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
  /** @type {string[]} */
  const branchKinds = [];
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
      if (branch[1] === 'alt') {
        branches.push(branch[2]);
        branchKinds.push('If ');
      } else if (branches.length) {
        branches[branches.length - 1] = branch[2];
        branchKinds[branches.length - 1] = 'Otherwise, ';
      } else return null;
      continue;
    }
    if (line === 'end') {
      if (!branches.length) return null;
      branches.pop();
      branchKinds.pop();
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
      branchLabel: branches
        .map((label, i) => branchKinds[i] + label)
        .join(' / '),
      line: index + 1,
      start: offset,
      end: offset + raw.trimEnd().length,
    });
  }
  return header && !branches.length && steps.length ? steps : null;
}

let removeExplainScopeMark = () => {};
let removeExplainCitationMark = () => {};
let explainMarkedScope = '';

/** Preserve original classes and the distinction between an absent and an
 * empty class attribute. The render is also used for export and annotations.
 * @param {Element[]} elements @param {string} className
 */
function addExplainClass(elements, className) {
  const changed = elements
    .filter((el) => !el.classList.contains(className))
    .map((el) => ({ el, hadClass: el.hasAttribute('class') }));
  for (const { el } of changed) el.classList.add(className);
  return () => {
    for (const { el, hadClass } of changed) {
      el.classList.remove(className);
      if (!hadClass && !el.classList.length) el.removeAttribute('class');
    }
  };
}

export function clearExplainScopeMark() {
  removeExplainScopeMark();
  removeExplainScopeMark = () => {};
}

export function clearExplainMarks() {
  clearExplainScopeMark();
  removeExplainCitationMark();
  removeExplainCitationMark = () => {};
  explainMarkedScope = '';
}

/** Inline markup can produce several touching or duplicate DOM rectangles for
 * one visual line. Join them before outlining the citation, preserving gaps
 * and line breaks. @param {Range} range @param {DOMRect} pane */
function explainLineFragments(range, pane) {
  /** @type {{left:number,top:number,right:number,bottom:number}[]} */
  const lines = [];
  for (const rect of range.getClientRects?.() || []) {
    const left = Math.max(pane.left, rect.left);
    const right = Math.min(pane.right, rect.right);
    const top = Math.max(pane.top, rect.top);
    const bottom = Math.min(pane.bottom, rect.bottom);
    if (left >= right || top >= bottom) continue;
    const previous = lines.at(-1);
    if (
      previous &&
      Math.abs(top - previous.top) <= 2 &&
      Math.abs(bottom - previous.bottom) <= 2 &&
      left <= previous.right + 1 &&
      right >= previous.left - 1
    ) {
      previous.left = Math.min(left, previous.left);
      previous.right = Math.max(right, previous.right);
      previous.top = Math.min(top, previous.top);
      previous.bottom = Math.max(bottom, previous.bottom);
    } else lines.push({ left, right, top, bottom });
  }
  return lines;
}

/** Range highlights cannot draw outlines. Overlay their fragment rectangles
 * outside the reader, so partial text, code offsets, selections and the rendered
 * Markdown remain intact. Reuse each box so scroll does not restart its flash.
 * @param {Range} range @param {string} className @param {HTMLElement} root
 */
function drawExplainFragments(range, className, root) {
  const layer = document.createElement('div');
  layer.className = 'explain-mark-layer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.append(layer);
  let frame = 0;
  function paint() {
    frame = 0;
    const pane = root.getBoundingClientRect();
    let count = 0;
    for (const { left, top, right, bottom } of explainLineFragments(
      range,
      pane
    )) {
      let box = layer.children[count++];
      if (!(box instanceof HTMLElement)) {
        box = document.createElement('span');
        box.className = className;
        layer.append(box);
      }
      Object.assign(/** @type {HTMLElement} */ (box).style, {
        left: left + 'px',
        top: top + 'px',
        width: right - left + 'px',
        height: bottom - top + 'px',
      });
    }
    while (layer.children.length > count) layer.lastElementChild?.remove();
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(paint);
  }
  const resizer =
    typeof ResizeObserver === 'function' ? new ResizeObserver(schedule) : null;
  resizer?.observe(root);
  window.addEventListener('scroll', schedule, true);
  window.addEventListener('resize', schedule);
  paint();
  return () => {
    cancelAnimationFrame(frame);
    resizer?.disconnect();
    window.removeEventListener('scroll', schedule, true);
    window.removeEventListener('resize', schedule);
    layer.remove();
  };
}

export function closeExplainSource() {
  explainSourceDismiss?.(false);
  clearExplainMarks();
}

/** @param {string} source @param {number} start @param {number} end @param {number} line */
function explainDiagramSource(source, start, end, line) {
  explainSourceDismiss?.(false);
  removeExplainCitationMark();
  const previous = document.activeElement;
  const modal = createSdModal({
    title: 'Diagram source · Line ' + line,
    onClose: () => explainSourceDismiss?.(true),
  });
  const pre = document.createElement('pre');
  const mark = document.createElement('mark');
  mark.textContent = source.slice(start, end);
  mark.className = 'citation-reveal';
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
  removeExplainCitationMark();
  if (owner instanceof SVGElement) {
    removeExplainCitationMark = addExplainClass([owner], 'citation-reveal');
  } else if (root) {
    removeExplainCitationMark = drawExplainFragments(
      range,
      'citation-reveal',
      root
    );
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

/** @param {ExplainBlock} block @param {number} start @param {number} end @param {string} text @param {ExplainContext} context @param {string} label @param {string} [ariaLabel] @returns {ExplainExcerpt} */
function explainExcerpt(
  block,
  start,
  end,
  text,
  context,
  label,
  ariaLabel = label
) {
  const { element, source, runs } = block;
  if (source !== undefined) {
    return {
      id: `d${explainNodeId(element)}-${start}-${end}`,
      text,
      label,
      ariaLabel,
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
    label,
    ariaLabel,
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
    const label = s.sender + ' → ' + s.recipient + ' · ' + s.message;
    const excerpt = explainExcerpt(
      block,
      s.start,
      s.end,
      text,
      context,
      explainLocation(block, 'diagram', 'step ' + (i + 1))
    );
    const step = {
      text,
      label,
      branchLabel: s.branchLabel,
      sourceId: excerpt.id,
      reveal: () => excerpt.reveal(),
    };
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
    return { excerpt, step };
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

/** @param {ExplainBlock} block @param {string} kind @param {string} part */
function explainLocation(block, kind, part) {
  const section = (block.headingName ||= explainHeadingName(block.heading));
  const qualifier =
    (block.blockNumber || 0) > 1 ? kind + ' ' + block.blockNumber + ', ' : '';
  return section + ', ' + qualifier + part;
}

/** @param {string} kind @param {string} label @param {ExplainBlock[]} blocks @param {ExplainContext} context @returns {Omit<ExplainScope,'key'|'mark'>} */
function makeExplainScope(kind, label, blocks, context) {
  /** @type {Omit<ExplainScope,'key'|'mark'>} */
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
      if (steps) scope.walkthrough = steps.map((s) => s.step);
      else
        scope.fallback =
          'A step-by-step walkthrough is available for sequence diagrams with messages and alt/else branches. View the diagram source below.';
    }
    const excerpts = function* () {
      if (steps) {
        for (const { excerpt } of steps) yield excerpt;
        return;
      }
      let offset = 0;
      let line = block.firstLine || 1;
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
        if (part.trim()) {
          const lineSource = diagram || block.element.matches('pre');
          const location = lineSource
            ? explainLocation(
                block,
                diagram ? 'diagram' : 'code block',
                'line ' + line
              )
            : block.element.matches(explainHeadings)
              ? explainLocation(block, '', 'heading')
              : explainLocation(block, '', '¶' + (block.paragraph || 1));
          yield explainExcerpt(
            block,
            offset,
            end,
            part,
            context,
            location,
            location.replace(/, ¶(\d+)$/, ', paragraph $1')
          );
        }
        if (part.endsWith('\n')) line++;
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
 * @param {ExplainBlock[]} blocks @param {ExplainContext} context @param {Range|null} [selectionRange]
 * @param {()=>ExplainScope|undefined} [parentSection] @returns {ExplainScope}
 */
function describeExplainScope(
  kind,
  label,
  identity,
  blocks,
  context,
  selectionRange = null,
  parentSection
) {
  /** @type {ReturnType<typeof makeExplainScope>|undefined} */
  let resolved;
  const resolve = () =>
    (resolved ||= makeExplainScope(kind, label, blocks, context));
  const key = [context.generation, kind, identity].join(':');
  return {
    key,
    get containingSection() {
      return parentSection?.();
    },
    get sectionKey() {
      return parentSection?.()?.key;
    },
    mark() {
      if (!isDocumentContextCurrent(context) || !context.root) return;
      if (explainMarkedScope !== key) clearExplainMarks();
      else clearExplainScopeMark();
      explainMarkedScope = key;
      if (selectionRange) {
        if (window.CSS?.highlights && window.Highlight) {
          CSS.highlights.set('explain-scope', new Highlight(selectionRange));
          removeExplainScopeMark = () => CSS.highlights.delete('explain-scope');
        } else
          removeExplainScopeMark = drawExplainFragments(
            selectionRange,
            'scope-mark',
            context.root
          );
        return;
      }
      const elements =
        kind === 'document'
          ? [context.root]
          : [...new Set(blocks.map((b) => b.element))];
      removeExplainScopeMark = addExplainClass(elements, 'scope-mark');
    },
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

/** Index section boundaries and source positions once for all of the lazy
 * picker choices. In particular a selected code fragment keeps the original
 * line number even when earlier lines are outside the selection.
 * @param {ExplainBlock[]} blocks @param {ExplainBlock[]} selected @param {ExplainContext} context
 */
function indexExplainSource(blocks, selected, context) {
  /** @typedef {{heading:Element|null,start:number,end:number,rank:number,parent?:ExplainSection,scope?:ExplainScope}} ExplainSection */
  /** @type {Map<Element|null, ExplainSection>} */
  const sections = new Map();
  /** @type {ExplainSection[]} */
  const stack = [];
  /** @type {Map<Element,{block:ExplainBlock,index:number}>} */
  const byElement = new Map();
  const counters = { paragraph: 0, code: 0, diagram: 0 };
  for (const [index, block] of blocks.entries()) {
    const el = block.element;
    if (el.matches(explainHeadings) && !sections.has(el)) {
      const rank = Number(el.tagName[1]);
      while (stack.length && stack[stack.length - 1].rank >= rank) {
        const section = stack.pop();
        if (section) section.end = index;
      }
      if (!sections.size && index)
        sections.set(null, { heading: null, start: 0, end: index, rank: 0 });
      const section = {
        heading: el,
        start: index,
        end: blocks.length,
        rank,
        parent: stack.at(-1),
      };
      sections.set(el, section);
      stack.push(section);
      counters.paragraph = counters.code = counters.diagram = 0;
    }
    const prior = byElement.get(el)?.block;
    if (prior) {
      block.paragraph = prior.paragraph;
      block.blockNumber = prior.blockNumber;
    } else {
      byElement.set(el, { block, index });
      if (block.source !== undefined || isExplainMermaidCode(el))
        block.blockNumber = ++counters.diagram;
      else if (el.matches('pre')) block.blockNumber = ++counters.code;
      else if (!el.matches(explainHeadings))
        block.paragraph = ++counters.paragraph;
    }
  }
  for (const block of selected) {
    const original = byElement.get(block.element)?.block;
    if (!original) continue;
    block.paragraph = original.paragraph;
    block.blockNumber = original.blockNumber;
    if (block.element.matches('pre') && block.runs.length) {
      const first = block.runs[0];
      let line = 1;
      for (const run of original.runs) {
        const end = run.node === first.node ? first.start : run.end;
        line += run.node.data.slice(run.start, end).split('\n').length - 1;
        if (run.node === first.node) break;
      }
      block.firstLine = line;
    }
  }
  /** @param {Element|null} heading @param {ExplainBlock} [last] */
  function sectionFor(heading, last) {
    let section = sections.get(heading);
    const index = last ? byElement.get(last.element)?.index : undefined;
    while (
      section &&
      index !== undefined &&
      (index < section.start || index >= section.end)
    )
      section = section.parent;
    if (!section) return undefined;
    return (section.scope ||= describeExplainScope(
      'section',
      'Section · ' + explainHeadingName(section.heading),
      section.heading ? String(explainNodeId(section.heading)) : 'opening',
      blocks.slice(section.start, section.end),
      context
    ));
  }
  return sectionFor;
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
  const sectionFor = indexExplainSource(blocks, selected, context);
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
        context,
        range.cloneRange(),
        () => sectionFor(selected[0].heading, selected.at(-1))
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
  const containing =
    heading || selected.length || target
      ? sectionFor(heading, selected.at(-1))
      : undefined;
  if (containing) scopes.push(containing);
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
  const nearby = (/** @type {ExplainBlock} */ b) => b.heading === heading;
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
    ...targets.filter((t) => nearby(t.block)),
    ...targets.filter((t) => !nearby(t.block)),
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
      context,
      null,
      () => sectionFor(b.heading)
    );
    if (explicitTarget) scopes.unshift(choice);
    else scopes.push(choice);
  }
  if (!scopes.includes(documentScope)) scopes.push(documentScope);
  return scopes;
}
