// Local visual QA only. Chrome/native transport is replaced, not production code.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const types = {
  ".js": "text/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};
http
  .createServer((request, response) => {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = path.resolve(root, "." + pathname);
    if (
      !file.startsWith(root + path.sep) ||
      !["extension", "tests"].includes(path.relative(root, file).split(path.sep)[0])
    ) {
      response.writeHead(404).end();
      return;
    }
    try {
      let contents = fs.readFileSync(file);
      if (["popup.html", "review.html"].includes(path.basename(file)))
        contents = contents
          .toString()
          .replace(
            "</head>",
            '<script src="/extension/recording-policy.js"></script><script src="/extension/default-config.js"></script><script src="/tests/ui-mock.js"></script></head>',
          );
      response
        .writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" })
        .end(contents);
    } catch {
      response.writeHead(404).end();
    }
  })
  .listen(8768, "127.0.0.1", () =>
    console.log("UI fixtures: http://127.0.0.1:8768/extension/popup.html"),
  );
