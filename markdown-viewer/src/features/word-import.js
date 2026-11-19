// Extract only the main Word story. Never resolve relationships or load media.
import { unzipSync } from 'fflate';
import { DOCUMENT_MAX_BYTES } from '../core/document-limits.js';
import { showToast } from './toast.js';

/** @param {string} value */
function wordLiteral(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/([\\`*_{}[\]#|~>])/g, '\\$1');
}

/** @param {Element} paragraph */
function wordParagraph(paragraph) {
  const ns = paragraph.namespaceURI;
  const text = [];
  for (const run of paragraph.getElementsByTagNameNS(ns, 'r')) {
    if (run.closest('del, moveFrom') || run.parentElement?.localName === 'del')
      continue;
    let body = '';
    for (const part of run.children) {
      if (part.localName === 't') body += wordLiteral(part.textContent || '');
      if (part.localName === 'tab') body += '    ';
      if (part.localName === 'br' || part.localName === 'cr') body += '  \n';
    }
    if (!body) continue;
    const properties = run.getElementsByTagNameNS(ns, 'rPr')[0];
    for (const [name, marker] of [
      ['b', '**'],
      ['i', '*'],
    ]) {
      const style = properties?.getElementsByTagNameNS(ns, name)[0];
      if (
        style &&
        !['false', '0', 'off'].includes(style.getAttributeNS(ns, 'val') || '')
      ) {
        const trimmed = body.trim();
        if (trimmed) {
          const start = body.length - body.trimStart().length;
          body =
            body.slice(0, start) +
            marker +
            trimmed +
            marker +
            body.slice(start + trimmed.length);
        }
      }
    }
    text.push(body);
  }
  const style =
    paragraph
      .getElementsByTagNameNS(ns, 'pStyle')[0]
      ?.getAttributeNS(ns, 'val') || '';
  const heading = /^Heading([1-6])$/i.exec(style);
  const list = paragraph.getElementsByTagNameNS(ns, 'numPr')[0];
  const prefix = heading
    ? '#'.repeat(Number(heading[1])) + ' '
    : list
      ? '- '
      : '';
  return prefix + text.join('');
}

/** @param {string} encoded */
export function convertWordDocument(encoded) {
  if (encoded.length > Math.ceil(DOCUMENT_MAX_BYTES / 3) * 4)
    throw Error('File too large');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  if (bytes.length < 22 || bytes.length > DOCUMENT_MAX_BYTES)
    throw Error('Invalid file size');
  const mainPart = 'word/document.xml';
  let entries = 0,
    found = false;
  const parts = unzipSync(bytes, {
    filter(entry) {
      if (++entries > 4096) throw Error('Too many ZIP entries');
      if (entry.name !== mainPart) return false;
      if (
        found ||
        entry.originalSize > DOCUMENT_MAX_BYTES ||
        entry.size > DOCUMENT_MAX_BYTES
      )
        throw Error('Invalid document part');
      found = true;
      return true;
    },
  });
  if (!parts[mainPart]) throw Error('Missing Word document');
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(parts[mainPart]);
  if (/<!DOCTYPE/i.test(xml)) throw Error('Unsupported document declaration');
  // Bound XML markup as well as bytes before allocating a document tree.
  let tags = 0;
  for (let i = xml.indexOf('<'); i >= 0; i = xml.indexOf('<', i + 1)) {
    if (++tags > 160000) throw Error('Word document is too complex');
  }
  const root = new DOMParser().parseFromString(
    xml,
    'application/xml'
  ).documentElement;
  if (
    root.localName !== 'document' ||
    ![
      'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
      'http://purl.oclc.org/ooxml/wordprocessingml/main',
    ].includes(root.namespaceURI || '')
  )
    throw Error('Invalid Word document');
  const body = root.getElementsByTagNameNS(root.namespaceURI, 'body')[0];
  if (!body) throw Error('Missing body');
  const blocks = [];
  for (const child of body.children) {
    if (child.localName === 'tbl') {
      const rows = [...child.children]
        .filter((el) => el.localName === 'tr')
        .map((row) =>
          [...row.children]
            .filter((el) => el.localName === 'tc')
            .map((cell) =>
              [...cell.getElementsByTagNameNS(root.namespaceURI, 'p')]
                .map(wordParagraph)
                .join(' ')
                .replace(/\n/g, ' ')
            )
        );
      if (rows[0]?.length) {
        rows.splice(
          1,
          0,
          rows[0].map(() => '---')
        );
        blocks.push(
          rows.map((row) => '| ' + row.join(' | ') + ' |').join('\n')
        );
      }
    } else {
      const paragraphs =
        child.localName === 'p'
          ? [child]
          : child.getElementsByTagNameNS(root.namespaceURI, 'p');
      for (const paragraph of paragraphs) blocks.push(wordParagraph(paragraph));
    }
  }
  const markdown = blocks.join('\n\n').trim();
  if (!markdown) throw Error('No readable text');
  return markdown + '\n';
}

/** @param {string} encoded @param {string} filename @param {(text:string)=>boolean} admit */
export function openWordDocument(encoded, filename, admit) {
  let content;
  try {
    content = convertWordDocument(encoded);
  } catch {
    showToast(
      'Could not import this Word document. Choose an unencrypted .docx with readable text up to 8 MiB.',
      { type: 'error' }
    );
    return false;
  }
  const accepted = admit(content);
  if (accepted)
    showToast(
      'Imported ' +
        filename +
        ' as Markdown. Images and page layout are omitted.'
    );
  return accepted;
}
