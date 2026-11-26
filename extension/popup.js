const $ = id => document.getElementById(id);
const defaults = { micId: "", outputId: "", monitorId: "", micVolume: 0.7, musicVolume: 0.15,
  masterVolume: 0.8, monitorVolume: 0.5, micMuted: false, musicMuted: false, monitor: true, ducking: false };
const sliders = ["micVolume", "musicVolume", "masterVolume", "monitorVolume"];
const checks = ["micMuted", "musicMuted", "monitor", "ducking"];
const devices = ["micId", "outputId", "monitorId"];
let config = { ...defaults }, running = false, busy = false;
let debounce;
const isSettings = new URLSearchParams(location.search).has("setup");

function error(text) { $("error").textContent = text || ""; $("error").hidden = !text; }
async function send(type, extra = {}) {
  const result = await chrome.runtime.sendMessage({ target: "worker", type, ...extra });
  if (!result?.ok) throw new Error(result?.error || "Sem resposta do motor de áudio.");
  return result;
}
function paintControls() {
  for (const id of sliders) {
    $(id).value = Math.round(config[id] * 100);
    document.querySelector(`output[for="${id}"]`).textContent = `${$(id).value}%`;
  }
  for (const id of checks) $(id).checked = config[id];
}
function paintState(state) {
  running = state.running;
  $("badge").textContent = running ? "NO AR" : "PARADO";
  $("badge").classList.toggle("live", running);
  $("start").disabled = busy || running || isSettings;
  $("stop").disabled = busy || !running;
  for (const id of [...devices, "monitor", "refresh", "permission"]) $(id).disabled = busy || running;
  $("source").textContent = running ? `Capturando: ${state.title}` : isSettings ? "Salve suas escolhas aqui e volte à guia da música. Os ajustes são salvos automaticamente." : "Abra a guia da música para começar.";
  $("duckState").textContent = state.ducked ? "ATIVO" : "";
  for (const id of ["mic", "music", "output"]) $(`${id}Meter`).value = state[id] || 0;
  if (state.error) error(state.error);
}
async function populateDevices() {
  const available = await navigator.mediaDevices.enumerateDevices();
  const physical = available.filter(d => !["default", "communications"].includes(d.deviceId));
  for (const id of devices) {
    const entries = physical.filter(d => d.kind === (id === "micId" ? "audioinput" : "audiooutput"));
    $(id).replaceChildren(new Option("Selecione…", ""));
    entries.forEach((d, i) => $(id).add(new Option(d.label || `Dispositivo ${i + 1} (autorize o microfone)`, d.deviceId)));
    $(id).value = config[id];
    if (config[id] && !entries.some(d => d.deviceId === config[id])) {
      $(id).add(new Option("Dispositivo salvo indisponível — selecione outro", config[id]));
      $(id).value = config[id];
    }
  }
}
async function save() {
  for (const id of sliders) config[id] = Number($(id).value) / 100;
  for (const id of checks) config[id] = $(id).checked;
  for (const id of devices) config[id] = $(id).value;
  paintControls();
  await chrome.storage.local.set({ config });
  if (running) await send("update", { config });
}
async function action(type) {
  if (busy) return;
  busy = true; error("");
  $("start").disabled = true; $("stop").disabled = true;
  try {
    clearTimeout(debounce);
    await save();
    paintState(await send(type, { config }));
  } catch (e) { error(e.message); }
  finally { busy = false; await poll(); }
}
async function poll() {
  try { paintState(await send("state")); } catch (e) { error(e.message); }
}
$("start").addEventListener("click", () => action("start"));
$("stop").addEventListener("click", () => action("stop"));
$("setup").addEventListener("click", () => chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?setup=1") }));
$("refresh").addEventListener("click", () => populateDevices().catch(e => error(e.message)));
$("permission").addEventListener("click", async () => {
  error("");
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    await populateDevices();
    $("setupHint").textContent = "Microfone autorizado. Escolha os dispositivos abaixo.";
  } catch (e) { error(`Não foi possível autorizar o microfone: ${e.message}`); }
  finally { stream?.getTracks().forEach(t => t.stop()); }
});
for (const id of [...sliders, ...checks, ...devices]) {
  $(id).addEventListener("input", () => {
    for (const slider of sliders) document.querySelector(`output[for="${slider}"]`).textContent = `${$(slider).value}%`;
    clearTimeout(debounce);
    // Volumes são pequenos objetos locais; salvar imediatamente evita perder o último ajuste ao fechar o popup.
    save().catch(e => error(e.message));
  });
}
async function init() {
  if (isSettings) {
    document.body.classList.add("settings"); $("permission").hidden = false;
    $("setupHint").textContent = "1. Autorize o microfone. 2. Escolha os dispositivos. 3. Volte à guia da música e abra o ícone do TabMix.";
  }
  config = { ...defaults, ...(await chrome.storage.local.get("config")).config };
  const state = await send("state");
  if (state.running && state.config) config = { ...config, ...state.config };
  paintControls(); await populateDevices(); paintState(state);
  setInterval(poll, 180);
}
init().catch(e => error(e.message));
