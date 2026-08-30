#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const os = require("os");
const { spawnSync } = require("child_process");
const sharp = require("sharp");
require("../extension/recording-policy.js");

const APP_ROOT = path.resolve(__dirname, "..");
const DEFAULT_ROOT = path.join(os.homedir(), "sistemas", "cronoPrint");
let input = Buffer.alloc(0);
const uploads = new Map();

function respond(message) {
  const body = Buffer.from(JSON.stringify(message));
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  process.stdout.write(Buffer.concat([header, body]));
}

function safeSlug(name) {
  const slug = String(name || "projeto")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
  return slug || `projeto-${Date.now()}`;
}

function expandPath(value) {
  let expanded = String(value || DEFAULT_ROOT).trim();
  if (expanded === "~" || expanded.startsWith("~/")) expanded = path.join(os.homedir(), expanded.slice(2));
  expanded = expanded.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}|\$([A-Za-z_][A-Za-z0-9_]*)|%([A-Za-z_][A-Za-z0-9_]*)%/g, (_, a, b, c) => process.env[a || b || c] || "");
  return path.resolve(expanded);
}

function assertProject(projectPath) {
  const resolved = path.resolve(projectPath || "");
  if (!fs.existsSync(path.join(resolved, "project.json"))) throw new Error("Projeto ChronoClick inválido.");
  return resolved;
}

function readJson(file) { return JSON.parse(fs.readFileSync(file, "utf8")); }
function writeJson(file, value) { fs.writeFileSync(file, JSON.stringify(value, null, 2)); }

async function writeImage(dataUrl, file, options) {
  if (!String(dataUrl || "").startsWith("data:")) throw new Error("Imagem inválida.");
  const input = Buffer.from(dataUrl.split(",")[1], "base64");
  let pipeline = sharp(input).rotate();
  const width = Number(options.maxWidth || 1920);
  const height = Number(options.maxHeight || 1080);
  pipeline = pipeline.resize({ width, height, fit: "inside", withoutEnlargement: options.upscale !== true });
  if (options.format === "png") pipeline = pipeline.png({ compressionLevel: 8 });
  else if (options.format === "webp") pipeline = pipeline.webp({ quality: Number(options.quality || 82) });
  else pipeline = pipeline.jpeg({ quality: Number(options.quality || 82), mozjpeg: true });
  await pipeline.toFile(file);
}

function extensionFor(format) { return format === "png" ? "png" : format === "webp" ? "webp" : "jpg"; }

async function createProject(message) {
  const projectRoot = expandPath(message.root || message.config?.projectRoot || DEFAULT_ROOT);
  fs.mkdirSync(projectRoot, { recursive: true });
  const base = safeSlug(message.name);
  let slug = base;
  let projectPath = path.join(projectRoot, slug);
  let suffix = 2;
  while (fs.existsSync(projectPath)) { slug = `${base}-${suffix++}`; projectPath = path.join(projectRoot, slug); }
  for (const folder of ["screenshots", "components", "documents"]) fs.mkdirSync(path.join(projectPath, folder), { recursive: true });
  const config = message.config || {};
  const project = { schemaVersion: 2, id: crypto.randomUUID(), name: message.name || slug, slug, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), root: projectPath, config };
  const session = { schemaVersion: 2, id: crypto.randomUUID(), projectId: project.id, createdAt: project.createdAt, finishedAt: null, config, steps: [], groups: [] };
  writeJson(path.join(projectPath, "project.json"), project);
  writeJson(path.join(projectPath, "session.json"), session);
  const defaultTheme = path.join(APP_ROOT, "themes", "default.css");
  if (fs.existsSync(defaultTheme)) fs.copyFileSync(defaultTheme, path.join(projectPath, "theme.css"));
  return { project, session };
}

async function saveEvent(message) {
  const projectPath = assertProject(message.projectPath);
  const sessionFile = path.join(projectPath, "session.json");
  const session = readJson(sessionFile);
  const config = session.config?.images || {};
  const step = message.step;
  const screenOptions = { format: "jpeg", quality: 82, maxWidth: 1920, maxHeight: 1080, ...(config.screen || {}) };
  const componentOptions = { format: "png", quality: 92, maxWidth: 600, maxHeight: 300, ...(config.component || {}) };
  const groupNumber = session.groups.length + 1;
  let group = session.groups.find((item) => item.id === step.groupId);
  const screenName = `screen-${step.id}.${extensionFor(screenOptions.format)}`;
  await writeImage(message.screenDataUrl, path.join(projectPath, "screenshots", screenName), screenOptions);
  if (!group) {
    group = { id: step.groupId, page: step.page, screenshot: `screenshots/${screenName}`, signature: message.signature, stepIds: [] };
    session.groups.push(group);
  }
  step.images = { screen: `screenshots/${screenName}`, microprint: null };
  if (message.microDataUrl) {
    const componentName = `step-${step.id}.${extensionFor(componentOptions.format)}`;
    await writeImage(message.microDataUrl, path.join(projectPath, "components", componentName), componentOptions);
    step.images.microprint = `components/${componentName}`;
  }
  session.steps.push(step);
  group.stepIds.push(step.id);
  writeJson(sessionFile, session);
  return { step, count: session.steps.length };
}

async function handle(message) {
  if (message.command === "ping") return { ok: true, version: "0.8.8", root: DEFAULT_ROOT };
  if (message.command === "createProject") return { ok: true, ...(await createProject(message)) };
  if (message.command === "saveEvent") return { ok: true, ...(await saveEvent(message)) };
  if (message.command === "beginEvent") {
    const uploadId = crypto.randomUUID(); uploads.set(uploadId, { projectPath: message.projectPath, step: message.step, signature: message.signature, screen: [], micro: [] });
    return { ok: true, uploadId };
  }
  if (message.command === "eventChunk") {
    const upload = uploads.get(message.uploadId); if (!upload) throw new Error("Upload de evento expirou.");
    if (!['screen', 'micro'].includes(message.kind)) throw new Error("Tipo de bloco inválido.");
    upload[message.kind].push(message.data); return { ok: true, received: message.index };
  }
  if (message.command === "commitEvent") {
    const upload = uploads.get(message.uploadId); if (!upload) throw new Error("Upload de evento expirou."); uploads.delete(message.uploadId);
    return { ok: true, ...(await saveEvent({ projectPath: upload.projectPath, step: upload.step, signature: upload.signature, screenDataUrl: upload.screen.join(""), microDataUrl: upload.micro.join("") })) };
  }
  if (message.command === "getSession") {
    const projectPath = assertProject(message.projectPath);
    return { ok: true, session: readJson(path.join(projectPath, "session.json")), project: readJson(path.join(projectPath, "project.json")) };
  }
  if (message.command === "readImage") {
    const projectPath = assertProject(message.projectPath);
    const file = path.resolve(projectPath, message.relativePath || "");
    if (!file.startsWith(projectPath + path.sep)) throw new Error("Imagem fora do projeto.");
    const ext = path.extname(file).toLowerCase();
    const mime = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
    return { ok: true, dataUrl: `data:${mime};base64,${fs.readFileSync(file).toString("base64")}` };
  }
  if (message.command === "saveSession") {
    const projectPath = assertProject(message.projectPath);
    writeJson(path.join(projectPath, "session.json"), message.session);
    const projectFile = path.join(projectPath, "project.json");
    const project = readJson(projectFile); project.config = message.session.config; project.updatedAt = new Date().toISOString(); writeJson(projectFile, project);
    return { ok: true };
  }
  if (message.command === "finish") {
    const projectPath = assertProject(message.projectPath);
    const file = path.join(projectPath, "session.json"); const session = readJson(file); session.finishedAt = new Date().toISOString(); writeJson(file, session);
    return { ok: true, session };
  }
  if (message.command === "generateDocx") {
    const projectPath = assertProject(message.projectPath);
    fs.mkdirSync(path.join(projectPath, "documents"), { recursive: true });
    const recorded = readJson(path.join(projectPath, "session.json"));
    if (recorded.captureFailures?.length && message.allowPartial !== true) throw new Error("Há capturas com falha. Confirme a exportação dos passos salvos para continuar.");
    if (!recorded.steps?.length) throw new Error("Nenhum passo foi capturado. Inicie uma gravação e confira o contador de eventos antes de finalizar.");
    if (!recorded.groups?.some(group => group.stepIds?.some(id => recorded.steps.some(step => step.id === id)))) throw new Error("A sessão não contém telas associadas aos passos. Não é possível gerar um documento vazio.");
    for (const step of recorded.steps) {
      if (!step.images?.screen || !fs.existsSync(path.join(projectPath, step.images.screen))) throw new Error(`Print ausente no passo ${step.sequence}.`);
      if (step.images.microprint && !fs.existsSync(path.join(projectPath, step.images.microprint))) throw new Error(`Microprint ausente no passo ${step.sequence}.`);
    }
    const project = readJson(path.join(projectPath, "project.json"));
    const fileName = String(project.name || project.slug || "projeto").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/g, "").trim() || "projeto";
    const output = path.join(projectPath, "documents", `${fileName}.docx`);
    const node = process.execPath;
    const args = [path.join(APP_ROOT, "cli", "generate-docx.cjs"), path.join(projectPath, "session.json"), output];
    if (fs.existsSync(path.join(projectPath, "theme.css"))) args.push("--theme", path.join(projectPath, "theme.css"));
    const result = spawnSync(node, args, { env: process.env, encoding: "utf8", timeout: 120000 });
    if (result.error || result.status !== 0) throw new Error(result.error?.message || result.stderr || "Falha ao gerar DOCX.");
    if (!fs.existsSync(output) || fs.statSync(output).size < 100) throw new Error("A geração terminou sem um DOCX válido.");
    recorded.document = { state: "ready", output, generatedAt: new Date().toISOString() };
    writeJson(path.join(projectPath, "session.json"), recorded);
    return { ok: true, output, document: recorded.document };
  }
  if (message.command === "openDocx") {
    const projectPath = assertProject(message.projectPath);
    const recorded = readJson(path.join(projectPath, "session.json"));
    const output = recorded.document?.output;
    if (!output || path.dirname(path.resolve(output)) !== path.join(projectPath, "documents") || path.extname(output) !== ".docx" || !fs.existsSync(output)) throw new Error("Gere o DOCX antes de abrir o documento.");
    const result = spawnSync("/usr/bin/open", [output], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(result.stderr || "Não foi possível abrir o DOCX.");
    return { ok: true };
  }
  throw new Error(`Comando desconhecido: ${message.command}`);
}

process.stdin.on("data", (chunk) => {
  input = Buffer.concat([input, chunk]);
  while (input.length >= 4) {
    const length = input.readUInt32LE(0);
    if (input.length < 4 + length) break;
    const body = input.subarray(4, 4 + length); input = input.subarray(4 + length);
    const message = JSON.parse(body.toString("utf8"));
    Promise.resolve().then(() => handle(message))
      .then((result) => respond({ requestId: message.requestId, ...result })).catch((error) => respond({ requestId: message.requestId, ok: false, error: error.message }));
  }
});
