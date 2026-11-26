const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function harness({ micFails = false, outputFails = false } = {}) {
  const streams = [], contexts = [], players = [], listeners = [];
  const stream = name => {
    const track = { stopped: false, onended: null, stop() { this.stopped = true; } };
    const value = { name, getTracks: () => [track] }; streams.push(value); return value;
  };
  function node(name) {
    return { name, links: [], connect(other) { this.links.push(other); return other; },
      gain: { value: 1, setTargetAtTime(value) { this.value = value; } } };
  }
  class Context {
    constructor() { contexts.push(this); this.state = 'running'; this.currentTime = 0; this.sources = []; }
    createGain() { return node('gain'); }
    createAnalyser() { return { ...node('meter'), fftSize: 1024, getFloatTimeDomainData(a) { a.fill(0); } }; }
    createMediaStreamSource(s) { const n = node(s.name); this.sources.push(n); return n; }
    createDynamicsCompressor() { return { ...node('compressor'), ...Object.fromEntries(['threshold','knee','ratio','attack','release'].map(k => [k, { value: 0 }])) }; }
    createMediaStreamDestination() { return { ...node('destination'), stream: stream('destination') }; }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
  }
  class Audio {
    constructor() { players.push(this); }
    async setSinkId(id) { if (outputFails) throw new Error('sink unavailable'); this.sinkId = id; }
    async play() { this.playing = true; }
    pause() { this.playing = false; }
  }
  const box = vm.createContext({ AudioContext: Context, Audio, Float32Array, Date, Number, Math,
    setInterval: () => 1, clearInterval: () => {},
    navigator: { mediaDevices: { async getUserMedia(c) {
      const isTab = Boolean(c.audio.mandatory);
      if (!isTab && micFails) throw new Error('microphone denied');
      return stream(isTab ? 'tab' : 'mic');
    } } },
    chrome: { runtime: { id: 'test', onMessage: { addListener: f => listeners.push(f) } } }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../extension/offscreen.js'), 'utf8'), box);
  const run = code => vm.runInContext(code, box);
  const config = { micId: 'physical-mic', outputId: 'cable-input', monitorId: 'headphones', monitor: true,
    micVolume: 0.7, musicVolume: 0.15, monitorVolume: 0.5, masterVolume: 0.8 };
  const start = (patch = {}) => { box.message = { config: { ...config, ...patch }, streamId: 'id', tabId: 42, title: 'Music' }; return run('start(message)'); };
  const send = message => new Promise(resolve => listeners[0]({ target: 'engine', ...message }, { id: 'test' }, resolve));
  return { streams, contexts, players, start, run, send };
}

test('mix goes to the cable; only tab audio has a separate headphone route', async () => {
  const h = harness(); const result = await h.start();
  assert.equal(result.running, true);
  assert.deepEqual(h.players.map(p => p.sinkId), ['cable-input', 'headphones']);
  assert.equal(h.run('session.micGain.links[0] === session.musicGain.links[0]'), true);
  assert.equal(h.run('session.ctx.sources[0].links.includes(session.monitorGain)'), true);
  assert.equal(h.run('session.ctx.sources[1].links.includes(session.monitorGain)'), false);
  await h.run('stop()');
  assert.ok(h.streams.every(s => s.getTracks().every(t => t.stopped)));
  assert.ok(h.players.every(p => !p.playing && p.srcObject === null));
  assert.equal(h.contexts[0].state, 'closed');
});

test('microphone permission failure releases tab capture', async () => {
  const h = harness({ micFails: true });
  await assert.rejects(h.start(), /microphone denied/);
  assert.ok(h.streams[0].getTracks()[0].stopped);
  assert.equal(h.run('state().running'), false);
});

test('output failure releases every track and audio context', async () => {
  const h = harness({ outputFails: true });
  await assert.rejects(h.start(), /sink unavailable/);
  assert.ok(h.streams.every(s => s.getTracks()[0].stopped));
  assert.equal(h.contexts[0].state, 'closed');
});

test('invalid destinations are rejected before acquiring audio', async () => {
  const h = harness();
  await assert.rejects(h.start({ outputId: 'default' }), /explicitamente/);
  await assert.rejects(h.start({ monitorId: 'cable-input' }), /diferente/);
  assert.equal(h.streams.length, 0);
});

test('closing another tab keeps capture; closing captured tab releases it', async () => {
  const h = harness(); await h.start();
  assert.equal((await h.send({ type: 'tabClosed', tabId: 99 })).running, true);
  assert.equal((await h.send({ type: 'tabClosed', tabId: 42 })).running, false);
  assert.ok(h.streams.every(s => s.getTracks()[0].stopped));
});

test('track disconnection stops the session', async () => {
  const h = harness(); await h.start();
  h.streams[1].getTracks()[0].onended();
  await h.run('commands');
  assert.equal(h.run('state().running'), false);
  assert.ok(h.streams.every(s => s.getTracks()[0].stopped));
});

test('mute changes gain live without stopping or rerouting devices', async () => {
  const h = harness(); await h.start();
  const result = await h.send({ type: 'update', config: { micMuted: true, musicMuted: true, outputId: 'other' } });
  assert.equal(result.running, true);
  assert.equal(h.run('session.micGain.gain.value'), 0);
  assert.equal(h.run('session.musicGain.gain.value'), 0);
  assert.equal(h.run('session.monitorGain.gain.value'), 0.5);
  assert.equal(h.players[0].sinkId, 'cable-input');
  await h.run('stop()');
});
