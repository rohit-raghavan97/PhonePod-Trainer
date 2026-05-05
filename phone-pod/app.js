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
  timers: new Set(),
  tickTimer: null,
  wakeLock: null
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
  Object.assign(state, {
    status: "idle",
    activeColor: null,
    activeKind: "target",
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
  state.activeStartedAt = performance.now();
  state.lightToken += 1;
  const token = state.lightToken;
  render();

  if (config.lightsOutMode !== "hit") {
    const timer = setTimeout(() => {
      state.timers.delete(timer);
      if (state.status !== "running" || !state.activeColor || token !== state.lightToken) return;
      state.misses += state.activeKind === "distractor" ? 0 : 1;
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
  if (state.status !== "running") return;

  if (!state.activeColor) {
    markWrongTap();
    return;
  }

  if (state.config.activityMode === "focus" && state.activeKind === "distractor") {
    state.falseHits += 1;
    state.strikes += 1;
    markWrongTap();
    state.activeColor = null;
    state.lightToken += 1;
    if (state.strikes >= state.config.strikeLimit) return finishRun();
    scheduleNextLight();
    render();
    return;
  }

  state.hits += 1;
  state.reactions.push(performance.now() - state.activeStartedAt);
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
  state.activeColor = null;
  state.lightToken += 1;
  if (state.cycle >= state.config.cycles) return finishRun();

  state.status = "resting";
  render();
  const timer = setTimeout(() => {
    state.timers.delete(timer);
    state.cycle += 1;
    state.cycleStartedAt = performance.now();
    state.status = "running";
    prepareSequence();
    render();
    scheduleNextLight(250);
  }, state.config.restSeconds * 1000);
  state.timers.add(timer);
}

function finishRun() {
  state.status = "finished";
  clearTimers();
  state.activeColor = null;
  state.lightToken += 1;
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

  if (state.status === "running" && state.activeColor) {
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

  if (state.status === "resting") {
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
    label.textContent = "Ready";
    subcopy.textContent = "Configure, start, tap.";
  }

  $("startButton").disabled = state.status === "running" || state.status === "resting";
  $("pauseButton").disabled = state.status !== "running" && state.status !== "paused";
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
