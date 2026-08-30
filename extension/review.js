let session;
const $ = (id) => document.getElementById(id);
const colorIn = (value) => `#${String(value || "000000").replace("#", "")}`;
const colorOut = (value) => value.replace("#", "").toUpperCase();

function automaticDescription(step) {
  const key = ChronoPolicy.actionKey(step);
  const template = session.config.actionTexts?.[key] || session.config.actionTexts?.generic || "Interaja com {name}.";
  return template.replaceAll("{name}", step.component?.name || "componente").replaceAll("{value}", ChronoPolicy.actionValue(step)).replaceAll("{url}", step.page?.url || "").replaceAll("{pageName}", step.page?.pageName || "página").replaceAll("{scrollX}", step.scrollX ?? step.scroll?.x ?? 0).replaceAll("{scrollY}", step.scrollY ?? step.scroll?.y ?? 0).replaceAll("{texto-iluminado}", step.selectedText || step.component?.name || "texto").replaceAll("{highlighted-text}", step.selectedText || step.component?.name || "texto");
}

function showColorPreviews() {
  document.querySelectorAll('input[type="color"]').forEach(input => {
    let preview = input.nextElementSibling;
    if (!preview?.classList.contains('color-preview')) {
      preview = document.createElement('span'); preview.className = 'color-preview';
      const swatch=document.createElement('span'); swatch.className='color-swatch'; swatch.setAttribute('aria-hidden','true');
      preview.append(swatch,document.createElement('code')); input.after(preview);
    }
    const update=()=>{preview.firstElementChild.style.backgroundColor=input.value;preview.lastElementChild.textContent=input.value.toUpperCase();};
    input.oninput=update; update();
  });
}

function renderColumns() {
  $("columns").innerHTML = "";
  session.config.columns.forEach((column, index) => {
    const row = document.createElement("div");
    row.className = "column";
    row.innerHTML = `<input aria-label="Título" value="${column.title || ""}"><input aria-label="Fontes" value="${(column.source || []).join(", ")}"><input aria-label="Largura" type="number" value="${column.width || 20}"><select aria-label="Alinhamento"><option value="left">Esquerda</option><option value="center">Centralizado</option><option value="right">Direita</option><option value="justify">Justificado</option></select><button>Remover</button>`;
    const inputs = row.querySelectorAll("input");
    inputs[0].oninput = () => column.title = inputs[0].value;
    inputs[1].oninput = () => column.source = inputs[1].value.split(",").map((v) => v.trim()).filter(Boolean);
    inputs[2].oninput = () => column.width = Number(inputs[2].value);
    const alignment = row.querySelector("select"); alignment.value = column.alignment || "left"; alignment.onchange = () => column.alignment = alignment.value;
    row.querySelector("button").onclick = () => { session.config.columns.splice(index, 1); renderColumns(); };
    $("columns").append(row);
  });
}

async function renderSteps() {
  $("steps").innerHTML = "";
  if (!session.steps.length) $("steps").innerHTML = '<p class="muted">Nenhum evento capturado ainda.</p>';
  session.steps.forEach((step, index) => {
    const row = document.createElement("div");
    row.className = "step";
    row.innerHTML = `<strong>${step.sequence}</strong><div class="micro-preview"></div><div><label class="field">Nome do componente<input class="name"></label><label class="field">Descrição<textarea placeholder="Escreva a descrição posteriormente ou deixe em branco"></textarea></label><small class="muted">${step.action} · ${step.page.pageName}</small></div><button>Excluir</button>`;
    const preview = row.querySelector(".micro-preview");
    if (step.component?.role === "link" && step.component?.textOnlyLink) {
      preview.textContent = step.component.name; preview.classList.add("text-link");
    } else {
      if (step.images?.microprint) {
        const image = document.createElement("img"); image.alt = "Microprint do componente"; preview.append(image);
        chrome.runtime.sendMessage({ type: "READ_IMAGE", relativePath: step.images.microprint }).then((response) => { if (response?.dataUrl) image.src = response.dataUrl; });
      } else preview.textContent = step.action === "scroll" ? "Rolagem" : "Página";
    }
    row.querySelector(".name").value = step.component.name;
    row.querySelector("textarea").value = step.description || automaticDescription(step);
    row.querySelector(".name").oninput = (e) => step.component.name = e.target.value;
    row.querySelector("textarea").oninput = (e) => step.description = e.target.value;
    row.querySelector("button").onclick = () => {
      session.steps.splice(index, 1);
      session.steps.forEach((item, i) => item.sequence = i + 1);
      session.groups.forEach((group) => group.stepIds = group.stepIds.filter((id) => session.steps.some((step) => step.id === id)));
      renderSteps();
    };
    $("steps").append(row);
  });
}

function readForm() {
  const c = session.config;
  c.recording ||= {};
  document.querySelectorAll("[data-recording]").forEach(input => {
    c.recording[input.dataset.recording] = input.hasAttribute("data-boolean") ? input.value === "true" : input.type === "number" ? Math.max(Number(input.min || 1), Number(input.value)) : input.value;
  });
  c.documentTitle = $("documentTitle").value;
  c.sectionTitlePattern = $("sectionTitlePattern").value;
  c.screenshotCaptionPattern = $("screenshotCaptionPattern").value;
  c.tableCaptionPattern = $("tableCaptionPattern").value;
  c.showScreenshotCaption = $("showScreenshotCaption").checked;
  c.showTableCaption = $("showTableCaption").checked;
  c.linkColorSource = $("linkColorSource").value;
  c.groupWindowMs = Number($("groupWindow").value) * 1000;
  c.projectRoot = $("projectRoot").value.trim();
  const t = c.theme;
  t.fontFamily = $("fontFamily").value;
  t.bodyFontSize = Number($("bodyFontSize").value);
  t.headingColor = colorOut($("headingColor").value);
  t.tableHeaderBackground = colorOut($("tableHeaderBackground").value);
  t.tableHeaderColor = colorOut($("tableHeaderColor").value);
  t.markerBackground = colorOut($("markerBackground").value);
  t.componentColor = colorOut($("componentColor").value);
  t.linkColor = colorOut($("linkColor").value);
  t.componentBold = $("componentBold").value === "true";
  t.titleAfter = Number($("titleAfter").value);
  t.screenAfter = Number($("screenAfter").value);
  t.tableAfter = Number($("tableAfter").value);
  c.microprint ||= {}; c.markers ||= {}; c.actionTexts ||= {};
  c.microprint.heightPt = Number($("microprintHeightPt").value);
  c.microprint.maxWidthPt = Number($("microprintMaxWidthPt").value);
  c.microprint.preserveAspectRatio = $("microprintPreserveAspect").value === "true";
  c.markers.sizePt = Number($("markerSizePt").value);
  document.querySelectorAll("[data-action-text]").forEach((input) => c.actionTexts[input.dataset.actionText] = input.value);
  c.images ||= {}; c.images.screen ||= {}; c.images.component ||= {};
  c.images.screen.format = $("screenFormat").value;
  c.images.screen.quality = Number($("screenQuality").value);
  c.images.screen.maxWidth = Number($("screenMaxWidth").value);
  c.images.screen.maxHeight = Number($("screenMaxHeight").value);
  c.images.component.format = $("componentFormat").value;
  c.images.component.padding = Number($("componentPadding").value);
  c.images.component.maxWidth = Number($("componentMaxWidth").value);
  c.images.component.maxHeight = Number($("componentMaxHeight").value);
}

async function load() {
  const data = await chrome.runtime.sendMessage({ type: "GET_SESSION" });
  if (!data.session) { $("status").textContent = "Inicie uma gravação antes de revisar."; return; }
  session = data.session;
  $("documentLink").hidden = session.document?.state !== "ready";
  const c = session.config, t = c.theme;
  document.querySelectorAll("[data-recording]").forEach(input => input.value = String(c.recording?.[input.dataset.recording] ?? ""));
  $("captureWarnings").textContent = (session.captureFailures || []).map(item => `${item.action}: ${item.error}`).join("\n");
  $("documentTitle").value = c.documentTitle;
  $("sectionTitlePattern").value = c.sectionTitlePattern;
  $("screenshotCaptionPattern").value = c.screenshotCaptionPattern;
  $("tableCaptionPattern").value = c.tableCaptionPattern;
  $("showScreenshotCaption").checked = c.showScreenshotCaption !== false;
  $("showTableCaption").checked = c.showTableCaption !== false;
  $("linkColorSource").value = c.linkColorSource || "settings";
  $("groupWindow").value = (c.groupWindowMs ?? 0) / 1000;
  $("projectRoot").value = c.projectRoot || "${HOME}/sistemas/cronoPrint";
  $("fontFamily").value = t.fontFamily;
  $("bodyFontSize").value = t.bodyFontSize;
  $("headingColor").value = colorIn(t.headingColor);
  $("tableHeaderBackground").value = colorIn(t.tableHeaderBackground);
  $("tableHeaderColor").value = colorIn(t.tableHeaderColor);
  $("markerBackground").value = colorIn(t.markerBackground);
  $("componentColor").value = colorIn(t.componentColor);
  $("linkColor").value = colorIn(t.linkColor || "0563C1");
  $("componentBold").value = String(t.componentBold);
  $("titleAfter").value = t.titleAfter;
  $("screenAfter").value = t.screenAfter;
  $("tableAfter").value = t.tableAfter;
  $("microprintHeightPt").value = c.microprint?.heightPt || t.bodyFontSize || 11;
  $("microprintMaxWidthPt").value = c.microprint?.maxWidthPt || 90;
  $("microprintPreserveAspect").value = String(c.microprint?.preserveAspectRatio !== false);
  $("markerSizePt").value = c.markers?.sizePt || 18;
  document.querySelectorAll("[data-action-text]").forEach((input) => input.value = c.actionTexts?.[input.dataset.actionText] || "");
  const si = c.images?.screen || {}, ci = c.images?.component || {};
  $("screenFormat").value = si.format || "jpeg"; $("screenQuality").value = si.quality || 82;
  $("screenMaxWidth").value = si.maxWidth || 1920; $("screenMaxHeight").value = si.maxHeight || 1080;
  $("componentFormat").value = ci.format || "png"; $("componentPadding").value = ci.padding ?? 18;
  $("componentMaxWidth").value = ci.maxWidth || 600; $("componentMaxHeight").value = ci.maxHeight || 300;
  showColorPreviews(); renderColumns(); renderSteps();
}

$("addColumn").onclick = () => { session.config.columns.push({ title: "NOVA COLUNA", source: ["editable"], width: 20, alignment: "left" }); renderColumns(); };
$("save").onclick = async () => {
  try {
    readForm(); const saved = await chrome.runtime.sendMessage({ type: "SAVE_SESSION", session });
    if (!saved?.ok) throw new Error(saved?.error || "Não foi possível salvar a sessão.");
    const configured = await chrome.runtime.sendMessage({ type: "SAVE_CONFIG", config: session.config });
    if (!configured?.ok) throw new Error(configured?.error || "Não foi possível salvar a configuração.");
    $("status").textContent = "Alterações salvas.";
    const currentTab = await chrome.tabs.getCurrent();
    if (currentTab?.id != null) await chrome.tabs.remove(currentTab.id);
    else window.close();
  } catch (error) { $("status").textContent = `Erro: ${error.message}`; }
};
$("generate").onclick = async () => {
  const allowPartial = !!session?.captureFailures?.length;
  if (allowPartial && !window.confirm(`${session.captureFailures.length} captura(s) falharam. Gerar somente os ${session.steps.length} passos salvos, com um aviso no documento?`)) return;
  $("documentLink").hidden = true;
  const button = $("generate"); button.disabled = true; $("status").textContent = "Gerando DOCX...";
  try {
    readForm(); const saved = await chrome.runtime.sendMessage({ type: "SAVE_SESSION", session });
    if (!saved?.ok) throw new Error(saved?.error || "Não foi possível salvar a sessão.");
    const response = await chrome.runtime.sendMessage({ type: "GENERATE_DOCX", fileName: session.config.documentTitle, allowPartial });
    if (!response?.ok) throw new Error(response?.error || "Falha ao gerar DOCX.");
    $("status").textContent = `DOCX criado em ${response.output}`;
    session.document = response.document;
    $("documentLink").hidden = false;
  } catch (error) { $("status").textContent = `Erro: ${error.message}`; }
  finally { button.disabled = false; }
};
$("documentLink").onclick = async event => {
  event.preventDefault();
  try {
    const result = await chrome.runtime.sendMessage({ type: "OPEN_DOCX" });
    if (!result?.ok) throw new Error(result?.error || "Não foi possível abrir o DOCX.");
  } catch (error) { $("status").textContent = `Erro: ${error.message}`; }
};
load();
