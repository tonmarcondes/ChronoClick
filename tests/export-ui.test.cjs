const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const source = (name) => fs.readFileSync(path.join(root, "extension", name), "utf8");
const tick = () => new Promise((resolve) => setImmediate(resolve));

(async () => {
  const elements = new Map(),
    calls = [],
    timers = [];
  const element = (id) => {
    if (!elements.has(id))
      elements.set(id, { value: "", textContent: "", dataset: {}, hidden: true });
    return elements.get(id);
  };
  let state = { ok: true, state: "idle", count: 0 },
    failStart = false,
    failSave = false;
  const chrome = {
    runtime: {
      getManifest: () => ({ version: "0.9.0" }),
      openOptionsPage: () => calls.push("options"),
      sendMessage: async (message) => {
        calls.push(message.type);
        if (message.type === "GET_STATE") return state;
        if (message.type === "START") {
          if (failStart) return { ok: false, error: "Página desconectada" };
          state = { ok: true, state: "recording", count: 0, project: { root: "/new" } };
        }
        if (message.type === "STOP") state = { ...state, state: "finished", count: 2 };
        if (message.type === "GENERATE_DOCX")
          state.document = { state: "ready", output: "/new/documents/test.docx" };
        if (message.type === "SAVE_SESSION" && failSave)
          return { ok: false, error: "Falha de disco" };
        return { ok: true };
      },
    },
    tabs: { getCurrent: async () => ({ id: 9 }), remove: async (id) => calls.push(`close:${id}`) },
  };
  const context = vm.createContext({
    chrome,
    document: { getElementById: element },
    setInterval() {},
    setTimeout(fn, ms) {
      timers.push({ fn, ms });
      return timers.length;
    },
    clearTimeout() {},
    window: {
      close() {
        calls.push("close");
      },
    },
  });
  vm.runInContext(source("popup-model.js"), context);
  vm.runInContext(source("popup.js"), context);
  await tick();
  assert.equal(element("primaryAction").textContent, "Iniciar nova");
  failStart = true;
  await element("primaryAction").onclick();
  assert.match(element("error").textContent, /Página desconectada/);
  assert.equal(timers.length, 0);
  failStart = false;
  await element("primaryAction").onclick();
  assert.equal(element("primaryAction").textContent, "Finalizar");
  assert.equal(element("projectField").hidden, true);
  assert.equal(timers[0].ms, 3000);
  await element("primaryAction").onclick();
  assert.equal(element("primaryAction").textContent, "Gerar DOCX");
  state.failures = [{ error: "Captura falhou" }];
  await element("primaryAction").onclick();
  assert.match(element("error").textContent, /Confirme/);
  element("allowPartial").checked = true;
  await element("primaryAction").onclick();
  assert.equal(element("documentLink").hidden, false);
  assert.equal(element("primaryAction").textContent, "Iniciar nova");
  await element("documentLink").onclick({ preventDefault() {} });
  assert.ok(calls.includes("OPEN_DOCX"));
  await element("primaryAction").onclick();
  assert.equal(element("documentLink").hidden, true);
  assert.equal(element("summary").textContent, "0 passo(s)");
  state = { ...state, state: "finished", count: 0 };
  await vm.runInContext("refresh()", context);
  assert.equal(element("primaryAction").disabled, true);
  assert.equal(element("newProject").hidden, false);
  element("newProject").onclick();
  assert.equal(element("primaryAction").textContent, "Iniciar nova");

  const review = vm.createContext({
    chrome,
    document: { getElementById: element },
    window: {
      close() {
        calls.push("close");
      },
    },
  });
  vm.runInContext(source("review.js").replace(/load\(\);\s*$/, ""), review);
  element("printBorderEnabled").checked = false;
  element("printBorderWidth").value = "2";
  element("printBorderWidth").oninput();
  assert.equal(element("printBorderEnabled").checked, true);
  element("printBorderWidth").value = "0";
  element("printBorderWidth").oninput();
  assert.equal(element("printBorderEnabled").checked, false);
  vm.runInContext("session={config:{}};readForm=()=>{};", review);
  calls.length = 0;
  await element("save").onclick();
  assert.deepEqual(calls, ["SAVE_SESSION", "SAVE_CONFIG", "close:9"]);
  calls.length = 0;
  failSave = true;
  await element("save").onclick();
  assert.deepEqual(calls, ["SAVE_SESSION"]);
  vm.runInContext("editingDefaults=true;", review);
  calls.length = 0;
  await element("save").onclick();
  assert.deepEqual(calls, ["SAVE_CONFIG", "close:9"]);

  let listener, finishGeneration;
  const bg = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    chrome: {
      runtime: {
        onMessage: {
          addListener(fn) {
            listener = fn;
          },
        },
      },
      storage: { local: { set: async () => {} } },
      tabs: { query: async () => [] },
    },
  });
  vm.runInContext(source("recording-policy.js"), bg);
  vm.runInContext(source("default-config.js"), bg);
  vm.runInContext(source("background.js").replace(/^import .*;$/gm, ""), bg);
  bg.hostCall = async (command) =>
    command === "generateDocx"
      ? new Promise((resolve) => {
          finishGeneration = () =>
            resolve({ ok: true, document: { state: "ready", output: "/project/test.docx" } });
        })
      : { ok: true };
  vm.runInContext(
    `project={root:'/project'};session={config:{},steps:[{id:'1'}],groups:[]};recorderState='finished';native=hostCall;`,
    bg,
  );
  const send = (type, extra = {}) =>
    new Promise((resolve) => listener({ type, ...extra }, {}, resolve));
  const generating = send("GENERATE_DOCX");
  await tick();
  assert.equal((await send("GET_STATE")).document.state, "generating");
  for (const type of ["GENERATE_DOCX", "START", "SAVE_SESSION"])
    assert.equal((await send(type)).ok, false);
  finishGeneration();
  await generating;
  assert.equal((await send("GET_STATE")).document.state, "ready");
  vm.runInContext(`session.captureFailures=[{error:'print'}];`, bg);
  assert.equal((await send("GENERATE_DOCX")).ok, false);
  const partial = send("GENERATE_DOCX", { allowPartial: true });
  await tick();
  finishGeneration();
  assert.equal((await partial).ok, true);
  console.log(
    "PASS: botão de três etapas, sessão nova, configurações antes da gravação, consentimento e geração concorrente.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
