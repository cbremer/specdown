// Each adapter owns exactly one utterance. Its disposer detaches callbacks
// before stopping the engine, including while waiting for voice discovery.
import { bridgeDesktopPlatform, bridgeReaderSpeechAdapter } from './bridge.js';

/** @typedef {{sessionId:string, sentenceId:string}} SpeechIdentity */
/** @typedef {SpeechIdentity & {text:string, rate:number}} ReaderUtterance */
/** @typedef {(ReaderUtterance & {action:'speak'}) | (SpeechIdentity & {action:'stop'})} ReaderSpeechCommand */
/** @typedef {SpeechIdentity & {type:'start'|'end'|'interrupted'|'error'}} ReaderSpeechEvent */
/** @typedef {(type:ReaderSpeechEvent['type'], message?:string)=>void} ReaderSpeechNotify */
/** @typedef {{send:(command:ReaderSpeechCommand)=>void|Promise<boolean>, listen:(callback:(event:ReaderSpeechEvent)=>void)=>()=>void}} ReaderNativeSpeech */

const readerMissingVoice =
  'Install an offline voice in your system speech settings, then try Read Aloud again.';
const readerSpeechUnavailable =
  'Speech could not start. Check your system voice settings and try again.';

/** @returns {ReaderNativeSpeech|null} */
function readerNativeSpeech() {
  const ios = window.iosNative && window.webkit?.messageHandlers?.specdown;
  if (!ios) return bridgeReaderSpeechAdapter();
  return {
    send(command) {
      ios.postMessage({ action: 'readerSpeech', command });
    },
    listen(callback) {
      window.specdownSpeechEvent = callback;
      return () => {
        if (window.specdownSpeechEvent === callback)
          delete window.specdownSpeechEvent;
      };
    },
  };
}

/** @param {ReaderNativeSpeech} native @param {ReaderUtterance} item @param {ReaderSpeechNotify} emit */
function readerSpeakNative(native, item, emit) {
  const stop = native.listen((event) => {
    if (
      event?.sessionId === item.sessionId &&
      event.sentenceId === item.sentenceId &&
      ['start', 'end', 'interrupted', 'error'].includes(event.type)
    ) {
      emit(
        event.type,
        event.type === 'error' ? readerSpeechUnavailable : undefined
      );
    }
  });
  try {
    Promise.resolve(native.send({ action: 'speak', ...item })).then(
      (accepted) => {
        if (accepted === false) {
          const message =
            bridgeDesktopPlatform() === 'linux'
              ? 'Install eSpeak NG or a local system voice, then try Read Aloud again.'
              : readerSpeechUnavailable;
          emit('error', message);
        }
      },
      () => emit('error', readerSpeechUnavailable)
    );
  } catch {
    emit('error', readerSpeechUnavailable);
  }
  return () => {
    stop();
    try {
      Promise.resolve(
        native.send({
          action: 'stop',
          sessionId: item.sessionId,
          sentenceId: item.sentenceId,
        })
      ).catch(() => {});
    } catch {
      /* The host window may already be closing. */
    }
  };
}

/** @param {ReaderUtterance} item @param {ReaderSpeechNotify} emit */
function readerSpeakWeb(item, emit) {
  const synth = window.speechSynthesis;
  if (!synth || !window.SpeechSynthesisUtterance) {
    emit('error', readerMissingVoice);
    return () => {};
  }
  /** @type {SpeechSynthesisUtterance|null} */
  let utterance = null;
  const timeout = window.setTimeout(
    () => emit('error', readerMissingVoice),
    2500
  );
  const poll = window.setInterval(discover, 250);
  function discover() {
    if (utterance) return;
    try {
      // The unqualified system default may send text to a remote service.
      const local = synth.getVoices().filter((voice) => voice.localService);
      const lang = (
        document.documentElement.lang || navigator.language
      ).toLowerCase();
      const voice =
        local.find((v) => v.lang.toLowerCase() === lang) ||
        local.find(
          (v) => v.lang.toLowerCase().split('-')[0] === lang.split('-')[0]
        ) ||
        local.find((v) => v.default) ||
        local[0];
      if (!voice) return;
      clearInterval(poll);
      clearTimeout(timeout);
      utterance = new SpeechSynthesisUtterance(item.text);
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = item.rate;
      utterance.onstart = () => emit('start');
      utterance.onend = () => emit('end');
      utterance.onpause = () => emit('interrupted');
      utterance.onerror = (e) =>
        e.error === 'interrupted' || e.error === 'canceled'
          ? emit('interrupted')
          : emit('error', readerSpeechUnavailable);
      if (synth.paused) synth.resume();
      synth.speak(utterance);
    } catch {
      emit('error', readerSpeechUnavailable);
    }
  }
  synth.addEventListener('voiceschanged', discover);
  discover();
  return () => {
    clearTimeout(timeout);
    clearInterval(poll);
    synth.removeEventListener('voiceschanged', discover);
    if (utterance) {
      utterance.onstart =
        utterance.onend =
        utterance.onerror =
        utterance.onpause =
          null;
      synth.cancel();
    }
  };
}

let readerNativeFallbackSession = '';

/**
 * Use native speech on Apple shells. Desktop Windows/Linux can use their
 * installed host engine if the browser cannot start an installed voice.
 * @param {ReaderUtterance} item
 * @param {ReaderSpeechNotify} notify
 * @returns {()=>void}
 */
export function speakReaderUtterance(item, notify) {
  const native = readerNativeSpeech();
  const platform = bridgeDesktopPlatform();
  const webFirst = platform === 'win32' || platform === 'linux';
  let attempt = 0;
  let watchdog = 0;
  let dispose = () => {};
  /** @param {ReaderNativeSpeech|null} adapter */
  function start(adapter) {
    const id = ++attempt;
    let started = false;
    /** @param {ReaderSpeechEvent['type']} type @param {string} [message] */
    const emit = (type, message) => {
      if (attempt !== id) return;
      clearTimeout(watchdog);
      if (type === 'start') {
        started = true;
        // A backend can report startup and then lose the audio device without
        // reporting completion. Keep a generous budget for slower local voices.
        const duration = 20000 + (item.text.length * 350) / item.rate;
        watchdog = window.setTimeout(
          () =>
            emit(
              'error',
              'Speech stopped responding. Check your audio output and try again.'
            ),
          duration
        );
      }
      if (type === 'error' && !started && !adapter && native && webFirst) {
        // A synchronous engine rejection can precede registration of dispose.
        queueMicrotask(() => {
          if (attempt !== id) return;
          attempt++;
          dispose();
          readerNativeFallbackSession = item.sessionId;
          start(native);
        });
      } else notify(type, message);
    };
    watchdog = window.setTimeout(
      () => emit('error', readerSpeechUnavailable),
      6000
    );
    try {
      dispose = adapter
        ? readerSpeakNative(adapter, item, emit)
        : readerSpeakWeb(item, emit);
    } catch {
      emit('error', readerSpeechUnavailable);
    }
  }
  start(
    !webFirst || readerNativeFallbackSession === item.sessionId ? native : null
  );
  return () => {
    attempt++;
    clearTimeout(watchdog);
    dispose();
  };
}
