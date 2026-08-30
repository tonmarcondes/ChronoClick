const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console, crypto, setTimeout, clearTimeout,
  chrome: { runtime: { onMessage: { addListener() {} } }, storage: { local: { set: async () => {} } },
    tabs: { query: async () => [{id:1}], sendMessage: async () => ({url:'https://test/a',documentToken:'doc',scrollY:0}), captureVisibleTab: async () => 'screen-A' } } });
vm.runInContext(fs.readFileSync(path.join(root, 'extension/recording-policy.js'), 'utf8'), context);
vm.runInContext(fs.readFileSync(path.join(root, 'extension/background.js'), 'utf8').replace('import "./recording-policy.js";', ''), context);
vm.runInContext(`
  globalThis.api = { policy: ChronoPolicy, captureVisible, addEvent, migrateConfig, getSession: () => session };
  project = {root:'/tmp/test'}; recorderState = 'recording';
  session = {config:migrateConfig({configVersion:5}),steps:[],groups:[]};
  native = async () => ({ok:true});
  nativeSaveEvent = async ({step}) => ({step:{images:{screen:'screenshots/'+step.id+'.png',microprint:step.noMicroprint?null:'components/'+step.id+'.png'}}});
  saveState = async () => {};
`, context);
const {policy, addEvent, captureVisible, getSession} = context.api;
const event = (action='click', selector='#button') => ({action,component:{selector,role:'button',name:'Salvar'},page:{url:'https://test/a',pageName:'Teste',documentToken:'doc',scrollY:0},timestamp:new Date().toISOString()});
const media = {screenDataUrl:'data:image/png;base64,AA',microDataUrl:null,signature:[1]};
(async () => {
  assert.equal(policy.defaults.scrollMode,'with-interaction');
  assert.equal(policy.typedValue({matches:()=>true,closest:()=>null,value:'secret'}, {captureText:true}), '[REDACTED]');
  assert.equal(policy.typedValue({matches:()=>false,closest:()=>null,value:'João\nSilva'}, {captureText:true}), 'João\nSilva');
  assert.equal(policy.typedValue({matches:()=>false,closest:()=>null,value:'secret'}, {captureText:false}), '[NOT_CAPTURED]');
  await addEvent(event(),media); const first = getSession().steps[0].id;
  await addEvent(event(),media);
  assert.equal(getSession().steps.length,1); assert.notEqual(getSession().steps[0].id,first);
  assert.equal(getSession().groups.length,1);
  await addEvent(event('click','#other'),media); await addEvent(event(),media);
  assert.equal(getSession().steps.length,3); // nonconsecutive repetition is meaningful
  getSession().config.recording.repeatMode='page'; await addEvent(event(),media);
  assert.equal(getSession().steps.length,2);
  getSession().config.recording.repeatMode='off'; await addEvent(event(),media);
  assert.equal(getSession().steps.length,3);
  getSession().config.recording.repeatMode='consecutive';
  await addEvent({...event('typing','#name'),value:'Maria'},media);
  await addEvent({...event('typing','#name'),value:'Maria Silva'},media);
  assert.equal(getSession().steps.filter(s=>s.action==='typing').length,1);
  assert.equal(getSession().steps.at(-1).value,'Maria Silva');
  await addEvent({...event('click','#continue'),pendingScroll:{scrollY:900,selector:'body'}},media);
  assert.equal(getSession().steps.at(-2).action,'scroll'); assert.equal(getSession().steps.at(-2).scrollY,900);
  assert.equal(getSession().steps.at(-1).action,'click');
  getSession().steps.forEach((s,i)=>assert.equal(s.sequence,i+1));
  assert.equal(new Set(getSession().steps.map(s=>s.images.screen)).size,getSession().steps.length);
  assert.equal(await captureVisible({tab:{id:1,windowId:1}},event()),'screen-A');
  await assert.rejects(captureVisible({tab:{id:2,windowId:1}},event()),/aba de origem/);
  assert.throws(()=>policy.validate(event().page,{url:'https://test/b'}),/página mudou/);
  assert.throws(()=>policy.validate(event().page,{url:'https://test/a',documentToken:'doc',scrollY:100}),/posição/);
  assert.equal(context.api.migrateConfig({configVersion:5,actionTexts:{typing:'Preencha o campo {name}.'}}).actionTexts.typing,'Insira o texto {value} no campo {name}.');
  console.log('PASS: 17 verificações — consolidação, scroll associado, valores, privacidade, prints únicos, aba/URL/posição e migração.');
})().catch(error=>{console.error(error);process.exitCode=1;});
