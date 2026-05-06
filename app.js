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
  deviceId: "reflex:deviceId",
  players: "reflex:players",
  customPresets: "reflex:customPresets",
  history: "reflex:history"
};

const backendTables = {
  appUsers: "app_users",
  players: "players",
  customPresets: "custom_presets",
  results: "results"
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
  lastReactionMs: null,
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
  deviceId: "",
  players: [],
  customPresets: [],
  history: [],
  selectedPresetId: "",
  selectedPlayerId: "",
  adminStats: null,
  adminLoading: false,
  currentPage: "home",
  isHandlingPopState: false,
  editingPresetId: null,
  editingPresetName: "",
  backend: {
    client: null,
    ready: false,
    message: "Local device storage"
  },
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

function normalizeName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

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

async function init() {
  await loadAppData();
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
  syncInitialRoute();
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
  $("gamePauseButton").addEventListener("click", togglePause);
  $("resetButton").addEventListener("click", resetRun);
  $("gameResetButton").addEventListener("click", resetRun);
  $("podButton").addEventListener("click", handleTap);
  $("loadPresetButton").addEventListener("click", openPresetPicker);
  $("exportButton").addEventListener("click", exportCsv);
  $("wakeLockButton").addEventListener("click", toggleWakeLock);
  $("menuToggle").addEventListener("click", toggleMenu);
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
    button.addEventListener("click", () => {
      showPage(button.dataset.page);
      closeMenu();
    });
  });
  $("registrationForm").addEventListener("submit", saveRegistration);
  $("profileForm").addEventListener("submit", saveProfile);
  $("openPlayerButton").addEventListener("click", openPlayerDialog);
  $("playersAddPlayerButton").addEventListener("click", openPlayerDialog);
  $("refreshAdminButton").addEventListener("click", () => refreshAdminStats(true));
  $("playerList").addEventListener("click", (event) => {
    const card = event.target.closest("[data-player-id]");
    if (card) openPlayerProfile(card.dataset.playerId);
  });
  $("cancelPlayerButton").addEventListener("click", () => $("playerDialog").close());
  $("playerForm").addEventListener("submit", savePlayer);
  $("savePresetButton").addEventListener("click", openSavePresetDialog);
  $("backToPresetsButton").addEventListener("click", () => showPage("presets"));
  $("presetDetailForm").addEventListener("click", (event) => {
    const button = event.target.closest("[data-apply-detail-preset]");
    if (button) applyPreset(button.dataset.applyDetailPreset);
  });
  $("presetDetailForm").addEventListener("submit", saveCustomPreset);
  $("historyList").addEventListener("click", (event) => {
    const button = event.target.closest("[data-result-id]");
    if (button) selectResult(button.dataset.resultId);
  });
  window.addEventListener("popstate", (event) => {
    state.isHandlingPopState = true;
    showPage(event.state?.page || "home", { push: false });
    state.isHandlingPopState = false;
  });
}

function showPage(page, options = {}) {
  const shouldPush = options.push !== false && !state.isHandlingPopState;
  document.querySelectorAll(".app-page").forEach((section) => section.classList.toggle("is-active", section.id === `${page}Page`));
  document.querySelectorAll(".nav-button[data-page]").forEach((button) => button.classList.toggle("is-active", button.dataset.page === page));
  if (page !== state.currentPage && shouldPush) {
    window.history.pushState({ page }, "", `#${page}`);
  }
  state.currentPage = page;
  if (page === "results") {
    renderHistory();
    renderResultDetail();
  }
  if (page === "players") renderPlayers();
  if (page === "playerProfile") renderPlayerProfile();
  if (page === "admin") renderAdmin();
  if (page === "leaderboards") renderLeaderboards();
  if (page === "presets") renderPresets();
  if (page === "presetDetail" && state.selectedPresetId) renderPresetDetail();
}

function syncInitialRoute() {
  const hashPage = window.location.hash.replace("#", "");
  const page = hashPage && $(`${hashPage}Page`) ? hashPage : "home";
  window.history.replaceState({ page }, "", page === "home" ? window.location.pathname + window.location.search : `#${page}`);
  if (page !== "home") showPage(page, { push: false });
}

function toggleMenu() {
  const isOpen = document.body.classList.toggle("menu-open");
  $("menuToggle").setAttribute("aria-expanded", String(isOpen));
}

function closeMenu() {
  document.body.classList.remove("menu-open");
  $("menuToggle").setAttribute("aria-expanded", "false");
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

async function loadAppData() {
  state.user = JSON.parse(localStorage.getItem(storageKeys.user) || "null");
  state.deviceId = localStorage.getItem(storageKeys.deviceId) || uid("device");
  localStorage.setItem(storageKeys.deviceId, state.deviceId);
  state.players = JSON.parse(localStorage.getItem(storageKeys.players) || "[]");
  state.customPresets = JSON.parse(localStorage.getItem(storageKeys.customPresets) || "[]");
  state.history = JSON.parse(localStorage.getItem(storageKeys.history) || "[]");
  state.backend.client = createBackendClient();
  if (state.backend.client) {
    await loadSharedData();
  }
  if (state.user && !state.players.length) {
    state.players = [{ id: uid("player"), name: state.user.fullName, note: "Primary" }];
    savePlayers();
  }
  if (state.user) trackAppUser().catch(() => {});
}

function createBackendClient() {
  const config = window.REFLEX_SUPABASE_CONFIG || {};
  if (!config.url || !config.anonKey || !window.supabase?.createClient) return null;
  return window.supabase.createClient(config.url, config.anonKey);
}

async function loadSharedData() {
  try {
    const localPlayers = [...state.players];
    const localPresets = [...state.customPresets];
    const localHistory = [...state.history];
    const [players, presets, results] = await Promise.all([
      state.backend.client.from(backendTables.players).select("id,name,note").order("name", { ascending: true }),
      state.backend.client.from(backendTables.customPresets).select("id,name,description,config").order("name", { ascending: true }),
      state.backend.client.from(backendTables.results).select("*").order("date", { ascending: false }).limit(100)
    ]);
    if (players.error || presets.error || results.error) throw players.error || presets.error || results.error;
    state.players = mergePlayers(players.data || [], localPlayers);
    state.customPresets = mergePresets((presets.data || []).map(rowToPreset), localPresets);
    state.history = mergeResults((results.data || []).map(rowToResult), localHistory);
    state.backend.ready = true;
    state.backend.message = "Shared Supabase storage";
    state.backend.lastSyncedAt = new Date().toISOString();
    cacheLocalData();
    syncSharedData().catch(() => {});
    refreshAdminStats(false).catch(() => {});
  } catch {
    state.backend.ready = false;
    state.backend.message = "Using local storage. Check Supabase config.";
  }
}

function cacheLocalData() {
  localStorage.setItem(storageKeys.players, JSON.stringify(state.players));
  localStorage.setItem(storageKeys.customPresets, JSON.stringify(state.customPresets));
  localStorage.setItem(storageKeys.history, JSON.stringify(state.history));
}

async function savePlayers() {
  localStorage.setItem(storageKeys.players, JSON.stringify(state.players));
  if (!state.backend.ready) return;
  const { error } = await state.backend.client.from(backendTables.players).upsert(state.players, { onConflict: "id" });
  if (error) throw error;
}

async function saveCustomPresets() {
  localStorage.setItem(storageKeys.customPresets, JSON.stringify(state.customPresets));
  if (!state.backend.ready) return;
  const { error } = await state.backend.client.from(backendTables.customPresets).upsert(state.customPresets.map(presetToRow), { onConflict: "id" });
  if (error) throw error;
}

async function syncSharedData() {
  if (!state.backend.ready) return;
  await Promise.all([
    state.players.length ? state.backend.client.from(backendTables.players).upsert(state.players, { onConflict: "id" }) : Promise.resolve(),
    state.customPresets.length ? state.backend.client.from(backendTables.customPresets).upsert(state.customPresets.map(presetToRow), { onConflict: "id" }) : Promise.resolve(),
    state.history.length ? state.backend.client.from(backendTables.results).upsert(state.history.map(resultToRow), { onConflict: "id" }) : Promise.resolve()
  ]);
  state.backend.lastSyncedAt = new Date().toISOString();
}

async function refreshAdminStats(force = false) {
  if (!state.backend.ready || state.adminLoading || (state.adminStats && !force)) return;
  state.adminLoading = true;
  try {
    const [players, presets, results, users] = await Promise.all([
      state.backend.client.from(backendTables.players).select("id", { count: "exact", head: true }),
      state.backend.client.from(backendTables.customPresets).select("id", { count: "exact", head: true }),
      state.backend.client.from(backendTables.results).select("id,date,player,preset_name", { count: "exact" }).order("date", { ascending: false }).limit(5),
      state.backend.client.rpc("get_reflex_admin_summary")
    ]);
    state.adminStats = {
      players: players.count ?? state.players.length,
      presets: presets.count ?? state.customPresets.length,
      results: results.count ?? state.history.length,
      recentResults: results.data || [],
      registeredUsers: users.error ? "Run v1.18 SQL" : users.data?.registeredUsers ?? users.data?.registered_users ?? "--",
      recentUsers: users.data?.recentUsers ?? users.data?.recent_users ?? "--",
      lastSeen: users.data?.lastSeen || users.data?.last_seen || ""
    };
  } catch {
    state.adminStats = {
      players: state.players.length,
      presets: state.customPresets.length,
      results: state.history.length,
      recentResults: state.history.slice(0, 5).map(resultToRow),
      registeredUsers: "Run v1.18 SQL",
      recentUsers: "--",
      lastSeen: ""
    };
  } finally {
    state.adminLoading = false;
    renderAdmin();
  }
}

async function trackAppUser() {
  if (!state.backend.ready || !state.user?.fullName || !state.deviceId) return;
  await state.backend.client.from(backendTables.appUsers).upsert({
    device_id: state.deviceId,
    full_name: state.user.fullName,
    last_seen_at: new Date().toISOString()
  }, { onConflict: "device_id" });
}

function showRegistrationIfNeeded() {
  if (!state.user) $("registrationDialog").showModal();
}

async function saveRegistration(event) {
  event.preventDefault();
  const fullName = $("registrationName").value.trim();
  if (!fullName) return;
  state.user = { fullName };
  localStorage.setItem(storageKeys.user, JSON.stringify(state.user));
  await trackAppUser().catch(() => {});
  if (!state.players.some((player) => normalizeName(player.name) === normalizeName(fullName))) {
    state.players.push({ id: uid("player"), name: fullName, note: "Primary" });
  }
  await savePlayers().catch(() => {});
  $("registrationDialog").close();
  renderPlayers();
  renderProfile();
}

async function saveProfile(event) {
  event.preventDefault();
  const fullName = $("profileName").value.trim();
  if (!fullName) return;
  const previous = state.user?.fullName;
  state.user = { fullName };
  localStorage.setItem(storageKeys.user, JSON.stringify(state.user));
  await trackAppUser().catch(() => {});
  if (previous && state.players[0]?.name === previous) {
    state.players[0].name = fullName;
    await savePlayers().catch(() => {});
  }
  $("profileStatus").textContent = "Profile saved.";
  renderPlayers();
  renderProfile();
  renderNetwork();
}

function openPlayerDialog() {
  $("newPlayerName").value = "";
  $("newPlayerNote").value = "";
  $("playerStatus").textContent = "";
  $("playerDialog").showModal();
}

async function savePlayer(event) {
  event.preventDefault();
  const name = cleanName($("newPlayerName").value);
  if (!name) return;
  const duplicate = state.players.some((player) => normalizeName(player.name) === normalizeName(name));
  if (duplicate) {
    $("playerStatus").textContent = `${name} already exists. Choose the existing player or change the name.`;
    return;
  }
  const player = { id: uid("player"), name, note: $("newPlayerNote").value.trim() };
  state.players.push(player);
  try {
    await savePlayers();
  } catch {
    state.players = state.players.filter((item) => item.id !== player.id);
    $("playerStatus").textContent = `${name} could not be saved. It may already exist globally.`;
    return;
  }
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
  const sortedPlayers = [...state.players].sort((a, b) => a.name.localeCompare(b.name));
  const html = sortedPlayers.length
    ? sortedPlayers.map((player) => `<button class="player-card selectable-card" data-player-id="${player.id}" type="button"><strong>${escapeHtml(player.name)}</strong><span>${escapeHtml(player.note || "Player")}</span></button>`).join("")
    : `<p class="panel-copy">No players yet.</p>`;
  if ($("playerList")) $("playerList").innerHTML = html;
}

function openPlayerProfile(id) {
  state.selectedPlayerId = id;
  renderPlayerProfile();
  showPage("playerProfile");
}

function renderPlayerProfile() {
  if (!$("playerProfileContent")) return;
  const player = state.players.find((item) => item.id === state.selectedPlayerId) || state.players[0];
  if (!player) {
    $("playerProfileTitle").textContent = "Player insights";
    $("playerProfileContent").innerHTML = `<p class="panel-copy">Add a player and complete attempts to see insights.</p>`;
    return;
  }
  state.selectedPlayerId = player.id;
  $("playerProfileTitle").textContent = player.name;
  const attempts = getHistory().filter((item) => normalizeName(item.player) === normalizeName(player.name));
  if (!attempts.length) {
    $("playerProfileContent").innerHTML = `
      <section class="player-hero-panel">
        <div><p class="eyebrow">No attempts yet</p><h2>${escapeHtml(player.name)}</h2><p>${escapeHtml(player.note || "Player")}</p></div>
        <div class="player-score-orb"><strong>--</strong><span>Score</span></div>
      </section>
      <section class="home-panel"><p class="panel-copy">Once this player completes a drill, this page will show trends, strengths, weaknesses, and recent performance.</p></section>
    `;
    return;
  }
  const profile = playerProfileAnalytics(player, attempts);
  $("playerProfileContent").innerHTML = `
    <section class="player-hero-panel">
      <div>
        <p class="eyebrow">${attempts.length} attempts tracked</p>
        <h2>${escapeHtml(player.name)}</h2>
        <p>${escapeHtml(profile.headline)}</p>
      </div>
      <div class="player-score-orb"><strong>${profile.bestScore}</strong><span>Best score</span></div>
    </section>
    <section class="player-stat-grid">
      <article><strong>${profile.avgScore}</strong><span>Avg score</span></article>
      <article><strong>${profile.avgReaction}</strong><span>Avg reaction</span></article>
      <article><strong>${profile.accuracy}</strong><span>Avg accuracy</span></article>
      <article><strong>${profile.bestPreset}</strong><span>Best preset</span></article>
    </section>
    <section class="profile-grid-wide">
      <article class="home-panel">
        <h2>Improvement trend</h2>
        ${renderTrendChart(profile.trend)}
        <p class="panel-copy">${escapeHtml(profile.trendInsight)}</p>
      </article>
      <article class="home-panel">
        <h2>Strengths and weaknesses</h2>
        <div class="insight-list">
          ${profile.insights.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}
        </div>
      </article>
    </section>
    <section class="profile-grid-wide">
      <article class="home-panel">
        <h2>Preset performance</h2>
        <div class="preset-performance-list">${profile.presets.map((preset) => `
          <div>
            <strong>${escapeHtml(preset.name)}</strong>
            <span>${preset.score}/100 avg - ${preset.count} attempts</span>
            <progress value="${preset.score}" max="100"></progress>
          </div>
        `).join("")}</div>
      </article>
      <article class="home-panel">
        <h2>Recent attempts</h2>
        <div class="compact-list">${attempts.slice(0, 5).map((attempt) => `
          <button class="result-row" data-result-id="${attempt.id}" type="button">
            <strong>${escapeHtml(attempt.presetName || attempt.mode)} <span>${attemptScore(attempt)}</span></strong>
            <small>${attempt.avgReaction || "--"} avg - ${attempt.accuracy || "--"} - ${new Date(attempt.date).toLocaleDateString()}</small>
          </button>
        `).join("")}</div>
      </article>
    </section>
  `;
  $("playerProfileContent").querySelectorAll("[data-result-id]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedResultId = button.dataset.resultId;
      showPage("results");
    });
  });
}

function renderAdmin() {
  if (!$("adminContent")) return;
  if (!state.adminStats && state.backend.ready) refreshAdminStats(false);
  const stats = state.adminStats || {};
  const pendingLocal = state.history.length;
  $("adminContent").innerHTML = `
    <section class="player-stat-grid">
      <article><strong>${state.backend.ready ? "Online" : "Local"}</strong><span>Storage mode</span></article>
      <article><strong>${stats.registeredUsers ?? "--"}</strong><span>Registered devices</span></article>
      <article><strong>${stats.results ?? state.history.length}</strong><span>Cloud attempts</span></article>
      <article><strong>${formatAdminDate(state.backend.lastSyncedAt)}</strong><span>Last sync</span></article>
    </section>
    <section class="profile-grid-wide">
      <article class="home-panel">
        <h2>Sync health</h2>
        <dl>
          <dt>Status</dt><dd>${escapeHtml(state.backend.message)}</dd>
          <dt>Local attempts</dt><dd>${pendingLocal}</dd>
          <dt>Players</dt><dd>${stats.players ?? state.players.length}</dd>
          <dt>Custom presets</dt><dd>${stats.presets ?? state.customPresets.length}</dd>
          <dt>Active this week</dt><dd>${stats.recentUsers ?? "--"}</dd>
          <dt>Last user seen</dt><dd>${formatAdminDate(stats.lastSeen)}</dd>
        </dl>
      </article>
      <article class="home-panel">
        <h2>Recent activity</h2>
        <div class="compact-list">
          ${(stats.recentResults || []).length ? (stats.recentResults || []).map((row) => `
            <div class="admin-activity-row">
              <strong>${escapeHtml(row.player || "--")}</strong>
              <span>${escapeHtml(row.preset_name || "Attempt")} - ${formatAdminDate(row.date)}</span>
            </div>
          `).join("") : `<p class="panel-copy">No cloud attempts yet.</p>`}
        </div>
      </article>
    </section>
  `;
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
    exitFullscreen();
    state.activeColor = null;
    state.lastSummary = message.summary || null;
    render();
    return;
  }
  if (message.type === "idle") {
    state.status = "idle";
    document.body.classList.remove("is-playing");
    exitFullscreen();
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
  state.lastReactionMs = message.reactionMs || performance.now() - state.activeStartedAt;
  state.reactions.push(state.lastReactionMs);
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
  showPage("play");
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
    lastReactionMs: null,
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
  exitFullscreen();
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
    lastReactionMs: null,
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
  state.lastReactionMs = performance.now() - state.activeStartedAt;
  state.reactions.push(state.lastReactionMs);
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
  exitFullscreen();
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
  showPage("results");
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
  renderResultsOverview();
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
  $("pauseButton").textContent = state.status === "paused" ? "Play" : "Pause";
  $("gamePauseButton").textContent = state.status === "paused" ? "Play" : "Pause";
}

function renderStats() {
  $("hitCount").textContent = String(state.hits);
  $("missCount").textContent = String(state.misses);
  $("lastReaction").textContent = state.lastReactionMs ? `${Math.round(state.lastReactionMs)}ms` : "--";
  $("avgReaction").textContent = state.reactions.length ? `${Math.round(avg(state.reactions))}ms` : "--";
  $("bestReaction").textContent = state.reactions.length ? `${Math.round(Math.min(...state.reactions))}ms` : "--";
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
        <strong>${escapeHtml(item.player)} <span>${attemptScore(item)}</span></strong>
        <span>${escapeHtml(item.presetName || item.mode)} - ${item.hits} hits - ${item.accuracy || "--"} accuracy</span>
        <small>${item.avgReaction || "--"} avg - ${item.bestReaction || "--"} best</small>
        <small>${new Date(item.date).toLocaleString()}</small>
      </button>
    `).join("")
    : "<p class=\"panel-copy\">No attempts yet.</p>";
  renderResultsOverview();
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
  const analytics = attemptAnalytics(result);
  const insights = attemptInsights(result, analytics);
  $("resultDetail").innerHTML = `
    <div class="detail-hero">
      <h2>${escapeHtml(result.presetName || result.mode)}</h2>
      <p>${escapeHtml(result.player)} - ${new Date(result.date).toLocaleString()}</p>
      <strong class="attempt-score">${attemptScore(result)}</strong>
    </div>
    <div class="detail-stats">
      <div><strong>${result.hits}</strong><span>Hits</span></div>
      <div><strong>${result.misses}</strong><span>Misses</span></div>
      <div><strong>${result.falseHits}</strong><span>False hits</span></div>
      <div><strong>${result.accuracy || "--"}</strong><span>Accuracy</span></div>
      <div><strong>${result.avgReaction || "--"}</strong><span>Avg reaction</span></div>
      <div><strong>${result.bestReaction || "--"}</strong><span>Best reaction</span></div>
      <div><strong>${analytics.consistency}</strong><span>Consistency</span></div>
      <div><strong>${analytics.falseRate}</strong><span>False hit rate</span></div>
      <div><strong>${analytics.pace}</strong><span>Attempt pace</span></div>
    </div>
    <h3>Coach insights</h3>
    <div class="insight-list">${insights.map((item) => `<p>${escapeHtml(item)}</p>`).join("")}</div>
    <h3>Configuration</h3>
    <dl>
      <dt>Mode</dt><dd>${escapeHtml(titleForMode(config.activityMode) || result.mode)}</dd>
      <dt>Duration</dt><dd>${escapeHtml(config.durationMode || "--")}</dd>
      <dt>Time limit</dt><dd>${config.timeLimit || "--"}s</dd>
      <dt>Hit target</dt><dd>${config.hitTarget || "--"}</dd>
      <dt>Light timeout</dt><dd>${config.lightTimeout || "--"}s</dd>
      <dt>Delay</dt><dd>${escapeHtml(config.delayMode || "--")}</dd>
      <dt>Cycles</dt><dd>${config.cycles || "--"}</dd>
      <dt>Colors</dt><dd>${escapeHtml((config.enabledColors || []).join(", ") || "--")}</dd>
      <dt>Leaderboard</dt><dd>${result.leaderboardEligible ? "Eligible" : "Unsaved custom run"}</dd>
    </dl>
  `;
}

function renderResultsOverview() {
  if (!$("resultsOverview")) return;
  const history = getHistory();
  const players = new Set(history.map((item) => item.player)).size;
  const best = [...history].sort((a, b) => attemptScoreValue(b) - attemptScoreValue(a))[0];
  $("resultsOverview").innerHTML = `
    <article><strong>${history.length}</strong><span>Total attempts</span></article>
    <article><strong>${players}</strong><span>Players tested</span></article>
    <article><strong>${best ? attemptScore(best) : "--"}</strong><span>Best score</span></article>
    <article><strong>${best ? escapeHtml(best.player) : "--"}</strong><span>Top performer</span></article>
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
  const presets = [...defaultPresets, ...state.customPresets].filter((preset) => history.some((result) => result.presetId === preset.id));
  $("leaderboardGrid").innerHTML = (presets.length ? presets : [...defaultPresets, ...state.customPresets]).map((preset) => {
    const rows = history
      .filter((result) => result.presetId === preset.id)
      .sort((a, b) => attemptScoreValue(b) - attemptScoreValue(a))
      .slice(0, 5);
    return `
      <article class="home-panel">
        <h2>${escapeHtml(preset.name)}</h2>
        <p class="panel-copy">${escapeHtml(preset.description)}</p>
        <ol class="leaderboard-list">
          ${rows.length ? rows.map((row, index) => `<li><strong>${index + 1}. ${escapeHtml(row.player)}</strong><span>${attemptScore(row)} - ${row.avgReaction || "--"} avg - ${row.accuracy || "--"}</span></li>`).join("") : "<li><span>No attempts yet</span></li>"}
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
  showPage("presets");
}

function renderPresets() {
  const allPresets = [...defaultPresets, ...state.customPresets];
  const cards = allPresets.map((preset) => presetCard(preset)).join("");
  if ($("presetPageList")) $("presetPageList").innerHTML = cards;
  document.querySelectorAll("[data-open-preset]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      openPresetDetail(button.dataset.openPreset);
    };
  });
  document.querySelectorAll("[data-load-preset]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      applyPreset(button.dataset.loadPreset);
    };
  });
  document.querySelectorAll("[data-delete-preset]").forEach((button) => {
    button.onclick = (event) => {
      event.stopPropagation();
      deleteCustomPreset(button.dataset.deletePreset);
    };
  });
}

function presetCard(preset, compact = false) {
  const config = preset.config;
  const keyConfigs = presetKeyConfigs(config);
  const colorDots = config.enabledColors.map((name) => {
    const color = colors.find((item) => item.name === name);
    return `<span class="mini-swatch" title="${escapeHtml(name)}" style="background:${color?.value || "#fff"}"></span><span>${escapeHtml(name)}</span>`;
  }).join("");
  const deleteAction = preset.type === "custom" && !compact
    ? `<button class="text-button danger-text" data-delete-preset="${preset.id}" type="button">Delete</button>`
    : "";
  return `
    <article class="preset-card selectable-card" data-open-preset="${preset.id}" role="button" tabindex="0">
      <div class="preset-card-main">
        <strong class="preset-card-title">${escapeHtml(preset.name)}</strong>
        <span class="preset-card-description">${escapeHtml(preset.description || "Custom game")}</span>
        <div class="preset-key-configs">${keyConfigs.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>
        <div class="mini-swatch-row" aria-label="Preset colors">${colorDots}</div>
      </div>
      <div class="preset-actions">
        <button class="secondary-button compact-button" data-open-preset="${preset.id}" type="button">Details</button>
        ${deleteAction}
      </div>
    </article>
  `;
}

function presetKeyConfigs(config) {
  return [
    titleForMode(config.activityMode),
    config.durationMode === "hits" ? `${config.hitTarget} hits` : `${config.timeLimit}s limit`,
    config.delayMode === "random" ? `Random delay ${config.randomDelayMax}s` : config.delayMode === "fixed" ? `Fixed delay ${config.fixedDelay}s` : "No delay"
  ];
}

function openPresetDetail(id) {
  state.selectedPresetId = id;
  renderPresetDetail();
  showPage("presetDetail");
}

function renderPresetDetail() {
  const preset = getPresetById(state.selectedPresetId) || defaultPresets[0];
  if (!preset) return;
  state.selectedPresetId = preset.id;
  const editable = preset.type === "custom";
  $("presetDetailType").textContent = editable ? "Custom preset" : "Default preset";
  $("presetDetailTitle").textContent = preset.name;
  $("presetDetailLock").textContent = editable ? "Editable" : "Locked";
  $("presetDetailForm").innerHTML = presetDetailForm(preset, editable);
  $("presetDetailColors").innerHTML = colors.map((color) => {
    const selected = preset.config.enabledColors.includes(color.name);
    return `
      <label class="preset-color-choice ${selected ? "is-selected" : ""}">
        <input data-preset-color="${color.name}" type="checkbox" ${selected ? "checked" : ""} ${editable ? "" : "disabled"} />
        <span class="color-swatch" style="background:${color.value}"></span>
        ${color.name}
      </label>
    `;
  }).join("");
  $("presetColorMeta").innerHTML = `
    <dt>Home base</dt><dd>${escapeHtml(preset.config.homeBaseColor)}</dd>
    <dt>Focus target</dt><dd>${escapeHtml(preset.config.focusTargetColor)}</dd>
    <dt>Distractors</dt><dd>${preset.config.distractorCount}</dd>
  `;
  $("presetDetailStatus").textContent = "";
}

function presetDetailForm(preset, editable) {
  const disabled = editable ? "" : "disabled";
  const config = preset.config;
  return `
    <input type="hidden" id="detailPresetId" value="${escapeHtml(preset.id)}" />
    <label>Preset name <input id="detailPresetName" value="${escapeHtml(preset.name)}" ${disabled} required /></label>
    <label>Description <textarea id="detailPresetDescription" ${disabled} placeholder="What this test is used for">${escapeHtml(preset.description || "")}</textarea></label>
    <label>Activity ${detailSelect("detailActivityMode", config.activityMode, [
      ["random", "Random Reaction"], ["focus", "Focus"], ["sequence", "Sequence"], ["homeBase", "Home Base"]
    ], disabled)}</label>
    <div class="two-col">
      <label>Duration ${detailSelect("detailDurationMode", config.durationMode, [["timeout", "Timeout"], ["hits", "Hit target"], ["both", "Hit or timeout"]], disabled)}</label>
      <label>Lights out ${detailSelect("detailLightsOutMode", config.lightsOutMode, [["hit", "Hit"], ["timeout", "Timeout"], ["both", "Hit or timeout"]], disabled)}</label>
    </div>
    <div class="two-col">
      <label>Time limit <input id="detailTimeLimit" type="number" min="5" max="900" value="${config.timeLimit}" ${disabled} /></label>
      <label>Hit target <input id="detailHitTarget" type="number" min="1" max="999" value="${config.hitTarget}" ${disabled} /></label>
    </div>
    <div class="two-col">
      <label>Light timeout <input id="detailLightTimeout" type="number" min="0.2" max="30" step="0.1" value="${config.lightTimeout}" ${disabled} /></label>
      <label>Delay ${detailSelect("detailDelayMode", config.delayMode, [["none", "None"], ["fixed", "Fixed"], ["random", "Random"]], disabled)}</label>
    </div>
    <div class="two-col">
      <label>Fixed delay <input id="detailFixedDelay" type="number" min="0" max="20" step="0.1" value="${config.fixedDelay}" ${disabled} /></label>
      <label>Random delay max <input id="detailRandomDelayMax" type="number" min="0" max="20" step="0.1" value="${config.randomDelayMax}" ${disabled} /></label>
    </div>
    <div class="two-col">
      <label>Cycles <input id="detailCycles" type="number" min="1" max="20" value="${config.cycles}" ${disabled} /></label>
      <label>Rest seconds <input id="detailRestSeconds" type="number" min="0" max="300" value="${config.restSeconds}" ${disabled} /></label>
    </div>
    <div class="two-col">
      <label>Focus strikes <input id="detailStrikeLimit" type="number" min="1" max="20" value="${config.strikeLimit}" ${disabled} /></label>
      <label>Sequence steps <input id="detailSequenceSteps" type="number" min="2" max="24" value="${config.sequenceSteps}" ${disabled} /></label>
    </div>
    <div class="two-col">
      <label>Home base ${detailSelect("detailHomeBaseColor", config.homeBaseColor, colors.map((color) => [color.name, color.name]), disabled)}</label>
      <label>Focus target ${detailSelect("detailFocusTargetColor", config.focusTargetColor, colors.map((color) => [color.name, color.name]), disabled)}</label>
    </div>
    <label>Distracting colors ${detailSelect("detailDistractorCount", String(config.distractorCount), [["1", "1 color"], ["2", "2 colors"], ["3", "3 colors"], ["4", "4 colors"]], disabled)}</label>
    <div class="form-actions">
      <button class="primary-button" data-apply-detail-preset="${preset.id}" type="button">Use preset</button>
      ${editable ? `<button class="secondary-button" type="submit">Save changes</button>` : ""}
    </div>
  `;
}

function detailSelect(id, value, options, disabled) {
  return `<select id="${id}" ${disabled}>${options.map(([optionValue, label]) => `<option value="${optionValue}" ${String(value) === String(optionValue) ? "selected" : ""}>${label}</option>`).join("")}</select>`;
}

function applyPreset(id) {
  const preset = getPresetById(id);
  if (!preset) return;
  const playerName = $("playerName")?.value || state.config.playerName;
  writeConfig({ ...preset.config, playerName });
  clearPresetEditState();
  showPage("play");
  setPresetStatus(`${preset.name} loaded.`);
}

function openSavePresetDialog() {
  state.selectedPresetId = "";
  showPage("presetDetail");
  renderNewPresetDetail();
}

async function saveCustomPreset(event) {
  event.preventDefault();
  const id = $("detailPresetId").value || uid("preset");
  const name = cleanName($("detailPresetName").value);
  if (!name) return;
  const config = readPresetDetailConfig(id);
  if (!config) return;
  const existing = state.customPresets.findIndex((preset) => preset.id === id);
  const duplicate = findDuplicatePreset(name, config, id);
  if (duplicate) {
    $("presetDetailStatus").textContent = duplicate;
    return;
  }
  const previousPresets = [...state.customPresets];
  const preset = { id, type: "custom", name, description: $("detailPresetDescription").value.trim() || "Custom game", config };
  if (existing >= 0) state.customPresets[existing] = preset;
  else state.customPresets.push(preset);
  try {
    await saveCustomPresets();
  } catch {
    state.customPresets = previousPresets;
    localStorage.setItem(storageKeys.customPresets, JSON.stringify(state.customPresets));
    setPresetStatus(`${name} could not be saved globally. Try again.`);
    return;
  }
  state.config.presetId = id;
  clearPresetEditState();
  state.selectedPresetId = id;
  renderPresets();
  renderPresetDetail();
  $("presetDetailStatus").textContent = existing >= 0 ? `${name} updated.` : `${name} saved.`;
}

function renderNewPresetDetail() {
  const id = uid("preset");
  state.selectedPresetId = id;
  const preset = { id, type: "custom", name: "", description: "Custom game", config: { ...readConfig(), presetId: id } };
  $("presetDetailType").textContent = "New custom preset";
  $("presetDetailTitle").textContent = "Save custom preset";
  $("presetDetailLock").textContent = "Editable";
  $("presetDetailForm").innerHTML = presetDetailForm(preset, true);
  $("presetDetailColors").innerHTML = colors.map((color) => {
    const selected = preset.config.enabledColors.includes(color.name);
    return `<label class="preset-color-choice ${selected ? "is-selected" : ""}"><input data-preset-color="${color.name}" type="checkbox" ${selected ? "checked" : ""} /><span class="color-swatch" style="background:${color.value}"></span>${color.name}</label>`;
  }).join("");
  $("presetColorMeta").innerHTML = "";
  $("presetDetailStatus").textContent = "";
}

async function deleteCustomPreset(id) {
  state.customPresets = state.customPresets.filter((preset) => preset.id !== id);
  if (state.editingPresetId === id) clearPresetEditState();
  localStorage.setItem(storageKeys.customPresets, JSON.stringify(state.customPresets));
  if (state.backend.ready) {
    await state.backend.client.from(backendTables.customPresets).delete().eq("id", id);
  }
  renderPresets();
  setPresetStatus("Custom preset deleted.");
}

function clearPresetEditState() {
  state.editingPresetId = null;
  state.editingPresetName = "";
  if ($("savePresetButton")) $("savePresetButton").textContent = "Save custom preset";
}

function getPresetById(id) {
  return [...defaultPresets, ...state.customPresets].find((item) => item.id === id);
}

function readPresetDetailConfig(id) {
  const enabledColors = [...document.querySelectorAll("[data-preset-color]:checked")].map((input) => input.dataset.presetColor);
  if (!enabledColors.length) {
    $("presetDetailStatus").textContent = "Choose at least one active color.";
    return null;
  }
  return {
    ...defaults,
    presetId: id,
    activityMode: $("detailActivityMode").value,
    playerName: state.config.playerName,
    durationMode: $("detailDurationMode").value,
    lightsOutMode: $("detailLightsOutMode").value,
    timeLimit: clamp(Number($("detailTimeLimit").value), 5, 900),
    hitTarget: clamp(Number($("detailHitTarget").value), 1, 999),
    lightTimeout: clamp(Number($("detailLightTimeout").value), 0.2, 30),
    delayMode: $("detailDelayMode").value,
    fixedDelay: clamp(Number($("detailFixedDelay").value), 0, 20),
    randomDelayMax: clamp(Number($("detailRandomDelayMax").value), 0, 20),
    cycles: clamp(Math.round(Number($("detailCycles").value)), 1, 20),
    restSeconds: clamp(Number($("detailRestSeconds").value), 0, 300),
    strikeLimit: clamp(Math.round(Number($("detailStrikeLimit").value)), 1, 20),
    sequenceSteps: clamp(Math.round(Number($("detailSequenceSteps").value)), 2, 24),
    homeBaseColor: $("detailHomeBaseColor").value,
    focusTargetColor: $("detailFocusTargetColor").value,
    distractorCount: clamp(Math.round(Number($("detailDistractorCount").value)), 1, 4),
    enabledColors
  };
}

function findDuplicatePreset(name, config, currentId) {
  const allPresets = [...defaultPresets, ...state.customPresets].filter((preset) => preset.id !== currentId);
  if (allPresets.some((preset) => normalizeName(preset.name) === normalizeName(name))) {
    return `${name} already exists. Choose a different preset name.`;
  }
  const signature = presetConfigSignature(config);
  const match = allPresets.find((preset) => presetConfigSignature(preset.config) === signature);
  return match ? `This setup already matches ${match.name}. Change at least one rule or color.` : "";
}

function presetConfigSignature(config) {
  const comparable = { ...config };
  delete comparable.presetId;
  delete comparable.playerName;
  comparable.enabledColors = [...(comparable.enabledColors || [])].sort();
  return JSON.stringify(Object.keys(comparable).sort().reduce((acc, key) => {
    acc[key] = comparable[key];
    return acc;
  }, {}));
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
    score: 0,
    hits: state.hits,
    misses: state.misses,
    falseHits: state.falseHits,
    accuracy: summary.accuracy,
    avgReaction: summary.avgReaction === "--" ? "" : summary.avgReaction,
    bestReaction: summary.bestReaction === "--" ? "" : summary.bestReaction,
    totalTime: summary.totalTime,
    config: { ...state.config }
  };
  result.leaderboardEligible = Boolean(preset && state.config.presetId && state.config.presetId !== "custom");
  result.score = attemptScoreValue(result);
  const history = [result, ...getHistory()].slice(0, 100);
  state.history = history;
  state.selectedResultId = result.id;
  localStorage.setItem(storageKeys.history, JSON.stringify(history));
  if (state.backend.ready) {
    state.backend.client
      .from(backendTables.results)
      .upsert(resultToRow(result), { onConflict: "id" })
      .then(({ error }) => {
        if (error) state.backend.message = "Result saved locally. Cloud sync will retry on next open.";
      });
  }
}

function getHistory() {
  return state.history.length ? state.history : JSON.parse(localStorage.getItem(storageKeys.history) || "[]");
}

function attemptScore(result) {
  const score = result.score || attemptScoreValue(result);
  return Number.isFinite(score) && score > 0 ? `${score}/100` : "--";
}

function attemptScoreValue(result) {
  const accuracy = parsePercent(result.accuracy);
  const avgReaction = parseMs(result.avgReaction);
  const bestReaction = parseMs(result.bestReaction);
  const attempts = (result.hits || 0) + (result.misses || 0) + (result.falseHits || 0);
  if (!attempts || avgReaction === Number.MAX_SAFE_INTEGER) return 0;
  const speedScore = clamp(Math.round(100 - ((avgReaction - 250) / 750) * 100), 0, 100);
  const bestScore = bestReaction === Number.MAX_SAFE_INTEGER ? speedScore : clamp(Math.round(100 - ((bestReaction - 180) / 620) * 100), 0, 100);
  const volumeScore = clamp(Math.round(((result.hits || 0) / Math.max(1, result.config?.hitTarget || result.hits || 1)) * 100), 0, 100);
  const falsePenalty = clamp((result.falseHits || 0) * 6, 0, 30);
  const mode = result.config?.activityMode || "";
  if (mode === "focus") {
    return clamp(Math.round(accuracy * 0.46 + speedScore * 0.26 + volumeScore * 0.16 + bestScore * 0.12 - falsePenalty * 1.5), 0, 100);
  }
  if (mode === "sequence") {
    return clamp(Math.round(volumeScore * 0.34 + accuracy * 0.28 + speedScore * 0.24 + bestScore * 0.14 - falsePenalty), 0, 100);
  }
  if (mode === "homeBase") {
    return clamp(Math.round(speedScore * 0.36 + accuracy * 0.3 + volumeScore * 0.22 + bestScore * 0.12 - falsePenalty), 0, 100);
  }
  return clamp(Math.round(speedScore * 0.42 + accuracy * 0.32 + bestScore * 0.16 + volumeScore * 0.1 - falsePenalty), 0, 100);
}

function attemptAnalytics(result) {
  const reactions = (result.reactions || []).map(Number).filter(Number.isFinite);
  const attempts = (result.hits || 0) + (result.misses || 0) + (result.falseHits || 0);
  const falseRate = attempts ? `${Math.round(((result.falseHits || 0) / attempts) * 100)}%` : "--";
  const totalSeconds = parseSeconds(result.totalTime);
  const pace = totalSeconds && result.hits ? `${(result.hits / (totalSeconds / 60)).toFixed(1)}/min` : "--";
  if (reactions.length < 2) {
    return { consistency: "--", falseRate, pace, spread: "--", fatigue: "--" };
  }
  const spread = Math.max(...reactions) - Math.min(...reactions);
  const first = avg(reactions.slice(0, Math.ceil(reactions.length / 2)));
  const second = avg(reactions.slice(Math.ceil(reactions.length / 2)));
  const fatigue = second - first;
  return {
    consistency: spread < 180 ? "High" : spread < 350 ? "Medium" : "Low",
    falseRate,
    pace,
    spread: `${Math.round(spread)}ms`,
    fatigue: `${fatigue >= 0 ? "+" : ""}${Math.round(fatigue)}ms`
  };
}

function attemptInsights(result, analytics) {
  const insights = [];
  const accuracy = parsePercent(result.accuracy);
  const score = attemptScoreValue(result);
  if (score >= 85) insights.push("Excellent all-round attempt: speed and accuracy were both strong.");
  else if (score >= 70) insights.push("Solid attempt with room to sharpen either speed or precision.");
  else insights.push("Useful baseline attempt. Focus on clean hits before chasing speed.");
  if (accuracy >= 90) insights.push("Accuracy was high, so the player can safely push reaction speed.");
  else if (accuracy < 75) insights.push("Accuracy was the limiting factor. Slow the drill slightly or simplify the colors.");
  if ((result.falseHits || 0) > 0) insights.push("False hits suggest impulse control or distractor filtering needs attention.");
  if (analytics.consistency === "Low") insights.push("Reaction consistency was low; repeat the same preset to build steadier responses.");
  if (!result.leaderboardEligible) insights.push("This was an unsaved custom run, so it is excluded from preset leaderboards.");
  return insights.slice(0, 4);
}

function presetToRow(preset) {
  return {
    id: preset.id,
    name: preset.name,
    description: preset.description || "Custom game",
    config: preset.config
  };
}

function rowToPreset(row) {
  return {
    id: row.id,
    type: "custom",
    name: row.name,
    description: row.description || "Custom game",
    config: row.config || defaults
  };
}

function resultToRow(result) {
  return {
    id: result.id,
    date: result.date,
    player: result.player,
    mode: result.mode,
    preset_id: result.presetId,
    preset_name: result.presetName,
    leaderboard_eligible: result.leaderboardEligible,
    hits: result.hits,
    misses: result.misses,
    false_hits: result.falseHits,
    accuracy: result.accuracy,
    avg_reaction: result.avgReaction,
    best_reaction: result.bestReaction,
    total_time: result.totalTime,
    config: result.config
  };
}

function rowToResult(row) {
  return {
    id: row.id,
    date: row.date,
    player: row.player,
    mode: row.mode,
    presetId: row.preset_id,
    presetName: row.preset_name,
    leaderboardEligible: row.leaderboard_eligible,
    hits: row.hits,
    misses: row.misses,
    falseHits: row.false_hits,
    accuracy: row.accuracy,
    avgReaction: row.avg_reaction,
    bestReaction: row.best_reaction,
    totalTime: row.total_time,
    score: row.score || 0,
    config: row.config
  };
}

function mergePlayers(remotePlayers, localPlayers) {
  const merged = [];
  [...remotePlayers, ...localPlayers].forEach((player) => {
    const nameKey = normalizeName(player.name);
    if (!nameKey || merged.some((item) => item.id === player.id || normalizeName(item.name) === nameKey)) return;
    merged.push(player);
  });
  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

function mergePresets(remotePresets, localPresets) {
  const merged = [];
  [...remotePresets, ...localPresets].forEach((preset) => {
    if (!preset?.id) return;
    const nameKey = normalizeName(preset.name);
    const signature = presetConfigSignature(preset.config || {});
    const duplicate = merged.some((item) => item.id === preset.id || normalizeName(item.name) === nameKey || presetConfigSignature(item.config || {}) === signature);
    if (!duplicate) merged.push({ ...preset, type: "custom" });
  });
  return merged.sort((a, b) => a.name.localeCompare(b.name));
}

function mergeResults(remoteResults, localResults) {
  const byId = new Map();
  [...remoteResults, ...localResults].forEach((result) => {
    if (result?.id && !byId.has(result.id)) byId.set(result.id, result);
  });
  return [...byId.values()]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 100);
}

function playerProfileAnalytics(player, attempts) {
  const sorted = [...attempts].sort((a, b) => new Date(b.date) - new Date(a.date));
  const scores = sorted.map(attemptScoreValue);
  const bestScore = Math.max(...scores);
  const avgScore = Math.round(avg(scores));
  const avgReaction = averageParsed(sorted.map((item) => parseMs(item.avgReaction)), Number.MAX_SAFE_INTEGER);
  const accuracy = Math.round(avg(sorted.map((item) => parsePercent(item.accuracy))));
  const presets = presetPerformance(sorted);
  const recent = sorted.slice(0, Math.min(7, sorted.length)).reverse();
  const trend = recent.map((attempt, index) => ({
    score: attemptScoreValue(attempt),
    label: `#${index + 1}`,
    preset: attempt.presetName || attempt.mode
  }));
  const firstHalf = sorted.slice(Math.ceil(sorted.length / 2));
  const secondHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
  const earlyAvg = firstHalf.length ? avg(firstHalf.map(attemptScoreValue)) : avgScore;
  const recentAvg = secondHalf.length ? avg(secondHalf.map(attemptScoreValue)) : avgScore;
  const delta = Math.round(recentAvg - earlyAvg);
  const weakest = [...sorted].sort((a, b) => attemptScoreValue(a) - attemptScoreValue(b))[0];
  const fastest = [...sorted].sort((a, b) => parseMs(a.avgReaction) - parseMs(b.avgReaction))[0];
  const cleanest = [...sorted].sort((a, b) => parsePercent(b.accuracy) - parsePercent(a.accuracy))[0];
  const insights = [
    delta > 4 ? `Improving: recent attempts are ${delta} points higher than earlier attempts.` : delta < -4 ? `Recent scores dipped by ${Math.abs(delta)} points. Consider more rest or simpler progressions.` : "Performance is stable across recent attempts.",
    fastest ? `Fastest reactions came in ${fastest.presetName || fastest.mode} at ${fastest.avgReaction || "--"} average.` : "",
    cleanest ? `Cleanest control was ${cleanest.accuracy || "--"} accuracy in ${cleanest.presetName || cleanest.mode}.` : "",
    weakest ? `Main opportunity: ${weakest.presetName || weakest.mode} has the lowest score profile.` : ""
  ].filter(Boolean);
  return {
    bestScore: `${bestScore}/100`,
    avgScore: `${avgScore}/100`,
    avgReaction: avgReaction === "--" ? "--" : `${avgReaction}ms`,
    accuracy: `${accuracy}%`,
    bestPreset: presets[0]?.name || "--",
    trend,
    trendInsight: delta > 0 ? `${player.name} is trending up by ${delta} points.` : delta < 0 ? `${player.name} is trending down by ${Math.abs(delta)} points.` : `${player.name}'s results are steady.`,
    headline: `${presets[0]?.name || "Training"} is currently the strongest area.`,
    insights,
    presets
  };
}

function renderTrendChart(points) {
  if (!points.length) return `<div class="trend-chart empty-chart">No trend yet</div>`;
  if (points.length === 1) {
    return `<div class="trend-chart single-chart"><strong>${points[0].score}/100</strong><span>First recorded attempt</span></div>`;
  }
  const width = 320;
  const height = 160;
  const pad = 22;
  const xStep = (width - pad * 2) / Math.max(1, points.length - 1);
  const coords = points.map((point, index) => {
    const x = pad + index * xStep;
    const y = height - pad - (clamp(point.score, 0, 100) / 100) * (height - pad * 2);
    return { ...point, x, y };
  });
  const path = coords.map((point) => `${point.x},${point.y}`).join(" ");
  return `
    <div class="trend-chart">
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Player score trend">
        <line x1="${pad}" y1="${height - pad}" x2="${width - pad}" y2="${height - pad}"></line>
        <line x1="${pad}" y1="${pad}" x2="${pad}" y2="${height - pad}"></line>
        <polyline points="${path}"></polyline>
        ${coords.map((point) => `<circle cx="${point.x}" cy="${point.y}" r="4"></circle><text x="${point.x}" y="${height - 4}">${escapeHtml(point.label)}</text>`).join("")}
      </svg>
      <div class="trend-caption">
        <span>${points[0].score}/100 first</span>
        <strong>${points[points.length - 1].score}/100 latest</strong>
      </div>
    </div>
  `;
}

function presetPerformance(attempts) {
  const groups = new Map();
  attempts.forEach((attempt) => {
    const key = attempt.presetId || attempt.presetName || attempt.mode;
    if (!groups.has(key)) groups.set(key, { name: attempt.presetName || attempt.mode, attempts: [] });
    groups.get(key).attempts.push(attempt);
  });
  return [...groups.values()]
    .map((group) => ({
      name: group.name,
      count: group.attempts.length,
      score: Math.round(avg(group.attempts.map(attemptScoreValue)))
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function averageParsed(values, invalidValue) {
  const valid = values.filter((value) => Number.isFinite(value) && value !== invalidValue);
  return valid.length ? Math.round(avg(valid)) : "--";
}

function formatAdminDate(value) {
  return value ? new Date(value).toLocaleString() : "--";
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
      $("wakeLockButton").checked = false;
    } else {
      state.wakeLock = await navigator.wakeLock.request("screen");
      $("wakeLockButton").checked = true;
      state.wakeLock.addEventListener("release", () => {
        state.wakeLock = null;
        $("wakeLockButton").checked = false;
      });
    }
  } catch {
    $("wakeLockButton").checked = false;
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

function exitFullscreen() {
  if (!document.fullscreenElement || !document.exitFullscreen) return;
  document.exitFullscreen().catch(() => {});
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

function parsePercent(value) {
  const parsed = Number(String(value || "").replace("%", ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSeconds(value) {
  const parsed = Number(String(value || "").replace("s", ""));
  return Number.isFinite(parsed) ? parsed : 0;
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
