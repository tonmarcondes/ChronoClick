const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");
const crypto = require("crypto");

const app = path.resolve(__dirname, "..");
const host = path.join(__dirname, "native-host.command");

const child = spawn(host, [], { stdio: ["pipe", "pipe", "pipe"] });
let output = Buffer.alloc(0); const pending = new Map();
child.stdout.on("data", (data) => {
  output = Buffer.concat([output, data]);
  while (output.length >= 4) {
    const size = output.readUInt32LE(0); if (output.length < size + 4) break;
    const response = JSON.parse(output.subarray(4, size + 4).toString("utf8")); output = output.subarray(size + 4);
    const request = pending.get(response.requestId); pending.delete(response.requestId);
    response.ok ? request.resolve(response) : request.reject(new Error(response.error));
  }
});

function call(message) {
  const requestId = crypto.randomUUID(), body = Buffer.from(JSON.stringify({ requestId, ...message })), header = Buffer.alloc(4); header.writeUInt32LE(body.length);
  return new Promise((resolve, reject) => { pending.set(requestId, { resolve, reject }); child.stdin.write(Buffer.concat([header, body])); });
}

function dataUrl(file, mime) { return `data:${mime};base64,${fs.readFileSync(file).toString("base64")}`; }

(async () => {
  const ping = await call({ command: "ping" });
  const created = await call({ command: "createProject", name: `_smoke-test-${Date.now()}`, root: process.env.CHRONO_TEST_ROOT || "${HOME}/sistemas/cronoPrint", config: {
    documentTitle: "Teste ChronoClick", sectionTitlePattern: "{sectionNumber}. {pageName}", screenshotCaptionPattern: "Figura {sectionNumber}.{screenNumber} — {pageName}", tableCaptionPattern: "Tabela {sectionNumber}.{tableNumber} — {pageName}",
    configVersion: 5,
    columns: [{ title: "STEP", source: ["sequence"], width: 12, alignment: "center" }, { title: "DESCRIÇÃO", source: ["auto-description", "microprint"], width: 88, alignment: "left" }],
    actionTexts: { "click-button": "Clique no botão {name}.", click: "Clique em {name}.", "highlight-text": "Certifique-se que {texto-iluminado}.", "page-view": "Insira a url {url} e acesse a página {pageName}", scroll: "Role a página até a posição {scrollY}.", generic: "Interaja com {name}." },
    microprint: { heightPt: 11, maxWidthPt: 90, preserveAspectRatio: true }, markers: { sizePt: 18 },
    images: { screen: { format: "jpeg", quality: 80, maxWidth: 1280, maxHeight: 720 }, component: { format: "png", maxWidth: 400, maxHeight: 200 } },
    theme: { fontFamily: "Aptos", bodyFontSize: 11, headingColor: "111827", tableHeaderBackground: "285589", tableHeaderColor: "FFFFFF", tableBorderColor: "111111", markerBackground: "000000", markerColor: "FFFFFF", componentBold: true, componentColor: "111827", linkColor: "0563C1" }
  }});
  const projectPath = created.project.root;
  if (!fs.statSync(path.join(projectPath, "documents")).isDirectory()) throw new Error("Pasta de documentos ausente.");
  let emptyRejected = false;
  try { await call({ command: "generateDocx", projectPath }); } catch (error) { emptyRejected = error.message.includes("Nenhum passo"); }
  if (!emptyRejected) throw new Error("Sessão vazia aceita indevidamente.");
  let openRejected = false;
  try { await call({ command: "openDocx", projectPath }); } catch (error) { openRejected = error.message.includes("Gere o DOCX"); }
  if (!openRejected) throw new Error("Abertura aceita antes da geração.");
  const svgPadding = crypto.randomBytes(700000).toString("hex");
  const largeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800"><rect width="1200" height="800" fill="#edf3fb"/><text x="80" y="130" font-family="Arial" font-size="54">Página web de teste</text><!--${svgPadding}--></svg>`;
  const screen = `data:image/svg+xml;base64,${Buffer.from(largeSvg).toString("base64")}`;
  const micro = `data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="140" height="30"><rect width="140" height="30" fill="#eeeeee"/><text x="8" y="21" font-size="16">Botão de teste</text></svg>').toString('base64')}`;
  const page = { pageName: "Página de teste", url: "https://example.test", viewportWidth: 1288, viewportHeight: 520 };
  const step = { id: "smoke-step-1", sequence: 1, groupId: "screen-001", timestamp: new Date().toISOString(), action: "click", description: "", component: { name: "Fleet List", role: "tab", selector: "#fleet" }, rect: { x: 20, y: 137, width: 137, height: 43 }, click: { x: 80, y: 157 }, page };
  const started = await call({ command: "beginEvent", projectPath, step, signature: [1, 2, 3] });
  for (const [kind, value] of [["screen", screen], ["micro", micro]]) for (let index = 0, offset = 0; offset < value.length; index++, offset += 480000) await call({ command: "eventChunk", uploadId: started.uploadId, kind, index, data: value.slice(offset, offset + 480000) });
  await call({ command: "commitEvent", uploadId: started.uploadId });
  const selectedStep = { id: "smoke-step-2", sequence: 2, groupId: "screen-001", timestamp: new Date().toISOString(), action: "highlight-text", selectedText: "o cadastro deve ser revisado", description: "", component: { name: "Aviso de revisão", role: "text", selector: "#notice" }, rect: { x: 80, y: 210, width: 420, height: 26 }, click: null, page };
  const selectedUpload = await call({ command: "beginEvent", projectPath, step: selectedStep, signature: [1, 2, 3] });
  for (const [kind, value] of [["screen", screen], ["micro", micro]]) for (let index = 0, offset = 0; offset < value.length; index++, offset += 480000) await call({ command: "eventChunk", uploadId: selectedUpload.uploadId, kind, index, data: value.slice(offset, offset + 480000) });
  await call({ command: "commitEvent", uploadId: selectedUpload.uploadId });
  const linkStep = { id: "smoke-step-3", sequence: 3, groupId: "screen-001", timestamp: new Date().toISOString(), action: "click", description: "", component: { name: "Ver detalhes", role: "link", selector: "#details", textOnlyLink: true }, rect: { x: 80, y: 260, width: 120, height: 24 }, click: { x: 120, y: 272 }, page };
  const linkUpload = await call({ command: "beginEvent", projectPath, step: linkStep, signature: [1, 2, 3] });
  for (const [kind, value] of [["screen", screen], ["micro", micro]]) for (let index = 0, offset = 0; offset < value.length; index++, offset += 480000) await call({ command: "eventChunk", uploadId: linkUpload.uploadId, kind, index, data: value.slice(offset, offset + 480000) });
  await call({ command: "commitEvent", uploadId: linkUpload.uploadId });
  const destinationPage = { ...page, pageName: "Página de destino", url: "https://example.test/destino" };
  const pageStep = { id: "smoke-step-4", sequence: 4, groupId: "screen-002", timestamp: new Date().toISOString(), action: "page-view", description: "", noMicroprint: true, forceNewGroup: true, component: { name: "Página de destino", role: "page", selector: "body" }, rect: { x: 0, y: 0, width: 1288, height: 520 }, click: null, page: destinationPage };
  const pageUpload = await call({ command: "beginEvent", projectPath, step: pageStep, signature: [4, 5, 6] });
  for (let index = 0, offset = 0; offset < screen.length; index++, offset += 480000) await call({ command: "eventChunk", uploadId: pageUpload.uploadId, kind: "screen", index, data: screen.slice(offset, offset + 480000) });
  await call({ command: "commitEvent", uploadId: pageUpload.uploadId });
  const scrollStep = { id: "smoke-step-5", sequence: 5, groupId: "screen-003", timestamp: new Date().toISOString(), action: "scroll", scrollX: 0, scrollY: 640, description: "", noMicroprint: true, forceNewGroup: true, component: { name: "Página de destino", role: "page", selector: "body" }, rect: { x: 0, y: 0, width: 1288, height: 520 }, click: null, page: { ...destinationPage, scrollY: 640 } };
  const scrollUpload = await call({ command: "beginEvent", projectPath, step: scrollStep, signature: [7, 8, 9] });
  for (let index = 0, offset = 0; offset < screen.length; index++, offset += 480000) await call({ command: "eventChunk", uploadId: scrollUpload.uploadId, kind: "screen", index, data: screen.slice(offset, offset + 480000) });
  await call({ command: "commitEvent", uploadId: scrollUpload.uploadId });
  const typingStep = { ...step, id: "smoke-step-6", sequence: 6, action: "typing", value: "Exemplo final 123", component: { name: "Nome", role: "textbox", selector: "#name" }, click: null };
  const typingUpload = await call({ command: "beginEvent", projectPath, step: typingStep, signature: [1,2,3] });
  for (const [kind, value] of [["screen", screen], ["micro", micro]]) for (let index=0, offset=0; offset<value.length; index++, offset+=480000) await call({ command:"eventChunk", uploadId:typingUpload.uploadId, kind,index,data:value.slice(offset,offset+480000) });
  await call({ command:"commitEvent",uploadId:typingUpload.uploadId });
  await call({ command: "finish", projectPath });
  fs.rmdirSync(path.join(projectPath, "documents")); // Empty test-only folder: export must recreate it.
  const generated = await call({ command: "generateDocx", projectPath, fileName: "smoke-test" });
  if (path.basename(generated.output) !== `${created.project.name}.docx`) throw new Error('O arquivo não usou o nome do projeto.');
  for (const expected of ["project.json", "session.json", "theme.css", "screenshots/screen-smoke-step-1.jpg", "screenshots/screen-smoke-step-4.jpg", "screenshots/screen-smoke-step-5.jpg", "components/step-smoke-step-1.png"]) {
    if (!fs.existsSync(path.join(projectPath, expected))) throw new Error(`Arquivo ausente: ${expected}`);
  }
  const savedSession = JSON.parse(fs.readFileSync(path.join(projectPath, "session.json"), "utf8"));
  if (savedSession.document?.state !== "ready" || savedSession.document.output !== generated.output || fs.statSync(generated.output).size < 100) throw new Error("Estado do documento não persistido.");
  if (savedSession.steps.length !== 6 || savedSession.steps[3].images.microprint !== null || savedSession.steps[4].images.microprint !== null) throw new Error("Eventos de navegação/scroll inválidos.");
  const xml = spawnSync("unzip", ["-p", generated.output, "word/document.xml"], {encoding:"utf8"}).stdout;
  if (!xml.includes("Insira o texto Exemplo final 123 no campo Nome.")) throw new Error("Texto digitado ausente no DOCX.");
  if (!xml.includes("Insira a url https://example.test/destino e acesse a página Página de destino")) throw new Error("URL ou nome da página ausente no DOCX.");
  for (const id of [1,3,6]) if (!xml.includes(`id="ChronoClick_${id}"`)) throw new Error(`Marcador editável ausente no passo ${id}.`);
  for (const id of [4,5]) if (xml.includes(`id="ChronoClick_${id}"`)) throw new Error(`Marcador indevido na página/rolagem ${id}.`);
  if (xml.includes('CHRONOMARKER_')) throw new Error('Marcadores não foram inseridos no documento.');
  const numberingXml=spawnSync('unzip',['-p',generated.output,'word/numbering.xml'],{encoding:'utf8'}).stdout;
  if(!numberingXml.includes('w:suff w:val="nothing"')) throw new Error('Numeração manteve tabulação após o número.');
  const originalFile = path.join(projectPath, savedSession.steps[0].images.screen);
  fs.renameSync(originalFile, originalFile + ".test-backup");
  let rejectedMissing = false;
  try { await call({command:"generateDocx",projectPath,fileName:"should-not-export"}); } catch(error) { rejectedMissing = error.message.includes("Print ausente"); }
  finally { fs.renameSync(originalFile + ".test-backup", originalFile); }
  if (!rejectedMissing) throw new Error("Exportação não rejeitou print ausente.");
  savedSession.config.recording = { separateScreens: false };
  savedSession.steps[2].markerRects = {"#fleet":savedSession.steps[0].rect};
  savedSession.config.groupWindowMs = 0;
  savedSession.config.documentTitle = 'Manual — {pageName}';
  await call({ command:'saveSession', projectPath, session:savedSession });
  const grouped = await call({ command:'generateDocx', projectPath, fileName:'Manual — {pageName}' });
  const groupedXml = spawnSync('unzip',['-p',grouped.output,'word/document.xml'],{encoding:'utf8'}).stdout;
  if (grouped.output !== generated.output || !groupedXml.includes('Manual — Página de teste') || groupedXml.includes('{pageName}')) throw new Error('Título interno ou nome do projeto incorreto.');
  if ((groupedXml.match(/<w:tbl>/g)||[]).length !== 3) throw new Error('Agrupamento deveria gerar 3 tabelas, usando a última tela e preservando retorno à página.');
  const firstScreen = groupedXml.slice(0,groupedXml.indexOf('<w:tbl>'));
  for (const id of [1,3]) if (!firstScreen.includes(`id="ChronoClick_${id}"`)) throw new Error('Cronocliques não foram agrupados no primeiro print.');
  savedSession.captureFailures = [{ action: 'click', error: 'A página mudou antes do print.' }];
  savedSession.config.showScreenshotCaption=false;
  savedSession.config.printDecoration={enabled:true,color:'125678',widthPt:2,type:'dash',shadow:true,shadowColor:'334455',opacity:30,blurPt:5,offsetPt:2};
  savedSession.config.showTableCaption=false;
  savedSession.config.theme.linkColor='CC2288';
  savedSession.config.linkColorSource='settings';
  await call({ command: 'saveSession', projectPath, session: savedSession });
  let partialRejected = false;
  try { await call({ command: 'generateDocx', projectPath, fileName: 'partial' }); } catch (error) { partialRejected = error.message.includes('Confirme'); }
  if (!partialRejected) throw new Error('Exportação parcial sem confirmação.');
  const partial = await call({ command: 'generateDocx', projectPath, fileName: 'partial', allowPartial: true });
  const partialXml = spawnSync('unzip', ['-p', partial.output, 'word/document.xml'], { encoding: 'utf8' }).stdout;
  if (!partialXml.includes('GRAVAÇÃO INCOMPLETA') || !partialXml.includes('A página mudou antes do print.')) throw new Error('Aviso de exportação parcial ausente.');
  if(partialXml.includes('w:pStyle w:val="ChronoCaption"')||partialXml.includes('w:pStyle w:val="ChronoTableCaption"'))throw new Error('Legendas desativadas ainda aparecem.');
  if(!partialXml.includes('w:color w:val="CC2288"'))throw new Error('CSS sobrescreveu a cor do link escolhida.');
  if(!partialXml.includes('<a:ln w="25400"')||!partialXml.includes('<a:prstDash val="dash"')||!partialXml.includes('<a:outerShdw')||!partialXml.includes('val="125678"'))throw new Error('Borda ou sombra do print ausente.');
  for (const [appearance,label] of [['button','botão'],['menu','menu']]) {
    savedSession.steps[2].component.appearance=appearance;
    savedSession.steps[2].component.textOnlyLink=false;
    await call({command:'saveSession',projectPath,session:savedSession});
    const styled=await call({command:'generateDocx',projectPath,allowPartial:true});
    const styledXml=spawnSync('unzip',['-p',styled.output,'word/document.xml'],{encoding:'utf8'}).stdout;
    if(!styledXml.includes(`Acione o ${label} Ver detalhes.`))throw new Error(`Descrição de ${appearance} incorreta.`);
  }
  console.log(JSON.stringify({ hostVersion: ping.version, projectPath, docx: generated.output }));
  child.stdin.end();
})().catch((error) => { console.error(error); process.exit(1); });
