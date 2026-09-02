chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== "offscreen" || message.type !== "GENERATE_DOCX_OFFSCREEN") return false;
  ChronoBrowserDocx.generateDocx(message.session, message.assets)
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      setTimeout(() => URL.revokeObjectURL(url), 5 * 60 * 1000);
      sendResponse({ ok: true, url });
    })
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  return true;
});
