// Shared by the content script, service worker and deterministic regression tests.
globalThis.ChronoPolicy = {
  linkAppearance({ role, menu, classes, background, padding, border }) {
    if (role === "menuitem" || menu) return "menu";
    if (role === "button" || /(^|[\s_-])(btn|button)([\s_-]|$)/i.test(classes || ""))
      return "button";
    return padding >= 4 &&
      (border > 0 ||
        (background &&
          background !== "transparent" &&
          !/rgba\([^)]*,\s*0(?:\.0+)?\)$/.test(background)))
      ? "button"
      : "link";
  },
  actionKey(step) {
    if (step.action !== "click") return step.action || "generic";
    if (step.component?.appearance === "menu" || step.component?.role === "menuitem")
      return "click-menu";
    if (step.component?.appearance === "button") return "click-styled-button";
    if (["button", "tab"].includes(step.component?.role)) return "click-button";
    if (step.component?.role === "link") return "click-link";
    if (["textbox", "combobox", "checkbox", "radio", "switch"].includes(step.component?.role))
      return "click-field";
    return "click";
  },
  actionValue(step) {
    return step.action === "click"
      ? step.value || step.component?.name || "componente"
      : step.value || "";
  },
  defaults: {
    scrollMode: "with-interaction",
    scrollMinPx: 20,
    scrollIdleMs: 650,
    repeatMode: "consecutive",
    typingFinish: "blur",
    typingIdleMs: 1200,
    captureText: true,
    pageViews: true,
    skipInitialOriginPages: true,
    separateScreens: false,
    validateCapture: true,
    delayLinkNavigation: true,
  },
  canGroup(group, incoming, signature, config) {
    if (!group || config.recording?.separateScreens || incoming.action === "scroll") return false;
    const a = group.page || {},
      b = incoming.page || {};
    if (
      a.url !== b.url ||
      (a.documentToken && b.documentToken && a.documentToken !== b.documentToken)
    )
      return false;
    for (const key of ["scrollX", "scrollY", "viewportWidth", "viewportHeight"])
      if ((a[key] || 0) !== (b[key] || 0)) return false;
    if (
      config.groupWindowMs > 0 &&
      Date.parse(incoming.timestamp) - Date.parse(group.lastTimestamp) > config.groupWindowMs
    )
      return false;
    if (!group.signature?.length || group.signature.length !== signature?.length) return false;
    return (
      group.signature.reduce((sum, n, i) => sum + Math.abs(n - signature[i]), 0) /
        signature.length <=
      10
    );
  },
  documentTitle(session, pattern) {
    const step = session.steps?.[0] || {},
      page = step.page || session.groups?.[0]?.page || {};
    const vars = {
      pageName: page.pageName || "Página",
      url: page.url || session.initialUrl || "",
      name: step.component?.name || "",
      value: step.value || "",
      "texto-iluminado": step.selectedText || "",
      "highlighted-text": step.selectedText || "",
      scrollX: page.scrollX || 0,
      scrollY: page.scrollY || 0,
      sectionNumber: 1,
      screenNumber: 1,
      tableNumber: 1,
    };
    return String(pattern || session.config?.documentTitle || "Procedimento gravado").replace(
      /\{([^{}]+)\}/g,
      (token, key) => (Object.hasOwn(vars, key) ? String(vars[key]) : token),
    );
  },
  skipPageView(session, incoming) {
    if (
      incoming.action !== "page-view" ||
      session.config?.recording?.skipInitialOriginPages === false
    )
      return false;
    try {
      const current = new URL(incoming.page?.url);
      if (!/^https?:$/.test(current.protocol)) return false;
      return session.steps.some((step) => {
        try {
          return step.action === "page-view" && new URL(step.page.url).origin === current.origin;
        } catch {
          return false;
        }
      });
    } catch {
      return false;
    }
  },
  typedValue(element, options) {
    if (
      element.matches(
        "input[type=password],[autocomplete*=password],[autocomplete=one-time-code],[data-chrono-private]",
      ) ||
      element.closest("[data-chrono-private]")
    )
      return "[REDACTED]";
    return options.captureText
      ? String(element.value ?? element.innerText ?? "")
      : "[NOT_CAPTURED]";
  },
  duplicates(steps, incoming, mode) {
    if (mode === "off" || ["page-view", "scroll"].includes(incoming.action)) return [];
    const candidates = mode === "page" ? steps : steps.slice(-1);
    return candidates.filter(
      (old) =>
        old.page?.url === incoming.page?.url &&
        old.component?.selector === incoming.component?.selector &&
        (old.action === incoming.action ||
          (incoming.action === "typing" && old.action === "click") ||
          (incoming.action === "double-click" && old.action === "click")),
    );
  },
  normalize(session) {
    session.steps.forEach((step, index) => (step.sequence = index + 1));
    const ids = new Set(session.steps.map((step) => step.id));
    session.groups.forEach((group) => (group.stepIds = group.stepIds.filter((id) => ids.has(id))));
    session.groups = session.groups.filter((group) => group.stepIds.length);
  },
  validate(expected, actual) {
    if (
      !actual ||
      expected.url !== actual.url ||
      (expected.documentToken && expected.documentToken !== actual.documentToken)
    )
      throw new Error("A página mudou antes do print. Repita a interação na página de origem.");
    for (const key of ["scrollX", "scrollY", "viewportWidth", "viewportHeight"]) {
      if (expected[key] != null && Math.abs(expected[key] - actual[key]) > 2)
        throw new Error(
          "A posição ou o tamanho da página mudou antes do print. Repita a interação.",
        );
    }
  },
};
