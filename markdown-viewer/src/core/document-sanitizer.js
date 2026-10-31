// @ts-check
import DOMPurify from 'dompurify';
import { DOCUMENT_MAX_NODES } from './document-limits.js';

// Documents share a DOM with native-action controls. Script sanitization alone
// does not prevent CSS overlays, label activation, or trusted-ID collisions.
export function sanitizeDocumentHtml(/** @type {string} */ html) {
  // Bound markup before the HTML parser or DOMPurify allocates a tree.
  // indexOf avoids constructing an array with one entry per token.
  let markupTokens = 0;
  let markupOffset = html.indexOf('<');
  while (markupOffset !== -1) {
    if (++markupTokens > 2 * DOCUMENT_MAX_NODES) {
      throw new Error('This document contains too many elements to display.');
    }
    markupOffset = html.indexOf('<', markupOffset + 1);
  }
  const sanitized = DOMPurify.sanitize(html, {
    ADD_TAGS: ['#comment'],
    FORCE_BODY: true,
    FORBID_TAGS: [
      'style',
      'form',
      'dialog',
      'button',
      'textarea',
      'select',
      'option',
      'label',
      'iframe',
      'object',
      'embed',
      'svg',
      'math',
    ],
    FORBID_ATTR: [
      'style',
      'name',
      'for',
      'form',
      'autofocus',
      'slot',
      'hidden',
      'popover',
      'popovertarget',
      'popovertargetaction',
      'command',
      'commandfor',
    ],
    SANITIZE_NAMED_PROPS: true,
  });
  const template = document.createElement('template');
  template.innerHTML = sanitized;
  const nodes = template.content.querySelectorAll('*');
  if (nodes.length > DOCUMENT_MAX_NODES)
    throw new Error('This document contains too many elements to display.');
  for (const node of nodes) {
    // GFM task lists remain readable, but document inputs cannot accept input
    // or participate in an application form/label association.
    if (node.tagName === 'INPUT') {
      if (node.getAttribute('type') !== 'checkbox') {
        node.remove();
        continue;
      }
      node.setAttribute('disabled', '');
      node.removeAttribute('id');
      node.removeAttribute('value');
    }
    // Application CSS classes can themselves create overlays. Preserve only
    // syntax-highlighting classes; Mermaid adds its own controls after this pass.
    const classes = Array.from(node.classList).filter((name) =>
      /^(?:language-[\w-]+|hljs(?:-[\w-]+)?)$/.test(name)
    );
    node.removeAttribute('class');
    if (classes.length) node.setAttribute('class', classes.join(' '));
    for (const attribute of Array.from(node.attributes)) {
      if (attribute.name.startsWith('data-'))
        node.removeAttribute(attribute.name);
    }
    for (const attribute of ['href', 'src', 'poster', 'srcset', 'background']) {
      const value = node.getAttribute(attribute);
      if (!value) continue;
      const compact = value.replace(/\s/g, '');
      let decoded = compact;
      let invalid = false;
      try {
        decoded = decodeURIComponent(compact);
      } catch {
        invalid = true;
      }
      const unsafeResourcePath =
        attribute !== 'href' &&
        !/^(?:https:|data:|blob:)/i.test(compact) &&
        (/^[\\/]/.test(decoded) || decoded.split(/[\\/]/).includes('..'));
      if (
        invalid ||
        attribute === 'srcset' ||
        /^(?:file:|http:|[\\/]{2})/i.test(compact) ||
        unsafeResourcePath
      )
        node.removeAttribute(attribute);
      else if (
        attribute === 'href' &&
        value.startsWith('#') &&
        value.length > 1
      ) {
        node.setAttribute(attribute, '#user-content-' + value.slice(1));
      }
    }
    let depth = 0;
    for (
      let parent = node.parentElement;
      parent;
      parent = parent.parentElement
    ) {
      if (++depth > 64)
        throw new Error('This document is nested too deeply to display.');
    }
  }
  return template.innerHTML;
}
