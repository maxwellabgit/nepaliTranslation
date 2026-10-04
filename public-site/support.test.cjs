const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const esbuild = require('../testing-ground/node_modules/esbuild');

// Synthetic browser/client only: no hosted requests, credentials or storage writes.
const compiled = esbuild.transformSync(
  fs.readFileSync(path.join(__dirname, 'support.ts'), 'utf8').replace(/^import[^\n]*\n/, ''),
  { loader: 'ts' },
).code;

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

function harness({ session: initial = 'A', fetchReply } = {}) {
  const fields = {};
  class Element {
    constructor() { this.value = ''; this.checked = false; this.disabled = false; this.children = []; this.events = {}; this.textContent = ''; this.removeCalls = 0; }
    set innerHTML(_) { throw Error('User content must never be interpreted as HTML'); }
    addEventListener(name, callback) { this.events[name] = callback; }
    querySelectorAll() { return [fields.message, fields.category, fields.allowed, fields.send]; }
    replaceChildren() { this.children = []; }
    append(...children) { this.children.push(...children); }
    remove() { this.removeCalls++; }
  }
  for (const name of ['form', 'message', 'category', 'allowed', 'status', 'requests', 'refresh', 'start', 'send']) fields[name] = new Element();
  fields.category.value = 'general';
  const nodes = { '#support-form': fields.form, '#message': fields.message, '#category': fields.category, '#send-consent': fields.allowed, '#status': fields.status, '#requests': fields.requests, '#refresh': fields.refresh, '#start': fields.start };
  let subject = initial;
  let authCallback;
  let authError = null;
  let nonce = 0;
  let creations = 0;
  const calls = [];
  const auth = {
    onAuthStateChange(callback) { authCallback = callback; },
    async getSession() { return { error: authError, data: { session: subject ? { user: { id: subject }, access_token: `token-${subject}` } : null } }; },
    async signInAnonymously() { creations++; subject = 'B'; return { error: null, data: { user: { id: subject } } }; },
  };
  const reply = data => ({ ok: true, json: async () => data });
  vm.runInNewContext(compiled, {
    createClient: () => ({ auth }),
    document: { querySelector: selector => nodes[selector], createElement: () => new Element() },
    crypto: { randomUUID: () => `nonce-${++nonce}` },
    confirm: () => true,
    fetch: async (url, options) => {
      const call = { method: url.split('/').at(-1), token: options.headers.Authorization, body: JSON.parse(options.body) };
      calls.push(call);
      return fetchReply ? fetchReply(call, calls, reply) : reply(call.method === 'support_list' ? [] : {});
    },
  });
  return {
    ...fields, calls, reply,
    get creations() { return creations; },
    setAuthError(error) { authError = error; },
    changeOwner(next, notify = true) { subject = next; if (notify) authCallback('SIGNED_OUT', next ? { user: { id: next } } : null); },
    open: () => fields.start.events.click(),
    refreshReplies: () => fields.refresh.events.click(),
    sendMessage(text) { if (text !== undefined) fields.message.value = text; fields.allowed.checked = true; return fields.form.events.submit({ preventDefault() {} }); },
  };
}

test('draft editing and network operations wait for explicit opening', async () => {
  const h = harness({ session: null });
  assert.equal(h.message.disabled, true);
  await h.sendMessage('Premature draft');
  await h.refreshReplies();
  assert.equal(h.calls.length, 0);
  assert.equal(h.creations, 0);
  await h.open();
  assert.equal(h.creations, 1);
  assert.equal(h.message.disabled, false);
  assert.equal(h.start.disabled, true);
  await h.open();
  assert.equal(h.creations, 1);
});

test('lost acknowledgement retries preserve the same guest, payload and client id', async () => {
  let attempts = 0;
  const h = harness({ fetchReply: (call, _, reply) => {
    if (call.method === 'support_submit' && ++attempts === 1) throw Error('lost acknowledgement');
    return reply(call.method === 'support_list' ? [] : {});
  } });
  await h.open();
  await h.sendMessage('Private draft');
  assert.equal(h.message.value, 'Private draft');
  assert.match(h.status.textContent, /Not confirmed/);
  await h.sendMessage();
  const submits = h.calls.filter(call => call.method === 'support_submit');
  assert.equal(submits.length, 2);
  assert.deepEqual(submits[0], submits[1]);
  assert.equal(submits[0].token, 'Bearer token-A');
  assert.equal(h.message.value, '');
  assert.equal(h.allowed.checked, false);
  assert.match(h.status.textContent, /^Sent/);
});

test('identity replacement isolates the previous draft, nonce and rendered requests', async () => {
  const h = harness({ fetchReply: (call, _, reply) => {
    if (call.method === 'support_submit' && call.token === 'Bearer token-A') throw Error('lost acknowledgement');
    return reply(call.method === 'support_list' ? (call.token === 'Bearer token-A' ? [{ id: 'row-A', message: 'Original message', reply: null }] : []) : {});
  } });
  await h.open();
  const oldDelete = h.requests.children[0].children[2];
  await h.sendMessage('A private draft');
  h.changeOwner(null);
  assert.equal(h.message.value, '');
  assert.equal(h.allowed.checked, false);
  assert.equal(h.requests.children.length, 0);
  assert.equal(h.message.disabled, true);
  await h.sendMessage();
  await oldDelete.events.click();
  assert.equal(h.calls.filter(call => call.method === 'support_submit').length, 1);
  assert.equal(h.calls.filter(call => call.method === 'support_delete').length, 0);
  await h.open();
  await h.sendMessage('B new draft');
  const submits = h.calls.filter(call => call.method === 'support_submit');
  assert.equal(submits[1].token, 'Bearer token-B');
  assert.equal(submits[1].body.p_message, 'B new draft');
  assert.notEqual(submits[1].body.p_client_id, submits[0].body.p_client_id);
});

test('a late delete acknowledgement cannot confirm deletion or alter the new owner UI', async () => {
  const gate = deferred();
  const started = deferred();
  const h = harness({ fetchReply: (call, _, reply) => {
    if (call.method === 'support_delete') { started.resolve(); return gate.promise; }
    return reply([{ id: call.token === 'Bearer token-A' ? 'row-A' : 'row-B', message: 'Current owner message', reply: null }]);
  } });
  await h.open();
  const oldArticle = h.requests.children[0];
  const deleting = oldArticle.children[2].events.click();
  await started.promise;
  h.changeOwner('B');
  await h.open();
  const newStatus = h.status.textContent;
  gate.resolve(h.reply({ deleted: true }));
  await deleting;
  assert.equal(oldArticle.removeCalls, 0);
  assert.equal(h.status.textContent, newStatus);
  assert.doesNotMatch(h.status.textContent, /^Deleted/);
  assert.equal(h.calls.find(call => call.method === 'support_delete').token, 'Bearer token-A');
});

test('a late previous-owner list response cannot expose old messages after replacement', async () => {
  const gate = deferred();
  const started = deferred();
  const h = harness({ fetchReply: (call, _, reply) => {
    if (call.token === 'Bearer token-A') { started.resolve(); return gate.promise; }
    return reply([]);
  } });
  const opening = h.open();
  await started.promise;
  h.changeOwner('B');
  await h.open();
  gate.resolve(h.reply([{ id: 'private-A', message: 'Private A response', reply: null }]));
  await opening;
  assert.equal(h.requests.children.length, 0);
  assert.match(h.status.textContent, /^Support ready/);
});

test('a late send acknowledgement cannot clear a new owner draft or report it sent', async () => {
  const gate = deferred();
  const started = deferred();
  const h = harness({ fetchReply: (call, _, reply) => {
    if (call.method === 'support_submit') { started.resolve(); return gate.promise; }
    return reply([]);
  } });
  await h.open();
  const sending = h.sendMessage('A pending message');
  await started.promise;
  h.changeOwner('B');
  await h.open();
  h.message.value = 'B unsent draft';
  h.allowed.checked = true;
  gate.resolve(h.reply({ id: 'A-submitted' }));
  await sending;
  assert.equal(h.message.value, 'B unsent draft');
  assert.equal(h.allowed.checked, true);
  assert.doesNotMatch(h.status.textContent, /^Sent/);
  assert.equal(h.calls.filter(call => call.method === 'support_submit').length, 1);
});

test('session mismatch prevents upload even without an auth-change notification', async () => {
  const h = harness();
  await h.open();
  h.changeOwner('B', false);
  await h.sendMessage('A draft');
  assert.equal(h.calls.filter(call => call.method === 'support_submit').length, 0);
  assert.equal(h.creations, 0);
  assert.match(h.status.textContent, /Not confirmed/);
});

test('network failure never rotates the guest or discards a retryable draft', async () => {
  const h = harness();
  await h.open();
  h.setAuthError(Error('offline'));
  await h.sendMessage('Offline draft');
  await h.refreshReplies();
  assert.equal(h.message.value, 'Offline draft');
  assert.equal(h.creations, 0);
  assert.equal(h.calls.filter(call => call.method === 'support_submit').length, 0);
});

test('failed opening does not replace a guest on a network error', async () => {
  const h = harness({ session: null });
  h.setAuthError(Error('offline'));
  await h.open();
  assert.equal(h.creations, 0);
  assert.equal(h.message.disabled, true);
  assert.match(h.status.textContent, /Unable to open/);
});

test('message and reply HTML payloads render as text', async () => {
  const message = '<img src=x onerror=alert(1)>';
  const replyText = '<script>alert(2)</script>';
  const h = harness({ fetchReply: (_, __, reply) => reply([{ id: 'row', message, reply: replyText }]) });
  await h.open();
  assert.equal(h.requests.children[0].children[0].textContent, message);
  assert.equal(h.requests.children[0].children[1].textContent, replyText);
});

function simulatePublisher({ extraLocalFile, pages, remoteTree = [] } = {}) {
  const calls = [];
  const memory = new Map();
  const expectedRoot = path.join(__dirname, 'site');
  const mockFs = {
    ...fs,
    readdirSync(directory) {
      const names = fs.readdirSync(directory);
      return directory === expectedRoot && extraLocalFile ? [...names, extraLocalFile] : names;
    },
    writeFileSync(file, content) { memory.set(file, content); },
    unlinkSync(file) { memory.delete(file); },
  };
  const mockProcess = { argv: ['node', 'publish.cjs', '--owner-approved'] };
  let error;
  try {
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'publish.cjs'), 'utf8'), {
      __dirname,
      process: mockProcess,
      console: { log() {} },
      require: name => name === 'node:fs' ? mockFs : name === 'node:child_process' ? {
        execFileSync(binary, args) {
          assert.equal(binary, 'gh');
          const route = args[1];
          const method = args[args.indexOf('--method') + 1];
          const input = args.includes('--input') ? JSON.parse(memory.get(args[args.indexOf('--input') + 1])) : undefined;
          calls.push({ route, method, input });
          if (route === 'user') return JSON.stringify({ login: 'maxwellabgit' });
          if (route === 'repos/maxwellabgit/maxwellabgit.github.io') return JSON.stringify({ private: false, default_branch: 'main' });
          if (route.endsWith('/pages')) return JSON.stringify(pages ?? { build_type: 'legacy', source: { branch: 'main', path: '/' } });
          if (route.endsWith('/git/ref/heads/main')) return JSON.stringify({ object: { sha: 'old-commit' } });
          if (route.endsWith('/git/commits/old-commit')) return JSON.stringify({ tree: { sha: 'old-tree' } });
          if (route.endsWith('/git/trees/old-tree?recursive=1')) return JSON.stringify({ truncated: false, tree: remoteTree });
          if (route.endsWith('/git/trees')) return JSON.stringify({ sha: 'new-tree' });
          if (route.endsWith('/git/commits')) return JSON.stringify({ sha: 'new-commit' });
          if (route.endsWith('/git/refs/heads/main')) return JSON.stringify({});
          throw Error(`Unexpected mocked route: ${route}`);
        },
      } : require(name),
    });
  } catch (caught) { error = caught; }
  return { calls, memory, error };
}

test('publisher rejects unexpected existing Pages configuration before any remote write', () => {
  const result = simulatePublisher({ pages: { build_type: 'legacy', source: { branch: 'gh-pages', path: '/docs' } } });
  assert.match(result.error?.message ?? '', /Unexpected Pages source/);
  assert.equal(result.calls.filter(call => call.method !== 'GET').length, 0);
  assert.equal(result.memory.size, 0);
});

test('publisher rejects unrelated destination files before any remote write', () => {
  const result = simulatePublisher({ remoteTree: [{ type: 'blob', path: 'unrelated-project/index.html' }] });
  assert.match(result.error?.message ?? '', /unrelated content/);
  assert.equal(result.calls.filter(call => call.method !== 'GET').length, 0);
  assert.equal(result.memory.size, 0);
});

test('publisher rejects an extra local private file before contacting GitHub', () => {
  const result = simulatePublisher({ extraLocalFile: '.env' });
  assert.match(result.error?.message ?? '', /allowlist mismatch/);
  assert.equal(result.calls.length, 0);
  assert.equal(result.memory.size, 0);
});

test('publisher happy path uploads only public assets and advances the reviewed parent without force', () => {
  const result = simulatePublisher();
  assert.equal(result.error, undefined);
  const tree = result.calls.find(call => call.method === 'POST' && call.route.endsWith('/git/trees'));
  assert.deepEqual(tree.input.tree.map(entry => entry.path).sort(), ['.nojekyll', 'app-ads.txt', 'deletion.html', 'index.html', 'privacy.html', 'robots.txt', 'style.css', 'support.html', 'support.js', 'terms.html'].sort());
  const commit = result.calls.find(call => call.method === 'POST' && call.route.endsWith('/git/commits'));
  assert.deepEqual(commit.input.parents, ['old-commit']);
  const ref = result.calls.find(call => call.method === 'PATCH');
  assert.equal(ref.input.force, false);
  assert.equal(result.calls.some(call => call.method === 'POST' && call.route.endsWith('/pages')), false);
  const manifest = JSON.parse(result.memory.get(path.join(__dirname, 'publication.json')));
  assert.equal(manifest.status, 'PUBLISHED_AWAITING_HTTP_VERIFICATION');
});
