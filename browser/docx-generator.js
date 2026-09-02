import JSZip from "jszip";
import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  ImageRun,
  PageBreak,
  PageNumber,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableOfContents,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import placeMarkers from "../cli/marker-layout.cjs";
import { decoratePrints } from "../cli/print-decoration.cjs";

const { ChronoDefaults, ChronoPolicy } = globalThis;

function bytesFromDataUrl(value) {
  if (!value) return null;
  const encoded = value.includes(",") ? value.slice(value.indexOf(",") + 1) : value;
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function dimensions(bytes) {
  if (bytes?.[0] === 0x89 && bytes?.[1] === 0x50) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (bytes?.[0] === 0xff && bytes?.[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < bytes.length) {
      if (bytes[offset] !== 0xff) {
        offset++;
        continue;
      }
      const marker = bytes[offset + 1];
      const length = (bytes[offset + 2] << 8) + bytes[offset + 3];
      if (marker >= 0xc0 && marker <= 0xc3)
        return {
          height: (bytes[offset + 5] << 8) + bytes[offset + 6],
          width: (bytes[offset + 7] << 8) + bytes[offset + 8],
        };
      offset += Math.max(2, length + 2);
    }
  }
  return { width: 1280, height: 720 };
}

function fit(bytes, maxWidth, maxHeight) {
  const original = dimensions(bytes);
  const scale = Math.min(maxWidth / original.width, maxHeight / original.height, 1);
  return {
    width: Math.max(1, Math.round(original.width * scale)),
    height: Math.max(1, Math.round(original.height * scale)),
  };
}

function fitHeight(bytes, heightPt, maxWidthPt, proportional = true) {
  const original = dimensions(bytes);
  const height = Math.max(1, Math.round((heightPt * 96) / 72));
  const maxWidth = Math.max(1, Math.round((maxWidthPt * 96) / 72));
  return {
    width: proportional
      ? Math.max(1, Math.min(maxWidth, Math.round((original.width * height) / original.height)))
      : maxWidth,
    height,
  };
}

function imageType(bytes) {
  return bytes?.[0] === 0x89 && bytes?.[1] === 0x50 ? "png" : "jpg";
}

function format(pattern, variables) {
  return String(pattern || "").replace(/\{([^}]+)\}/g, (_, key) => variables[key] ?? "");
}

function alignment(value) {
  return (
    {
      center: AlignmentType.CENTER,
      right: AlignmentType.RIGHT,
      justify: AlignmentType.JUSTIFIED,
    }[value] || AlignmentType.LEFT
  );
}

function paragraphStyle(id, name, options = {}) {
  return { id, name, basedOn: "Normal", next: "Normal", quickFormat: true, ...options };
}

function layoutFor(config, value) {
  for (const line of String(config.actionLayoutRules || "").split(/\r?\n/)) {
    const [pattern, before, after, tabs] = line.split("|").map((item) => item.trim());
    if (!pattern) continue;
    try {
      if (new RegExp(pattern).test(value || ""))
        return {
          before: Number(before || 0),
          after: Number(after || 0),
          tabs: Number(tabs || 0),
          matched: true,
        };
    } catch {}
  }
  return { before: 0, after: 0, tabs: 0, matched: false };
}

function description(config, step) {
  const templates = { ...ChronoDefaults.actionTexts, ...(config.actionTexts || {}) };
  const text = format(templates[ChronoPolicy.actionKey(step)] || templates.generic, {
    name: step.component?.name || "componente",
    value: ChronoPolicy.actionValue(step),
    url: step.page?.url || "",
    pageName: step.page?.pageName || "página",
    scrollX: step.scrollX ?? step.scroll?.x ?? 0,
    scrollY: step.scrollY ?? step.scroll?.y ?? 0,
    "texto-iluminado": step.selectedText || step.component?.name || "texto",
  });
  if (!step.scrollBefore) return step.description || text;
  return format(templates["scroll-combined"] || "Role a página e {action}", {
    action: text ? text[0].toLowerCase() + text.slice(1) : "continue.",
  });
}

function asset(assets, path) {
  return bytesFromDataUrl(path ? assets[path] : null);
}

async function descriptionRuns(config, theme, assets, step) {
  const runs = [new TextRun(description(config, step))];
  const micro =
    step.action === "typing" || step.noMicroprint || step.component?.textOnlyLink
      ? null
      : asset(assets, step.images?.microprint);
  if (micro) {
    runs.push(new TextRun("  "));
    runs.push(
      new ImageRun({
        data: micro,
        type: imageType(micro),
        transformation: fitHeight(
          micro,
          Number(config.microprint?.heightPt || theme.bodyFontSize || 11),
          Number(config.microprint?.maxWidthPt || 90),
          config.microprint?.preserveAspectRatio !== false,
        ),
        altText: {
          title: `Microprint do passo ${step.sequence}`,
          description: step.component?.name || "Componente",
          name: `step-${step.sequence}-microprint`,
        },
      }),
    );
  }
  return runs;
}

async function stepsTable(config, theme, assets, steps) {
  const columns = config.columns || ChronoDefaults.columns;
  const total = columns.reduce((sum, column) => sum + Number(column.width || 1), 0);
  const widths = columns.map((column) => Math.round((9360 * Number(column.width || 1)) / total));
  widths[widths.length - 1] += 9360 - widths.reduce((sum, width) => sum + width, 0);
  const rows = [
    new TableRow({
      tableHeader: true,
      children: columns.map(
        (column, index) =>
          new TableCell({
            width: { size: widths[index], type: WidthType.DXA },
            verticalAlign: VerticalAlign.CENTER,
            shading: { fill: theme.tableHeaderBackground || "285589" },
            margins: { left: 120, right: 120, top: 100, bottom: 100 },
            children: [
              new Paragraph({
                style: "ChronoTableHeader",
                alignment: alignment(column.alignment),
                children: [new TextRun(column.title || "")],
              }),
            ],
          }),
      ),
    }),
  ];
  for (const [stepIndex, step] of steps.entries()) {
    const cells = [];
    for (const [columnIndex, column] of columns.entries()) {
      const sources = Array.isArray(column.source) ? column.source : [column.source];
      const number = sources.includes("sequence");
      const rule = layoutFor(config, step.action);
      cells.push(
        new TableCell({
          width: { size: widths[columnIndex], type: WidthType.DXA },
          verticalAlign: VerticalAlign.CENTER,
          margins: { left: 120, right: 120, top: 100, bottom: 100 },
          children: [
            new Paragraph({
              style: number ? "ChronoStepNumber" : "ChronoStepDescription",
              alignment: alignment(column.alignment),
              spacing: { before: rule.before * 240, after: rule.after * 240 },
              children: number
                ? [new TextRun({ text: `${stepIndex + 1}.`, bold: true })]
                : [
                    new TextRun("\t".repeat(rule.tabs)),
                    ...(await descriptionRuns(config, theme, assets, step)),
                  ],
            }),
          ],
        }),
      );
    }
    rows.push(new TableRow({ children: cells }));
  }
  return new Table({
    layout: "fixed",
    style: "ChronoStepsTable",
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: widths,
    rows,
  });
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function markerXml(marker, theme) {
  return marker.items
    .map(
      (item, index) =>
        `<w:r><w:pict><v:oval id="ChronoClick_${item.sequence}" o:spid="_x0000_s${1025 + item.sequence}" style="position:absolute;margin-left:${item.leftPt.toFixed(2)}pt;margin-top:${item.topPt.toFixed(2)}pt;width:${marker.sizePt}pt;height:${marker.sizePt}pt;z-index:${251659264 + index};mso-position-horizontal-relative:column;mso-position-vertical-relative:paragraph" fillcolor="#${theme.markerBackground || "000000"}" strokecolor="#${theme.markerColor || "FFFFFF"}" strokeweight="1pt"><v:textbox inset="0,0,0,0"><w:txbxContent><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0"/></w:pPr><w:r><w:rPr><w:b/><w:color w:val="${theme.markerColor || "FFFFFF"}"/><w:sz w:val="${Math.round(marker.sizePt)}"/></w:rPr><w:t>${xmlEscape(item.sequence)}</w:t></w:r></w:p></w:txbxContent></v:textbox></v:oval></w:pict></w:r>`,
    )
    .join("");
}

async function patchDocx(buffer, markerPatches, theme, printDecoration) {
  const zip = await JSZip.loadAsync(buffer);
  const documentFile = zip.file("word/document.xml");
  let xml = await documentFile.async("string");
  for (const marker of markerPatches) {
    const position = xml.indexOf(marker.token);
    if (position < 0) continue;
    const start = Math.max(xml.lastIndexOf("<w:r>", position), xml.lastIndexOf("<w:r ", position));
    const end = xml.indexOf("</w:r>", position);
    if (start >= 0 && end >= 0)
      xml = xml.slice(0, start) + markerXml(marker, theme) + xml.slice(end + 6);
  }
  zip.file("word/document.xml", decoratePrints(xml, printDecoration));
  return zip.generateAsync({
    type: "blob",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export async function generateDocx(session, assets) {
  const config = { ...ChronoDefaults, ...(session.config || {}) };
  const theme = { ...ChronoDefaults.theme, ...(config.theme || {}) };
  const font = theme.fontFamily || "Aptos";
  const children = [
    new Paragraph({
      style: "ChronoDocumentTitle",
      children: [new TextRun(ChronoPolicy.documentTitle(session))],
    }),
  ];
  if (session.captureFailures?.length && config.showCaptureErrorsInDocx !== false) {
    children.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `GRAVAÇÃO INCOMPLETA: ${session.captureFailures.length} captura(s) falharam. Este documento contém somente os ${session.steps.length} passos salvos.`,
            bold: true,
            color: "B45309",
          }),
        ],
      }),
    );
  }
  if (config.showTableOfContents)
    children.push(
      new Paragraph({ style: "ChronoTocTitle", children: [new TextRun("Sumário")] }),
      new TableOfContents("Sumário", { hyperlink: true, headingStyleRange: "1-1" }),
      new Paragraph({ children: [new PageBreak()] }),
    );
  const markers = [];
  let section = 0;
  for (const group of session.groups || []) {
    const steps = (group.stepIds || [])
      .map((id) => session.steps.find((step) => step.id === id))
      .filter(Boolean);
    if (!steps.length) continue;
    section++;
    const observations = steps.filter((step) => step.action === "observation");
    const regular = steps.filter((step) => step.action !== "observation");
    const page = group.page || steps[0].page;
    const pageName = page?.pageName || "Página";
    children.push(
      new Paragraph({
        style: "ChronoSectionTitle",
        heading: HeadingLevel.HEADING_1,
        children: [
          new TextRun(
            format(config.sectionTitlePattern || "{sectionNumber}. {pageName}", {
              sectionNumber: section,
              pageName,
            }),
          ),
        ],
      }),
    );
    for (const [index, observation] of observations.entries()) {
      if (observation.observationText)
        children.push(
          new Paragraph({
            style: "ChronoObservation",
            children: [new TextRun(observation.observationText)],
          }),
        );
      const image = asset(assets, observation.images?.microprint);
      if (image) {
        const rule = layoutFor(config, "observation-print");
        children.push(
          new Paragraph({
            style: "ChronoObservationPrint",
            spacing: {
              before: (rule.matched ? rule.before : 0.5) * 240,
              after: (rule.matched ? rule.after : 1) * 240,
            },
            children: [
              new ImageRun({
                data: image,
                type: imageType(image),
                transformation: fit(image, 620, 470),
                altText: {
                  title: `Observação ${section}.${index + 1}`,
                  description: observation.observationText || "Área selecionada",
                  name: `screen-observation-${section}-${index + 1}`,
                },
              }),
            ],
          }),
        );
      }
    }
    const screenshot = asset(assets, group.screenshot || regular[0]?.images?.screen);
    if (screenshot && regular.length) {
      const size = fit(screenshot, 620, 470);
      const token = `CHRONOMARKER_${section}_${Date.now()}`;
      const sizePt = Number(config.markers?.sizePt || 18);
      const widthPt = size.width * 0.75;
      const heightPt = size.height * 0.75;
      const left = (468 - widthPt) / 2;
      const points = regular.flatMap((step) => {
        if (
          ![
            "click",
            "double-click",
            "right-click",
            "typing",
            "select",
            "toggle",
            "change",
          ].includes(step.action)
        )
          return [];
        const earlier = group.latestStepId && group.latestStepId !== step.id;
        const rect = earlier ? group.markerRects?.[step.component?.selector] : step.rect;
        const point =
          (!earlier && step.click) ||
          (rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null);
        return point
          ? [
              {
                sequence: step.sequence,
                leftPt: left + (point.x / page.viewportWidth) * widthPt - sizePt / 2,
                topPt: (point.y / page.viewportHeight) * heightPt - sizePt / 2,
              },
            ]
          : [];
      });
      markers.push({
        token,
        sizePt,
        items: placeMarkers(points, {
          left,
          width: widthPt,
          height: heightPt,
          size: sizePt,
        }),
      });
      const rule = layoutFor(config, "print");
      children.push(
        new Paragraph({
          style: "ChronoScreen",
          spacing: {
            before: (rule.matched ? rule.before : theme.screenBefore / 12) * 240,
            after: (rule.matched ? rule.after : 0.25) * 240,
          },
          children: [
            new ImageRun({
              data: screenshot,
              type: imageType(screenshot),
              transformation: size,
              altText: {
                title: `Tela ${section}`,
                description: `Tela ${pageName} com marcadores cronológicos editáveis`,
                name: `screen-${section}`,
              },
            }),
            new TextRun({ text: token, color: "FFFFFF", size: 2 }),
          ],
        }),
      );
    }
    if (!regular.length) continue;
    if (config.stepPresentation === "text") {
      for (const [index, step] of regular.entries()) {
        const rule = layoutFor(config, step.action);
        children.push(
          new Paragraph({
            style: "ChronoStepDescription",
            spacing: { before: rule.before * 240, after: Math.max(120, rule.after * 240) },
            children: [
              new TextRun({ text: `${index + 1}. `, bold: true }),
              new TextRun("\t".repeat(rule.tabs)),
              ...(await descriptionRuns(config, theme, assets, step)),
            ],
          }),
        );
      }
    } else {
      const rule = layoutFor(config, "table");
      if (rule.before)
        children.push(new Paragraph({ spacing: { after: rule.before * 240 }, children: [] }));
      children.push(await stepsTable(config, theme, assets, regular));
      children.push(
        new Paragraph({
          style: "ChronoAfterTable",
          spacing: { after: (rule.matched ? rule.after : 1.5) * 240 },
        }),
      );
    }
  }
  const doc = new Document({
    creator: "ChronoClick Recorder",
    title: ChronoPolicy.documentTitle(session),
    description: "Procedimento gerado a partir de uma sessão ChronoClick.",
    features: { updateFields: true },
    styles: {
      paragraphStyles: [
        paragraphStyle("ChronoDocumentTitle", "ChronoClick - Título do Documento", {
          run: { font, size: 36, bold: true, color: theme.headingColor || "111827" },
          paragraph: { spacing: { after: (theme.titleAfter || 18) * 20 } },
        }),
        paragraphStyle("ChronoSectionTitle", "ChronoClick - Título da Seção", {
          basedOn: "Heading1",
          run: { font, size: 30, bold: true, color: theme.headingColor || "111827" },
          paragraph: { spacing: { before: 300, after: 160 }, outlineLevel: 0 },
        }),
        paragraphStyle("ChronoTocTitle", "ChronoClick - Título do Sumário", {
          run: { font, size: 30, bold: true, color: theme.headingColor || "111827" },
        }),
        paragraphStyle("ChronoScreen", "ChronoClick - Print da Tela", {
          paragraph: { alignment: AlignmentType.CENTER },
        }),
        paragraphStyle("ChronoObservation", "ChronoClick - Explicação da Observação", {
          run: { font, size: (theme.bodyFontSize || 11) * 2 },
          paragraph: { spacing: { before: 160, after: 100 }, keepNext: true },
        }),
        paragraphStyle("ChronoObservationPrint", "ChronoClick - Print da Observação", {
          paragraph: { alignment: AlignmentType.CENTER, keepNext: true },
        }),
        paragraphStyle("ChronoTableHeader", "ChronoClick - Cabeçalho da Tabela", {
          run: { font, size: 20, bold: true, color: theme.tableHeaderColor || "FFFFFF" },
        }),
        paragraphStyle("ChronoStepNumber", "ChronoClick - Número do Passo", {
          run: { font, size: 22, bold: true },
        }),
        paragraphStyle("ChronoStepDescription", "ChronoClick - Descrição do Passo", {
          run: { font, size: (theme.bodyFontSize || 11) * 2 },
          paragraph: { spacing: { line: 276 } },
        }),
        paragraphStyle("ChronoAfterTable", "ChronoClick - Espaço após Tabela"),
      ],
    },
    sections: [
      {
        properties: { page: { margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 } } },
        headers: {
          default: new Header({
            children: [
              new Paragraph({ children: [new TextRun({ text: "ChronoClick", color: "7A8493" })] }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun("Página "), new TextRun({ children: [PageNumber.CURRENT] })],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  const blob = await Packer.toBlob(doc);
  return patchDocx(await blob.arrayBuffer(), markers, theme, config.printDecoration);
}

globalThis.ChronoBrowserDocx = { generateDocx };
