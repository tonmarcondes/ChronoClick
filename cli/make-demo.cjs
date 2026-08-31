const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const project = path.resolve(__dirname, "..");
const demoDir = path.join(project, "demo");
fs.mkdirSync(demoDir, { recursive: true });

(async () => {
  const screenshotPath = path.join(demoDir, "reference-screen.jpg");
  const screenSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1288" height="520">
    <rect width="1288" height="520" fill="#f8fafc"/><rect x="0" y="0" width="1288" height="58" fill="#ffffff"/><rect x="0" y="57" width="1288" height="1" fill="#cbd5e1"/>
    <text x="28" y="38" font-family="Arial" font-size="25" font-weight="700" fill="#6d28d9">IFS</text><text x="120" y="38" font-family="Arial" font-size="23" font-weight="700" fill="#1769aa">Line Technician To Do List</text><text x="440" y="38" font-family="Arial" font-size="18" fill="#475569">› Line Technician</text>
    <rect x="20" y="82" width="116" height="38" rx="4" fill="#dbe4ee"/><text x="42" y="107" font-family="Arial" font-size="16" fill="#334155">Flight Search</text>
    <rect x="20" y="137" width="137" height="43" fill="#f6c945"/><text x="50" y="165" font-family="Arial" font-size="18" font-weight="700" fill="#1f2937">Fleet List</text>
    <rect x="157" y="137" width="190" height="43" fill="#bfdbfe"/><text x="181" y="165" font-family="Arial" font-size="18" fill="#1f2937">Assigned Work List</text>
    <rect x="347" y="137" width="118" height="43" fill="#bfdbfe"/><text x="374" y="165" font-family="Arial" font-size="18" fill="#1f2937">My Tasks</text>
    <rect x="20" y="205" width="1248" height="46" fill="#07679f"/><text x="45" y="235" font-family="Arial" font-size="16" font-weight="700" fill="#fff">Aircraft</text><text x="245" y="235" font-family="Arial" font-size="16" font-weight="700" fill="#fff">Registration</text><text x="520" y="235" font-family="Arial" font-size="16" font-weight="700" fill="#fff">Name / Work Package</text><text x="1010" y="235" font-family="Arial" font-size="16" font-weight="700" fill="#fff">Status</text>
    <g font-family="Arial" font-size="17" fill="#1769aa"><rect x="20" y="251" width="1248" height="66" fill="#fff"/><text x="48" y="291">A319-112</text><text x="245" y="291">PR-MYC</text><text x="520" y="291">WP-LM-PR-MYC10JUN2024</text><text x="1010" y="291" fill="#334155">IN PROGRESS</text>
    <rect x="20" y="317" width="1248" height="66" fill="#e5e7eb"/><text x="48" y="357">A319-112</text><text x="245" y="357">PR-MYL</text><text x="520" y="357">WP-LM-PR-MYL08JAN2025</text><text x="1010" y="357" fill="#334155">IN PROGRESS</text>
    <rect x="20" y="383" width="1248" height="66" fill="#fff"/><text x="48" y="423">A319-112</text><text x="245" y="423">PT-TPA</text><text x="520" y="423">WP-LM-PT-TPA02MAR2024</text><text x="1010" y="423" fill="#334155">IN PROGRESS</text></g>
  </svg>`;
  await sharp(Buffer.from(screenSvg)).jpeg({ quality: 90 }).toFile(screenshotPath);
  const rects = [
    { x: 110, y: 5, width: 320, height: 48, name: "Line Technician To Do List", role: "heading" },
    { x: 20, y: 137, width: 137, height: 43, name: "Fleet List", role: "tab" },
    { x: 510, y: 390, width: 340, height: 45, name: "WP-LM-PT-TPA02MAR2024", role: "link" },
  ];
  const steps = [];
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    const micro = `step-${i + 1}-micro.jpg`;
    await sharp(screenshotPath)
      .extract({
        left: Math.max(0, r.x - 12),
        top: Math.max(0, r.y - 8),
        width: Math.min(1288 - Math.max(0, r.x - 12), r.width + 24),
        height: Math.min(520 - Math.max(0, r.y - 8), r.height + 16),
      })
      .jpeg({ quality: 92 })
      .toFile(path.join(demoDir, micro));
    steps.push({
      id: `demo-step-${i + 1}`,
      sequence: i + 1,
      groupId: "screen-001",
      timestamp: new Date(Date.now() + i * 1000).toISOString(),
      action: i === 0 ? "observation" : "click",
      description: "",
      component: {
        name: r.name,
        role: r.role,
        tagName: i === 0 ? "h1" : "a",
        selector: `.demo-${i + 1}`,
      },
      rect: { x: r.x, y: r.y, width: r.width, height: r.height },
      click: { x: r.x + r.width / 2, y: r.y + r.height / 2, button: 0 },
      page: {
        pageName: "Encontrando um Cartão de Tarefas",
        browserTitle: "Line Technician To Do List",
        heading: "",
        url: "https://exemplo.local/tasks",
        viewportWidth: 1288,
        viewportHeight: 520,
        scrollX: 0,
        scrollY: 0,
        devicePixelRatio: 1,
      },
      images: { screen: "reference-screen.jpg", microprint: micro },
    });
  }
  const session = {
    schemaVersion: 1,
    id: "demo",
    createdAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    config: {
      documentTitle: "Procedimento Operacional",
      sectionTitlePattern: "{sectionNumber}. {pageName}",
      screenshotCaptionPattern: "Figura {sectionNumber}.{screenNumber} — {pageName}",
      tableCaptionPattern: "Tabela {sectionNumber}.{tableNumber} — Passos de {pageName}",
      groupWindowMs: 12000,
      columns: [
        { key: "step", title: "STEP", source: ["sequence"], width: 12 },
        {
          key: "description",
          title: "DESCRIÇÃO",
          source: ["auto-description", "microprint"],
          width: 88,
        },
      ],
      actionTexts: {
        "click-button": "Clique no botão {name}.",
        "click-link": "Clique no link {name}.",
        click: "Clique em {name}.",
        observation: "Observe {name}.",
        generic: "Interaja com {name}.",
      },
      microprint: { heightPt: 11, maxWidthPt: 90 },
      markers: { sizePt: 18 },
      theme: {
        fontFamily: "Aptos",
        bodyFontSize: 11,
        headingColor: "111827",
        tableHeaderBackground: "285589",
        tableHeaderColor: "FFFFFF",
        tableBorderColor: "111111",
        markerBackground: "000000",
        markerColor: "FFFFFF",
        componentBold: true,
        componentColor: "111827",
        titleBefore: 0,
        titleAfter: 18,
        screenBefore: 6,
        screenAfter: 12,
        tableBefore: 8,
        tableAfter: 18,
      },
    },
    steps,
    groups: [
      {
        id: "screen-001",
        page: steps[0].page,
        screenshot: "reference-screen.jpg",
        stepIds: steps.map((step) => step.id),
      },
    ],
  };
  fs.writeFileSync(path.join(demoDir, "demo-session.json"), JSON.stringify(session, null, 2));
  console.log("Sessão de demonstração criada.");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
