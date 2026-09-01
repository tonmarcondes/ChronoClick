(() => {
  if (globalThis.__chronoClickInstalled) return;
  globalThis.__chronoClickInstalled = true;

  let state = "idle";
  let receivedExplicitState = false;
  let options = { ...ChronoPolicy.defaults };
  const documentToken = crypto.randomUUID();
  const dirtyFields = new Map(),
    pendingSends = new Set();
  const replayedClicks = new WeakSet();

  // File pickers, new tabs and downloads need the browser's trusted user activation.
  function guardedTarget(event) {
    if (
      !options.delayLinkNavigation ||
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    )
      return null;
    const target = event.target.closest?.(
      'a[href],button,input[type="submit"],input[type="button"],input[type="reset"],[role="button"],[role="tab"],[role="menuitem"]',
    );
    if (
      !target ||
      target.hasAttribute("download") ||
      (target.target && target.target !== "_self") ||
      target.matches('[data-chrono-recorder-ui],input[type="file"]')
    )
      return null;
    return target;
  }
  let pendingScroll = null;
  const scrollPositions = new WeakMap();
  let lastKnownUrl = location.href,
    lastPageViewUrl = "";
  let pageViewTimer = null,
    scrollTimer = null;
  let lastRecordedScrollX = scrollX,
    lastRecordedScrollY = scrollY;

  const interactiveSelector = [
    "button",
    "a",
    "input",
    "select",
    "textarea",
    "summary",
    "[role='button']",
    "[role='link']",
    "[role='tab']",
    "[role='menuitem']",
    "[role='checkbox']",
    "[role='radio']",
    "[role='switch']",
    "[role='option']",
    "[contenteditable='true']",
    "[tabindex]",
  ].join(",");

  const clean = (value, max = 160) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, max);

  function cssEscape(value) {
    if (globalThis.CSS?.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, "\\$&");
  }

  function selectorFor(element) {
    if (element.id) return `#${cssEscape(element.id)}`;
    const testId = element.getAttribute("data-testid");
    if (testId) return `[data-testid="${String(testId).replace(/"/g, '\\"')}"]`;
    const parts = [];
    let node = element;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let part = node.tagName.toLowerCase();
      const parent = node.parentElement;
      if (parent) {
        const siblings = [...parent.children].filter((item) => item.tagName === node.tagName);
        if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(" > ");
  }

  function findLabel(element) {
    const aria = element.getAttribute("aria-label");
    if (aria) return aria;
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\s+/)
        .map((id) => document.getElementById(id)?.innerText || "")
        .join(" ");
      if (clean(text)) return text;
    }
    if (element.labels?.length)
      return [...element.labels].map((label) => label.innerText).join(" ");
    const wrappingLabel = element.closest("label");
    if (wrappingLabel) return wrappingLabel.innerText;
    return (
      element.getAttribute("title") ||
      element.getAttribute("alt") ||
      element.getAttribute("placeholder") ||
      element.innerText ||
      element.getAttribute("name") ||
      element.id
    );
  }

  function roleFor(element) {
    const explicit = element.getAttribute("role");
    if (explicit) return explicit;
    const tag = element.tagName.toLowerCase();
    if (tag === "a") return "link";
    if (tag === "button") return "button";
    if (tag === "select") return "combobox";
    if (tag === "textarea") return "textbox";
    if (tag === "input") {
      const type = element.type;
      if (["button", "submit", "reset"].includes(type)) return "button";
      if (["checkbox", "radio"].includes(type)) return type;
      return "textbox";
    }
    return tag;
  }

  function describe(element) {
    const target = element.closest?.(interactiveSelector) || element;
    const rect = target.getBoundingClientRect();
    let appearance;
    if (target.matches("a[href]")) {
      const style = getComputedStyle(target);
      appearance = ChronoPolicy.linkAppearance({
        role: target.getAttribute("role"),
        menu: !!target.closest('nav,[role="menu"],[role="menubar"],[role="navigation"]'),
        classes: target.className,
        background: style.backgroundColor,
        padding: Math.max(parseFloat(style.paddingLeft) || 0, parseFloat(style.paddingTop) || 0),
        border: parseFloat(style.borderTopWidth) || 0,
      });
    }
    const isTextLink =
      roleFor(target) === "link" &&
      (!appearance || appearance === "link") &&
      !target.matches("img,svg,picture,canvas") &&
      !target.querySelector("img,svg,picture,canvas");
    return {
      component: {
        tagName: target.tagName.toLowerCase(),
        role: roleFor(target),
        appearance,
        name: clean(findLabel(target)) || `${roleFor(target)} sem nome`,
        selector: selectorFor(target),
        textOnlyLink: isTextLink,
      },
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      click: null,
    };
  }

  function pageInfo() {
    const h1 = [...document.querySelectorAll("h1")].find((item) => item.offsetParent !== null);
    return {
      url: location.href,
      documentToken,
      browserTitle: clean(document.title),
      heading: clean(h1?.innerText),
      pageName:
        clean(h1?.innerText) || clean(document.title) || location.pathname || location.hostname,
      viewportWidth: innerWidth,
      viewportHeight: innerHeight,
      scrollX,
      scrollY,
      devicePixelRatio,
    };
  }

  function record(action, element, extra = {}) {
    if (state !== "recording" || !element || element.closest?.("[data-chrono-recorder-ui]")) return;
    const data = describe(element);
    return sendEvent({
      action,
      ...data,
      page: pageInfo(),
      timestamp: new Date().toISOString(),
      ...extra,
    });
  }

  function sendEvent(payload) {
    if (pendingScroll && !["page-view", "scroll"].includes(payload.action)) {
      payload.pendingScroll = pendingScroll;
      pendingScroll = null;
    }
    const sending = chrome.runtime
      .sendMessage({
        type: "RECORD_EVENT",
        payload,
      })
      .catch(() => ({ ok: false }));
    pendingSends.add(sending);
    sending.finally(() => pendingSends.delete(sending));
    return sending;
  }

  function flushTyping(element) {
    const entry = dirtyFields.get(element);
    if (!entry || entry.composing) return;
    clearTimeout(entry.timer);
    dirtyFields.delete(element);
    return record("typing", element, {
      value: ChronoPolicy.typedValue(element, options),
      noMicroprint: true,
    });
  }

  async function flushAll() {
    for (const element of [...dirtyFields.keys()]) flushTyping(element);
    await Promise.all([...pendingSends]);
  }

  function recordPageAction(action, extra = {}) {
    if (state !== "recording") return;
    const page = pageInfo();
    return sendEvent({
      action,
      timestamp: new Date().toISOString(),
      page,
      noMicroprint: true,
      forceNewGroup: true,
      component: { tagName: "body", role: "page", name: page.pageName, selector: "body" },
      rect: { x: 0, y: 0, width: innerWidth, height: innerHeight },
      click: null,
      ...extra,
    });
  }

  function schedulePageView() {
    clearTimeout(pageViewTimer);
    pageViewTimer = setTimeout(
      () => {
        if (
          state !== "recording" ||
          !options.pageViews ||
          document.visibilityState !== "visible" ||
          lastPageViewUrl === location.href
        )
          return;
        lastPageViewUrl = location.href;
        recordPageAction("page-view");
      },
      document.readyState === "complete" ? 500 : 900,
    );
  }

  function startObservationSelection() {
    if (state !== "recording") return { ok: false, error: "A gravação não está ativa." };
    if (document.querySelector("[data-chrono-observation-overlay]"))
      return { ok: false, error: "A seleção já está aberta." };
    const overlay = document.createElement("div"),
      box = document.createElement("div"),
      hint = document.createElement("div");
    overlay.dataset.chronoObservationOverlay = overlay.dataset.chronoRecorderUi = "true";
    hint.textContent = "Arraste para selecionar uma área · Esc para cancelar";
    const alpha = Math.max(0, Math.min(80, Number(options.observationOverlayOpacity ?? 25))) / 100;
    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      cursor: "crosshair",
      background: `rgba(15,23,42,${alpha})`,
    });
    Object.assign(box.style, {
      position: "fixed",
      display: "none",
      border: "2px solid #38bdf8",
      boxShadow: `0 0 0 9999px rgba(15,23,42,${alpha})`,
    });
    Object.assign(hint.style, {
      position: "fixed",
      top: "16px",
      left: "50%",
      transform: "translateX(-50%)",
      padding: "9px 14px",
      borderRadius: "8px",
      background: "white",
      color: "#172033",
      font: "14px system-ui",
    });
    overlay.append(box, hint);
    let start;
    const cancel = () => {
      removeEventListener("keydown", onKey, true);
      overlay.remove();
    };
    const onKey = (event) => {
      if (event.key === "Escape") cancel();
    };
    addEventListener("keydown", onKey, true);
    overlay.onpointerdown = (event) => {
      if (event.button) return;
      start = { x: event.clientX, y: event.clientY };
      overlay.style.background = "transparent";
      box.style.display = "block";
      overlay.setPointerCapture(event.pointerId);
    };
    overlay.onpointermove = (event) => {
      if (!start) return;
      Object.assign(box.style, {
        left: `${Math.min(start.x, event.clientX)}px`,
        top: `${Math.min(start.y, event.clientY)}px`,
        width: `${Math.abs(event.clientX - start.x)}px`,
        height: `${Math.abs(event.clientY - start.y)}px`,
      });
    };
    overlay.onpointerup = async (event) => {
      if (!start) return;
      const rect = {
        x: Math.min(start.x, event.clientX),
        y: Math.min(start.y, event.clientY),
        width: Math.abs(event.clientX - start.x),
        height: Math.abs(event.clientY - start.y),
      };
      if (rect.width < 12 || rect.height < 12) {
        start = null;
        box.style.display = "none";
        return;
      }
      const explanation = prompt("Escreva a explicação que ficará acima do print:", "");
      if (explanation === null) {
        cancel();
        return;
      }
      cancel();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      sendEvent({
        action: "observation",
        timestamp: new Date().toISOString(),
        observationText: clean(explanation, 1000),
        component: {
          tagName: "body",
          role: "observation",
          name: clean(explanation) || "Área observada",
          selector: "body",
        },
        rect,
        click: { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, button: 0 },
        page: pageInfo(),
      });
    };
    document.documentElement.append(overlay);
    return { ok: true };
  }

  async function captureSelection() {
    if (state !== "recording") return { ok: false, error: "A gravação não está ativa." };
    const selection = getSelection();
    const selectedText = clean(selection?.toString(), 500);
    if (!selection?.rangeCount || !selectedText)
      return { ok: false, error: "Nenhum texto está selecionado." };
    const range = selection.getRangeAt(0),
      rect = range.getBoundingClientRect();
    let target =
      range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    target =
      target?.closest?.("p,li,h1,h2,h3,h4,h5,h6,td,th,label,article,section,div,span") ||
      target ||
      document.body;
    const response = await sendEvent({
      action: "highlight-text",
      timestamp: new Date().toISOString(),
      selectedText,
      component: {
        tagName: target.tagName.toLowerCase(),
        role: "text",
        name: selectedText,
        selector: selectorFor(target),
      },
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      click: null,
      page: pageInfo(),
    });
    return response?.ok === false ? response : { ok: true };
  }

  document.addEventListener(
    "pointerdown",
    (event) => {
      if (state !== "recording" || event.target.closest?.("[data-chrono-recorder-ui]")) return;
      for (const field of [...dirtyFields.keys()]) if (field !== event.target) flushTyping(field);
      const interactive = event.target.closest?.(interactiveSelector);
      if (!interactive) return;
      if (guardedTarget(event)) return;
      const action =
        event.button === 2 ? "right-click" : event.detail >= 2 ? "double-click" : "click";
      record(action, interactive, {
        click: { x: event.clientX, y: event.clientY, button: event.button },
      });
    },
    true,
  );

  // Keep double-click handlers behind the same capture barrier.
  for (const type of ["click", "dblclick"])
    window.addEventListener(
      type,
      (event) => {
        if (replayedClicks.has(event) || state !== "recording" || event.defaultPrevented) return;
        const target = guardedTarget(event);
        if (!target) return;
        // Capture before target handlers (including SPA routers) can change the screen.
        event.preventDefault();
        event.stopImmediatePropagation();
        const originalTarget = event.target;
        const replay = new MouseEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          view: window,
          detail: event.detail,
          button: event.button,
          buttons: event.buttons,
          clientX: event.clientX,
          clientY: event.clientY,
          screenX: event.screenX,
          screenY: event.screenY,
        });
        replayedClicks.add(replay);
        const captured =
          type === "dblclick"
            ? Promise.all([...pendingSends])
            : record(event.detail >= 2 ? "double-click" : "click", target, {
                click: { x: event.clientX, y: event.clientY, button: event.button },
              });
        // Replay the actual click, not location.assign: keep routers and form handlers intact.
        Promise.resolve(captured).finally(() => {
          if (originalTarget.isConnected) originalTarget.dispatchEvent(replay);
        });
      },
      true,
    );

  document.addEventListener(
    "change",
    (event) => {
      const element = event.target;
      if (!(element instanceof Element)) return;
      let action = "change";
      let value = "";
      if (element.matches("select")) {
        action = "select";
        value = clean(element.selectedOptions?.[0]?.textContent);
      } else if (element.matches("input[type='checkbox'],input[type='radio']")) {
        action = "toggle";
        value = element.checked ? "checked" : "unchecked";
      } else if (element.matches("input,textarea,[contenteditable='true']")) {
        flushTyping(element);
        return;
      }
      record(action, element, { value });
    },
    true,
  );

  document.addEventListener(
    "input",
    (event) => {
      const element = event.target;
      if (
        state !== "recording" ||
        !element.matches(
          "input:not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true]",
        )
      )
        return;
      const prior = dirtyFields.get(element);
      clearTimeout(prior?.timer);
      const entry = { composing: event.isComposing, timer: null };
      dirtyFields.set(element, entry);
      if (options.typingFinish === "idle" && !event.isComposing)
        entry.timer = setTimeout(() => flushTyping(element), options.typingIdleMs);
    },
    true,
  );
  document.addEventListener(
    "compositionend",
    (event) => {
      const entry = dirtyFields.get(event.target);
      if (entry) entry.composing = false;
    },
    true,
  );
  document.addEventListener(
    "focusout",
    (event) => {
      const entry = dirtyFields.get(event.target);
      if (entry) entry.composing = false;
      flushTyping(event.target);
    },
    true,
  );
  document.addEventListener(
    "keydown",
    (event) => {
      if (state !== "recording" || event.isComposing) return;
      if (event.key === "Enter" && event.target.matches("input")) flushTyping(event.target);
      else if (
        ["Enter", " "].includes(event.key) &&
        event.target.matches("button,a,[role=button]") &&
        !guardedTarget({ target: event.target, button: 0 })
      )
        record("click", event.target);
    },
    true,
  );

  document.addEventListener(
    "scroll",
    (event) => {
      if (state !== "recording") return;
      if (options.scrollMode === "off") return;
      const target = event.target === document ? document.documentElement : event.target;
      const isPage = target === document.documentElement || target === document.body;
      const x = isPage ? scrollX : target.scrollLeft,
        y = isPage ? scrollY : target.scrollTop;
      const prior = scrollPositions.get(target) || { x: 0, y: 0 };
      if (Math.hypot(x - prior.x, y - prior.y) < options.scrollMinPx) return;
      scrollPositions.set(target, { x, y });
      pendingScroll = {
        timestamp: new Date().toISOString(),
        scrollX: x,
        scrollY: y,
        selector: isPage ? "body" : selectorFor(target),
      };
      clearTimeout(scrollTimer);
      if (options.scrollMode === "all")
        scrollTimer = setTimeout(() => {
          const latest = pendingScroll;
          pendingScroll = null;
          if (latest) recordPageAction("scroll", latest);
        }, options.scrollIdleMs);
    },
    { passive: true, capture: true },
  );

  // Detecta também rotas SPA que alteram a URL sem recarregar o documento.
  setInterval(() => {
    if (location.href === lastKnownUrl) return;
    lastKnownUrl = location.href;
    pendingScroll = null;
    schedulePageView();
  }, 400);
  addEventListener("popstate", schedulePageView);
  addEventListener("hashchange", schedulePageView);

  chrome.runtime.onMessage.addListener((message, _sender, respond) => {
    if (message.type === "START_RECORDING") {
      receivedExplicitState = true;
      options = { ...options, ...message.recording };
      state = "recording";
      lastPageViewUrl = "";
      pendingScroll = null;
      schedulePageView();
      respond({ ok: true });
      return;
    }
    if (message.type === "SET_STATE") {
      receivedExplicitState = true;
      options = { ...options, ...message.recording };
      const wasRecording = state === "recording";
      if (["idle", "finished"].includes(state) && message.state === "recording")
        lastPageViewUrl = "";
      state = message.state;
      if (state !== "recording") {
        pendingScroll = null;
        clearTimeout(scrollTimer);
      }
      if (!wasRecording && state === "recording") schedulePageView();
    }
    if (message.type === "FLUSH_PENDING") {
      flushAll().then(() => {
        pendingScroll = null;
        respond({ ok: true });
      });
      return true;
    }
    if (message.type === "GET_CAPTURE_CONTEXT") {
      const info = pageInfo();
      info.markerRects = {};
      for (const selector of (message.selectors || []).slice(0, 100)) {
        try {
          const element = document.querySelector(selector),
            rect = element?.getBoundingClientRect();
          const style = element && getComputedStyle(element);
          info.markerRects[selector] =
            rect &&
            rect.width > 0 &&
            rect.height > 0 &&
            rect.bottom > 0 &&
            rect.right > 0 &&
            rect.top < innerHeight &&
            rect.left < innerWidth &&
            style.visibility !== "hidden" &&
            style.display !== "none" &&
            style.opacity !== "0"
              ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
              : null;
        } catch {
          info.markerRects[selector] = null;
        }
      }
      if (message.selector) {
        try {
          const rect = document.querySelector(message.selector)?.getBoundingClientRect();
          info.rect = rect
            ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            : null;
        } catch {
          info.rect = null;
        }
      }
      respond(info);
    }
    if (message.type === "OBSERVE_NEXT") {
      respond(startObservationSelection());
      return;
    }
    if (message.type === "GET_PAGE") respond(pageInfo());
    if (message.type === "CAPTURE_SELECTION") {
      captureSelection().then(respond);
      return true;
    }
  });

  chrome.runtime
    .sendMessage({ type: "GET_STATE" })
    .then((response) => {
      if (receivedExplicitState) return;
      state = response?.state || "idle";
      options = { ...options, ...response?.recording };
      if (state === "recording") schedulePageView();
    })
    .catch(() => {});
})();
