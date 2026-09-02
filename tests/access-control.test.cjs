const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

let stored = {};
const context = vm.createContext({
  console,
  Date,
  fetch: async () => {
    throw new Error("offline");
  },
  chrome: {
    runtime: { id: "test-extension" },
    storage: {
      local: {
        get: async () => ({ chronoAccess: stored.chronoAccess }),
        set: async (value) => Object.assign(stored, value),
        remove: async (key) => delete stored[key],
      },
    },
  },
});

const source = fs
  .readFileSync(path.join(__dirname, "../extension/access-control.js"), "utf8")
  .replace(/export /g, "");
vm.runInContext(
  `${source}\nglobalThis.accessApi={accessStatus,validateAccess,clearAccess};`,
  context,
);

(async () => {
  const api = context.accessApi;
  assert.equal((await api.accessStatus()).authenticated, false);
  const valid = await api.validateAccess(" WmarcondesBR@gmail.com ");
  assert.equal(valid.authenticated, true);
  assert.equal(valid.email, "wmarcondesbr@gmail.com");
  assert.equal((await api.accessStatus()).plan, "teste");
  await assert.rejects(api.validateAccess("outra@pessoa.com"), /ainda não está disponível/);
  await api.clearAccess();
  assert.equal((await api.accessStatus()).authenticated, false);
  console.log("PASS: acesso por e-mail, validade local e bloqueio de contas sem licença.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
