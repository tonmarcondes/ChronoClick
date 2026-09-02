const fs = require("node:fs");
const path = require("node:path");
const JSZip = require("jszip");

const root = path.resolve(__dirname, "../extension");
const manifest = JSON.parse(fs.readFileSync(path.join(root, "manifest.json"), "utf8"));
const output = path.resolve(__dirname, `../dist/chronoclick-extension-v${manifest.version}.zip`);
const zip = new JSZip();

function add(directory, prefix = "") {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    const relative = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) add(absolute, relative);
    else zip.file(relative, fs.readFileSync(absolute));
  }
}

(async () => {
  add(root);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(output);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
