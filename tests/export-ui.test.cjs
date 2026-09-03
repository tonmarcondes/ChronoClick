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
  let state = { ok: true, state: "idle", count: 0, access: { authenticated: true } },
    failStart = false,
    failSave = false,
    reviewListener;
  const chrome = {
    runtime: {
      onMessage: {
        addListener(fn) {
          reviewListener = fn;
        },
      },
      getManifest: () => ({ version: "0.9.0" }),
      openOptionsPage: () => calls.push("options"),
      sendMessage: async (message) => {
        calls.push(message.type);
        if (message.type === "GET_STATE") return state;
        if (message.type === "START") {
          if (failStart) return { ok: false, error: "Página desconectada" };
          state = {
            ok: true,
            state: "recording",
            count: 0,
            project: { root: "/new" },
            access: { authenticated: true },
          };
        }
        if (message.type === "STOP") state = { ...state, state: "finished", count: 2 };
        if (message.type === "GENERATE_DOCX")
          state = {
            ok: true,
            state: "idle",
            count: 0,
            project: null,
            failures: [],
            access: { authenticated: true },
          };
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
  await vm.runInContext("refresh()", context);
  assert.equal(element("captureWarnings").hidden, false);
  state.showCaptureErrors = false;
  await vm.runInContext("refresh()", context);
  assert.equal(element("captureWarnings").hidden, true);
  state.showCaptureErrors = true;
  await element("primaryAction").onclick();
  assert.match(element("error").textContent, /Confirme/);
  element("allowPartial").checked = true;
  await element("primaryAction").onclick();
  assert.equal(element("primaryAction").textContent, "Iniciar nova");
  await element("primaryAction").onclick();
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
  assert.equal(element("reviewVersion").textContent, "v0.9.0");
  vm.runInContext(
    "session={config:{},steps:[{id:'old'}],groups:[],captureFailures:[{error:'old'}]};",
    review,
  );
  reviewListener({ type: "SESSION_STARTED" });
  assert.equal(vm.runInContext("session.steps.length", review), 0);
  assert.equal(element("captureWarnings").textContent, "");
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
  const actionBadges = [],
    badgeBackgrounds = [],
    badgeTextColors = [],
    openedDownloads = [],
    removedProjects = [];
  const bg = vm.createContext({
    console,
    crypto: require("node:crypto"),
    setTimeout,
    clearTimeout,
    accessStatus: async () => ({ authenticated: true }),
    clearAccess: async () => ({ authenticated: false }),
    validateAccess: async () => ({ authenticated: true }),
    readAsset: async () => null,
    readProjectAssets: async () => ({}),
    removeProjectAssets: async () => {},
    saveEventAssets: async () => ({}),
    chrome: {
      runtime: {
        onMessage: {
          addListener(fn) {
            listener = fn;
          },
        },
      },
      storage: { local: { get: async () => ({}), set: async () => {} } },
      tabs: { query: async () => [] },
      action: {
        setBadgeBackgroundColor: async ({ color }) => badgeBackgrounds.push(color),
        setBadgeText: async ({ text }) => actionBadges.push(text),
        setBadgeTextColor: async ({ color }) => badgeTextColors.push(color),
        setTitle: async () => {},
      },
      downloads: { open: async (id) => openedDownloads.push(id) },
    },
  });
  vm.runInContext(source("recording-policy.js"), bg);
  vm.runInContext(source("default-config.js"), bg);
  vm.runInContext(
    source("background.js").replace(/^import[\s\S]*?const DEFAULT_CONFIG/, "const DEFAULT_CONFIG"),
    bg,
  );
  bg.hostCall = async (command) =>
    command === "generateDocx"
      ? new Promise((resolve) => {
          finishGeneration = () =>
            resolve({
              ok: true,
              document: { state: "ready", output: "/project/test.docx", downloadId: 42 },
            });
        })
      : { ok: true };
  vm.runInContext(
    `project={id:'project',root:'local'};session={config:{},steps:[{id:'1'}],groups:[]};recorderState='finished';generateAndDownloadDocx=()=>hostCall('generateDocx');`,
    bg,
  );
  bg.removeProjectAssets = async (projectId) => removedProjects.push(projectId);
  const send = (type, extra = {}) =>
    new Promise((resolve) => listener({ type, ...extra }, {}, resolve));
  const generating = send("GENERATE_DOCX");
  await tick();
  assert.equal((await send("GET_STATE")).document.state, "generating");
  for (const type of ["GENERATE_DOCX", "START", "SAVE_SESSION"])
    assert.equal((await send(type)).ok, false);
  finishGeneration();
  const generated = await generating;
  assert.equal(generated.document.state, "ready");
  assert.ok(actionBadges.includes("1"));
  assert.equal((await send("OPEN_DOCX", { downloadId: generated.document.downloadId })).ok, true);
  assert.deepEqual(openedDownloads, [42]);
  assert.deepEqual(removedProjects, ["project"]);
  assert.equal((await send("GET_STATE")).count, 0);
  assert.equal((await send("GET_STATE")).project, null);
  assert.equal(actionBadges.at(-1), "");
  vm.runInContext(
    `project={id:'project-2',root:'local'};session={config:{theme:{badgeBackground:'123456',badgeTextColor:'ABCDEF',badgeTransparent:true}},steps:[{id:'1'}],groups:[],captureFailures:[]};recorderState='finished';`,
    bg,
  );
  await vm.runInContext("saveState()", bg);
  assert.deepEqual(Array.from(badgeBackgrounds.at(-1)), [0, 0, 0, 0]);
  assert.equal(badgeTextColors.at(-1), "#ABCDEF");
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
