const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../extension/content.js"), "utf8");
const helper = source.slice(
  source.indexOf("  function guardedTarget"),
  source.indexOf("  let pendingScroll"),
);
const handler = source.slice(
  source.indexOf('  for (const type of ["click", "dblclick"])'),
  source.indexOf('\n  document.addEventListener(\n    "change"'),
);
let listener,
  complete,
  records = 0,
  executions = 0;
const element = {
  isConnected: true,
  closest: () => element,
  hasAttribute: () => false,
  matches: () => false,
  dispatchEvent(event) {
    executions++;
    listener(event);
  },
};
const context = vm.createContext({
  Promise,
  MouseEvent: class {
    constructor(type, init) {
      Object.assign(this, init, { type, target: element });
    }
  },
  window: {
    addEventListener(type, fn, capture) {
      assert.equal(capture, true);
      if (type === "click") listener = fn;
    },
  },
  record() {
    records++;
    return new Promise((resolve) => {
      complete = resolve;
    });
  },
});
vm.runInContext(
  `const replayedClicks = new WeakSet(); let state = "recording"; const options = {delayLinkNavigation:true}; ${helper}\n${handler}`,
  context,
);
function click(extra = {}) {
  return {
    target: element,
    button: 0,
    detail: 1,
    clientX: 20,
    clientY: 30,
    preventDefault() {
      this.prevented = true;
    },
    stopImmediatePropagation() {
      this.stopped = true;
    },
    ...extra,
  };
}
(async () => {
  const event = click();
  listener(event);
  assert.equal(event.prevented, true);
  assert.equal(event.stopped, true);
  assert.equal(records, 1);
  assert.equal(executions, 0, "The page must not change while capture is pending");
  complete({ ok: true });
  await new Promise(setImmediate);
  assert.equal(executions, 1);
  assert.equal(records, 1, "Replayed click must not be recorded again");
  for (const extra of [{ ctrlKey: true }, { metaKey: true }, { button: 2 }]) {
    const ignored = click(extra);
    listener(ignored);
    assert.equal(ignored.prevented, undefined);
  }
  const failed = click();
  listener(failed);
  complete({ ok: false });
  await new Promise(setImmediate);
  assert.equal(executions, 2, "A capture failure must not swallow the user's action");
  element.target = "_blank";
  const newTab = click();
  listener(newTab);
  assert.equal(newTab.prevented, undefined);
  console.log("PASS: captura antes da ação, execução única, falha e atalhos preservados.");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
