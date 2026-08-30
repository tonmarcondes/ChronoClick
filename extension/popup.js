const $ = (id) => document.getElementById(id);
$("version").textContent = `v${chrome.runtime.getManifest().version}`;

async function activeTab() {
  return (await chrome.tabs.query({ active: true, currentWindow: true }))[0];
}

async function refresh() {
  const data = await chrome.runtime.sendMessage({ type: "GET_STATE" });
  const labels = { idle: "Parado", recording: "Gravando", paused: "Pausado", finalizing: "Finalizando", finished: "Finalizado" };
  $("badge").textContent = labels[data.state] || data.state;
  $("badge").dataset.state = data.state;
  $("summary").textContent = `${data.count || 0} evento(s) capturado(s).`;
  if (data.failures?.length) $("error").textContent = `${data.failures.length} captura(s) falharam: ${data.failures.at(-1).error}`;
  $("folder").textContent = data.project?.root || "Pasta raiz: ~/sistemas/cronoPrint";
  if (!$("projectRoot").value) $("projectRoot").value = data.projectRoot || "${HOME}/sistemas/cronoPrint";
  $("pause").disabled = data.state !== "recording";
  $("resume").disabled = data.state !== "paused";
  $("observe").disabled = data.state !== "recording";
  $("stop").disabled = !["recording", "paused"].includes(data.state);
  $("generate").disabled = !data.count || data.document?.state === "generating" || ["recording", "finalizing"].includes(data.state);
  $("documentLink").hidden = data.document?.state !== "ready";
  $("documentLink").title = data.document?.output || "";
  $("documentStatus").textContent = data.document?.state === "generating" ? "Gerando DOCX… Aguarde." : data.document?.state === "ready" ? `Pronto: ${data.document.output}` : data.document?.state === "error" ? data.document.error : "";
  $("start").disabled = ["recording", "paused", "finalizing"].includes(data.state);
}

$("start").onclick = async () => {
  $("error").textContent = "";
  const response = await chrome.runtime.sendMessage({ type: "START", name: $("projectName").value.trim(), root: $("projectRoot").value.trim() });
  if (!response?.ok) $("error").textContent = `Host local: ${response?.error || "erro desconhecido"}`;
  await refresh();
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
  const allowPartial = !!state.failures?.length;
  if (allowPartial && !window.confirm(`${state.failures.length} captura(s) falharam. Gerar o DOCX somente com os ${state.count} passos salvos? O documento incluirá um aviso sobre as falhas.`)) return;
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
