// @ts-check
// Optional nebula + starfield behind the empty-state drop zone.
// Available on web, desktop, and iOS. Default on for the web showcase,
// off for native shells until the user toggles it. Persisted as
// localStorage.starfield = '1' | '0'.
//
// Unique prefixes (starfield*): the test harness
// (tests/helpers/loadApp.js) flattens every module to global scope.

import { state } from '../core/state.js';
import { iconSvg } from '../core/icons.js';
import { isDesktop, isIOSNative } from '../core/platform.js';
import { syncIOSChrome } from '../platform/ios-chrome.js';
import { bridgeNotifyStarfield } from '../platform/bridge.js';

const STARFIELD_STORAGE_KEY = 'starfield';
const starfieldEl = (/** @type {string} */ id) => document.getElementById(id);

function starfieldIsWebSurface() {
  return !isDesktop && !isIOSNative;
}

function starfieldReadPreference() {
  const stored = localStorage.getItem(STARFIELD_STORAGE_KEY);
  if (stored === '1') return true;
  if (stored === '0') return false;
  return starfieldIsWebSurface();
}

function starfieldUpdateToggle() {
  const button = starfieldEl('starfield-toggle');
  if (!button) return;
  const on = !!state.starfieldEnabled;
  button.setAttribute('aria-pressed', on ? 'true' : 'false');
  const label = on
    ? 'Starfield on (click to turn off)'
    : 'Starfield off (click to turn on)';
  button.setAttribute('aria-label', label);
  button.setAttribute('title', label);
  button.classList.toggle('active', on);
  const icon = button.querySelector('.theme-icon');
  if (icon) {
    icon.setAttribute('data-icon', 'sparkles');
    icon.innerHTML = iconSvg('sparkles');
  }
}

/** @param {boolean} persist */
function starfieldApply(persist) {
  document.documentElement.setAttribute(
    'data-starfield',
    state.starfieldEnabled ? 'on' : 'off'
  );
  if (persist) {
    localStorage.setItem(
      STARFIELD_STORAGE_KEY,
      state.starfieldEnabled ? '1' : '0'
    );
  }
  starfieldUpdateToggle();
  syncIOSChrome();
  bridgeNotifyStarfield(state.starfieldEnabled);
  if (state.starfieldEnabled) starfieldEnsureField();
}

/**
 * @param {boolean} enabled
 */
export function setStarfieldEnabled(enabled) {
  state.starfieldEnabled = !!enabled;
  starfieldApply(true);
}

/**
 * Resolve the persisted (or surface-default) preference and paint the sky.
 */
export function setupStarfield() {
  state.starfieldEnabled = starfieldReadPreference();
  starfieldApply(false);
}

export function toggleStarfield() {
  setStarfieldEnabled(!state.starfieldEnabled);
}

/**
 * Starfield + cursor gravity well. Stars spring back to a home position but
 * part around the pointer, leaving a void bubble. Skipped when the canvas
 * has no layout box (jsdom) or the user prefers reduced motion — CSS nebula
 * still paints. Mounted once; later toggles only flip `data-starfield`.
 */
function starfieldEnsureField() {
  const dropZone = starfieldEl('drop-zone');
  if (!dropZone || starfieldEl('starfield-canvas')) return;

  const canvas = document.createElement('canvas');
  canvas.id = 'starfield-canvas';
  canvas.className = 'starfield-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  dropZone.insertBefore(canvas, dropZone.firstChild);

  const cursorCore = document.createElement('div');
  cursorCore.id = 'starfield-cursor-core';
  cursorCore.className = 'starfield-cursor-core';
  cursorCore.setAttribute('aria-hidden', 'true');
  cursorCore.innerHTML =
    '<span class="starfield-cursor-ring"></span><span class="starfield-cursor-dot"></span>';
  dropZone.insertBefore(cursorCore, canvas.nextSibling);

  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ctx = canvas.getContext('2d');
  if (!ctx || reduceMotion) return;
  if (dropZone.getBoundingClientRect().width < 1) return;

  const starfieldZone = dropZone;
  const starfieldCtx = ctx;
  const STARFIELD_STAR_COUNT = isIOSNative ? 70 : 120;
  const STARFIELD_WARP_RADIUS = 140;
  /** @type {{ x: number, y: number, homeX: number, homeY: number, r: number, tw: number, drift: number }[]} */
  const starfieldStars = [];
  const starfieldMouse = { x: -9999, y: -9999 };
  const starfieldCore = { x: -9999, y: -9999 };
  let starfieldW = 0;
  let starfieldH = 0;
  let starfieldDpr = 1;

  function starfieldResize() {
    starfieldW = Math.max(1, starfieldZone.clientWidth);
    starfieldH = Math.max(1, starfieldZone.clientHeight);
    starfieldDpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(starfieldW * starfieldDpr);
    canvas.height = Math.floor(starfieldH * starfieldDpr);
    canvas.style.top = starfieldZone.scrollTop + 'px';
    starfieldCtx.setTransform(starfieldDpr, 0, 0, starfieldDpr, 0, 0);
  }

  function starfieldSeed() {
    starfieldStars.length = 0;
    for (let i = 0; i < STARFIELD_STAR_COUNT; i++) {
      const x = Math.random() * starfieldW;
      const y = Math.random() * starfieldH;
      starfieldStars.push({
        x,
        y,
        homeX: x,
        homeY: y,
        r: Math.random() * 1.6 + 0.4,
        tw: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.15,
      });
    }
  }

  function starfieldPalette() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    return dark
      ? {
          star: 'rgba(220, 235, 255, 0.9)',
          warm: 'rgba(255, 140, 90, 0.85)',
          link: 'rgba(122, 184, 245, 0.16)',
        }
      : {
          star: 'rgba(22, 58, 99, 0.42)',
          warm: 'rgba(224, 90, 42, 0.8)',
          link: 'rgba(31, 107, 184, 0.2)',
        };
  }

  function starfieldTick() {
    requestAnimationFrame(starfieldTick);
    if (!state.starfieldEnabled) return;
    if (starfieldZone.style.display === 'none') return;

    if (
      starfieldZone.clientWidth !== starfieldW ||
      starfieldZone.clientHeight !== starfieldH
    ) {
      starfieldResize();
    }
    canvas.style.top = starfieldZone.scrollTop + 'px';

    starfieldCore.x += (starfieldMouse.x - starfieldCore.x) * 0.18;
    starfieldCore.y += (starfieldMouse.y - starfieldCore.y) * 0.18;
    cursorCore.style.top = starfieldZone.scrollTop + 'px';
    cursorCore.style.transform =
      'translate(' +
      starfieldCore.x +
      'px, ' +
      starfieldCore.y +
      'px) translate(-50%, -50%)';

    const palette = starfieldPalette();
    starfieldCtx.clearRect(0, 0, starfieldW, starfieldH);

    for (const star of starfieldStars) {
      star.homeX += star.drift;
      if (star.homeX < 0) star.homeX = starfieldW;
      if (star.homeX > starfieldW) star.homeX = 0;

      const dx = star.x - starfieldCore.x;
      const dy = star.y - starfieldCore.y;
      const dist = Math.hypot(dx, dy) || 0.0001;
      if (dist < STARFIELD_WARP_RADIUS) {
        const force = Math.pow(1 - dist / STARFIELD_WARP_RADIUS, 2) * 14;
        star.x += (dx / dist) * force;
        star.y += (dy / dist) * force;
      } else {
        star.x += (star.homeX - star.x) * 0.045;
        star.y += (star.homeY - star.y) * 0.045;
      }
      star.tw += 0.02;
    }

    starfieldCtx.lineWidth = 1;
    starfieldCtx.strokeStyle = palette.link;
    for (let i = 0; i < starfieldStars.length; i++) {
      const a = starfieldStars[i];
      for (let j = i + 1; j < starfieldStars.length; j++) {
        const b = starfieldStars[j];
        const gap = Math.hypot(a.x - b.x, a.y - b.y);
        if (gap > 78) continue;
        const midX = (a.x + b.x) / 2 - starfieldCore.x;
        const midY = (a.y + b.y) / 2 - starfieldCore.y;
        if (Math.hypot(midX, midY) < STARFIELD_WARP_RADIUS * 0.7) continue;
        starfieldCtx.globalAlpha = (1 - gap / 78) * 0.7;
        starfieldCtx.beginPath();
        starfieldCtx.moveTo(a.x, a.y);
        starfieldCtx.lineTo(b.x, b.y);
        starfieldCtx.stroke();
      }
    }
    starfieldCtx.globalAlpha = 1;

    for (const star of starfieldStars) {
      const near = Math.hypot(
        star.x - starfieldCore.x,
        star.y - starfieldCore.y
      );
      const flicker = 0.55 + Math.sin(star.tw) * 0.45;
      starfieldCtx.beginPath();
      starfieldCtx.fillStyle =
        near < STARFIELD_WARP_RADIUS * 1.15 ? palette.warm : palette.star;
      starfieldCtx.globalAlpha = flicker;
      starfieldCtx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      starfieldCtx.fill();
    }
    starfieldCtx.globalAlpha = 1;
  }

  starfieldResize();
  starfieldSeed();

  starfieldZone.addEventListener(
    'pointermove',
    (event) => {
      const zoneBox = starfieldZone.getBoundingClientRect();
      starfieldMouse.x = event.clientX - zoneBox.left;
      starfieldMouse.y = event.clientY - zoneBox.top;
    },
    { passive: true }
  );
  starfieldZone.addEventListener(
    'pointerleave',
    () => {
      starfieldMouse.x = -9999;
      starfieldMouse.y = -9999;
    },
    { passive: true }
  );

  requestAnimationFrame(starfieldTick);
  window.addEventListener('resize', starfieldResize);
}
