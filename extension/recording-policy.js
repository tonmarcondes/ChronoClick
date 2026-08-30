// Shared by the content script, service worker and deterministic regression tests.
globalThis.ChronoPolicy = {
  defaults: { scrollMode: "with-interaction", scrollMinPx: 20, scrollIdleMs: 650,
    repeatMode: "consecutive", typingFinish: "blur", typingIdleMs: 1200,
    captureText: true, pageViews: true, separateScreens: true, validateCapture: true, delayLinkNavigation: true },
  typedValue(element, options) {
    if (element.matches("input[type=password],[autocomplete*=password],[autocomplete=one-time-code],[data-chrono-private]") || element.closest("[data-chrono-private]")) return "[REDACTED]";
    return options.captureText ? String(element.value ?? element.innerText ?? "") : "[NOT_CAPTURED]";
  },
  duplicates(steps, incoming, mode) {
    if (mode === "off" || ["page-view", "scroll"].includes(incoming.action)) return [];
    const candidates = mode === "page" ? steps : steps.slice(-1);
    return candidates.filter(old => old.page?.url === incoming.page?.url && old.component?.selector === incoming.component?.selector &&
      (old.action === incoming.action || (incoming.action === "typing" && old.action === "click") || (incoming.action === "double-click" && old.action === "click")));
  },
  normalize(session) {
    session.steps.forEach((step, index) => step.sequence = index + 1);
    const ids = new Set(session.steps.map(step => step.id));
    session.groups.forEach(group => group.stepIds = group.stepIds.filter(id => ids.has(id)));
    session.groups = session.groups.filter(group => group.stepIds.length);
  },
  validate(expected, actual) {
    if (!actual || expected.url !== actual.url || (expected.documentToken && expected.documentToken !== actual.documentToken)) throw new Error("A página mudou antes do print. Repita a interação na página de origem.");
    for (const key of ["scrollX", "scrollY", "viewportWidth", "viewportHeight"]) {
      if (expected[key] != null && Math.abs(expected[key] - actual[key]) > 2) throw new Error("A posição ou o tamanho da página mudou antes do print. Repita a interação.");
    }
  }
};
