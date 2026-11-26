let session = null;
let lastError = "";
let commands = Promise.resolve();

function bounded(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Math.max(0, Math.min(1, Number(value))) : fallback;
}

async function dispose(s) {
  if (!s) return;
  clearInterval(s.timer);
  for (const stream of s.streams) {
    for (const track of stream.getTracks()) { track.onended = null; track.stop(); }
  }
  for (const audio of s.players) { audio.pause(); audio.srcObject = null; }
  if (s.ctx && s.ctx.state !== "closed") await s.ctx.close();
}

async function stop(error = "") {
  const old = session;
  session = null;
  lastError = error;
  await dispose(old);
}

function level(analyser) {
  const data = new Float32Array(analyser.fftSize);
  analyser.getFloatTimeDomainData(data);
  let peak = 0, power = 0;
  for (const sample of data) { peak = Math.max(peak, Math.abs(sample)); power += sample * sample; }
  return { peak, rms: Math.sqrt(power / data.length) };
}

function tune(s) {
  const c = s.config;
  const now = s.ctx.currentTime;
  s.micGain.gain.setTargetAtTime(c.micMuted ? 0 : bounded(c.micVolume, 0.7), now, 0.02);
  const speech = level(s.micMeter).rms;
  // Histerese evita alternar o ducking a cada sílaba. Mantém a redução por 450 ms.
  if (!c.micMuted && speech > 0.025) s.lastSpeech = Date.now();
  const duck = c.ducking && !c.micMuted && Date.now() - s.lastSpeech < 450;
  s.ducked = Boolean(duck);
  s.musicGain.gain.setTargetAtTime(c.musicMuted ? 0 : bounded(c.musicVolume, 0.15) * (duck ? 0.25 : 1), now, duck ? 0.06 : 0.35);
  s.monitorGain.gain.setTargetAtTime(c.monitor ? bounded(c.monitorVolume, 0.5) : 0, now, 0.02);
  s.master.gain.setTargetAtTime(bounded(c.masterVolume, 0.8), now, 0.02);
}

async function start(message) {
  await stop();
  const c = message.config;
  if (!c?.outputId || !c?.micId) throw new Error("Selecione o microfone e a saída do cabo virtual antes de iniciar.");
  if (c.outputId === "default" || c.outputId === "communications") {
    throw new Error("Escolha explicitamente o cabo virtual como saída da mistura.");
  }
  if (c.monitor && (!c.monitorId || c.monitorId === "default" || c.monitorId === "communications" || c.monitorId === c.outputId)) {
    throw new Error("Escolha seu fone como retorno; ele precisa ser diferente da saída da mistura.");
  }
  const s = { streams: [], players: [], config: c, tabId: message.tabId, title: message.title, lastSpeech: 0 };
  try {
    s.tab = await navigator.mediaDevices.getUserMedia({ audio: { mandatory: {
      chromeMediaSource: "tab", chromeMediaSourceId: message.streamId
    } }, video: false });
    s.streams.push(s.tab);
    s.mic = await navigator.mediaDevices.getUserMedia({ audio: {
      deviceId: { exact: c.micId }, channelCount: 1,
      echoCancellation: true, noiseSuppression: true, autoGainControl: false
    }, video: false });
    s.streams.push(s.mic);
    s.ctx = new AudioContext({ sampleRate: 48000, latencyHint: "interactive" });
    const ctx = s.ctx;
    s.musicGain = ctx.createGain(); s.micGain = ctx.createGain();
    s.monitorGain = ctx.createGain(); s.master = ctx.createGain();
    s.micMeter = ctx.createAnalyser(); s.outputMeter = ctx.createAnalyser();
    s.musicMeter = ctx.createAnalyser();
    for (const meter of [s.micMeter, s.outputMeter, s.musicMeter]) meter.fftSize = 1024;
    const musicSource = ctx.createMediaStreamSource(s.tab);
    const micSource = ctx.createMediaStreamSource(s.mic);
    // Retorno deriva SOMENTE da guia e tem volume próprio; a voz nunca vai ao fone.
    musicSource.connect(s.musicMeter); musicSource.connect(s.musicGain);
    musicSource.connect(s.monitorGain);
    micSource.connect(s.micMeter); micSource.connect(s.micGain);
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -6; compressor.knee.value = 3;
    compressor.ratio.value = 20; compressor.attack.value = 0.003; compressor.release.value = 0.2;
    s.musicGain.connect(compressor); s.micGain.connect(compressor);
    compressor.connect(s.master); s.master.connect(s.outputMeter);
    const mixed = ctx.createMediaStreamDestination();
    const monitor = ctx.createMediaStreamDestination();
    s.master.connect(mixed); s.monitorGain.connect(monitor);
    s.streams.push(mixed.stream, monitor.stream);
    tune(s);
    async function player(stream, sink) {
      const audio = new Audio(); s.players.push(audio);
      await audio.setSinkId(sink);
      audio.srcObject = stream;
      await audio.play();
    }
    await player(mixed.stream, c.outputId);
    if (c.monitor) await player(monitor.stream, c.monitorId);
    await ctx.resume();
    if (ctx.state !== "running") throw new Error("O Edge bloqueou a reprodução. Reabra a extensão e tente iniciar novamente.");
    for (const stream of [s.tab, s.mic]) {
      for (const track of stream.getTracks()) track.onended = () => {
        commands = commands.then(() => session === s ? stop("A guia ou o microfone foi desconectado. Inicie novamente.") : undefined);
      };
    }
    session = s;
    s.timer = setInterval(() => tune(s), 35);
    return state();
  } catch (error) {
    await dispose(s);
    throw error;
  }
}

function state() {
  const s = session;
  return { ok: true, running: Boolean(s), error: lastError, title: s?.title,
    tabId: s?.tabId, ducked: s?.ducked, config: s?.config,
    mic: s ? level(s.micMeter).peak : 0,
    music: s ? level(s.musicMeter).peak : 0,
    output: s ? level(s.outputMeter).peak : 0 };
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || message.target !== "engine") return;
  commands = commands.then(async () => {
    if (message.type === "start") return await start(message);
    if (message.type === "stop") await stop();
    if (message.type === "tabClosed" && session?.tabId === message.tabId) await stop("A guia capturada foi fechada.");
    if (message.type === "update" && session) {
      // Dispositivos só mudam após parar. Controles de volume funcionam durante a captura.
      for (const key of ["micVolume", "musicVolume", "masterVolume", "monitorVolume", "micMuted", "musicMuted", "ducking", "monitor"]) {
        if (key in message.config) session.config[key] = message.config[key];
      }
      // O player de retorno só existe se o retorno estava habilitado ao iniciar.
      tune(session);
    }
    return state();
  }).catch(error => { lastError = error.message; return { ...state(), ok: false, error: error.message }; });
  commands.then(respond);
  return true;
});
