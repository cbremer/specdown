// Local speech fallback for packaged Windows and Linux viewers without a
// working Chromium voice. Each viewer owns its child process and cancellation.
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const path = require('node:path');

const windowsSpeechScript = [
  "$ErrorActionPreference = 'Stop'",
  '[Console]::InputEncoding = [Text.UTF8Encoding]::new($false)',
  'Add-Type -AssemblyName System.Speech',
  '$voice = [System.Speech.Synthesis.SpeechSynthesizer]::new()',
  'try {',
  '  $text = [Console]::In.ReadToEnd()',
  '  $voice.SetOutputToDefaultAudioDevice()',
  '  $voice.Rate = [int]$env:SPECDOWN_SPEECH_RATE',
  "  [Console]::Out.WriteLine('ready')",
  '  $voice.Speak($text)',
  '} finally { $voice.Dispose() }',
].join('\n');

function speechProgram(rate) {
  if (process.platform === 'win32') {
    const root = process.env.SystemRoot;
    if (!root) return null;
    const file = path.win32.join(
      root,
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe'
    );
    return {
      file,
      args: [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        windowsSpeechScript,
      ],
      env: {
        ...process.env,
        SPECDOWN_SPEECH_RATE: String(Math.round(5 * Math.log2(rate))),
      },
      waitForReady: true,
    };
  }
  if (process.platform !== 'linux') return null;
  const file = [
    '/usr/bin/espeak-ng',
    '/usr/bin/espeak',
    '/usr/local/bin/espeak-ng',
    '/usr/local/bin/espeak',
  ].find(existsSync);
  return file
    ? {
        file,
        args: ['--stdin', '-b', '1', '-s', String(Math.round(175 * rate))],
        env: process.env,
        waitForReady: false,
      }
    : null;
}

function createPortableSpeech(emit) {
  let active = null;
  function stop() {
    const record = active;
    active = null;
    if (record) record.child.kill();
  }
  function speech(command) {
    if (
      !command ||
      typeof command.sessionId !== 'string' ||
      typeof command.sentenceId !== 'string'
    )
      return false;
    if (command.action === 'stop') {
      if (
        active?.sessionId === command.sessionId &&
        active.sentenceId === command.sentenceId
      )
        stop();
      return true;
    }
    if (
      command.action !== 'speak' ||
      typeof command.text !== 'string' ||
      !command.text.trim() ||
      command.text.length > 16384
    )
      return false;
    const rate = command.rate ?? 1;
    if (!Number.isFinite(rate) || rate < 0.25 || rate > 4) return false;
    const program = speechProgram(rate);
    if (!program) return false;
    stop();
    const { sessionId, sentenceId } = command;
    const child = spawn(program.file, program.args, {
      env: program.env,
      windowsHide: true,
      shell: false,
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    const record = { child, sessionId, sentenceId };
    active = record;
    const notify = (type) => {
      if (active !== record) return;
      if (type === 'end' || type === 'error') active = null;
      emit({ type, sessionId, sentenceId });
    };
    if (program.waitForReady) {
      child.stdout.once('data', () => notify('start'));
    } else {
      child.once('spawn', () => notify('start'));
    }
    child.once('error', () => notify('error'));
    child.once('close', (code) => notify(code === 0 ? 'end' : 'error'));
    child.stdin.on('error', () => {
      if (active === record) {
        notify('error');
        child.kill();
      }
    });
    // The document never appears in a shell command or process argument.
    child.stdin.end(command.text, 'utf8');
    return true;
  }
  return { speech, dispose: stop };
}
module.exports = { createPortableSpeech };
