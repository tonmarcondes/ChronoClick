const $ = (id) => document.getElementById(id);
let state = { state: "idle" };
let busy = false;
let newProject = false;
let revision = 0;
let closeTimer;

async function send(type, payload = {}) {
  const response = await chrome.runtime.sendMessage({ type, ...payload });
  if (!response || response.ok === false)
    throw new Error(response?.error || "Não foi possível concluir a ação.");
  return response;
}

function render() {
  const authenticated = state.access?.authenticated === true;
  $("accessPanel").hidden = authenticated;
  $("appContent").hidden = !authenticated;
  $("review").disabled = !authenticated;
  if (!authenticated) return;
  const model = ChronoPopup.model(state, newProject);
  const labels = {
    idle: "Pronto",
    recording: "Gravando",
    paused: "Pausado",
    finalizing: "Finalizando",
    finished: "Finalizado",
  };
  $("badge").textContent = labels[state.state] || "Pronto";
  $("badge").dataset.state = state.state;
  $("summary").textContent = newProject || !state.project ? "" : `${state.count || 0} passo(s)`;
  $("primaryAction").textContent = model.label;
  $("primaryAction").disabled = busy || model.disabled;
  $("projectField").hidden = !model.canStart;
  $("captureTools").hidden = !model.recording;
  $("pause").hidden = state.state !== "recording";
  $("resume").hidden = state.state !== "paused";
  $("observe").disabled = $("highlight").disabled = state.state !== "recording";
  $("newProject").hidden = model.canStart || model.recording || (model.disabled && !!state.count);
  const failures = newProject || state.showCaptureErrors === false ? [] : state.failures || [];
  $("captureWarnings").hidden = !failures.length;
  $("warningCount").textContent = `${failures.length} captura(s) precisam de atenção`;
  $("warningDetails").textContent = failures.map((item) => item.error).join("\n");
  $("partialConsent").hidden = model.action !== "GENERATE_DOCX" || !failures.length;
  if (!failures.length) $("allowPartial").checked = false;
  $("documentStatus").textContent = newProject
    ? ""
    : state.document?.state === "error"
      ? state.document.error
      : state.document?.state === "ready"
        ? "Documento pronto."
        : state.state === "finished" && !state.count
          ? "Nenhum passo salvo. Inicie outro projeto para gravar novamente."
          : "";
}

async function refresh() {
  if (busy) return;
  const requestRevision = revision;
  const data = await send("GET_STATE");
  if (busy || requestRevision !== revision) return;
  state = data;
  render();
}

async function run(task) {
  if (busy) return;
  clearTimeout(closeTimer);
  busy = true;
  revision++;
  $("error").textContent = "";
  render();
  try {
    await task();
  } catch (error) {
    $("error").textContent = error.message;
  } finally {
    busy = false;
    await refresh().catch((error) => {
      $("error").textContent = error.message;
      render();
    });
  }
}

$("primaryAction").onclick = () =>
  run(async () => {
    const action = ChronoPopup.model(state, newProject).action;
    if (action === "START") {
      $("documentStatus").textContent = "Conectando à página…";
      await send("START", { name: $("projectName").value.trim() });
      newProject = false;
      closeTimer = setTimeout(() => window.close(), 3000);
    } else if (action === "STOP") {
      $("documentStatus").textContent = "Salvando as capturas…";
      await send("STOP");
    } else if (action === "GENERATE_DOCX") {
      const latest = await send("GET_STATE");
      if (
        latest.showCaptureErrors !== false &&
        latest.failures?.length &&
        !$("allowPartial").checked
      )
        throw new Error("Confirme a exportação dos passos salvos ou revise as capturas com falha.");
      $("documentStatus").textContent = "Gerando DOCX…";
      await send("GENERATE_DOCX", {
        allowPartial: latest.showCaptureErrors === false || $("allowPartial").checked,
      });
    }
  });
$("newProject").onclick = () => {
  newProject = true;
  $("projectName").value = "";
  $("error").textContent = "";
  render();
};
$("review").onclick = () => {
  clearTimeout(closeTimer);
  chrome.runtime.openOptionsPage();
};
$("pause").onclick = () => run(() => send("PAUSE"));
$("resume").onclick = () => run(() => send("RESUME"));
async function captureTool(type) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error("Abra a página que deseja capturar.");
  const result = await chrome.tabs.sendMessage(tab.id, { type });
  if (result?.ok === false) throw new Error(result.error);
  window.close();
}
$("observe").onclick = () => run(() => captureTool("OBSERVE_NEXT"));
$("highlight").onclick = () => run(() => captureTool("CAPTURE_SELECTION"));
$("validateAccess").onclick = async () => {
  const button = $("validateAccess");
  button.disabled = true;
  $("accessError").textContent = "Validando…";
  try {
    await send("VALIDATE_ACCESS", { email: $("accessEmail").value });
    $("accessError").textContent = "";
    await refresh();
  } catch (error) {
    $("accessError").textContent = error.message;
  } finally {
    button.disabled = false;
  }
};
$("accessEmail").onkeydown = (event) => {
  if (event.key === "Enter") $("validateAccess").click();
};
$("version").textContent = `v${chrome.runtime.getManifest().version}`;
refresh().catch((error) => {
  $("error").textContent = error.message;
});
setInterval(
  () =>
    refresh().catch((error) => {
      $("error").textContent = error.message;
    }),
  1500,
);
