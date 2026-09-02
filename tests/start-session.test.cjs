const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const crypto = require("node:crypto");
const root = path.resolve(__dirname, "..");
let listener,
  connected = false,
  blocked = false,
  injects = 0;
const context = vm.createContext({
  console,
  crypto,
  setTimeout,
  clearTimeout,
  URL,
  accessStatus: async () => ({ authenticated: true }),
  clearAccess: async () => ({ authenticated: false }),
  validateAccess: async () => ({ authenticated: true }),
  readAsset: async () => null,
  readProjectAssets: async () => ({}),
  removeProjectAssets: async () => {},
  saveEventAssets: async () => ({}),
  chrome: {
    runtime: {
      sendMessage: async () => ({ ok: true }),
      onMessage: {
        addListener(fn) {
          listener = fn;
        },
      },
    },
    storage: {
      local: { get: async () => ({ chronoConfig: { configVersion: 7 } }), set: async () => {} },
    },
    scripting: {
      executeScript: async (args) => {
        if (blocked) throw Error("Permission denied");
        injects++;
        if (args.files) connected = true;
      },
    },
    tabs: {
      query: async () => [{ id: 1, url: "https://test/form" }],
      sendMessage: async (_, message) => {
        if (!connected) throw Error("Receiving end does not exist");
        if (message.type === "GET_PAGE") return { url: "https://test/form" };
        if (message.type === "START_RECORDING") return { ok: true };
      },
    },
  },
});
vm.runInContext(fs.readFileSync(path.join(root, "extension/recording-policy.js"), "utf8"), context);
vm.runInContext(fs.readFileSync(path.join(root, "extension/default-config.js"), "utf8"), context);
vm.runInContext(
  fs
    .readFileSync(path.join(root, "extension/background.js"), "utf8")
    .replace(/^import[\s\S]*?const DEFAULT_CONFIG/, "const DEFAULT_CONFIG"),
  context,
);
vm.runInContext(
  `project={id:'old',root:'local'};session={id:'old',config:{},steps:[{id:'old'}],document:{state:'ready',output:'old.docx'}};recorderState='finished';`,
  context,
);
const send = (type) => new Promise((resolve) => listener({ type }, {}, resolve));
(async () => {
  blocked = true;
  assert.equal((await send("START")).ok, false);
  assert.equal((await send("GET_STATE")).document.output, "old.docx");
  blocked = false;
  assert.equal((await send("START")).ok, true);
  assert.equal(injects, 2);
  const state = await send("GET_STATE");
  assert.equal(state.state, "recording");
  assert.equal(state.count, 0);
  assert.equal(state.document, null);
  assert.equal(state.failures.length, 0);
  assert.equal(state.project.root, "Armazenamento local da extensão");
  assert.equal((await send("START")).ok, false);
  console.log(
    "PASS: início reconecta a página, confirma gravação, limpa sessão antiga e preserva dados se falhar.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
