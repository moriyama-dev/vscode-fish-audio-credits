import * as assert from 'node:assert/strict';
import * as vscode from 'vscode';
import type { FetchFn } from '../../src/core/fish-api';
import { COMMANDS, CreditStatus, SECRET_KEY } from '../../src/credit-status';

const EXTENSION_ID = 'moriyama-dev.vscode-fish-audio-credits';

/** Secret storage that lives in memory, so tests never touch the real keychain. */
class MemorySecrets implements vscode.SecretStorage {
  private readonly values = new Map<string, string>();
  private readonly emitter = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>();
  readonly onDidChange = this.emitter.event;

  get(key: string): Thenable<string | undefined> {
    return Promise.resolve(this.values.get(key));
  }
  keys(): Thenable<string[]> {
    return Promise.resolve([...this.values.keys()]);
  }
  store(key: string, value: string): Thenable<void> {
    this.values.set(key, value);
    this.emitter.fire({ key });
    return Promise.resolve();
  }
  delete(key: string): Thenable<void> {
    this.values.delete(key);
    this.emitter.fire({ key });
    return Promise.resolve();
  }
}

/** Answers like api.fish.audio would, and counts the calls. */
function fakeFetch(answer: (url: string) => { status: number; body?: unknown } | Error) {
  const calls: string[] = [];
  const fn: FetchFn = (input) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    calls.push(url);
    const result = answer(url);
    if (result instanceof Error) {
      return Promise.reject(result);
    }
    return Promise.resolve(
      new Response(result.body === undefined ? null : JSON.stringify(result.body), {
        status: result.status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  };
  return { fn, calls };
}

const healthy = (url: string) =>
  url.endsWith('/package')
    ? { status: 200, body: { type: 'plus', total: 120000, balance: 100712, finished_at: '2027-08-05T17:45:00Z' } }
    : { status: 200, body: { credit: '0' } };

describe('Credit Balance for Fish Audio', () => {
  const log = vscode.window.createOutputChannel('Fish Audio credits (test)', { log: true });
  const open: CreditStatus[] = [];
  const make = (secrets: vscode.SecretStorage, fn: FetchFn) => {
    const status = new CreditStatus(secrets, log, fn);
    open.push(status);
    return status;
  };

  afterEach(() => {
    for (const status of open.splice(0)) {
      status.dispose();
    }
  });

  it('activates after startup and registers its commands', async () => {
    const extension = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(extension, 'installed under the published ID');
    await extension.activate();
    const commands = await vscode.commands.getCommands(true);
    for (const command of Object.values(COMMANDS)) {
      assert.ok(commands.includes(command), command);
    }
  });

  it('asks for a key when none is stored, without calling the API', async () => {
    const { fn, calls } = fakeFetch(healthy);
    const status = make(new MemorySecrets(), fn);
    await status.refresh();
    assert.equal(status.current.kind, 'noKey');
    assert.equal(status.statusBarItem.command, COMMANDS.setApiKey);
    assert.match(status.statusBarItem.text, /\$\(key\)/);
    assert.deepEqual(calls, []);
  });

  it('shows the plan balance once a key is stored', async () => {
    const secrets = new MemorySecrets();
    const { fn } = fakeFetch(healthy);
    const status = make(secrets, fn);
    await secrets.store(SECRET_KEY, 'k');
    await status.refresh();
    assert.equal(status.current.kind, 'ok');
    assert.match(status.statusBarItem.text, /100,712/);
    assert.equal(status.statusBarItem.backgroundColor, undefined);
    const tooltip = status.statusBarItem.tooltip as vscode.MarkdownString;
    assert.match(tooltip.value, /120,000/);
  });

  it('highlights a low balance', async () => {
    const secrets = new MemorySecrets();
    await secrets.store(SECRET_KEY, 'k');
    const { fn } = fakeFetch((url) =>
      url.endsWith('/package')
        ? { status: 200, body: { total: 1000, balance: 50 } }
        : { status: 200, body: { credit: '0' } },
    );
    const status = make(secrets, fn);
    await status.refresh();
    assert.ok(status.statusBarItem.backgroundColor instanceof vscode.ThemeColor);
  });

  it('points to the key command when the key is rejected', async () => {
    const secrets = new MemorySecrets();
    await secrets.store(SECRET_KEY, 'bad');
    const { fn } = fakeFetch(() => ({ status: 401, body: { status: 401, message: 'No permission' } }));
    const status = make(secrets, fn);
    await status.refresh();
    assert.equal(status.current.kind, 'invalidKey');
    assert.equal(status.statusBarItem.command, COMMANDS.setApiKey);
  });

  it('keeps the last known balance when a later refresh fails', async () => {
    const secrets = new MemorySecrets();
    await secrets.store(SECRET_KEY, 'k');
    let online = true;
    const { fn } = fakeFetch((url) => (online ? healthy(url) : new TypeError('fetch failed')));
    const status = make(secrets, fn);
    await status.refresh();
    online = false;
    await status.refresh();
    assert.equal(status.current.kind, 'failed');
    assert.match(status.statusBarItem.text, /\$\(warning\) 100,712/);
  });

  it('sends one request for refreshes that overlap', async () => {
    const secrets = new MemorySecrets();
    await secrets.store(SECRET_KEY, 'k');
    const { fn, calls } = fakeFetch(healthy);
    const status = make(secrets, fn);
    await Promise.all([status.refresh(), status.refresh(), status.refresh()]);
    assert.equal(calls.length, 2, 'one call per endpoint');
  });

  it('notices when another window removes the key', async () => {
    const secrets = new MemorySecrets();
    await secrets.store(SECRET_KEY, 'k');
    const { fn } = fakeFetch(healthy);
    const status = make(secrets, fn);
    await status.refresh();
    await secrets.delete(SECRET_KEY);
    await status.refresh();
    assert.equal(status.current.kind, 'noKey');
  });
});
