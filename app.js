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
  presetId: "custom",
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

const defaultPresets = [
  {
    id: "random-sprint",
    type: "default",
    name: "Random Sprint",
    description: "30-second speed test with quick lights.",
    config: { ...defaults, presetId: "random-sprint", activityMode: "random", durationMode: "timeout", timeLimit: 30, lightTimeout: 1.5, delayMode: "random", randomDelayMax: 0.8, cycles: 1, restSeconds: 20 }
  },
  {
    id: "focus-filter",
    type: "default",
    name: "Focus Filter",
    description: "Tap green only and avoid distractors.",
    config: { ...defaults, presetId: "focus-filter", activityMode: "focus", durationMode: "both", timeLimit: 45, hitTarget: 18, lightTimeout: 1.8, focusTargetColor: "Green", distractorCount: 3, strikeLimit: 3, cycles: 1, restSeconds: 20 }
  },
  {
    id: "sequence-ladder",
    type: "default",
    name: "Sequence Ladder",
    description: "Six-step sequence for rhythm and recall.",
    config: { ...defaults, presetId: "sequence-ladder", activityMode: "sequence", durationMode: "hits", hitTarget: 18, sequenceSteps: 6, lightTimeout: 2.2, delayMode: "fixed", fixedDelay: 0.25, cycles: 1, restSeconds: 20 }
  },
  {
    id: "home-base-shuttle",
    type: "default",
    name: "Home Base Shuttle",
    description: "Return to green between each task prompt.",
    config: { ...defaults, presetId: "home-base-shuttle", activityMode: "homeBase", durationMode: "timeout", timeLimit: 60, lightTimeout: 2, delayMode: "random", randomDelayMax: 0.8, homeBaseColor: "Green", cycles: 1, restSeconds: 20 }
  }
];

const storageKeys = {
  user: "reflex:user",
  players: "reflex:players",
  customPresets: "reflex:customPresets",
  history: "reflex:history"
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
  countdownValue: 0,
  restEndsAt: 0,
  lastSummary: null,
  selectedResultId: null,
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
  user: null,
  players: [],
  customPresets: [],
  network: {
    role: "solo",
    peer: null,
    hostConn: null,
    roomId: "",
    connections: new Map(),
    pods: [{ id: "local", label: "This device", connected: true }],
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
  loadAppData();
  buildColorControls();
  bindControls();
  loadPreset(false);
  renderPlayers();
  resetRun();
  renderHistory();
  renderModeOptions();
  renderNetwork();
  renderPresets();
  renderLeaderboards();
  renderProfile();
  showRegistrationIfNeeded();
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
      if (field !== "playerName") state.config.presetId = "custom";
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
  $("loadPresetButton").addEventListener("click", openPresetPicker);
  $("exportButton").addEventListener("click", exportCsv);
  $("wakeLockButton").addEventListener("click", toggleWakeLock);
  $("hostRoomButton").addEventListener("click", hostRoom);
  $("homeHostButton").addEventListener("click", () => {
    showPage("play");
    switchTab("multi");
    hostRoom();
  });
  $("joinRoomButton").addEventListener("click", () => joinRoom($("joinRoomCode").value.trim()));
  $("leaveRoomButton").addEventListener("click", leaveRoom);
  $("copyRoomLinkButton").addEventListener("click", copyRoomLink);
  document.querySelectorAll(".nav-button[data-page]").forEach((button) => {
    button.addEventListener("click", () => showPage(button.dataset.page));
  });
  $("registrationForm").addEventListener("submit", saveRegistration);
  $("profileForm").addEventListener("submit", saveProfile);
  $("openPlayerButton").addEventListener("click", openPlayerDialog);
  $("profileAddPlayerButton").addEventListener("click", openPlayerDialog);
  $("cancelPlayerButton").addEventListener("click", () => $("playerDialog").close());
  $("playerForm").addEventListener("submit", savePlayer);
  $("closePresetDialogButton").addEventListener("click", () => $("presetDialog").close());
  $("savePresetButton").addEventListener("click", openSavePresetDialog);
  $("cancelCustomPresetButton").addEventListener("click", () => $("savePresetDialog").close());
  $("customPresetForm").addEventListener("submit", saveCustomPreset);
  $("historyList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-result-id]");
    if (button) selectResult(button.dataset.resultId);
  });
}

function showPage(page) {
  document.querySelectorAll(".app-page").forEach((section) => section.classList.toggle("is-active", section.id === `${page}Page`));
  document.querySelectorAll(".nav-button[data-page]").forEach((button) => button.classList.toggle("is-active", button.dataset.page === page));
  if (page === "results") {
    renderHistory();
    renderResultDetail();
  }
  if (page === "leaderboards") renderLeaderboards();
}

function autoJoinFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("join");
  if (!room) return;
  $("joinRoomCode").value = room;
  showPage("play");
  switchTab("multi");
  joinRoom(room);
}

function loadAppData() {
  state.user = JSON.parse(localStorage.getItem(storageKeys.user) || "null");
  state.players = JSON.parse(localStorage.getItem(storageKeys.players) || "[]");
  state.customPresets = JSON.parse(localStorage.getItem(storageKeys.customPresets) || "[]");
  if (state.user && !state.players.length) {
    state.players = [{ id: uid("player"), name: state.user.fullName, note: "Primary" }];
    savePlayers();
  }
}

function savePlayers() {
  localStorage.setItem(storageKeys.players, JSON.stringify(state.players));
}

function saveCustomPresets() {
  localStorage.setItem(storageKeys.customPresets, JSON.stringify(state.customPresets));
}

function showRegistrationIfNeeded() {
  if (!state.user) $("registrationDialog").showModal();
}

function saveRegistration(event) {
  event.preventDefault();
  const fullName = $("registrationName").value.trim();
  if (!fullName) return;
  state.user = { fullName };
  localStorage.setItem(storageKeys.user, JSON.stringify(state.user));
  state.players = [{ id: uid("player"), name: fullName, note: "Primary" }];
  savePlayers();
  $("registrationDialog").close();
  renderPlayers();
  renderProfile();
}

function saveProfile(event) {
  event.preventDefault();
  const fullName = $("profileName").value.trim();
  if (!fullName) return;
  const previous = state.user?.fullName;
  state.user = { fullName };
  localStorage.setItem(storageKeys.user, JSON.stringify(state.user));
  if (previous && state.players[0]?.name === previous) {
    state.players[0].name = fullName;
    savePlayers();
  }
  $("profileStatus").textContent = "Profile saved.";
  renderPlayers();
  renderProfile();
  renderNetwork();
}

function openPlayerDialog() {
  $("newPlayerName").value = "";
  $("newPlayerNote").value = "";
  $("playerDialog").showModal();
}

function savePlayer(event) {
  event.preventDefault();
  const name = $("newPlayerName").value.trim();
  if (!name) return;
  state.players.push({ id: uid("player"), name, note: $("newPlayerNote").value.trim() });
  savePlayers();
  $("playerDialog").close();
  renderPlayers();
}

function renderPlayers() {
  const selected = $("playerName")?.value || state.config.playerName;
  if ($("playerName")) {
    $("playerName").innerHTML = "";
    state.players.forEach((player) => $("playerName").add(new Option(player.name, player.name)));
    if (!state.players.length) $("playerName").add(new Option("Player 1", "Player 1"));
    $("playerName").value = state.players.some((player) => player.name === selected) ? selected : $("playerName").options[0]?.value;
    state.config.playerName = $("playerName").value || defaults.playerName;
  }
  const html = state.players.length
    ? state.players.map((player) => `<article class="player-card"><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.note || "Player")}</span></article>`).join("")
    : `<p class="panel-copy">No players yet.</p>`;
  if ($("playerList")) $("playerList").innerHTML = html;
  if ($("profilePlayerList")) $("profilePlayerList").innerHTML = html;
}

function renderProfile() {
  if ($("profileName")) $("profileName").value = state.user?.fullName || "";
}

function hostRoom() {
  if (!window.Peer) {
    setNetworkMessage("Connection library did not load. Check internet and refresh.");
    return;
  }
  leaveRoom(false);
  const roomId = `reflex-${Math.random().toString(36).slice(2, 8)}`;
  const peer = new Peer(roomId, { debug: 0 });
  state.network.role = "host";
  state.network.peer = peer;
  state.network.roomId = roomId;
  state.network.pods = [{ id: "local", label: deviceLabel(), connected: true }];
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
      label: "reflex",
      metadata: { label: deviceLabel() },
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
    pods: [{ id: "local", label: deviceLabel(), connected: true }],
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
    conn.send({ type: "pod-ready", label: deviceLabel() });
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
  if (message.type === "fullscreen") {
    document.body.classList.add("is-playing");
    enterFullscreen();
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
  if (message.type === "countdown") {
    state.status = "countdown";
    state.countdownValue = message.value;
    state.activeColor = null;
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
    state.restEndsAt = performance.now() + message.seconds * 1000;
    state.activeColor = null;
    render();
    return;
  }
  if (message.type === "done") {
    state.status = "finished";
    document.body.classList.remove("is-playing");
    state.activeColor = null;
    state.lastSummary = message.summary || null;
    render();
    return;
  }
  if (message.type === "idle") {
    state.status = "idle";
    document.body.classList.remove("is-playing");
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
  return randomItem(pods.length ? pods : [{ id: "local", label: deviceLabel(), connected: true }]);
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
  enterFullscreen();
  document.body.classList.add("is-playing");
  broadcastToPods({ type: "fullscreen" });
  Object.assign(state, {
    status: "countdown",
    activeColor: null,
    activeKind: "target",
    activePodId: "local",
    lightToken: state.lightToken + 1,
    runStartedAt: 0,
    cycleStartedAt: 0,
    countdownValue: 3,
    restEndsAt: 0,
    lastSummary: null,
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
  broadcastToPods({ type: "countdown", value: state.countdownValue });
  render();
  runCountdown(() => beginCycle(1));
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

function runCountdown(onComplete) {
  if (state.status !== "countdown") return;
  const timer = setTimeout(() => {
    state.timers.delete(timer);
    state.countdownValue -= 1;
    if (state.countdownValue <= 0) {
      broadcastToPods({ type: "idle", label: "Go", subcopy: "Watch for your color." });
      onComplete();
      return;
    }
    broadcastToPods({ type: "countdown", value: state.countdownValue });
    render();
    runCountdown(onComplete);
  }, 1000);
  state.timers.add(timer);
}

function beginCycle(cycleNumber) {
  state.cycle = cycleNumber;
  state.cycleStartedAt = performance.now();
  if (!state.runStartedAt) state.runStartedAt = state.cycleStartedAt;
  state.status = "running";
  state.restEndsAt = 0;
  prepareSequence();
  render();
  scheduleNextLight(250);
}

function resetRun() {
  clearTimers();
  document.body.classList.remove("is-playing");
  if (state.network.role !== "pod") {
    broadcastToPods({ type: "idle", label: "Ready", subcopy: "Waiting for host." });
  }
  Object.assign(state, {
    status: "idle",
    activeColor: null,
    activeKind: "target",
    activePodId: "local",
    lightToken: state.lightToken + 1,
    countdownValue: 0,
    restEndsAt: 0,
    lastSummary: null,
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
  state.restEndsAt = performance.now() + state.config.restSeconds * 1000;
  broadcastToPods({ type: "rest", seconds: state.config.restSeconds });
  render();
  const timer = setTimeout(() => {
    state.timers.delete(timer);
    broadcastToPods({ type: "idle", label: "Ready", subcopy: "Watch for your color." });
    beginCycle(state.cycle + 1);
  }, state.config.restSeconds * 1000);
  state.timers.add(timer);
}

function finishRun() {
  state.status = "finished";
  clearTimers();
  document.body.classList.remove("is-playing");
  sendToPod(state.activePodId, { type: "clear", token: state.lightToken });
  state.activeColor = null;
  state.lightToken += 1;
  state.restEndsAt = 0;
  state.countdownValue = 0;
  state.lastSummary = buildSummary();
  broadcastToPods({ type: "done", hits: state.hits, summary: state.lastSummary });
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
  state.tickTimer = setInterval(() => {
    renderStats();
    if (state.status === "resting") renderStage();
  }, 200);
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

  if (state.status === "countdown") {
    button.classList.add("is-resting");
    label.textContent = String(state.countdownValue || 3);
    subcopy.textContent = "Get ready";
  } else if (state.status === "running" && state.activeColor && (state.activePodId === "local" || state.network.role === "pod")) {
    const textColor = state.activeColor.name === "Yellow" || state.activeColor.name === "White" ? "#101418" : "#ffffff";
    button.classList.add("is-active");
    button.style.background = state.activeColor.value;
    button.style.color = textColor;
    button.style.setProperty("--active-glow", state.activeColor.value);
    label.textContent = state.activeColor.name;
    subcopy.textContent = state.activeKind === "distractor" ? "Hold" : "Tap";
  } else {
    button.style.background = "";
    button.style.color = "";
    button.style.removeProperty("--active-glow");
  }

  if (state.status === "countdown") {
    // Countdown state is rendered above.
  } else if (state.status === "running" && state.activeColor && state.activePodId !== "local" && state.network.role !== "pod") {
    button.classList.add("is-idle");
    label.textContent = podLabel(state.activePodId);
    subcopy.textContent = `${state.activeColor.name} is live on another phone.`;
  } else if (state.status === "resting") {
    button.classList.add("is-resting");
    label.textContent = "Rest";
    subcopy.textContent = `${restSecondsLeft()}s until next cycle`;
  } else if (state.status === "paused") {
    button.classList.add("is-idle");
    label.textContent = "Paused";
    subcopy.textContent = "Resume when ready.";
  } else if (state.status === "finished") {
    button.classList.add("is-idle");
    label.textContent = "Done";
    subcopy.textContent = summaryLine();
  } else {
    button.classList.add("is-idle");
    label.textContent = state.network.role === "pod" ? "Pod ready" : "Ready";
    subcopy.textContent = state.network.role === "pod" ? "Waiting for host." : "Configure, start, tap.";
  }

  renderStageSummary();

  $("startButton").disabled = state.network.role === "pod" || state.status === "countdown" || state.status === "running" || state.status === "resting";
  $("pauseButton").disabled = state.network.role === "pod" || (state.status !== "running" && state.status !== "paused");
  $("pauseButton").textContent = state.status === "paused" ? "Resume" : "Pause";
}

function renderStats() {
  $("hitCount").textContent = String(state.hits);
  $("avgReaction").textContent = state.reactions.length ? `${Math.round(avg(state.reactions))}ms` : "--";
  $("cycleValue").textContent = `${state.cycle}/${state.config.cycles}`;

  if (state.status === "countdown") {
    $("remainingValue").textContent = `${state.countdownValue || 3}s`;
  } else if (state.status === "resting") {
    $("remainingValue").textContent = `${restSecondsLeft()}s`;
  } else if (state.config.durationMode === "hits") {
    $("remainingValue").textContent = Math.max(0, state.config.hitTarget - state.hits);
  } else {
    const left = Math.max(0, state.config.timeLimit - Math.floor(elapsedCycleMs() / 1000));
    $("remainingValue").textContent = state.status === "idle" || state.status === "finished" ? `${state.config.timeLimit}s` : `${left}s`;
  }
}

function renderResults() {
  const currentResults = document.getElementById("currentResults");
  if (!currentResults) return;
  const best = state.reactions.length ? `${Math.round(Math.min(...state.reactions))}ms` : "--";
  const summary = state.lastSummary || buildSummary();
  currentResults.innerHTML = `
    <dt>Player</dt><dd>${escapeHtml(state.config.playerName)}</dd>
    <dt>Mode</dt><dd>${titleForMode(state.config.activityMode)}</dd>
    <dt>Hits</dt><dd>${state.hits}</dd>
    <dt>Misses</dt><dd>${state.misses}</dd>
    <dt>False hits</dt><dd>${state.falseHits}</dd>
    <dt>Accuracy</dt><dd>${summary.accuracy}</dd>
    <dt>Best reaction</dt><dd>${best}</dd>
  `;
}

function renderStageSummary() {
  const summaryEl = $("stageSummary");
  if (!summaryEl) return;
  if (state.status !== "finished" || !state.lastSummary) {
    summaryEl.classList.remove("is-visible");
    summaryEl.innerHTML = "";
    return;
  }
  const summary = state.lastSummary;
  summaryEl.classList.add("is-visible");
  summaryEl.innerHTML = `
    <h2>Round summary</h2>
    <div class="summary-stat"><strong>${summary.hits}</strong><span>Hits</span></div>
    <div class="summary-stat"><strong>${summary.avgReaction}</strong><span>Avg reaction</span></div>
    <div class="summary-stat"><strong>${summary.bestReaction}</strong><span>Best reaction</span></div>
    <div class="summary-stat"><strong>${summary.accuracy}</strong><span>Accuracy</span></div>
  `;
}

function renderModeOptions() {
  $("strikeLimit").closest("label").style.display = state.config.activityMode === "focus" ? "grid" : "none";
  $("sequenceSteps").closest("label").style.display = state.config.activityMode === "sequence" ? "grid" : "none";
}

function renderHistory() {
  const history = getHistory();
  if (!$("historyList")) return;
  if (!state.selectedResultId && history.length) state.selectedResultId = history[0].id;
  $("historyList").innerHTML = history.length
    ? history.map((item) => `
      <button class="result-row ${item.id === state.selectedResultId ? "is-selected" : ""}" data-result-id="${item.id}" type="button">
        <strong>${escapeHtml(item.player)}</strong>
        <span>${escapeHtml(item.presetName || item.mode)} - ${item.hits} hits - ${item.avgReaction || "--"}</span>
        <small>${new Date(item.date).toLocaleString()}</small>
      </button>
    `).join("")
    : "<p class=\"panel-copy\">No attempts yet.</p>";
  renderResultDetail();
}

function selectResult(id) {
  state.selectedResultId = id;
  renderHistory();
}

function renderResultDetail() {
  if (!$("resultDetail")) return;
  const result = getHistory().find((item) => item.id === state.selectedResultId);
  if (!result) {
    $("resultDetail").innerHTML = "<p class=\"panel-copy\">Select an attempt to see detailed analytics.</p>";
    return;
  }
  const config = result.config || {};
  $("resultDetail").innerHTML = `
    <div class="detail-hero">
      <h2>${escapeHtml(result.presetName || result.mode)}</h2>
      <p>${escapeHtml(result.player)} - ${new Date(result.date).toLocaleString()}</p>
    </div>
    <div class="detail-stats">
      <div><strong>${result.hits}</strong><span>Hits</span></div>
      <div><strong>${result.misses}</strong><span>Misses</span></div>
      <div><strong>${result.falseHits}</strong><span>False hits</span></div>
      <div><strong>${result.accuracy || "--"}</strong><span>Accuracy</span></div>
      <div><strong>${result.avgReaction || "--"}</strong><span>Avg reaction</span></div>
      <div><strong>${result.bestReaction || "--"}</strong><span>Best reaction</span></div>
    </div>
    <h3>Configuration</h3>
    <dl>
      <dt>Mode</dt><dd>${escapeHtml(titleForMode(config.activityMode) || result.mode)}</dd>
      <dt>Duration</dt><dd>${escapeHtml(config.durationMode || "--")}</dd>
      <dt>Time limit</dt><dd>${config.timeLimit || "--"}s</dd>
      <dt>Hit target</dt><dd>${config.hitTarget || "--"}</dd>
      <dt>Light timeout</dt><dd>${config.lightTimeout || "--"}s</dd>
      <dt>Delay</dt><dd>${escapeHtml(config.delayMode || "--")}</dd>
      <dt>Cycles</dt><dd>${config.cycles || "--"}</dd>
      <dt>Leaderboard</dt><dd>${result.leaderboardEligible ? "Eligible" : "Custom game"}</dd>
    </dl>
  `;
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

function renderLeaderboards() {
  if (!$("leaderboardGrid")) return;
  const history = getHistory().filter((result) => result.leaderboardEligible);
  $("leaderboardGrid").innerHTML = defaultPresets.map((preset) => {
    const rows = history
      .filter((result) => result.presetId === preset.id)
      .sort((a, b) => parseMs(a.avgReaction) - parseMs(b.avgReaction))
      .slice(0, 5);
    return `
      <article class="home-panel">
        <h2>${escapeHtml(preset.name)}</h2>
        <p class="panel-copy">${escapeHtml(preset.description)}</p>
        <ol class="leaderboard-list">
          ${rows.length ? rows.map((row, index) => `<li><strong>${index + 1}. ${escapeHtml(row.player)}</strong><span>${row.avgReaction || "--"} avg - ${row.hits} hits</span></li>`).join("") : "<li><span>No attempts yet</span></li>"}
        </ol>
      </article>
    `;
  }).join("");
}

function switchTab(name) {
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("is-active", tab.dataset.tab === name));
  document.querySelectorAll(".panel-page").forEach((page) => page.classList.remove("is-active"));
  $(`${name}Panel`).classList.add("is-active");
}

function loadPreset() {
  writeConfig(defaults);
}

function openPresetPicker() {
  renderPresets();
  $("presetDialog").showModal();
}

function renderPresets() {
  const allPresets = [...defaultPresets, ...state.customPresets];
  const cards = allPresets.map((preset) => presetCard(preset)).join("");
  if ($("presetPicker")) $("presetPicker").innerHTML = cards;
  if ($("homePresetList")) $("homePresetList").innerHTML = defaultPresets.map((preset) => presetCard(preset, true)).join("");
  document.querySelectorAll("[data-load-preset]").forEach((button) => {
    button.onclick = () => applyPreset(button.dataset.loadPreset);
  });
  document.querySelectorAll("[data-edit-preset]").forEach((button) => {
    button.onclick = () => editCustomPreset(button.dataset.editPreset);
  });
  document.querySelectorAll("[data-delete-preset]").forEach((button) => {
    button.onclick = () => deleteCustomPreset(button.dataset.deletePreset);
  });
}

function presetCard(preset, compact = false) {
  const config = preset.config;
  const meta = `${titleForMode(config.activityMode)} - ${config.durationMode} - ${config.durationMode === "hits" ? `${config.hitTarget} hits` : `${config.timeLimit}s`}`;
  const customActions = preset.type === "custom" && !compact
    ? `<button class="text-button" data-edit-preset="${preset.id}" type="button">Edit</button><button class="text-button danger-text" data-delete-preset="${preset.id}" type="button">Delete</button>`
    : "";
  return `
    <article class="preset-card">
      <div>
        <strong>${escapeHtml(preset.name)}</strong>
        <span>${escapeHtml(preset.description || meta)}</span>
        <small>${escapeHtml(meta)}</small>
      </div>
      <div class="preset-actions">
        <button class="secondary-button compact-button" data-load-preset="${preset.id}" type="button">Use</button>
        ${customActions}
      </div>
    </article>
  `;
}

function applyPreset(id) {
  const preset = [...defaultPresets, ...state.customPresets].find((item) => item.id === id);
  if (!preset) return;
  const playerName = $("playerName")?.value || state.config.playerName;
  writeConfig({ ...preset.config, playerName });
  if ($("presetDialog").open) $("presetDialog").close();
  showPage("play");
  setPresetStatus(`${preset.name} loaded.`);
}

function openSavePresetDialog() {
  $("editingPresetId").value = "";
  $("customPresetName").value = "";
  $("savePresetDialog").showModal();
}

function saveCustomPreset(event) {
  event.preventDefault();
  const id = $("editingPresetId").value || uid("preset");
  const name = $("customPresetName").value.trim();
  if (!name) return;
  const config = { ...readConfig(), presetId: id };
  const existing = state.customPresets.findIndex((preset) => preset.id === id);
  const preset = { id, type: "custom", name, description: "Custom game", config };
  if (existing >= 0) state.customPresets[existing] = preset;
  else state.customPresets.push(preset);
  saveCustomPresets();
  state.config.presetId = id;
  $("savePresetDialog").close();
  setPresetStatus(`${name} saved.`);
  renderPresets();
}

function editCustomPreset(id) {
  const preset = state.customPresets.find((item) => item.id === id);
  if (!preset) return;
  writeConfig(preset.config);
  $("presetDialog").close();
  $("editingPresetId").value = preset.id;
  $("customPresetName").value = preset.name;
  $("savePresetDialog").showModal();
}

function deleteCustomPreset(id) {
  state.customPresets = state.customPresets.filter((preset) => preset.id !== id);
  saveCustomPresets();
  renderPresets();
  setPresetStatus("Custom preset deleted.");
}

function setPresetStatus(message) {
  if (!$("presetStatus")) return;
  $("presetStatus").textContent = message;
  setTimeout(() => {
    if ($("presetStatus").textContent === message) $("presetStatus").textContent = "";
  }, 2400);
}

function saveResult() {
  const summary = state.lastSummary || buildSummary();
  const preset = defaultPresets.find((item) => item.id === state.config.presetId) || state.customPresets.find((item) => item.id === state.config.presetId);
  const result = {
    id: uid("result"),
    date: new Date().toISOString(),
    player: state.config.playerName,
    mode: titleForMode(state.config.activityMode),
    presetId: state.config.presetId || "custom",
    presetName: preset?.name || "Custom game",
    leaderboardEligible: defaultPresets.some((item) => item.id === state.config.presetId),
    hits: state.hits,
    misses: state.misses,
    falseHits: state.falseHits,
    accuracy: summary.accuracy,
    avgReaction: summary.avgReaction === "--" ? "" : summary.avgReaction,
    bestReaction: summary.bestReaction === "--" ? "" : summary.bestReaction,
    totalTime: summary.totalTime,
    config: { ...state.config }
  };
  const history = [result, ...getHistory()].slice(0, 50);
  state.selectedResultId = result.id;
  localStorage.setItem(storageKeys.history, JSON.stringify(history));
}

function getHistory() {
  return JSON.parse(localStorage.getItem(storageKeys.history) || "[]");
}

function buildSummary() {
  const attempts = state.hits + state.misses + state.falseHits;
  const accuracy = attempts ? `${Math.round((state.hits / attempts) * 100)}%` : "--";
  return {
    hits: state.hits,
    misses: state.misses,
    falseHits: state.falseHits,
    accuracy,
    avgReaction: state.reactions.length ? `${Math.round(avg(state.reactions))}ms` : "--",
    bestReaction: state.reactions.length ? `${Math.round(Math.min(...state.reactions))}ms` : "--",
    totalTime: state.runStartedAt ? `${Math.round((performance.now() - state.runStartedAt) / 1000)}s` : "--"
  };
}

function summaryLine() {
  const summary = state.lastSummary || buildSummary();
  return `${summary.hits} hits - ${summary.avgReaction} avg - ${summary.accuracy} accuracy`;
}

function restSecondsLeft() {
  if (!state.restEndsAt) return state.config.restSeconds;
  return Math.max(0, Math.ceil((state.restEndsAt - performance.now()) / 1000));
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
  link.download = "reflex-results.csv";
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

function enterFullscreen() {
  const target = $("playPage") || document.documentElement;
  if (document.fullscreenElement || !target.requestFullscreen) return;
  target.requestFullscreen().catch(() => {});
}

function podLabel(id) {
  if (id === "local") return deviceLabel();
  const pod = state.network.pods.find((item) => item.id === id);
  return pod?.label || "Device";
}

function deviceLabel() {
  const name = state.user?.fullName || "This";
  return `${name}'s device`;
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

function uid(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseMs(value) {
  const parsed = Number(String(value || "").replace("ms", ""));
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function csvCell(value) {
  const text = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
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
