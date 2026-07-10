(() => {
  if (!window.UI) return;

  const STAGES = [
    "world_1_1", "world_1_2", "world_1_3", "world_1_4", "world_1_5",
    "world_2_1", "world_2_2", "world_2_3", "world_2_4", "world_2_5"
  ];

  let launchToken = 0;

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const raf = () => new Promise(resolve => requestAnimationFrame(resolve));

  const setLoading = (percent, text) => {
    const fill = document.getElementById("loadingFill");
    const label = document.getElementById("loadingText");
    if (fill) fill.style.width = `${Math.max(8, Math.min(100, percent))}%`;
    if (label) label.textContent = text;
  };

  const stageTitle = () => {
    const name = document.getElementById("carouselStageName")?.textContent || "World 1-1";
    const title = document.getElementById("carouselStageTitle")?.textContent || "Blooming Meadow";
    return `${name} · ${title}`;
  };

  const ensureLoadingNode = () => {
    let loading = document.getElementById("stageLoading");
    if (loading) return loading;

    loading = document.createElement("section");
    loading.id = "stageLoading";
    loading.className = "stage-loading hidden";
    loading.innerHTML = `
      <div class="loading-card">
        <div class="loading-logo">CHERRIFT</div>
        <div id="loadingStageName" class="loading-stage">World 1-1 · Blooming Meadow</div>
        <div class="loading-bar"><i id="loadingFill"></i></div>
        <div id="loadingText" class="loading-text">Loading stage...</div>
      </div>`;
    document.getElementById("app")?.appendChild(loading);
    return loading;
  };

  const hidePanels = () => {
    ["worlds", "menu", "skins", "gear", "chests", "settings", "stageClearModal", "gameOver", "pauseModal", "levelModal"].forEach(id => {
      document.getElementById(id)?.classList.add("hidden");
    });
  };

  const hideGameUi = () => {
    ["hud", "skill", "stageHud"].forEach(id => document.getElementById(id)?.classList.add("hidden"));
  };

  const fitViewport = game => {
    const g = game || UI.game;
    const canvas = g?.canvas || document.getElementById("game");
    const app = document.getElementById("app");
    const vv = window.visualViewport;
    const w = Math.max(320, Math.floor(vv?.width || window.innerWidth || document.documentElement.clientWidth || screen.width || 360));
    const h = Math.max(240, Math.floor(vv?.height || window.innerHeight || document.documentElement.clientHeight || screen.height || 640));

    if (canvas) {
      canvas.style.position = "fixed";
      canvas.style.inset = "0";
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      canvas.style.minWidth = `${w}px`;
      canvas.style.minHeight = `${h}px`;
      canvas.style.display = "block";
      canvas.style.visibility = "visible";
      canvas.style.opacity = "1";
    }

    if (app) {
      app.style.position = "fixed";
      app.style.inset = "0";
      app.style.width = `${w}px`;
      app.style.height = `${h}px`;
      app.style.background = "transparent";
    }

    if (g) {
      const shortSide = Math.min(w, h);
      const mobile = shortSide <= 820;
      const portrait = h >= w;

      try { g.resize?.(); } catch (_) {}

      if (mobile && portrait) g.zoom = 0.82;
      else if (mobile) g.zoom = 0.74;
      else if (shortSide <= 980) g.zoom = 0.66;
      else g.zoom = 0.58;

      try { if (g.mode === "playing") g.render?.(); } catch (_) {}
    }
  };

  const queueFit = game => {
    requestAnimationFrame(() => fitViewport(game));
    setTimeout(() => fitViewport(game), 60);
    setTimeout(() => fitViewport(game), 160);
    setTimeout(() => fitViewport(game), 360);
    setTimeout(() => fitViewport(game), 720);
  };

  const updateCompactStageHud = game => {
    const g = game || UI.game;
    const stage = g?.stage || g?.getSelectedStage?.();
    if (!stage) return;

    const name = document.getElementById("stageHudName");
    const goal = document.getElementById("stageHudGoal");
    if (name) name.textContent = stage.name || "Stage";
    if (goal) goal.textContent = `${Math.min(g.kills || 0, stage.goalKills || 0)}/${stage.goalKills || 0}`;
  };

  const showLoading = () => {
    const loading = ensureLoadingNode();
    document.body.classList.add("is-loading-stage");
    document.body.classList.remove("is-playing");
    const stageName = document.getElementById("loadingStageName");
    if (stageName) stageName.textContent = stageTitle();
    setLoading(10, "Preparing stage...");
    hidePanels();
    hideGameUi();
    loading.classList.remove("hidden");
  };

  const finishLoading = async (game, token) => {
    if (token !== launchToken) return;
    fitViewport(game);
    await raf();
    if (token !== launchToken) return;

    setLoading(100, "Ready!");
    await sleep(120);
    if (token !== launchToken) return;

    document.body.classList.remove("is-loading-stage");
    document.body.classList.add("is-playing");
    document.getElementById("stageLoading")?.classList.add("hidden");

    hidePanels();
    document.getElementById("hud")?.classList.remove("hidden");
    document.getElementById("skill")?.classList.remove("hidden");
    document.getElementById("stageHud")?.classList.remove("hidden");
    updateCompactStageHud(game);
    queueFit(game);
  };

  const startGameNonBlocking = token => {
    let started = false;
    let thrown = null;

    try {
      const result = UI.game.start();
      started = true;

      // Do not await forever. Some mobile/fullscreen browsers can leave a wrapped start
      // promise pending while the game already starts. Continue after a safe short delay.
      if (result && typeof result.then === "function") {
        Promise.race([
          result.catch(err => { thrown = err; }),
          sleep(650)
        ]).then(() => {
          if (thrown) throw thrown;
        }).catch(err => console.error("Stage start async warning", err));
      }
    } catch (err) {
      thrown = err;
      console.error("Stage start failed", err);
      UI.toast?.("Stage start hiba");
      document.body.classList.remove("is-loading-stage");
      document.getElementById("stageLoading")?.classList.add("hidden");
      return false;
    }

    return started;
  };

  const launchStage = async e => {
    e?.preventDefault?.();
    e?.stopImmediatePropagation?.();

    if (UI.__stageLaunchBusy) return;
    UI.__stageLaunchBusy = true;
    const token = ++launchToken;

    try {
      const index = Math.max(0, Math.min(STAGES.length - 1, UI.worldCarouselIndex || 0));
      const stageId = STAGES[index] || STAGES[0];
      const unlocked = Array.isArray(UI.save?.unlockedStages) ? UI.save.unlockedStages.includes(stageId) : stageId === STAGES[0];

      if (!unlocked) {
        UI.toast?.("Ez a pálya még locked");
        return;
      }

      UI.save.selectedStageId = stageId;
      CherriftStorage.save(UI.save);

      showLoading();
      setLoading(28, "Loading map...");
      fitViewport(UI.game);
      await sleep(90);

      if (token !== launchToken) return;
      setLoading(58, "Spawning Cherry...");

      const ok = startGameNonBlocking(token);
      if (!ok) return;

      // Keep UI hidden while the first frames settle.
      hideGameUi();
      await sleep(260);

      if (token !== launchToken) return;
      setLoading(82, "Drawing stage...");
      queueFit(UI.game);

      // Failsafe: even if start promise or render wrapper gets weird, continue.
      await sleep(420);
      await finishLoading(UI.game, token);
    } finally {
      UI.__stageLaunchBusy = false;
    }
  };

  const openWorldSelect = e => {
    e?.preventDefault?.();
    e?.stopImmediatePropagation?.();

    launchToken++;
    document.body.classList.remove("is-playing", "is-loading-stage");
    document.getElementById("stageLoading")?.classList.add("hidden");
    hideGameUi();

    if (typeof UI.openWorldSelect === "function") UI.openWorldSelect();
    else UI.open?.("worlds");
  };

  const installFlow = () => {
    const rebind = (id, handler) => {
      const old = document.getElementById(id);
      if (!old) return null;
      const clone = old.cloneNode(true);
      old.replaceWith(clone);
      clone.addEventListener("click", handler, { capture:true });
      return clone;
    };

    rebind("playBtn", openWorldSelect);
    rebind("mobilePlayBtn", openWorldSelect);
    rebind("worldLaunchBtn", launchStage);
    rebind("worldBackBtn", e => {
      e?.preventDefault?.();
      openWorldSelect(e);
      UI.open?.("menu");
    });

    const mobileMode = document.getElementById("mobileModeBtn");
    if (mobileMode) mobileMode.style.display = "none";

    document.querySelectorAll('[data-open="worlds"]').forEach(btn => {
      btn.addEventListener("click", openWorldSelect, { capture:true });
    });

    UI.launchSelectedWorld = launchStage;
  };

  const oldBind = UI.bind.bind(UI);
  UI.bind = function freezeFixBind(...args) {
    const result = oldBind.apply(this, args);
    installFlow();
    setTimeout(installFlow, 0);
    return result;
  };

  const oldUpdateHUD = UI.updateHUD?.bind(UI);
  if (oldUpdateHUD) {
    UI.updateHUD = function compactUpdateHUD(game) {
      oldUpdateHUD(game);
      updateCompactStageHud(game);
    };
  }

  const oldShowStageHUD = UI.showStageHUD?.bind(UI);
  if (oldShowStageHUD) {
    UI.showStageHUD = function compactShowStageHUD(game) {
      oldShowStageHUD(game);
      updateCompactStageHud(game);
    };
  }

  ["resize", "orientationchange", "fullscreenchange", "webkitfullscreenchange", "pageshow"].forEach(eventName => {
    window.addEventListener(eventName, () => queueFit(window.UI?.game), { passive:true });
    document.addEventListener(eventName, () => queueFit(window.UI?.game), { passive:true });
  });
})();