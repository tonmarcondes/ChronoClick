import "./recording-policy.js";
const HOST = "com.chronoclick.recorder";
const DEFAULT_CONFIG = {
  configVersion: 6,
  recording: { ...ChronoPolicy.defaults },
  projectRoot: "${HOME}/sistemas/cronoPrint",
  documentTitle: "Procedimento gravado",
  sectionTitlePattern: "{sectionNumber}. {pageName}",
  screenshotCaptionPattern: "Figura {sectionNumber}.{screenNumber} — {pageName}",
  tableCaptionPattern: "Tabela {sectionNumber}.{tableNumber} — Passos de {pageName}",
  groupWindowMs: 12000,
  columns: [
    { key: "step", title: "STEP", source: ["sequence"], width: 12, alignment: "center" },
    { key: "description", title: "DESCRIÇÃO", source: ["auto-description", "microprint"], width: 88, alignment: "left" }
  ],
  actionTexts: {
    "click-button": "Clique no botão {name}.", "click-link": "Clique no link {name}.", "click-field": "Selecione o campo {name}.",
    click: "Clique em {name}.", "double-click": "Dê um duplo clique em {name}.", "right-click": "Acione o botão direito do mouse em {name}.",
    typing: "Insira o texto {value} no campo {name}.", select: "Selecione uma opção no campo {name}.", toggle: "Altere a opção {name}.",
    change: "Altere o campo {name}.", observation: "Observe {name}.", "highlight-text": "Certifique-se que {texto-iluminado}.",
    "page-view": "Acesse a página {pageName}.", scroll: "Role a página até a posição {scrollY}.", generic: "Interaja com {name}."
  },
  microprint: { heightPt: 11, maxWidthPt: 90, preserveAspectRatio: true },
  markers: { sizePt: 18 },
  images: {
    screen: { format: "jpeg", quality: 82, maxWidth: 1920, maxHeight: 1080 },
    component: { format: "png", quality: 92, maxWidth: 600, maxHeight: 300, padding: 18, upscale: false }
  },
  theme: {
    fontFamily: "Aptos", bodyFontSize: 11, headingColor: "111827",
    tableHeaderBackground: "285589", tableHeaderColor: "FFFFFF", tableBorderColor: "111111",
    markerBackground: "000000", markerColor: "FFFFFF", componentBold: true, componentColor: "111827", linkColor: "0563C1",
    titleBefore: 0, titleAfter: 18, screenBefore: 6, screenAfter: 12, tableBefore: 8, tableAfter: 18
  }
};

let recorderState = "idle", session = null, project = null, lastCaptureAt = 0;
let eventQueue = Promise.resolve();
let captureQueue = Promise.resolve();
let initialization = null;
let nativePort = null;
const nativePending = new Map();

function native(command, payload = {}) {
  if (!nativePort) {
    nativePort = chrome.runtime.connectNative(HOST);
    nativePort.onMessage.addListener((response) => {
      const pending = nativePending.get(response.requestId); if (!pending) return;
      nativePending.delete(response.requestId); response?.ok ? pending.resolve(response) : pending.reject(new Error(response?.error || "Falha no host local."));
    });
    nativePort.onDisconnect.addListener(() => {
      const message = chrome.runtime.lastError?.message || "O host local foi desconectado.";
      for (const pending of nativePending.values()) pending.reject(new Error(message));
      nativePending.clear(); nativePort = null;
    });
  }
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => { nativePending.set(requestId, { resolve, reject }); nativePort.postMessage({ requestId, command, ...payload }); });
}

async function nativeSaveEvent(payload) {
  const started = await native("beginEvent", { projectPath: payload.projectPath, step: payload.step, signature: payload.signature });
  for (const [kind, value] of [["screen", payload.screenDataUrl], ["micro", payload.microDataUrl]]) {
    if (!value) continue;
    const chunkSize = 480000;
    for (let index = 0, offset = 0; offset < value.length; index++, offset += chunkSize) {
      await native("eventChunk", { uploadId: started.uploadId, kind, index, data: value.slice(offset, offset + chunkSize) });
    }
  }
  return native("commitEvent", { uploadId: started.uploadId });
}

function migrateConfig(saved = {}) {
  const legacyColumns = Number(saved.configVersion || 0) < 3 ? DEFAULT_CONFIG.columns : (saved.columns || DEFAULT_CONFIG.columns);
  const migrated = { ...saved, configVersion: 6, columns: legacyColumns.map((column, index) => ({ ...column, alignment: column.alignment || (index === 0 ? "center" : "left") })) };
  migrated.recording = { ...ChronoPolicy.defaults, ...saved.recording };
  if (!saved.actionTexts?.typing || saved.actionTexts.typing === "Preencha o campo {name}.") migrated.actionTexts = { ...saved.actionTexts, typing: DEFAULT_CONFIG.actionTexts.typing };
  return { ...DEFAULT_CONFIG, ...migrated, actionTexts: { ...DEFAULT_CONFIG.actionTexts, ...(migrated.actionTexts || {}) }, microprint: { ...DEFAULT_CONFIG.microprint, ...(migrated.microprint || {}) }, markers: { ...DEFAULT_CONFIG.markers, ...(migrated.markers || {}) }, theme: { ...DEFAULT_CONFIG.theme, ...(migrated.theme || {}) }, images: { screen: { ...DEFAULT_CONFIG.images.screen, ...(migrated.images?.screen || {}) }, component: { ...DEFAULT_CONFIG.images.component, ...(migrated.images?.component || {}) } } };
}

async function loadState() {
  if (session || project) return;
  if (!initialization) initialization = (async () => {
    const stored = await chrome.storage.local.get(["chronoSession", "chronoProject", "chronoState", "chronoConfig"]);
    session = stored.chronoSession || null; project = stored.chronoProject || null; recorderState = stored.chronoState || "idle";
    if (session) session.config = migrateConfig(session.config);
    if (session?.document?.state === "generating") {
      session.document = { state: "error", error: "A geração anterior foi interrompida. Clique em Gerar DOCX para tentar novamente." };
      await saveState();
    }
  })();
  await initialization;
}
async function saveState() { await chrome.storage.local.set({ chronoSession: session, chronoProject: project, chronoState: recorderState, chronoConfig: session?.config || DEFAULT_CONFIG }); }
async function broadcastState() {
  for (const tab of await chrome.tabs.query({})) if (tab.id && /^https?:|^file:/.test(tab.url || "")) chrome.tabs.sendMessage(tab.id, { type: "SET_STATE", state: recorderState, recording: session?.config?.recording }).catch(() => {});
}
async function captureVisible(sender, payload) {
  if (sender.tab?.windowId == null) throw new Error("A aba de origem não está disponível.");
  const wait = Math.max(0, 550 - (Date.now() - lastCaptureAt)); if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
  const verify = async () => {
    const [active] = await chrome.tabs.query({ active: true, windowId: sender.tab.windowId });
    if (active?.id !== sender.tab.id) throw new Error("A aba de origem não está visível. Nenhum print de outra aba foi salvo.");
    const selector = payload.noMicroprint || payload.action === "highlight-text" ? null : payload.component?.selector;
    const actual = await chrome.tabs.sendMessage(sender.tab.id, { type: "GET_CAPTURE_CONTEXT", selector }, { frameId: sender.frameId || 0 });
    ChronoPolicy.validate(payload.page, actual);
    if (selector && payload.rect && (!actual.rect || ["x", "y", "width", "height"].some(key => Math.abs(payload.rect[key] - actual.rect[key]) > 2))) throw new Error("O componente mudou de posição antes do print. Repita a interação.");
  };
  if (session.config.recording.validateCapture) await verify();
  const result = await chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: "png" }); lastCaptureAt = Date.now();
  if (session.config.recording.validateCapture) await verify();
  return result;
}
async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return `data:${blob.type};base64,${btoa(binary)}`;
}
async function cropDataUrl(dataUrl, rect, page) {
  const padding = Number(session?.config?.images?.component?.padding ?? 18);
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const scaleX = bitmap.width / Math.max(1, page.viewportWidth), scaleY = bitmap.height / Math.max(1, page.viewportHeight);
  const left = Math.max(0, Math.floor((rect.x - padding) * scaleX)), top = Math.max(0, Math.floor((rect.y - padding) * scaleY));
  const right = Math.min(bitmap.width, Math.ceil((rect.x + rect.width + padding) * scaleX)), bottom = Math.min(bitmap.height, Math.ceil((rect.y + rect.height + padding) * scaleY));
  if (right <= left || bottom <= top) throw new Error("O componente não estava visível no print.");
  const width = Math.max(1, right - left), height = Math.max(1, bottom - top), canvas = new OffscreenCanvas(width, height);
  canvas.getContext("2d").drawImage(bitmap, left, top, width, height, 0, 0, width, height);
  return blobToDataUrl(await canvas.convertToBlob({ type: "image/png" }));
}
async function visualSignature(dataUrl) {
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob()), canvas = new OffscreenCanvas(16, 12), context = canvas.getContext("2d", { willReadFrequently: true });
  context.drawImage(bitmap, 0, 0, 16, 12); const data = context.getImageData(0, 0, 16, 12).data, values = [];
  for (let i = 0; i < data.length; i += 4) values.push(Math.round(data[i] * .299 + data[i + 1] * .587 + data[i + 2] * .114)); return values;
}
function signatureDifference(a, b) { return !a?.length || a.length !== b?.length ? Infinity : a.reduce((sum, value, i) => sum + Math.abs(value - b[i]), 0) / a.length; }
function groupIdFor(payload, signature) {
  if (session.config.recording.separateScreens || payload.forceNewGroup) return `screen-${crypto.randomUUID()}`;
  if (payload.forceNewGroup) return `screen-${String(session.groups.length + 1).padStart(3, "0")}`;
  const last = session.steps.at(-1); if (!last) return "screen-001";
  const group = session.groups.find((item) => item.id === last.groupId);
  const samePage = last.page.url.split("#")[0] === payload.page.url.split("#")[0] && last.page.pageName === payload.page.pageName;
  const close = Date.parse(payload.timestamp) - Date.parse(last.timestamp) <= (session.config.groupWindowMs || 12000);
  return samePage && close && signatureDifference(group?.signature, signature) <= 10 ? last.groupId : `screen-${String(session.groups.length + 1).padStart(3, "0")}`;
}
async function captureEvent(payload, sender) {
  const screenDataUrl = await captureVisible(sender, payload);
  const microDataUrl = payload.noMicroprint || payload.component?.textOnlyLink ? null : await cropDataUrl(screenDataUrl, payload.rect, payload.page);
  return { screenDataUrl, microDataUrl, signature: await visualSignature(screenDataUrl) };
}
async function addEvent(payload, media) {
  const { screenDataUrl, microDataUrl, signature } = media;
  const duplicateIds = new Set(ChronoPolicy.duplicates(session.steps, payload, session.config.recording.repeatMode).map(step => step.id));
  const pendingScroll = payload.pendingScroll; delete payload.pendingScroll;
  if (pendingScroll) {
    await addEvent({ action: "scroll", ...pendingScroll, page: payload.page, noMicroprint: true, forceNewGroup: true,
      component: { name: payload.page.pageName, role: "page", selector: pendingScroll.selector }, click: null,
      captureNote: "Posição final da rolagem, capturada junto da interação seguinte." }, { ...media, microDataUrl: null });
  }
  const groupId = groupIdFor(payload, signature), isNewGroup = !session.groups.some((item) => item.id === groupId);
  const step = { id: crypto.randomUUID(), sequence: session.steps.length + 1, groupId, description: "", ...payload };
  const result = await nativeSaveEvent({ projectPath: project.root, step, screenDataUrl, microDataUrl, signature }); step.images = result.step.images; session.steps.push(step);
  const resolvedKey = [payload.action, payload.page?.url, payload.component?.selector].join("|");
  session.captureFailures = (session.captureFailures || []).filter(item => item.key !== resolvedKey);
  if (isNewGroup) session.groups.push({ id: groupId, page: payload.page, screenshot: step.images.screen, signature, stepIds: [step.id] }); else session.groups.find((item) => item.id === groupId).stepIds.push(step.id);
  if (duplicateIds.size) {
    session.steps = session.steps.filter(item => !duplicateIds.has(item.id));
    ChronoPolicy.normalize(session);
  }
  await native("saveSession", { projectPath: project.root, session });
  await saveState(); return { ok: true, step };
}
async function flushPages() {
  await Promise.all((await chrome.tabs.query({})).filter(tab => /^https?:|^file:/.test(tab.url || "")).map(tab =>
    chrome.tabs.sendMessage(tab.id, { type: "FLUSH_PENDING" }).catch(() => null)));
}
async function startSession(name, root) {
  if (["recording", "paused", "finalizing"].includes(recorderState)) throw new Error("Finalize a gravação atual antes de iniciar outra.");
  const stored = await chrome.storage.local.get("chronoConfig");
  const config = migrateConfig(stored.chronoConfig || {});
  if (root?.trim()) config.projectRoot = root.trim();
  const response = await native("createProject", { name: name || `Projeto ${new Date().toLocaleString("pt-BR")}`, root: config.projectRoot, config });
  project = response.project; session = response.session; recorderState = "recording"; await saveState(); await broadcastState(); return response;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    await loadState();
    if (["SAVE_SESSION", "SAVE_CONFIG", "START", "RESUME", "STOP", "PAUSE"].includes(message.type) && session?.document?.state === "generating") throw new Error("Aguarde a geração do DOCX terminar.");
    if (message.type === "PING_HOST") return native("ping");
    if (message.type === "GET_STATE") return { ok: true, state: recorderState, count: session?.steps.length || 0, project, document: session?.document, recording: session?.config?.recording || DEFAULT_CONFIG.recording, failures: session?.captureFailures || [], projectRoot: session?.config?.projectRoot || DEFAULT_CONFIG.projectRoot };
    if (message.type === "START") { await startSession(message.name, message.root); return { ok: true, state: recorderState, project }; }
    if (message.type === "PAUSE") { await flushPages(); recorderState = "paused"; await eventQueue; await saveState(); await broadcastState(); return { ok: true, state: recorderState }; }
    if (message.type === "RESUME") { recorderState = "recording"; await saveState(); await broadcastState(); return { ok: true, state: recorderState }; }
    if (message.type === "STOP") {
      await flushPages();
      recorderState = "finalizing"; await saveState(); await broadcastState();
      await eventQueue.catch(() => {});
      const response = await native("finish", { projectPath: project.root }); session = response.session; recorderState = "finished";
      await saveState(); await broadcastState(); return { ok: true, state: recorderState, count: session.steps.length, project };
    }
    if (message.type === "RECORD_EVENT") {
      if (recorderState !== "recording") return { ok: false, error: "Gravação não está ativa." };
      const captured = captureQueue.catch(() => {}).then(() => captureEvent(message.payload, sender));
      captureQueue = captured.catch(() => {});
      const outcome = captured.then(media => ({ media }), error => ({ error }));
      eventQueue = eventQueue.catch(() => {}).then(async () => {
        const result = await outcome;
        try { if (result.error) throw result.error; return await addEvent(message.payload, result.media); }
        catch (error) {
          session.captureFailures ||= [];
          session.captureFailures.push({ key: [message.payload.action, message.payload.page?.url, message.payload.component?.selector].join("|"), action: message.payload.action, timestamp: message.payload.timestamp, error: error.message });
          await saveState();
          await native("saveSession", { projectPath: project.root, session }).catch(() => {});
          return { ok: false, error: error.message };
        }
      });
      return eventQueue;
    }
    if (message.type === "GET_SESSION") {
      if (!project) return { session: null, project: null, state: recorderState };
      if (session?.document?.state === "generating") return { ok: true, session, project, state: recorderState };
      await eventQueue;
      const response = await native("getSession", { projectPath: project.root }); session = response.session; project = response.project;
      if (Number(session.config?.configVersion || 0) < 6) { session.config = migrateConfig(session.config); await native("saveSession", { projectPath: project.root, session }); await saveState(); }
      return { ok: true, session, project, state: recorderState };
    }
    if (message.type === "READ_IMAGE") return native("readImage", { projectPath: project.root, relativePath: message.relativePath });
    if (message.type === "SAVE_SESSION") { if (["recording", "finalizing"].includes(recorderState)) throw new Error("Pause ou finalize antes de editar os passos e configurações."); await eventQueue; session = message.session; await native("saveSession", { projectPath: project.root, session }); await saveState(); return { ok: true }; }
    if (message.type === "SAVE_CONFIG") { session.config = migrateConfig(message.config); await native("saveSession", { projectPath: project.root, session }); await chrome.storage.local.set({ chronoConfig: session.config }); await saveState(); await broadcastState(); return { ok: true }; }
    if (message.type === "OPEN_DOCX") return native("openDocx", { projectPath: project?.root });
    if (message.type === "GENERATE_DOCX") {
      if (!project || !session) throw new Error("Inicie uma gravação antes de gerar o DOCX.");
      if (["recording", "finalizing"].includes(recorderState)) throw new Error("Pause ou finalize a gravação antes de gerar o DOCX.");
      if (session.document?.state === "generating") throw new Error("O DOCX já está sendo gerado.");
      session.document = { state: "generating" }; await saveState();
      try {
        await flushPages(); await eventQueue;
        if (!session.steps.length) throw new Error("Nenhum passo capturado. Confira a gravação antes de exportar.");
        if (session.captureFailures?.length && message.allowPartial !== true) throw new Error(`${session.captureFailures.length} captura(s) falharam. Confirme a exportação dos passos salvos para continuar.`);
        await native("saveSession", { projectPath: project.root, session });
        const result = await native("generateDocx", { projectPath: project.root, fileName: message.fileName || session.config.documentTitle || "procedimento", allowPartial: message.allowPartial === true });
        session.document = result.document; await saveState(); return result;
      } catch (error) { session.document = { state: "error", error: error.message }; await saveState(); throw error; }
    }
    return { ok: true };
  })().then(sendResponse).catch((error) => sendResponse({ ok: false, error: error.message })); return true;
});
