const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
jest.mock('node:child_process', () => ({ spawn: jest.fn() }));
jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  existsSync: jest.fn(),
}));
const { spawn } = require('node:child_process');
const { existsSync } = require('node:fs');
const { createPortableSpeech } = require('../../desktop/portable-speech');

const platformDescriptor = Object.getOwnPropertyDescriptor(process, 'platform');
const formerSystemRoot = process.env.SystemRoot;
const sample = {
  action: 'speak',
  sessionId: 'read1',
  sentenceId: 's1',
  text: 'Use “More” for $42 & notes.',
  rate: 1,
};
function fakeSpeechChild() {
  return Object.assign(new EventEmitter(), {
    stdin: new PassThrough(),
    stdout: new PassThrough(),
    kill: jest.fn(),
  });
}
afterEach(() => {
  Object.defineProperty(process, 'platform', platformDescriptor);
  if (formerSystemRoot === undefined) delete process.env.SystemRoot;
  else process.env.SystemRoot = formerSystemRoot;
  jest.resetAllMocks();
});

it.each(['win32', 'linux'])(
  'passes UTF-8 over stdin and routes current events on %s',
  (platform) => {
    Object.defineProperty(process, 'platform', { value: platform });
    process.env.SystemRoot = 'C:\\Windows';
    existsSync.mockReturnValue(true);
    const child = fakeSpeechChild();
    spawn.mockReturnValue(child);
    const emit = jest.fn();
    const adapter = createPortableSpeech(emit);
    expect(adapter.speech(sample)).toBe(true);
    expect(child.stdin.read().toString('utf8')).toBe(sample.text);
    const [program, args, options] = spawn.mock.calls[0];
    expect(program).toMatch(
      platform === 'win32' ? /powershell\.exe$/ : /espeak-ng$/
    );
    expect(args.join(' ')).not.toContain(sample.text);
    expect(options.shell).toBe(false);
    if (platform === 'win32') child.stdout.write('ready');
    else child.emit('spawn');
    child.emit('close', 0);
    expect(emit.mock.calls.map(([event]) => event.type)).toEqual([
      'start',
      'end',
    ]);
  }
);

it('ignores stale stop and completion after replacement and reports a missing Linux engine', () => {
  Object.defineProperty(process, 'platform', { value: 'linux' });
  const emit = jest.fn();
  const adapter = createPortableSpeech(emit);
  existsSync.mockReturnValue(false);
  expect(adapter.speech(sample)).toBe(false);
  existsSync.mockReturnValue(true);
  const first = fakeSpeechChild(),
    second = fakeSpeechChild();
  spawn.mockReturnValueOnce(first).mockReturnValueOnce(second);
  adapter.speech(sample);
  adapter.speech({ ...sample, sessionId: 'read2' });
  adapter.speech({ ...sample, action: 'stop' });
  first.emit('close', 0);
  expect(first.kill).toHaveBeenCalledTimes(1);
  expect(second.kill).not.toHaveBeenCalled();
  expect(emit).not.toHaveBeenCalled();
  adapter.dispose();
  expect(second.kill).toHaveBeenCalledTimes(1);
});
