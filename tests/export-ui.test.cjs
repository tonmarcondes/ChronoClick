const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = name => fs.readFileSync(path.join(root, 'extension', name), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));

(async () => {
  const elements = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', textContent: '', dataset: {}, hidden: true });
    return elements.get(id);
  };
  let state = { state: 'finished', count: 2 }, failSave = false, acceptPartial = false;
  const calls = [];
  const chrome = {
    runtime: {
      getManifest: () => ({ version: '0.8.1' }),
      sendMessage: async message => {
        calls.push(message.type);
        if (message.type === 'GET_STATE') return state;
        if (message.type === 'SAVE_SESSION' && failSave) return { ok: false, error: 'Falha de disco' };
        if (message.type === 'GENERATE_DOCX') state.document = { state: 'ready', output: '/project/documents/test.docx' };
        return { ok: true };
      }
    },
    tabs: { getCurrent: async () => ({ id: 9 }), remove: async id => calls.push(`close:${id}`) }
  };
  const context = vm.createContext({ chrome, document: { getElementById: element }, setInterval() {}, window: { confirm: () => acceptPartial, close() { calls.push('close'); } } });
  vm.runInContext(source('popup.js'), context);
  await tick();
  assert.equal(element('documentLink').hidden, true);
  await element('generate').onclick();
  assert.equal(element('documentLink').hidden, false);
  assert.match(element('documentStatus').textContent, /Pronto/);
  await element('documentLink').onclick({ preventDefault() {} });
  assert.equal(calls.at(-1), 'OPEN_DOCX');
  state.document = { state: 'generating' };
  await vm.runInContext('refresh()', context);
  assert.equal(element('generate').disabled, true);
  assert.equal(element('documentLink').hidden, true);
  state.document = { state: 'error', error: 'Print ausente' };
  await vm.runInContext('refresh()', context);
  assert.match(element('documentStatus').textContent, /Print ausente/);
  state.failures = [{error:'Captura falhou'}];
  calls.length = 0;
  await element('generate').onclick();
  assert.equal(calls.includes('GENERATE_DOCX'), false);
  acceptPartial = true;
  await element('generate').onclick();
  assert.equal(calls.includes('GENERATE_DOCX'), true);

  const review = vm.createContext({ chrome, document: { getElementById: element }, window: { close() { calls.push('close'); } } });
  vm.runInContext(source('review.js').replace(/load\(\);\s*$/, ''), review);
  vm.runInContext('session = {config:{}}; readForm = () => {};', review);
  calls.length = 0;
  await element('save').onclick();
  assert.deepEqual(calls, ['SAVE_SESSION', 'SAVE_CONFIG', 'close:9']);
  calls.length = 0; failSave = true;
  await element('save').onclick();
  assert.deepEqual(calls, ['SAVE_SESSION']);
  assert.match(element('status').textContent, /Falha de disco/);

  let listener, finishGeneration;
  const bg = vm.createContext({ console, chrome: {
    runtime: { onMessage: { addListener(fn) { listener = fn; } } },
    storage: { local: { set: async () => {} } }, tabs: { query: async () => [] }
  } });
  vm.runInContext(source('recording-policy.js'), bg);
  vm.runInContext(source('background.js').replace('import "./recording-policy.js";', ''), bg);
  bg.hostCall = async command => {
    if (command === 'generateDocx') return new Promise(resolve => { finishGeneration = () => resolve({ ok: true, document: { state: 'ready', output: '/project/documents/test.docx' } }); });
    return { ok: true };
  };
  vm.runInContext(`project={root:'/project'}; session={config:{},steps:[{id:'1'}],groups:[]}; recorderState='finished'; native=hostCall;`, bg);
  const send = (type, extra = {}) => new Promise(resolve => listener({ type, ...extra }, {}, resolve));
  const generating = send('GENERATE_DOCX');
  await tick();
  assert.equal((await send('GET_STATE')).document.state, 'generating');
  assert.equal((await send('GENERATE_DOCX')).ok, false);
  assert.equal((await send('START')).ok, false);
  assert.equal((await send('SAVE_SESSION')).ok, false);
  assert.equal((await send('GET_SESSION')).session.document.state, 'generating');
  finishGeneration(); await generating;
  assert.equal((await send('GET_STATE')).document.state, 'ready');
  vm.runInContext(`session.captureFailures=[{error:'print'}];`, bg);
  assert.equal((await send('GENERATE_DOCX')).ok, false);
  assert.equal((await send('GET_STATE')).document.state, 'error');
  const partial = send('GENERATE_DOCX', {allowPartial:true});
  await tick(); finishGeneration();
  assert.equal((await partial).ok, true);
  console.log('PASS: painel, link, revisão fecha após salvar, erro mantém revisão aberta, geração concorrente e erros persistidos.');
})().catch(error => { console.error(error); process.exitCode = 1; });
