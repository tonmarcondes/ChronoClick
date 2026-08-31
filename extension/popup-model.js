globalThis.ChronoPopup = {
  model(data, newProject = false) {
    const recording = ["recording", "paused"].includes(data.state);
    const generating = data.document?.state === "generating";
    const ready = data.document?.state === "ready";
    const canStart = newProject || !data.project || data.state === "idle" || ready;
    if (generating || data.state === "finalizing") return {action:null,label:generating ? "Gerando DOCX…" : "Finalizando…",disabled:true,recording,canStart:false};
    if (recording) return {action:"STOP",label:"Finalizar",disabled:false,recording,canStart:false};
    if (canStart) return {action:"START",label:"Iniciar nova",disabled:false,recording:false,canStart:true};
    return {action:"GENERATE_DOCX",label:"Gerar DOCX",disabled:!data.count,recording:false,canStart:false};
  }
};
