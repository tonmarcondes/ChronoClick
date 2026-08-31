#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const JSZip = require("jszip");
const placeMarkers = require("./marker-layout.cjs");
const { latestPageGroups } = require("./page-groups.cjs");
require("../extension/recording-policy.js");
const {
  AlignmentType, BorderStyle, Document, Footer, Header, ImageRun, PageNumber,
  Packer, Paragraph, ShadingType, Table, TableCell, TableRow, TextRun,
  VerticalAlign, WidthType
} = require("docx");

const cliArgs = process.argv.slice(2);
const themeIndex = cliArgs.indexOf("--theme");
let cssThemePath = null;
if (themeIndex >= 0) {
  cssThemePath = cliArgs[themeIndex + 1];
  cliArgs.splice(themeIndex, 2);
}
const inputPath = path.resolve(cliArgs[0] || "");
if (!cliArgs[0] || !fs.existsSync(inputPath)) {
  console.error("Uso: node cli/generate-docx.cjs sessao.json [saida.docx] [--theme tema.css]");
  process.exit(1);
}
const outputPath = path.resolve(cliArgs[1] || inputPath.replace(/\.json$/i, "") + ".docx");
const session = JSON.parse(fs.readFileSync(inputPath, "utf8"));
const config = session.config || {};
if (config.recording?.skipInitialOriginPages !== false) {
  const retained=[];
  for (const step of session.steps || []) if (!ChronoPolicy.skipPageView({config,steps:retained},step)) retained.push(step);
  session.steps=retained;
  ChronoPolicy.normalize(session);
}
const documentTitle = ChronoPolicy.documentTitle(session);
// Rebuild the presentation only; original captures and steps stay untouched.
if (config.recording?.separateScreens === false) session.groups = latestPageGroups(session);
const theme = config.theme || {};
const configuredLinkColor = theme.linkColor || "0563C1";
if (cssThemePath) applyCssTheme(theme, path.resolve(cssThemePath));
if (config.linkColorSource !== "css") theme.linkColor = configuredLinkColor;
const font = theme.fontFamily || "Aptos";
const markerPatches = [];

function applyCssTheme(target, cssPath) {
  const css = fs.readFileSync(cssPath, "utf8");
  const values = Object.fromEntries([...css.matchAll(/--([a-z0-9-]+)\s*:\s*([^;]+);/gi)].map((match) => [match[1], match[2].trim()]));
  const text = (key, fallback) => values[key] == null ? fallback : values[key].replace(/^['"]|['"]$/g, "");
  const number = (key, fallback) => values[key] == null ? fallback : Number.parseFloat(values[key]);
  const color = (key, fallback) => values[key] == null ? fallback : values[key].replace("#", "").toUpperCase();
  target.fontFamily = text("chrono-font-family", target.fontFamily);
  target.bodyFontSize = number("chrono-body-font-size", target.bodyFontSize);
  target.headingColor = color("chrono-heading-color", target.headingColor);
  target.tableHeaderBackground = color("chrono-table-header-background", target.tableHeaderBackground);
  target.tableHeaderColor = color("chrono-table-header-color", target.tableHeaderColor);
  target.tableBorderColor = color("chrono-table-border-color", target.tableBorderColor);
  target.markerBackground = color("chrono-marker-background", target.markerBackground);
  target.markerColor = color("chrono-marker-color", target.markerColor);
  target.markerSizePt = number("chrono-marker-size", target.markerSizePt);
  target.componentBold = text("chrono-component-bold", String(target.componentBold)) === "true";
  target.componentColor = color("chrono-component-color", target.componentColor);
  target.linkColor = color("chrono-link-color", target.linkColor);
  target.microprintHeightPt = number("chrono-microprint-height", target.microprintHeightPt);
  target.microprintMaxWidthPt = number("chrono-microprint-max-width", target.microprintMaxWidthPt);
  target.titleBefore = number("chrono-title-before", target.titleBefore);
  target.titleAfter = number("chrono-title-after", target.titleAfter);
  target.screenBefore = number("chrono-screen-before", target.screenBefore);
  target.screenAfter = number("chrono-screen-after", target.screenAfter);
  target.tableBefore = number("chrono-table-before", target.tableBefore);
  target.tableAfter = number("chrono-table-after", target.tableAfter);
}

function dataBuffer(value) {
  if (!value) return null;
  if (value.startsWith("data:")) return Buffer.from(value.split(",")[1], "base64");
  const resolved = path.resolve(path.dirname(inputPath), value);
  return fs.readFileSync(resolved);
}

function format(pattern, vars) {
  return String(pattern || "").replace(/\{([^}]+)\}/g, (_, key) => vars[key] ?? "");
}

async function imageSize(buffer, maxWidth, maxHeight) {
  const meta = await sharp(buffer).metadata();
  const scale = Math.min(maxWidth / meta.width, maxHeight / meta.height, 1);
  return { width: Math.max(1, Math.round(meta.width * scale)), height: Math.max(1, Math.round(meta.height * scale)) };
}

async function imageSizeByHeight(buffer, heightPt, maxWidthPt, preserveAspectRatio = true) {
  const meta = await sharp(buffer).metadata();
  const height = Math.max(1, Math.round(heightPt * 96 / 72));
  const maxWidth = Math.max(1, Math.round(maxWidthPt * 96 / 72));
  const width = preserveAspectRatio ? Math.max(1, Math.min(maxWidth, Math.round(meta.width * height / meta.height))) : maxWidth;
  return { width, height };
}

function alignmentFor(value) {
  return ({ left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED })[value] || AlignmentType.LEFT;
}

function numberingReferenceFor(value) {
  return value === "right" ? "chrono-steps-right" : value === "center" ? "chrono-steps-center" : "chrono-steps-left";
}

function stepColumnWidth() {
  const columns = config.columns?.length ? config.columns : [{ source: ["sequence"], width: 12 }, { source: ["auto-description"], width: 88 }];
  const total = columns.reduce((sum, column) => sum + Number(column.width || 1), 0);
  const stepColumn = columns.find((column) => (Array.isArray(column.source) ? column.source : [column.source]).includes("sequence"));
  return Math.round(9360 * Number(stepColumn?.width || 12) / total);
}

function imageType(buffer) {
  return buffer?.[0] === 0x89 && buffer?.[1] === 0x50 ? "png" : "jpg";
}

function actionTemplateKey(step) {
  return ChronoPolicy.actionKey(step);
}

function autoDescription(step) {
  const defaults = {
    "click-menu": "Acione o menu {value}.", "click-styled-button": "Acione o botão {value}.",
    "click-button": "Clique no botão {name}.", "click-link": "Clique no link {name}.", "click-field": "Selecione o campo {name}.",
    click: "Clique em {name}.", "double-click": "Dê um duplo clique em {name}.", "right-click": "Acione o botão direito do mouse em {name}.",
    typing: "Insira o texto {value} no campo {name}.", select: "Selecione uma opção no campo {name}.", toggle: "Altere a opção {name}.",
    change: "Altere o campo {name}.", observation: "Observe {name}.", "highlight-text": "Certifique-se que {texto-iluminado}.",
    "page-view": "Insira a url {url} e acesse a página {pageName}", scroll: "Role a página até a posição {scrollY}.", generic: "Interaja com {name}."
  };
  const templates = { ...defaults, ...(config.actionTexts || {}) };
  return format(templates[actionTemplateKey(step)] || templates.generic, { name: step.component?.name || "componente", value: ChronoPolicy.actionValue(step), url: step.page?.url || "", pageName: step.page?.pageName || "página", scrollX: step.scrollX ?? step.scroll?.x ?? 0, scrollY: step.scrollY ?? step.scroll?.y ?? 0, "texto-iluminado": step.selectedText || step.component?.name || "texto", "highlighted-text": step.selectedText || step.component?.name || "texto" });
}

function textSource(source, step) {
  if (source === "sequence") return String(step.sequence);
  if (source === "component-name") return step.component?.name || "Componente sem nome";
  if (source === "action") return step.action || "";
  if (source === "editable") return step.description || "";
  if (source === "auto-description") return step.description || autoDescription(step);
  if (source === "url") return step.page?.url || "";
  if (source === "page-title") return step.page?.pageName || "";
  if (source === "timestamp") return step.timestamp ? new Date(step.timestamp).toLocaleString("pt-BR") : "";
  if (source === "value") return step.value || "";
  if (source.startsWith("fixed-text:")) return source.slice(11);
  return "";
}

async function cellContent(column, step) {
  const sources = Array.isArray(column.source) ? column.source : [column.source];
  const alignment = alignmentFor(column.alignment);
  if (sources.includes("sequence")) {
    return [new Paragraph({ style: "ChronoStepNumber", alignment: AlignmentType.LEFT, numbering: { reference: numberingReferenceFor(column.alignment), level: 0 }, children: [] })];
  }
  const runs = [];
  for (const source of sources) {
    if (source === "microprint") {
      if (step.component?.role === "link" && step.component?.textOnlyLink) continue;
      const buffer = dataBuffer(step.images?.microprint);
      if (buffer) {
        const heightPt = Number(theme.microprintHeightPt || config.microprint?.heightPt || theme.bodyFontSize || 11);
        const maxWidthPt = Number(theme.microprintMaxWidthPt || config.microprint?.maxWidthPt || 90);
        const size = await imageSizeByHeight(buffer, heightPt, maxWidthPt, config.microprint?.preserveAspectRatio !== false);
        if (runs.length) runs.push(new TextRun("  "));
        runs.push(new ImageRun({ data: buffer, transformation: size, type: imageType(buffer), altText: { title: `Microprint do passo ${step.sequence}`, description: step.component?.name || "Componente", name: `step-${step.sequence}-microprint` } }));
      }
      continue;
    }
    const value = textSource(source, step);
    if (source === "component-name") {
      if (runs.length) runs.push(new TextRun(" "));
      runs.push(new TextRun({ text: value, style: "ChronoComponentName", ...(step.component?.role === "link" ? {color:theme.linkColor} : {}) }));
    } else if (source === "editable") {
      if (value) { if (runs.length) runs.push(new TextRun(" ")); runs.push(new TextRun(value)); }
    } else if (source === "auto-description" && value && step.component?.role === "link" && step.component?.textOnlyLink) {
      const name = step.component?.name || "link", position = value.indexOf(name);
      if (runs.length) runs.push(new TextRun(" "));
      if (position < 0) runs.push(new TextRun({ text: value, color: theme.linkColor || "0563C1" }));
      else {
        if (position) runs.push(new TextRun(value.slice(0, position)));
        runs.push(new TextRun({ text: name, color: theme.linkColor || "0563C1", underline: {} }));
        if (position + name.length < value.length) runs.push(new TextRun(value.slice(position + name.length)));
      }
    } else if (value) {
      if (runs.length) runs.push(new TextRun(" "));
      runs.push(new TextRun({text:value,...(source === "url" ? {color:theme.linkColor} : {})}));
    }
  }
  return [new Paragraph({ style: "ChronoStepDescription", alignment, children: runs })];
}

async function buildTable(steps) {
  const columns = config.columns?.length ? config.columns : [
    { title: "STEP", source: ["sequence"], width: 12, alignment: "center" },
    { title: "DESCRIÇÃO", source: ["auto-description", "microprint"], width: 88, alignment: "left" }
  ];
  const total = columns.reduce((sum, col) => sum + Number(col.width || 1), 0);
  const widths = columns.map((col) => Math.round(9360 * Number(col.width || 1) / total));
  widths[widths.length - 1] += 9360 - widths.reduce((a, b) => a + b, 0);
  const header = new TableRow({
    tableHeader: true,
    children: columns.map((column, i) => new TableCell({
      margins: { left: 120, right: 120, top: 100, bottom: 100 },
      width: { size: widths[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
      children: [new Paragraph({ style: "ChronoTableHeader", alignment: alignmentFor(column.alignment), children: [new TextRun(column.title || "")] })]
    }))
  });
  const rows = [header];
  for (const step of steps) {
    const cells = [];
    for (let i = 0; i < columns.length; i++) {
      cells.push(new TableCell({
        margins: { left: 120, right: 120, top: 100, bottom: 100 },
        width: { size: widths[i], type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER,
        children: await cellContent(columns[i], step)
      }));
    }
    rows.push(new TableRow({ children: cells }));
  }
  return new Table({
    layout: "fixed",
    style: "ChronoStepsTable",
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows
  });
}

function paragraphStyle(id, name, options = {}) {
  return { id, name, basedOn: "Normal", next: "Normal", quickFormat: true, ...options };
}

function xmlEscape(value) { return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

function markerXml(marker) {
  return marker.items.map((item, index) => `<w:r><w:pict><v:oval id="ChronoClick_${item.sequence}" o:spid="_x0000_s${1025 + item.sequence}" style="position:absolute;margin-left:${item.leftPt.toFixed(2)}pt;margin-top:${item.topPt.toFixed(2)}pt;width:${marker.sizePt}pt;height:${marker.sizePt}pt;z-index:${251659264 + index};mso-position-horizontal-relative:column;mso-position-vertical-relative:paragraph" fillcolor="#${theme.markerBackground || "000000"}" strokecolor="#${theme.markerColor || "FFFFFF"}" strokeweight="1pt"><v:textbox inset="0,0,0,0"><w:txbxContent><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="${theme.markerColor || "FFFFFF"}"/><w:sz w:val="${Math.round(marker.sizePt)}"/></w:rPr><w:t>${xmlEscape(item.sequence)}</w:t></w:r></w:p></w:txbxContent></v:textbox></v:oval></w:pict></w:r>`).join("");
}

async function patchPackage(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const file = zip.file("word/styles.xml");
  let xml = await file.async("string");
  if (!xml.includes('w:styleId="ChronoStepsTable"')) {
    const border = theme.tableBorderColor || "111111";
    const fill = theme.tableHeaderBackground || "285589";
    const text = theme.tableHeaderColor || "FFFFFF";
    const style = `<w:style w:type="table" w:styleId="ChronoStepsTable"><w:name w:val="ChronoClick - Tabela de Passos"/><w:basedOn w:val="TableNormal"/><w:uiPriority w:val="40"/><w:qFormat/><w:tblPr><w:tblInd w:w="120" w:type="dxa"/><w:tblCellMar><w:top w:w="100" w:type="dxa"/><w:start w:w="120" w:type="dxa"/><w:bottom w:w="100" w:type="dxa"/><w:end w:w="120" w:type="dxa"/></w:tblCellMar><w:tblBorders><w:top w:val="single" w:sz="8" w:color="${border}"/><w:left w:val="single" w:sz="8" w:color="${border}"/><w:bottom w:val="single" w:sz="8" w:color="${border}"/><w:right w:val="single" w:sz="8" w:color="${border}"/><w:insideH w:val="single" w:sz="6" w:color="${border}"/><w:insideV w:val="single" w:sz="6" w:color="${border}"/></w:tblBorders></w:tblPr><w:tblStylePr w:type="firstRow"><w:rPr><w:b/><w:color w:val="${text}"/></w:rPr><w:tcPr><w:shd w:val="clear" w:color="auto" w:fill="${fill}"/></w:tcPr></w:tblStylePr></w:style>`;
    xml = xml.replace("</w:styles>", style + "</w:styles>");
    zip.file("word/styles.xml", xml);
  }
  const documentFile = zip.file("word/document.xml");
  let documentXml = await documentFile.async("string");
  for (const marker of markerPatches) {
    const token = marker.token;
    const tokenPosition = documentXml.indexOf(token);
    if (tokenPosition >= 0) {
      const runStart = Math.max(documentXml.lastIndexOf("<w:r>", tokenPosition), documentXml.lastIndexOf("<w:r ", tokenPosition));
      const runEnd = documentXml.indexOf("</w:r>", tokenPosition);
      if (runStart >= 0 && runEnd >= 0) documentXml = documentXml.slice(0, runStart) + markerXml(marker) + documentXml.slice(runEnd + 6);
    }
  }
  zip.file("word/document.xml", documentXml);
  return zip.generateAsync({ type: "nodebuffer" });
}

(async () => {
  const children = [];
  children.push(new Paragraph({ style: "ChronoDocumentTitle", children: [new TextRun(documentTitle)] }));
  if (session.captureFailures?.length) {
    children.push(new Paragraph({ children: [new TextRun({ text: `GRAVAÇÃO INCOMPLETA: ${session.captureFailures.length} captura(s) falharam. Este documento contém somente os ${session.steps.length} passos salvos.`, bold: true, color: "B45309" })] }));
    for (const failure of session.captureFailures) children.push(new Paragraph({ children: [new TextRun({ text: `${failure.action || "Ação"}: ${failure.error || "Falha na captura."}`, color: "B45309" })] }));
  }

  let sectionNumber = 0;
  for (const group of session.groups || []) {
    const steps = group.stepIds?.map((id) => session.steps.find((step) => step.id === id)).filter(Boolean) || session.steps.filter((step) => step.groupId === group.id);
    if (!steps.length) continue;
    sectionNumber++;
    const vars = { sectionNumber, screenNumber: 1, tableNumber: 1, pageName: group.page?.pageName || steps[0].page?.pageName || "Página" };
    children.push(new Paragraph({ style: "ChronoSectionTitle", children: [new TextRun(format(config.sectionTitlePattern || "{sectionNumber}. {pageName}", vars))] }));
    const screenshot = dataBuffer(group.screenshot || steps[0]?.images?.screen);
    if (screenshot) {
      const size = await imageSize(screenshot, 620, 470);
      const token = `CHRONOMARKER_${sectionNumber}_${Date.now()}`;
      const page = group.page || steps[0].page;
      const sizePt = Number(theme.markerSizePt || config.markers?.sizePt || 18), imageWidthPt = size.width * .75, imageHeightPt = size.height * .75, leftBasePt = (468 - imageWidthPt) / 2;
      const unavailableMarkers = [];
      const markerSteps = steps.flatMap(step => {
        if (!["click", "double-click", "right-click", "observation", "typing", "select", "toggle", "change"].includes(step.action) || !step.component?.role || step.component.role === "page") return [];
        const isEarlierCapture = group.latestStepId && group.latestStepId !== step.id;
        const r = isEarlierCapture ? group.markerRects[step.component.selector] : step.rect;
        if (isEarlierCapture && !r) { unavailableMarkers.push(step.sequence); return []; }
        const visible = r && r.width > 0 && r.height > 0 && r.x < page.viewportWidth && r.y < page.viewportHeight && r.x+r.width > 0 && r.y+r.height > 0;
        const point = (!isEarlierCapture && step.click) || (visible ? { x: (Math.max(0,r.x)+Math.min(page.viewportWidth,r.x+r.width))/2, y: (Math.max(0,r.y)+Math.min(page.viewportHeight,r.y+r.height))/2 } : null);
        if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || point.x < 0 || point.y < 0 || point.x > page.viewportWidth || point.y > page.viewportHeight) return [];
        return [{ sequence: step.sequence, leftPt: leftBasePt + (point.x / page.viewportWidth) * imageWidthPt - sizePt / 2, topPt: (point.y / page.viewportHeight) * imageHeightPt - sizePt / 2 }];
      });
      markerPatches.push({ token, sizePt, items: placeMarkers(markerSteps, {left:leftBasePt,width:imageWidthPt,height:imageHeightPt,size:sizePt}) });
      children.push(new Paragraph({ style: "ChronoScreen", children: [new ImageRun({ data: screenshot, transformation: size, type: imageType(screenshot), altText: { title: `Tela ${sectionNumber}`, description: `Tela ${vars.pageName} com marcadores cronológicos editáveis`, name: `screen-${sectionNumber}` } }), new TextRun({ text: token, color: "FFFFFF", size: 2 })] }));
      if (config.showScreenshotCaption !== false) children.push(new Paragraph({ style: "ChronoCaption", children: [new TextRun(format(config.screenshotCaptionPattern || "Figura {sectionNumber}.{screenNumber} — {pageName}", vars))] }));
      if (unavailableMarkers.length) children.push(new Paragraph({children:[new TextRun({text:`Passos ${unavailableMarkers.join(", ")}: posição não confirmada na última tela. Consulte a tabela e os microprints.`,italics:true,size:18,color:"667085"})]}));
    }
    if (config.showTableCaption !== false) children.push(new Paragraph({ style: "ChronoTableCaption", children: [new TextRun(format(config.tableCaptionPattern || "Tabela {sectionNumber}.{tableNumber} — Passos de {pageName}", vars))] }));
    children.push(await buildTable(steps));
    children.push(new Paragraph({ style: "ChronoAfterTable" }));
  }

  const stepWidth = stepColumnWidth();
  const numberingLevel = (alignment, left) => ({ level: 0, format: "decimal", text: "%1", suffix: "nothing", alignment, style: { paragraph: { indent: { left, hanging: 0 }, spacing: { before: 40, after: 40 } }, run: { bold: true, size: 22, font } } });
  const doc = new Document({
    creator: "ChronoClick Recorder",
    title: documentTitle,
    description: "Procedimento gerado a partir de uma sessão ChronoClick.",
    numbering: { config: [
      { reference: "chrono-steps-left", levels: [numberingLevel(AlignmentType.LEFT, 0)] },
      { reference: "chrono-steps-center", levels: [numberingLevel(AlignmentType.CENTER, Math.max(0, Math.round(stepWidth / 2) - 120))] },
      { reference: "chrono-steps-right", levels: [numberingLevel(AlignmentType.RIGHT, Math.max(0, stepWidth - 240))] }
    ] },
    styles: {
      default: { document: { run: { font, size: (theme.bodyFontSize || 11) * 2, color: "202124" }, paragraph: { spacing: { after: 120, line: 276 } } } },
      paragraphStyles: [
        paragraphStyle("ChronoDocumentTitle", "ChronoClick - Título do Documento", { run: { font, size: 36, bold: true, color: theme.headingColor || "111827" }, paragraph: { spacing: { before: (theme.titleBefore || 0) * 20, after: (theme.titleAfter || 18) * 20 }, keepNext: true } }),
        paragraphStyle("ChronoSectionTitle", "ChronoClick - Título da Seção", { run: { font, size: 30, bold: true, color: theme.headingColor || "111827" }, paragraph: { spacing: { before: 300, after: 160 }, keepNext: true } }),
        paragraphStyle("ChronoScreen", "ChronoClick - Print da Tela", { paragraph: { alignment: AlignmentType.CENTER, spacing: { before: (theme.screenBefore || 6) * 20, after: 60 }, keepNext: true } }),
        paragraphStyle("ChronoCaption", "ChronoClick - Legenda do Print", { run: { font, size: 18, color: "5B6472", italics: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { after: (theme.screenAfter || 12) * 20 }, keepNext: true } }),
        paragraphStyle("ChronoTableCaption", "ChronoClick - Legenda da Tabela", { run: { font, size: 19, bold: true, color: theme.headingColor || "111827" }, paragraph: { spacing: { before: (theme.tableBefore || 8) * 20, after: 80 }, keepNext: true } }),
        paragraphStyle("ChronoTableHeader", "ChronoClick - Cabeçalho da Tabela", { run: { font, size: 20, bold: true, color: theme.tableHeaderColor || "FFFFFF" }, paragraph: { spacing: { before: 20, after: 20 }, alignment: AlignmentType.LEFT } }),
        paragraphStyle("ChronoStepNumber", "ChronoClick - Número do Passo", { run: { font, size: 22, bold: true }, paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 40, after: 40 } } }),
        paragraphStyle("ChronoStepDescription", "ChronoClick - Descrição do Passo", { run: { font, size: (theme.bodyFontSize || 11) * 2 }, paragraph: { spacing: { before: 40, after: 40, line: 276 } } }),
        paragraphStyle("ChronoMicroprint", "ChronoClick - Microprint", { paragraph: { spacing: { before: 40, after: 40 } } }),
        paragraphStyle("ChronoAfterTable", "ChronoClick - Espaço após Tabela", { paragraph: { spacing: { after: (theme.tableAfter || 18) * 20 } } })
      ],
      characterStyles: [
        { id: "ChronoComponentName", name: "ChronoClick - Nome do Componente", basedOn: "DefaultParagraphFont", quickFormat: true, run: { font, bold: theme.componentBold !== false, color: theme.componentColor || "111827" } }
      ]
    },
    sections: [{
      properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
      headers: { default: new Header({ children: [new Paragraph({ children: [new TextRun({ text: "ChronoClick", color: "7A8493", size: 17 })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: "Página ", color: "7A8493", size: 17 }), new TextRun({ children: [PageNumber.CURRENT], color: "7A8493", size: 17 })] })] }) },
      children
    }]
  });
  let buffer = await Packer.toBuffer(doc);
  buffer = await patchPackage(buffer);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buffer);
  console.log(`DOCX criado: ${outputPath}`);
})().catch((error) => { console.error(error); process.exit(1); });
