// @ts-check
// "About SpecDown" dialog, opened from the header ⋮ menu. Holds the version,
// any available-update link, and the support/privacy/source links that used to
// sit in the header — a public app keeps build details out of the main chrome.

import { trapFocus } from '../core/focus-trap.js';
import { getAppVersion, getAvailableUpdate } from './version-check.js';

const ABOUT_LINKS = [
  { label: 'Support', href: 'https://specdown.mosaicpando.com/support.html' },
  {
    label: 'Privacy Policy',
    href: 'https://specdown.mosaicpando.com/privacy.html',
  },
  { label: 'Source code', href: 'https://github.com/cbremer/specdown' },
];

/** @type {HTMLElement | null} */
let aboutOverlay = null;
/** @type {Element | null} */
let aboutPreviousFocus = null;
/** @type {(() => void) | null} */
let aboutReleaseTrap = null;

export function isAboutDialogOpen() {
  return aboutOverlay !== null;
}

/** @param {string} text @param {string} href */
function aboutLink(text, href) {
  const link = document.createElement('a');
  link.href = href;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = text;
  return link;
}

export function openAboutDialog() {
  if (aboutOverlay) return;
  aboutPreviousFocus = document.activeElement;

  aboutOverlay = document.createElement('div');
  aboutOverlay.className = 'shortcuts-overlay';
  aboutOverlay.addEventListener('mousedown', (e) => {
    if (e.target === aboutOverlay) closeAboutDialog();
  });

  const dialog = document.createElement('div');
  dialog.className = 'shortcuts-sheet about-sheet';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'about-title');
  dialog.tabIndex = -1;
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAboutDialog();
    }
  });

  const heading = document.createElement('h2');
  heading.id = 'about-title';
  heading.className = 'shortcuts-title';
  heading.textContent = 'SpecDown';
  dialog.appendChild(heading);

  const tagline = document.createElement('p');
  tagline.className = 'about-tagline';
  tagline.textContent = 'A Markdown viewer with live Mermaid diagrams.';
  dialog.appendChild(tagline);

  const version = document.createElement('p');
  version.id = 'about-version';
  version.className = 'about-version';
  version.textContent = 'Version ' + getAppVersion();
  dialog.appendChild(version);

  const update = getAvailableUpdate();
  if (update) {
    const updateLine = document.createElement('p');
    updateLine.className = 'about-update';
    updateLine.appendChild(
      aboutLink('Version ' + update.version + ' is available', update.url)
    );
    dialog.appendChild(updateLine);
  }

  const links = document.createElement('ul');
  links.className = 'about-links';
  for (const { label, href } of ABOUT_LINKS) {
    const item = document.createElement('li');
    item.appendChild(aboutLink(label, href));
    links.appendChild(item);
  }
  dialog.appendChild(links);

  const done = document.createElement('button');
  done.type = 'button';
  done.className = 'about-done';
  done.textContent = 'Done';
  done.addEventListener('click', () => closeAboutDialog());
  dialog.appendChild(done);

  aboutOverlay.appendChild(dialog);
  document.body.appendChild(aboutOverlay);
  aboutReleaseTrap = trapFocus(aboutOverlay);
  dialog.focus();
}

export function closeAboutDialog() {
  if (!aboutOverlay) return;
  if (aboutReleaseTrap) aboutReleaseTrap();
  aboutReleaseTrap = null;
  if (aboutOverlay.parentNode)
    aboutOverlay.parentNode.removeChild(aboutOverlay);
  aboutOverlay = null;
  const previous = /** @type {HTMLElement | null} */ (aboutPreviousFocus);
  if (previous && typeof previous.focus === 'function') previous.focus();
  aboutPreviousFocus = null;
}

/** Wire the "About SpecDown" item in the header ⋮ menu. */
export function setupAbout() {
  const aboutItem = document.getElementById('about-button');
  const aboutMenu = document.getElementById('header-more-menu');
  const aboutToggle = document.getElementById('header-more-toggle');
  if (!aboutItem) return;
  aboutItem.addEventListener('click', (event) => {
    event.stopPropagation();
    if (aboutMenu) aboutMenu.hidden = true;
    if (aboutToggle) aboutToggle.setAttribute('aria-expanded', 'false');
    openAboutDialog();
  });
}
