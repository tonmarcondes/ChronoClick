(() => {
  const config = structuredClone(ChronoDefaults);
  let state = { ok: true, state: "idle", count: 0 };
  window.close = () => {
    document.body.dataset.closeRequested = "true";
  };
  globalThis.chrome = {
    runtime: {
      getManifest: () => ({ version: "0.9.0 • teste" }),
      openOptionsPage: () => location.assign("/extension/review.html"),
      sendMessage: async (message) => {
        if (message.type === "GET_STATE") return state;
        if (message.type === "GET_SESSION")
          return { ok: true, session: null, project: null, config };
        if (message.type === "START")
          state = {
            ok: true,
            state: "recording",
            count: 3,
            project: { root: "/test", name: message.name },
          };
        if (message.type === "STOP") state = { ...state, state: "finished" };
        if (message.type === "GENERATE_DOCX")
          state.document = { state: "ready", output: "/test/Procedimento.docx" };
        return { ok: true };
      },
    },
    tabs: { getCurrent: async () => ({ id: 1 }), remove: async () => window.close() },
  };
})();
