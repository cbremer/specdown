/**
 * Unit tests for the accessible toast notification system.
 */

const { loadHTML, loadApp } = require('../helpers/loadApp');
require('../mocks/marked');
require('../mocks/mermaid');
require('../mocks/panzoom');
require('../mocks/highlightjs');

describe('Toast notifications', () => {
  beforeEach(() => {
    loadHTML(document);
    loadApp(document);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates a toast in a shared #toast-region with the message text', () => {
    showToast('Hello world');

    const region = document.getElementById('toast-region');
    expect(region).not.toBeNull();
    const toast = region.querySelector('.toast');
    expect(toast).not.toBeNull();
    expect(toast.textContent).toBe('Hello world');
  });

  it('reuses a single region for multiple toasts', () => {
    showToast('one');
    showToast('two');

    const regions = document.querySelectorAll('#toast-region');
    expect(regions.length).toBe(1);
    expect(regions[0].querySelectorAll('.toast').length).toBe(2);
  });

  it('uses role="alert" for errors and role="status" otherwise', () => {
    showToast('boom', { type: 'error' });
    showToast('ok', { type: 'success' });
    showToast('fyi', { type: 'info' });
    showToast('careful', { type: 'warning' });

    const toasts = document.querySelectorAll('.toast');
    expect(toasts[0].getAttribute('role')).toBe('alert');
    expect(toasts[1].getAttribute('role')).toBe('status');
    expect(toasts[2].getAttribute('role')).toBe('status');
    expect(toasts[3].getAttribute('role')).toBe('status');
  });

  it('applies a type-specific class', () => {
    showToast('careful', { type: 'warning' });
    expect(document.querySelector('.toast').classList.contains('toast-warning')).toBe(true);
  });

  it('auto-dismisses after the duration elapses', () => {
    jest.useFakeTimers();
    showToast('temporary', { type: 'info', duration: 1000 });

    expect(document.querySelector('.toast')).not.toBeNull();
    jest.advanceTimersByTime(1000);
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('does not auto-dismiss when duration is 0', () => {
    jest.useFakeTimers();
    showToast('sticky', { duration: 0 });

    jest.advanceTimersByTime(60000);
    expect(document.querySelector('.toast')).not.toBeNull();
  });

  it('dismisses on click', () => {
    showToast('click me');
    const toast = document.querySelector('.toast');
    toast.dispatchEvent(new Event('click', { bubbles: true }));
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('renders an action button that runs its handler and dismisses', () => {
    const onClick = jest.fn();
    showToast('Update ready', { duration: 0, action: { label: 'Restart now', onClick } });

    const toast = document.querySelector('.toast');
    expect(toast.querySelector('.toast-message').textContent).toBe('Update ready');
    const button = toast.querySelector('.toast-action');
    expect(button).not.toBeNull();
    expect(button.textContent).toBe('Restart now');

    button.dispatchEvent(new Event('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.toast')).toBeNull();
  });
});
