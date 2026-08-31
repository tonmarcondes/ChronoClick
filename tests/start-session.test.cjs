const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm"),
  path = require("node:path");
const root = path.resolve(__dirname, "..");
let listener,
  connected = false,
  blocked = false,
  injects = 0,
  creates = 0;
const context = vm.createContext({
  console,
  setTimeout,
  clearTimeout,
  URL,
  chrome: {
    runtime: {
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
  fs.readFileSync(path.join(root, "extension/background.js"), "utf8").replace(/^import .*;$/gm, ""),
  context,
);
context.host = async (command, payload) => {
  if (command === "createProject") {
    creates++;
    return {
      project: { root: "/new-project" },
      session: { id: "new", steps: [], groups: [], config: payload.config },
    };
  }
  return { ok: true };
};
vm.runInContext(
  `project={root:'/old-project'};session={id:'old',config:{},steps:[{id:'old'}],document:{state:'ready',output:'/old.docx'}};recorderState='finished';native=host;`,
  context,
);
const send = (type) => new Promise((resolve) => listener({ type }, {}, resolve));
(async () => {
  blocked = true;
  assert.equal((await send("START")).ok, false);
  assert.equal(creates, 0);
  assert.equal((await send("GET_STATE")).document.output, "/old.docx");
  blocked = false;
  assert.equal((await send("START")).ok, true);
  assert.equal(injects, 2);
  assert.equal(creates, 1);
  const state = await send("GET_STATE");
  assert.equal(state.state, "recording");
  assert.equal(state.count, 0);
  assert.equal(state.document, undefined);
  assert.equal(state.project.root, "/new-project");
  assert.equal((await send("START")).ok, false);
  assert.equal(creates, 1);
  console.log(
    "PASS: início reconecta a página, confirma gravação, limpa sessão antiga e preserva dados se falhar.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
