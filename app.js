const colors = [
  { name: "Red", value: "#ff3b4f" },
  { name: "Blue", value: "#2f80ff" },
  { name: "Green", value: "#39d98a" },
  { name: "Yellow", value: "#ffd166" },
  { name: "Purple", value: "#9b5cff" },
  { name: "Cyan", value: "#21d4d4" },
  { name: "White", value: "#f8fafc" },
  { name: "Orange", value: "#ff8a34" }
];

const defaults = {
  activityMode: "random",
  playerName: "Player 1",
  durationMode: "timeout",
  lightsOutMode: "hit",
  timeLimit: 45,
  hitTarget: 20,
  lightTimeout: 2.5,
  delayMode: "none",
  fixedDelay: 0.4,
  randomDelayMax: 1.5,
  cycles: 1,
  restSeconds: 20,
  strikeLimit: 3,
  sequenceSteps: 6,
  homeBaseColor: "Green",
  focusTargetColor: "Green",
  distractorCount: 2,
  enabledColors: ["Red", "Blue", "Green", "Yellow"]
};

const state = {
  status: "idle",
  config: { ...defaults },
  activeColor: null,
  activeKind: "target",
  activeStartedAt: 0,
  lightToken: 0,
  runStartedAt: 0,
  cycleStartedAt: 0,
  pausedCycleElapsed: 0,
  cycle: 1,
  hits: 0,
  misses: 0,
  falseHits: 0,
  strikes: 0,
  reactions: [],
  sequence: [],
  sequenceIndex: 0,
  activePodId: "local",
  timers: new Set(),
  tickTimer: null,
  wakeLock: null,
  network: {
    role: "solo",
    peer: null,
    hostConn: null,
    roomId: "",
    connections: new Map(),
    pods: [{ id: "local", label: "Host phone", connected: true }],
    message: "Solo"
  }
};

const $ = (id) => document.getElementById(id);

const fields = [
  "activityMode",
  "playerName",
  "durationMode",
  "lightsOutMode",
  "timeLimit",
  "hitTarget",
  "lightTimeout",
  "delayMode",
  "fixedDelay",
  "randomDelayMax",
  "cycles",
  "restSeconds",
  "strikeLimit",
  "sequenceSteps",
  "homeBaseColor",
  "focusTargetColor",
  "distractorCount"
];

function init() {
  buildColorControls();
  bindControls();
  loadPreset(false);
  resetRun();
  renderHistory();
  renderModeOptions();
  renderNetwork();
  autoJoinFromUrl();

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

function buildColorControls() {
  const grid = $("colorGrid");
  const homeSelect = $("homeBaseColor");
  const focusSelect = $("focusTargetColor");
  grid.innerHTML = "";
  homeSelect.innerHTML = "";
  focusSelect.innerHTML = "";

  colors.forEach((color) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "color-toggle";
    button.dataset.color = color.name;
    button.innerHTML = `<span class="color-swatch" style="background:${color.value}"></span>${color.name}`;
    grid.appendChild(button);

    const homeOption = new Option(color.name, color.name);
    const focusOption = new Option(color.name, color.name);
    homeSelect.add(homeOption);
    focusSelect.add(focusOption);
  });
}

function bindControls() {
  fields.forEach((field) => {
    $(field).addEventListener("input", () => {
      state.config = readConfig();
      render();
      renderModeOptions();
    });
  });

  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchTab(tab.dataset.tab));
  });

  $("colorGrid").addEventListener("click", (event) => {
    const button = event.target.closest(".color-toggle");
    if (!button) return;
    const selected = new Set(state.config.enabledColors);
    if (selected.has(button.dataset.color) && selected.size > 1) selected.delete(button.dataset.color);
    else selected.add(button.dataset.color);
    state.config.enabledColors = [...selected];
    render();
  });

  $("startButton").addEventListener("click", startRun);
  $("pauseButton").addEventListener("click", togglePause);
  $("resetButton").addEventListener("click", resetRun);
  $("podButton").addEventListener("click", handleTap);
  $("savePresetButton").addEventListener("click", savePreset);
  $("loadPresetButton").addEventListener("click", () => loadPreset(true));
  $("exportButton").addEventListener("click", exportCsv);
  $("wakeLockButton").addEventListener("click", toggleWakeLock);
  $("hostRoomButton").addEventListener("click", hostRoom);
  $("joinRoomButton").addEventListener("click", () => joinRoom($("joinRoomCode").value.trim()));
  $("leaveRoomButton").addEventListener("click", leaveRoom);
  $("copyRoomLinkButton").addEventListener("click", copyRoomLink);
}

function autoJoinFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("join");
  if (!room) return;
  $("joinRoomCode").value = room;
  switchTab("multi");
  joinRoom(room);
}

function hostRoom() {
  if (!window.Peer) {
    setNetworkMessage("Connection library did not load. Check internet and refresh.");
    return;
  }
  leaveRoom(false);
  const roomId = `phonepod-${Math.random().toString(36).slice(2, 8)}`;
  const peer = new Peer(roomId, { debug: 0 });
  state.network.role = "host";
  state.network.peer = peer;
  state.network.roomId = roomId;
  state.network.pods = [{ id: "local", label: "Host phone", connected: true }];
  setNetworkMessage("Opening room...");

  peer.on("open", () => {
    setNetworkMessage("Hosting");
    renderNetwork();
  });
  peer.on("connection", registerPodConnection);
  peer.on("error", (error) => setNetworkMessage(error.message || "Room error"));
  renderNetwork();
}

function joinRoom(roomId) {
  if (!roomId) {
    setNetworkMessage("Enter a room code first.");
    return;
  }
  if (!window.Peer) {
    setNetworkMessage("Connection library did not load. Check internet and refresh.");
    return;
  }
  leaveRoom(false);
  const peer = new Peer(undefined, { debug: 0 });
  state.network.role = "pod";
  state.network.peer = peer;
  state.network.roomId = roomId;
  setNetworkMessage("Joining...");

  peer.on("open", () => {
    const conn = peer.connect(roomId, {
      label: "phonepod",
      metadata: { label: state.config.playerName || "Pod phone" },
      serialization: "json"
    });
    state.network.hostConn = conn;
    bindPodHostConnection(conn);
  });
  peer.on("error", (error) => setNetworkMessage(error.message || "Join error"));
  switchTab("multi");
  render();
}

function leaveRoom(shouldRender = true) {
  if (state.network.peer) state.network.peer.destroy();
  state.network.connections.forEach((conn) => conn.close());
  state.network = {
    role: "solo",
    peer: null,
    hostConn: null,
    roomId: "",
    connections: new Map(),
    pods: [{ id: "local", label: "Host phone", connected: true }],
    message: "Solo"
  };
  if (shouldRender) render();
}

function registerPodConnection(conn) {
  conn.on("open", () => {
    const label = conn.metadata?.label || `Pod ${state.network.pods.length}`;
    state.network.connections.set(conn.peer, conn);
    upsertPod({ id: conn.peer, label, connected: true });
    conn.send({ type: "welcome", roomId: state.network.roomId, label });
    setNetworkMessage("Hosting");
    renderNetwork();
  });
  conn.on("data", (message) => handleHostMessage(conn, message));
  conn.on("close", () => {
    removePod(conn.peer);
    renderNetwork();
  });
  conn.on("error", () => {
    removePod(conn.peer);
    renderNetwork();
  });
}

function bindPodHostConnection(conn) {
  conn.on("open", () => {
    setNetworkMessage("Connected as pod");
    conn.send({ type: "pod-ready", label: state.config.playerName || "Pod phone" });
    render();
  });
  conn.on("data", handlePodMessage);
  conn.on("close", () => {
    setNetworkMessage("Disconnected");
    resetRun();
  });
  conn.on("error", (error) => setNetworkMessage(error.message || "Connection error"));
}

function handleHostMessage(conn, message) {
  if (!message || typeof message !== "object") return;
  if (message.type === "pod-ready") {
    upsertPod({ id: conn.peer, label: message.label || podLabel(conn.peer), connected: true });
    renderNetwork();
    return;
  }
  if (message.type === "tap") {
    handleRemoteTap(conn.peer, message);
    return;
  }
  if (message.type === "false-tap") {
    state.falseHits += 1;
    render();
  }
}

function handlePodMessage(message) {
  if (!message || typeof message !== "object") return;
  if (message.type === "welcome") {
    setNetworkMessage("Connected as pod");
    return;
  }
  if (message.type === "light") {
    const color = colors.find((item) => item.name === message.colorName) || colors[0];
    state.status = "running";
    state.activeColor = color;
    state.activeKind = message.kind;
    state.activePodId = "local";
    state.activeStartedAt = performance.now();
    state.lightToken = message.token;
    render();
    return;
  }
  if (message.type === "clear") {
    if (message.token === state.lightToken) {
      state.activeColor = null;
      state.status = "idle";
      render();
    }
    return;
  }
  if (message.type === "rest") {
    state.status = "resting";
    state.activeColor = null;
    $("podSubcopy").textContent = `${message.seconds}s`;
    render();
    return;
  }
  if (message.type === "done") {
    state.status = "finished";
    state.activeColor = null;
    render();
    return;
  }
  if (message.type === "idle") {
    state.status = "idle";
    state.activeColor = null;
    render();
  }
}

function handleRemoteTap(peerId, message) {
  if (state.status !== "running" || state.activePodId !== peerId || message.token !== state.lightToken) return;

  if (state.config.activityMode === "focus" && state.activeKind === "distractor") {
    state.falseHits += 1;
    state.strikes += 1;
    sendToPod(peerId, { type: "clear", token: state.lightToken });
    state.activeColor = null;
    state.lightToken += 1;
    if (state.strikes >= state.config.strikeLimit) return finishRun();
    scheduleNextLight();
    render();
    return;
  }

  state.hits += 1;
  state.reactions.push(message.reactionMs || performance.now() - state.activeStartedAt);
  sendToPod(peerId, { type: "clear", token: state.lightToken });
  state.activeColor = null;
  state.lightToken += 1;
  if (shouldEndCycle()) finishCycle();
  else scheduleNextLight();
  render();
}

function handlePodTap() {
  if (state.status !== "running" || !state.activeColor) {
    markWrongTap();
    if (state.network.hostConn?.open) {
      state.network.hostConn.send({ type: "false-tap" });
    }
    return;
  }
  const reactionMs = performance.now() - state.activeStartedAt;
  if (navigator.vibrate) navigator.vibrate(18);
  if (state.network.hostConn?.open) {
    state.network.hostConn.send({ type: "tap", token: state.lightToken, reactionMs });
  }
  state.activeColor = null;
  render();
}

function sendLightToActivePod(token) {
  if (state.activePodId === "local") return;
  sendToPod(state.activePodId, {
    type: "light",
    token,
    colorName: state.activeColor.name,
    kind: state.activeKind
  });
}

function sendToPod(podId, message) {
  if (!podId || podId === "local") return;
  const conn = state.network.connections.get(podId);
  if (conn?.open) conn.send(message);
}

function broadcastToPods(message) {
  state.network.connections.forEach((conn) => {
    if (conn.open) conn.send(message);
  });
}

function pickActivePod() {
  const pods = state.network.role === "host" ? state.network.pods.filter((pod) => pod.connected) : state.network.pods;
  return randomItem(pods.length ? pods : [{ id: "local", label: "Host phone", connected: true }]);
}

function upsertPod(pod) {
  const existing = state.network.pods.findIndex((item) => item.id === pod.id);
  if (existing >= 0) state.network.pods[existing] = { ...state.network.pods[existing], ...pod };
  else state.network.pods.push(pod);
}

function removePod(id) {
  state.network.connections.delete(id);
  state.network.pods = state.network.pods.filter((pod) => pod.id !== id);
  setNetworkMessage("Pod disconnected");
}

function roomLink() {
  if (!state.network.roomId) return "";
  const url = new URL(window.location.href);
  url.search = `?join=${encodeURIComponent(state.network.roomId)}`;
  url.hash = "trainer";
  return url.toString();
}

async function copyRoomLink() {
  const link = roomLink();
  if (!link) {
    setNetworkMessage("Start a room first.");
    return;
  }
  try {
    await navigator.clipboard.writeText(link);
    setNetworkMessage("Join link copied");
  } catch {
    $("roomLink").select();
    setNetworkMessage("Select and copy the join link");
  }
}

function setNetworkMessage(message) {
  state.network.message = message;
  renderNetwork();
}

function readConfig() {
  const next = { ...state.config };
  fields.forEach((field) => {
    const element = $(field);
    next[field] = element.type === "number" ? Number(element.value) : element.value;
  });
  next.timeLimit = clamp(next.timeLimit, 5, 900);
  next.hitTarget = clamp(next.hitTarget, 1, 999);
  next.lightTimeout = clamp(next.lightTimeout, 0.2, 30);
  next.fixedDelay = clamp(next.fixedDelay, 0, 20);
  next.randomDelayMax = clamp(next.randomDelayMax, 0, 20);
  next.cycles = clamp(Math.round(next.cycles), 1, 20);
  next.restSeconds = clamp(next.restSeconds, 0, 300);
  next.strikeLimit = clamp(Math.round(next.strikeLimit), 1, 20);
  next.sequenceSteps = clamp(Math.round(next.sequenceSteps), 2, 24);
  next.distractorCount = clamp(Math.round(next.distractorCount), 1, 4);
  return next;
}

function writeConfig(config) {
  fields.forEach((field) => {
    if ($(field)) $(field).value = config[field];
  });
  state.config = { ...defaults, ...config };
  render();
}

function startRun() {
  state.config = readConfig();
  clearTimers();
  Object.assign(state, {
    status: "running",
    activeColor: null,
    activeKind: "target",
    activePodId: "local",
    lightToken: state.lightToken + 1,
    runStartedAt: performance.now(),
    cycleStartedAt: performance.now(),
    cycle: 1,
    hits: 0,
    misses: 0,
    falseHits: 0,
    strikes: 0,
    reactions: [],
    sequence: [],
    sequenceIndex: 0
  });
  prepareSequence();
  startTicker();
  render();
  scheduleNextLight(250);
}

function togglePause() {
  if (state.status === "running") {
    state.status = "paused";
    state.pausedCycleElapsed = elapsedCycleMs();
    state.activeColor = null;
    state.lightToken += 1;
    clearTimers();
  } else if (state.status === "paused") {
    state.status = "running";
    state.cycleStartedAt = performance.now() - state.pausedCycleElapsed;
    state.pausedCycleElapsed = 0;
    startTicker();
    scheduleNextLight(100);
  }
  render();
}

function resetRun() {
  clearTimers();
  if (state.network.role !== "pod") {
    broadcastToPods({ type: "idle", label: "Ready", subcopy: "Waiting for host." });
  }
  Object.assign(state, {
    status: "idle",
    activeColor: null,
    activeKind: "target",
    activePodId: "local",
    lightToken: state.lightToken + 1,
    cycle: 1,
    hits: 0,
    misses: 0,
    falseHits: 0,
    strikes: 0,
    reactions: [],
    sequence: [],
    sequenceIndex: 0
  });
  render();
}

function scheduleNextLight(delayMs = nextDelayMs()) {
  if (state.status !== "running") return;
  const timer = setTimeout(() => {
    state.timers.delete(timer);
    if (shouldEndCycle()) return finishCycle();
    activateLight();
  }, delayMs);
  state.timers.add(timer);
}

function activateLight() {
  if (state.status !== "running") return;

  const config = state.config;
  let colorName = randomItem(config.enabledColors);
  let kind = "target";

  if (config.activityMode === "focus") {
    const distractors = colors
      .map((color) => color.name)
      .filter((name) => name !== config.focusTargetColor)
      .slice(0, config.distractorCount);
    const showDistractor = Math.random() < 0.38;
    colorName = showDistractor ? randomItem(distractors) : config.focusTargetColor;
    kind = colorName === config.focusTargetColor ? "target" : "distractor";
  }

  if (config.activityMode === "sequence") {
    colorName = state.sequence[state.sequenceIndex % state.sequence.length];
    state.sequenceIndex += 1;
  }

  if (config.activityMode === "homeBase") {
    const shouldGoHome = state.hits % 2 === 1;
    colorName = shouldGoHome ? config.homeBaseColor : randomItem(config.enabledColors.filter((name) => name !== config.homeBaseColor));
    kind = shouldGoHome ? "home" : "target";
  }

  state.activeColor = colors.find((color) => color.name === colorName) || colors[0];
  state.activeKind = kind;
  state.activePodId = pickActivePod().id;
  state.activeStartedAt = performance.now();
  state.lightToken += 1;
  const token = state.lightToken;
  sendLightToActivePod(token);
  render();

  if (config.lightsOutMode !== "hit") {
    const timer = setTimeout(() => {
      state.timers.delete(timer);
      if (state.status !== "running" || !state.activeColor || token !== state.lightToken) return;
      state.misses += state.activeKind === "distractor" ? 0 : 1;
      sendToPod(state.activePodId, { type: "clear", token });
      state.activeColor = null;
      state.lightToken += 1;
      if (shouldEndCycle()) finishCycle();
      else scheduleNextLight();
      render();
    }, config.lightTimeout * 1000);
    state.timers.add(timer);
  }
}

function handleTap() {
  if (state.network.role === "pod") {
    handlePodTap();
    return;
  }

  if (state.status !== "running") return;

  if (state.activePodId !== "local") {
    markWrongTap();
    return;
  }

  if (!state.activeColor) {
    markWrongTap();
    return;
  }

  if (state.config.activityMode === "focus" && state.activeKind === "distractor") {
    state.falseHits += 1;
    state.strikes += 1;
    markWrongTap();
    sendToPod(state.activePodId, { type: "clear", token: state.lightToken });
    state.activeColor = null;
    state.lightToken += 1;
    if (state.strikes >= state.config.strikeLimit) return finishRun();
    scheduleNextLight();
    render();
    return;
  }

  state.hits += 1;
  state.reactions.push(performance.now() - state.activeStartedAt);
  sendToPod(state.activePodId, { type: "clear", token: state.lightToken });
  state.activeColor = null;
  state.lightToken += 1;
  if (navigator.vibrate) navigator.vibrate(18);

  if (shouldEndCycle()) finishCycle();
  else scheduleNextLight();
  render();
}

function markWrongTap() {
  state.falseHits += 1;
  const button = $("podButton");
  button.classList.remove("is-wrong");
  requestAnimationFrame(() => button.classList.add("is-wrong"));
  if (navigator.vibrate) navigator.vibrate([20, 35, 20]);
}

function finishCycle() {
  sendToPod(state.activePodId, { type: "clear", token: state.lightToken });
  state.activeColor = null;
  state.lightToken += 1;
  if (state.cycle >= state.config.cycles) return finishRun();

  state.status = "resting";
  broadcastToPods({ type: "rest", seconds: state.config.restSeconds });
  render();
  const timer = setTimeout(() => {
    state.timers.delete(timer);
    state.cycle += 1;
    state.cycleStartedAt = performance.now();
    state.status = "running";
    prepareSequence();
    broadcastToPods({ type: "idle", label: "Ready", subcopy: "Watch for your color." });
    render();
    scheduleNextLight(250);
  }, state.config.restSeconds * 1000);
  state.timers.add(timer);
}

function finishRun() {
  state.status = "finished";
  clearTimers();
  sendToPod(state.activePodId, { type: "clear", token: state.lightToken });
  state.activeColor = null;
  state.lightToken += 1;
  broadcastToPods({ type: "done", hits: state.hits });
  saveResult();
  render();
  renderHistory();
}

function shouldEndCycle() {
  const config = state.config;
  const hitDone = state.hits >= config.hitTarget;
  const timeDone = elapsedCycleMs() >= config.timeLimit * 1000;
  if (config.durationMode === "hits") return hitDone;
  if (config.durationMode === "timeout") return timeDone;
  return hitDone || timeDone;
}

function elapsedCycleMs() {
  if (!state.cycleStartedAt) return 0;
  return performance.now() - state.cycleStartedAt;
}

function nextDelayMs() {
  const config = state.config;
  if (config.delayMode === "fixed") return config.fixedDelay * 1000;
  if (config.delayMode === "random") return Math.random() * config.randomDelayMax * 1000;
  return 0;
}

function prepareSequence() {
  if (state.config.activityMode !== "sequence") return;
  state.sequence = Array.from({ length: state.config.sequenceSteps }, () => randomItem(state.config.enabledColors));
  state.sequenceIndex = 0;
}

function startTicker() {
  if (state.tickTimer) clearInterval(state.tickTimer);
  state.tickTimer = setInterval(renderStats, 200);
}

function clearTimers() {
  state.timers.forEach((timer) => clearTimeout(timer));
  state.timers.clear();
  if (state.tickTimer) clearInterval(state.tickTimer);
  state.tickTimer = null;
}

function render() {
  renderControls();
  renderStage();
  renderStats();
  renderResults();
  renderNetwork();
}

function renderControls() {
  $("modeTitle").textContent = titleForMode(state.config.activityMode);
  document.querySelectorAll(".color-toggle").forEach((button) => {
    button.classList.toggle("is-selected", state.config.enabledColors.includes(button.dataset.color));
  });
}

function renderStage() {
  const button = $("podButton");
  const label = $("podLabel");
  const subcopy = $("podSubcopy");
  button.className = "pod-screen";

  if (state.status === "running" && state.activeColor && (state.activePodId === "local" || state.network.role === "pod")) {
    const textColor = state.activeColor.name === "Yellow" || state.activeColor.name === "White" ? "#101418" : "#ffffff";
    button.classList.add("is-active");
    button.style.background = state.activeColor.value;
    button.style.color = textColor;
    button.style.setProperty("--active-glow", state.activeColor.value);
    label.textContent = state.activeColor.name;
    subcopy.textContent = state.activeKind === "distractor" ? "Hold" : "Tap";
    return;
  }

  button.style.background = "";
  button.style.color = "";
  button.style.removeProperty("--active-glow");

  if (state.status === "running" && state.activeColor && state.activePodId !== "local") {
    button.classList.add("is-idle");
    label.textContent = podLabel(state.activePodId);
    subcopy.textContent = `${state.activeColor.name} is live on another phone.`;
  } else if (state.status === "resting") {
    button.classList.add("is-resting");
    label.textContent = "Rest";
    subcopy.textContent = `${state.config.restSeconds}s`;
  } else if (state.status === "paused") {
    button.classList.add("is-idle");
    label.textContent = "Paused";
    subcopy.textContent = "Resume when ready.";
  } else if (state.status === "finished") {
    button.classList.add("is-idle");
    label.textContent = "Done";
    subcopy.textContent = `${state.hits} hits`;
  } else {
    button.classList.add("is-idle");
    label.textContent = state.network.role === "pod" ? "Pod ready" : "Ready";
    subcopy.textContent = state.network.role === "pod" ? "Waiting for host." : "Configure, start, tap.";
  }

  $("startButton").disabled = state.network.role === "pod" || state.status === "running" || state.status === "resting";
  $("pauseButton").disabled = state.network.role === "pod" || (state.status !== "running" && state.status !== "paused");
  $("pauseButton").textContent = state.status === "paused" ? "Resume" : "Pause";
}

function renderStats() {
  $("hitCount").textContent = String(state.hits);
  $("avgReaction").textContent = state.reactions.length ? `${Math.round(avg(state.reactions))}ms` : "--";
  $("cycleValue").textContent = `${state.cycle}/${state.config.cycles}`;

  if (state.config.durationMode === "hits") {
    $("remainingValue").textContent = Math.max(0, state.config.hitTarget - state.hits);
  } else {
    const left = Math.max(0, state.config.timeLimit - Math.floor(elapsedCycleMs() / 1000));
    $("remainingValue").textContent = state.status === "idle" ? `${state.config.timeLimit}s` : `${left}s`;
  }
}

function renderResults() {
  const best = state.reactions.length ? `${Math.round(Math.min(...state.reactions))}ms` : "--";
  $("currentResults").innerHTML = `
    <dt>Player</dt><dd>${escapeHtml(state.config.playerName)}</dd>
    <dt>Mode</dt><dd>${titleForMode(state.config.activityMode)}</dd>
    <dt>Hits</dt><dd>${state.hits}</dd>
    <dt>Misses</dt><dd>${state.misses}</dd>
    <dt>False hits</dt><dd>${state.falseHits}</dd>
    <dt>Best reaction</dt><dd>${best}</dd>
  `;
}

function renderModeOptions() {
  $("strikeLimit").closest("label").style.display = state.config.activityMode === "focus" ? "grid" : "none";
  $("sequenceSteps").closest("label").style.display = state.config.activityMode === "sequence" ? "grid" : "none";
}

function renderHistory() {
  const history = getHistory();
  $("historyList").innerHTML = history.length
    ? history
        .slice(0, 10)
        .map((item) => `<li>${escapeHtml(item.player)} - ${escapeHtml(item.mode)} - ${item.hits} hits - ${item.avgReaction || "--"}</li>`)
        .join("")
    : "<li>No runs yet</li>";
}

function renderNetwork() {
  if (!$("networkStatus")) return;
  const roleLabel = {
    solo: "Solo",
    host: "Hosting",
    pod: "Pod"
  }[state.network.role];
  $("networkStatus").textContent = state.network.message || roleLabel;
  $("roomCode").value = state.network.role === "host" ? state.network.roomId : "";
  $("roomLink").value = state.network.role === "host" ? roomLink() : "";
  $("hostRoomButton").disabled = state.network.role === "host";
  $("joinRoomButton").disabled = state.network.role === "host";
  $("copyRoomLinkButton").disabled = state.network.role !== "host";
  $("leaveRoomButton").disabled = state.network.role === "solo";

  const pods = state.network.role === "pod"
    ? [{ id: "local", label: "This phone", connected: state.network.hostConn?.open }]
    : state.network.pods;
  $("podList").innerHTML = pods
    .map((pod) => `<li><span>${escapeHtml(pod.label || podLabel(pod.id))}</span><small>${pod.connected ? "connected" : "offline"}</small></li>`)
    .join("");
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === name));
  document.querySelectorAll(".panel-page").forEach((page) => page.classList.remove("is-active"));
  $(`${name}Panel`).classList.add("is-active");
}

function savePreset() {
  localStorage.setItem("phonepod:preset", JSON.stringify(readConfig()));
}

function loadPreset(showMissing) {
  const saved = localStorage.getItem("phonepod:preset");
  if (!saved) {
    writeConfig(defaults);
    if (showMissing) window.alert("No saved preset yet.");
    return;
  }
  writeConfig(JSON.parse(saved));
}

function saveResult() {
  const result = {
    date: new Date().toISOString(),
    player: state.config.playerName,
    mode: titleForMode(state.config.activityMode),
    hits: state.hits,
    misses: state.misses,
    falseHits: state.falseHits,
    avgReaction: state.reactions.length ? `${Math.round(avg(state.reactions))}ms` : "",
    bestReaction: state.reactions.length ? `${Math.round(Math.min(...state.reactions))}ms` : ""
  };
  const history = [result, ...getHistory()].slice(0, 50);
  localStorage.setItem("phonepod:history", JSON.stringify(history));
}

function getHistory() {
  return JSON.parse(localStorage.getItem("phonepod:history") || "[]");
}

function exportCsv() {
  const rows = getHistory();
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "phonepod-results.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function toggleWakeLock() {
  if (!("wakeLock" in navigator)) return;
  try {
    if (state.wakeLock) {
      await state.wakeLock.release();
      state.wakeLock = null;
      $("wakeLockButton").textContent = "Awake";
    } else {
      state.wakeLock = await navigator.wakeLock.request("screen");
      $("wakeLockButton").textContent = "Awake on";
      state.wakeLock.addEventListener("release", () => {
        state.wakeLock = null;
        $("wakeLockButton").textContent = "Awake";
      });
    }
  } catch {
    $("wakeLockButton").textContent = "Unavailable";
  }
}

function titleForMode(mode) {
  return {
    random: "Random Reaction",
    focus: "Focus",
    sequence: "Sequence",
    homeBase: "Home Base"
  }[mode];
}

function podLabel(id) {
  if (id === "local") return "Host phone";
  const pod = state.network.pods.find((item) => item.id === id);
  return pod?.label || "Pod phone";
}

function randomItem(items) {
  return items[Math.floor(Math.random() * items.length)] || colors[0].name;
}

function avg(items) {
  return items.reduce((sum, value) => sum + value, 0) / items.length;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[char]));
}

init();
