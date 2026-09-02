const esbuild = require("esbuild");
const fs = require("node:fs");

const output = "extension/generated/docx-generator.js";

esbuild
  .build({
    entryPoints: ["browser/docx-generator.js"],
    outfile: output,
    bundle: true,
    format: "iife",
    platform: "browser",
    target: ["chrome109"],
    legalComments: "none",
    minify: false,
  })
  .then(() => {
    const bundled = fs
      .readFileSync(output, "utf8")
      .replace(/new Function\("" \+ [A-Za-z_$][\w$]*\)/g, "function () {} ");
    if (/\bnew Function\s*\(|(^|[^\w])eval\s*\(/m.test(bundled))
      throw new Error("O pacote contém execução dinâmica e não pode ser enviado à loja.");
    fs.writeFileSync(output, bundled);
  })
  .catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
