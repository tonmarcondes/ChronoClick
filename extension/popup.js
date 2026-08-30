const $ = (id) => document.getElementById(id);
let starting = false;
let refreshGeneration = 0;
$("version").textContent = `v${chrome.runtime.getManifest().version}`;

async function activeTab() {
  return (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
}

async function refresh() {
  if (starting) return;
  const generation = refreshGeneration;
  const data = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  if (starting || generation !== refreshGeneration) return;
  const labels = { idle: "Parado", recording: "Gravando", paused: "Pausado", finalizing: "Finalizando", finished: "Finalizado" };
  $("badge").textContent = labels[data.state] || data.state;
  $("badge").dataset.state = data.state;
  $("summary").textContent = `${data.count || 0} evento(s) capturado(s).`;
  $("partialConsent").hidden = !data.failures?.length;
  if (!data.failures?.length) $("allowPartial").checked = false;
  $("captureWarnings").textContent = data.failures?.length ? `${data.failures.length} captura(s) falharam: ${data.failures.at(-1).error}` : "";
  $("folder").textContent = data.project?.root || "Pasta raiz: ~/sistemas/cronoPrint";
  if (!$("projectRoot").value) $("projectRoot").value = data.projectRoot || "${HOME}/sistemas/cronoPrint";
  $("pause").disabled = data.state !== "recording";
  $("resume").disabled = !["paused", "finished"].includes(data.state);
  $("observe").disabled = data.state !== "recording";
  $("stop").disabled = !["recording", "paused"].includes(data.state);
  $("generate").disabled = !data.count || data.document?.state === "generating" || ["recording", "finalizing"].includes(data.state);
  $("documentLink").hidden = data.document?.state !== "ready";
  $("documentLink").title = data.document?.output || "";
  $("documentStatus").textContent = data.document?.state === "generating" ? "Gerando DOCX… Aguarde." : data.document?.state === "ready" ? `Pronto: ${data.document.output}` : data.document?.state === "error" ? data.document.error : "";
  if (!data.count && data.state === "finished") $("documentStatus").textContent = "Nenhum evento foi salvo: não há conteúdo para gerar o DOCX. Atualize a página, inicie uma nova gravação e confira se o contador aumenta antes de finalizar.";
  $("start").disabled = ["recording", "paused", "finalizing"].includes(data.state);
}

$("start").onclick = async () => {
  if (starting) return;
  starting = true; refreshGeneration++; $("start").disabled = true;
  $("documentLink").hidden = true; $("documentLink").title = "";
  $("documentStatus").textContent = ""; $("summary").textContent = "Iniciando nova gravação…";
  $("captureWarnings").textContent = ""; $("partialConsent").hidden = true; $("allowPartial").checked = false;
  $("error").textContent = "Conectando o gravador à página…";
  try {
    const response = await chrome.runtime.sendMessage({ type: "START", name: $("projectName").value.trim(), root: $("projectRoot").value.trim() });
    if (!response?.ok) throw new Error(response?.error || "Não foi possível iniciar a gravação.");
    $("error").textContent = "Gravação iniciada. Este painel fecha em 3 segundos.";
    setTimeout(() => window.close(), 3000);
    starting = false;
    await refresh();
  } catch (error) { starting = false; await refresh().catch(() => {}); $("error").textContent = error.message; }
};
$("pause").onclick = async () => { await chrome.runtime.sendMessage({ type: "PAUSE" }); await refresh(); };
$("resume").onclick = async () => { await chrome.runtime.sendMessage({ type: "RESUME" }); await refresh(); };
$("stop").onclick = async () => {
  $("error").textContent = "Finalizando e salvando imagens...";
  const response = await chrome.runtime.sendMessage({ type: "STOP" });
  $("error").textContent = response?.ok ? "Gravação finalizada." : `Erro: ${response?.error}`;
  await refresh();
};
$("generate").onclick = async () => {
  const state = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  const allowPartial = !!state.failures?.length && $("allowPartial").checked;
  if (state.failures?.length && !allowPartial) { $("error").textContent = "Marque a autorização abaixo para exportar os passos salvos, ou refaça as capturas que falharam."; return; }
  $("generate").disabled = true; $("documentLink").hidden = true;
  $("documentStatus").textContent = "Gerando DOCX… Aguarde.";
  try {
    const response = await chrome.runtime.sendMessage({ type: "GENERATE_DOCX", allowPartial });
    $("error").textContent = response?.ok ? "" : response?.error;
  } catch (error) { $("error").textContent = error.message; }
  await refresh();
};
$("documentLink").onclick = async event => {
  event.preventDefault();
  const result = await chrome.runtime.sendMessage({ type: "OPEN_DOCX" });
  if (!result?.ok) $("error").textContent = result?.error || "Não foi possível abrir o arquivo.";
};
$("review").onclick = () => chrome.runtime.openOptionsPage();
$("observe").onclick = async () => {
  const tab = await activeTab();
  if (tab?.id) await chrome.tabs.sendMessage(tab.id, { type: "OBSERVE_NEXT" });
  window.close();
};
$("highlight").onclick = async () => {
  const tab = await activeTab();
  const response = tab?.id ? await chrome.tabs.sendMessage(tab.id, { type: "CAPTURE_SELECTION" }) : null;
  $("error").textContent = response?.ok ? "Texto selecionado capturado." : (response?.error || "Selecione um texto na página antes de capturar.");
};

refresh();
setInterval(() => refresh().catch(() => {}), 1500);
