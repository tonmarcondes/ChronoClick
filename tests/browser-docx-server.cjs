const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = process.env.CHRONO_BROWSER_DOCX || "/private/tmp/chronoclick-browser.docx";
const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };

http
  .createServer((request, response) => {
    if (request.method === "POST" && request.url === "/save-docx") {
      const chunks = [];
      request.on("data", (chunk) => chunks.push(chunk));
      request.on("end", () => {
        fs.writeFileSync(output, Buffer.concat(chunks));
        response.writeHead(204).end();
      });
      return;
    }
    const pathname = request.url === "/" ? "/tests/browser-docx-harness.html" : request.url;
    const file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root) || !fs.existsSync(file)) {
      response.writeHead(404).end("Não encontrado");
      return;
    }
    response.writeHead(200, {
      "content-type": types[path.extname(file)] || "application/octet-stream",
    });
    fs.createReadStream(file).pipe(response);
  })
  .listen(4174, "127.0.0.1", () => console.log("ChronoClick browser test: http://127.0.0.1:4174"));
