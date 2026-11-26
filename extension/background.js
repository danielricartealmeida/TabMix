let creating;
async function ensureEngine() {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creating) {
    creating = chrome.offscreen.createDocument({
      url: "offscreen.html",
      reasons: ["USER_MEDIA"],
      justification: "Capturar a guia e o microfone, misturar e encaminhar ao dispositivo de áudio escolhido."
    }).finally(() => { creating = undefined; });
  }
  await creating;
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message.target !== "worker") return;
  (async () => {
    if (message.type === "start") {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !/^https?:\/\//.test(tab.url || "")) {
        throw new Error("Abra a guia da música e clique no ícone do TabMix nessa guia.");
      }
      await ensureEngine();
      const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
      return await chrome.runtime.sendMessage({ target: "engine", type: "start", streamId,
        tabId: tab.id, title: tab.title || "Guia", config: message.config });
    }
    if (!(await chrome.offscreen.hasDocument())) return { ok: true, running: false };
    return await chrome.runtime.sendMessage({ ...message, target: "engine" });
  })().then(respond, error => respond({ ok: false, error: error.message }));
  return true;
});

chrome.tabs.onRemoved.addListener(async tabId => {
  if (await chrome.offscreen.hasDocument()) {
    chrome.runtime.sendMessage({ target: "engine", type: "tabClosed", tabId }).catch(() => {});
  }
});
