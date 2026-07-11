(() => {
  if (!window.UI || !window.CherriftGame) return;

  const VERSION = "0.3.9c-gear-ground-sprite-hotfix";
  if (window.CHERRIFT_CONFIG) CHERRIFT_CONFIG.version = VERSION;
  if (window.CHERRIFT_DATA) CHERRIFT_DATA.version = VERSION;

  const $ = id => document.getElementById(id);
  const $$ = sel => Array.from(document.querySelectorAll(sel));

  // ---------------------------------------------------------------------------
  // 1) Gear ghost / stuck item fix
  // The previous experimental drag patches could leave .drag-ghost elements behind.
  // For now gear uses stable tap-select + Equip/Unequip buttons only.
  // ---------------------------------------------------------------------------
  function cleanupGearGhosts() {
    $$(".drag-ghost, .dragging").forEach(el => {
      if (el.classList?.contains("dragging")) el.classList.remove("dragging");
      else el.remove();
    });
    document.body.classList.remove("gear-dragging-v037", "gear-dragging-v038", "gear-dragging-v039c");
    if (UI) {
      UI.__dragPayload = null;
      UI.__dragPointerId = null;
      UI.__dragGhost?.remove?.();
      UI.__dragGhost = null;
      UI.__gearCandidate = null;
      UI.__gearDragging = null;
    }
  }

  function safeClick(el, fn) {
    if (!el) return;
    el.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      cleanupGearGhosts();
      fn(e);
    };
  }

  function renderGearNoDrag() {
    const inv = $("inventory");
    if (!inv || !UI.save) return;

    cleanupGearGhosts();

    $$(".gear-slot").forEach(btn => {
      const slot = btn.dataset.slot;
      const g = UI.save.equipped?.[slot];
      btn.draggable = false;
      btn.ondragstart = e => { e.preventDefault(); return false; };
      btn.className = `gear-slot ${slot.toLowerCase()} ${g ? "" : "empty"} ${UI.selectedGear && UI.selectedGear.id === g?.id ? "selected" : ""}`;
      btn.dataset.short = slot.slice(0, 3).toUpperCase();
      btn.dataset.gearId = g?.id || "";
      btn.innerHTML = g ? `<span>${UI.gearEmoji(g)}</span>` : "";
      safeClick(btn, () => {
        cleanupGearGhosts();
        if (g) UI.showGearDetails(g, "equipped");
        else UI.showEmptySlot(slot);
        UI.highlightGear?.(g?.id);
      });
    });

    inv.innerHTML = "";
    (UI.save.inventory || []).forEach(g => {
      const el = document.createElement("button");
      el.type = "button";
      el.draggable = false;
      el.ondragstart = e => { e.preventDefault(); return false; };
      el.className = `inv-item rarity-${String(g.rarity || "Common").toLowerCase()} ${UI.selectedGear && UI.selectedGear.id === g.id ? "selected" : ""}`;
      el.dataset.gearId = g.id;
      el.dataset.slot = g.slot;
      el.innerHTML = `<span>${UI.gearEmoji(g)}</span><small>${g.slot}</small>`;
      safeClick(el, () => {
        cleanupGearGhosts();
        UI.showGearDetails(g, "inventory");
        UI.highlightGear?.(g.id);
      });
      inv.appendChild(el);
    });

    const count = $("inventoryCount");
    if (count) count.textContent = `${(UI.save.inventory || []).length} items`;

    const totalStats = $("totalStats");
    if (totalStats) {
      const stats = UI.totalGearStats(UI.save);
      totalStats.innerHTML = "<h3>Total Stats</h3>" + (
        Object.keys(stats).length
          ? Object.entries(stats).map(([k,v]) => `<div class="stat-line"><span>${k}</span><b>+${Math.round(v*10)/10}</b></div>`).join("")
          : "<p>No gear equipped.</p>"
      );
    }

    if (!UI.selectedGear) UI.showEmptySlot("Select item");
  }

  // Capture old drag events before older document-level bubble listeners get them.
  function installGearCaptureGuard() {
    if (UI.__v039cGearGuardInstalled) return;
    UI.__v039cGearGuardInstalled = true;

    const shouldGuard = e => {
      const target = e.target;
      if (!target?.closest) return false;
      return !!target.closest("#gear") && !!target.closest(".inv-item, .gear-slot");
    };

    ["dragstart", "drag", "dragend", "drop"].forEach(type => {
      document.addEventListener(type, e => {
        if (!e.target?.closest?.("#gear")) return;
        e.preventDefault();
        e.stopImmediatePropagation();
        cleanupGearGhosts();
        return false;
      }, true);
    });

    ["pointerdown", "pointermove", "pointerup", "pointercancel", "touchstart", "touchmove", "touchend", "mousedown", "mousemove", "mouseup"].forEach(type => {
      document.addEventListener(type, e => {
        if (!shouldGuard(e)) return;
        // Don't let older drag patches see this.
        e.stopImmediatePropagation();
        cleanupGearGhosts();
      }, true);
    });

    ["pointerup", "pointercancel", "touchend", "mouseup", "click"].forEach(type => {
      window.addEventListener(type, cleanupGearGhosts, true);
      document.addEventListener(type, cleanupGearGhosts, true);
    });
    window.addEventListener("blur", cleanupGearGhosts);
    document.addEventListener("visibilitychange", () => cleanupGearGhosts());
    setInterval(cleanupGearGhosts, 1200);
  }

  // ---------------------------------------------------------------------------
  // 2) World 1 ground tile fix
  // Uploaded tiles contain transparent/rounded edges, which caused visible grid gaps.
  // Draw cropped center texture and use accents as low-alpha overlays.
  // ---------------------------------------------------------------------------
  const WORLD1_TILES = {
    basic: "assets/map/world1_grass_basic.png",
    flowersRocks: "assets/map/world1_grass_flowers_rocks.png",
    dirtClearing: "assets/map/world1_dirt_clearing.png",
    grassDirtMix: "assets/map/world1_grass_dirt_mix.png",
    cloverFlowers: "assets/map/world1_grass_clover_flowers.png"
  };

  const groundImages = {};
  const groundReady = Promise.all(Object.entries(WORLD1_TILES).map(([key, src]) => new Promise(resolve => {
    const img = new Image();
    img.onload = () => { groundImages[key] = img; resolve(true); };
    img.onerror = () => { console.warn("Missing world1 ground:", src); resolve(false); };
    img.decoding = "async";
    img.src = src;
  })));

  function hash2(x, y) {
    let h = (x * 374761393 + y * 668265263) >>> 0;
    h = (h ^ (h >> 13)) >>> 0;
    h = (h * 1274126177) >>> 0;
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }

  function drawCoverCropped(c, img, x, y, size, alpha = 1) {
    if (!img) return false;
    const sw = img.naturalWidth || img.width;
    const sh = img.naturalHeight || img.height;
    // 16% crop removes the rounded transparent border and tile outline.
    const crop = Math.floor(Math.min(sw, sh) * 0.16);
    c.save();
    c.globalAlpha = alpha;
    c.drawImage(img, crop, crop, sw - crop * 2, sh - crop * 2, x, y, size + 1, size + 1);
    c.restore();
    return true;
  }

  function accentFor(gx, gy) {
    const r = hash2(gx, gy);
    if (r < .18) return ["grassDirtMix", .42];
    if (r < .28) return ["cloverFlowers", .32];
    if (r < .36) return ["flowersRocks", .28];
    if (r < .42) return ["dirtClearing", .34];
    return [null, 0];
  }

  const proto = CherriftGame.prototype;
  const olderDrawGround = proto.drawGround;
  proto.drawGround = function v039cDrawGround(c, zoom = 1) {
    const stage = this.stage || this.getSelectedStage?.();
    const isNight = stage?.theme === "forest_night";
    const isWorld1 = !isNight && (stage?.world === 1 || stage?.theme === "forest_day" || /^world_1_/i.test(stage?.id || ""));
    if (!isWorld1) return olderDrawGround.call(this, c, zoom);

    const basic = groundImages.basic || this.assets?.get?.("grass");
    if (!basic) return olderDrawGround.call(this, c, zoom);

    const size = 128;
    const viewW = this.w / zoom;
    const viewH = this.h / zoom;
    const startX = Math.floor((this.camera.x - viewW / 2) / size) - 1;
    const endX = Math.floor((this.camera.x + viewW / 2) / size) + 1;
    const startY = Math.floor((this.camera.y - viewH / 2) / size) - 1;
    const endY = Math.floor((this.camera.y + viewH / 2) / size) + 1;

    for (let gx = startX; gx <= endX; gx++) {
      for (let gy = startY; gy <= endY; gy++) {
        const x = gx * size;
        const y = gy * size;

        // Always fill the full cell with base grass, no transparent gap.
        drawCoverCropped(c, basic, x, y, size, 1);

        const [key, alpha] = accentFor(gx, gy);
        if (key && groundImages[key]) drawCoverCropped(c, groundImages[key], x, y, size, alpha);

        // Tiny soft tint breaks repetition without showing square borders.
        const v = hash2(gx + 71, gy - 29);
        if (v > .78) {
          c.save();
          c.globalAlpha = .025;
          c.fillStyle = v > .9 ? "#fff7d8" : "#4fb65d";
          c.fillRect(x, y, size + 1, size + 1);
          c.restore();
        }
      }
    }
  };

  // ---------------------------------------------------------------------------
  // 3) Sprite head/body size jump
  // Previous normalizer used different scale per animation state.
  // This one keeps the same draw scale for idle/walk/attack/skill.
  // ---------------------------------------------------------------------------
  const olderDrawPlayer = proto.drawPlayer;
  proto.drawPlayer = function v039cStableSpriteDraw(c, p) {
    const skin = this.activeSkinConfig?.();
    const cfg = CHERRIFT_CONFIG.player;
    if (!skin || !cfg) return olderDrawPlayer.call(this, c, p);

    const skillActive = (p.skillCastTimer || 0) > 0;
    const attackActive = !skillActive && (p.attackCastTimer || 0) > 0 && skin.states?.attack;
    const dir = skillActive ? (p.skillDir || p.lastDir || "down") : attackActive ? (p.attackDir || p.lastDir || "down") : (p.lastDir || "down");
    const stateName = skillActive ? "skill" : attackActive ? "attack" : (p.moving ? "walk" : "idle");
    const state = skin.states?.[stateName];
    const img = this.assets?.get?.(`player_${p.skin}_${stateName}_${dir}`);

    if (!state || !img) return olderDrawPlayer.call(this, c, p);

    const realFrames = Math.max(1, Math.floor(img.width / cfg.frameWidth));
    const frameCount = Math.max(1, Math.min(state.frames || realFrames, realFrames));
    let frame = 0;

    if (stateName === "skill") {
      const elapsed = Math.max(0, (p.skillCastDuration || state.duration || .4) - (p.skillCastTimer || 0));
      frame = Math.min(frameCount - 1, Math.floor(elapsed * (state.fps || 12)));
    } else if (stateName === "attack") {
      const elapsed = Math.max(0, (p.attackCastDuration || state.duration || .34) - (p.attackCastTimer || 0));
      frame = Math.min(frameCount - 1, Math.floor(elapsed * (state.fps || 18)));
    } else {
      frame = Math.floor(this.t * (state.fps || 6)) % frameCount;
    }

    // Same scale for all animation states to remove script-driven size popping.
    const scale = 0.95;
    const dw = (cfg.displayWidth || 116) * scale;
    const dh = (cfg.displayHeight || 116) * scale;
    const footX = p.x;
    const footY = p.y + 34;
    const dx = Math.round(footX - dw / 2);
    const dy = Math.round(footY - dh);

    const flipX = p.skin === "fairy_cherry" && stateName === "walk" && dir === "right";

    c.save();
    c.globalAlpha = .22;
    c.fillStyle = "#000";
    c.beginPath();
    c.ellipse(p.x, p.y + 25, 27, 9, 0, 0, Math.PI * 2);
    c.fill();
    c.restore();

    c.save();
    if (flipX) {
      c.translate(dx + dw / 2, 0);
      c.scale(-1, 1);
      c.drawImage(img, frame * cfg.frameWidth, 0, cfg.frameWidth, cfg.frameHeight, -dw / 2, dy, dw, dh);
    } else {
      c.drawImage(img, frame * cfg.frameWidth, 0, cfg.frameWidth, cfg.frameHeight, dx, dy, dw, dh);
    }
    c.restore();
  };

  // Hook start/open/render so fixes are ready.
  const oldStart = proto.start;
  if (!proto.__v039cStartPatched) {
    proto.start = async function v039cStart(...args) {
      await groundReady.catch(() => {});
      cleanupGearGhosts();
      return await oldStart.apply(this, args);
    };
    proto.__v039cStartPatched = true;
  }

  const oldOpen = UI.open?.bind(UI);
  if (oldOpen && !UI.__v039cOpenPatched) {
    UI.open = function v039cOpen(panel, ...args) {
      cleanupGearGhosts();
      const result = oldOpen(panel, ...args);
      if (panel === "gear") setTimeout(renderGearNoDrag, 0);
      return result;
    };
    UI.__v039cOpenPatched = true;
  }

  const oldRenderGear = UI.renderGear?.bind(UI);
  UI.renderGear = function v039cRenderGear(...args) {
    try { oldRenderGear?.(...args); } catch (_) {}
    renderGearNoDrag();
    cleanupGearGhosts();
  };

  const oldRefresh = UI.refreshMenu?.bind(UI);
  UI.refreshMenu = function v039cRefresh(...args) {
    cleanupGearGhosts();
    const result = oldRefresh ? oldRefresh(...args) : undefined;
    const build = $("menuBuildVersion");
    if (build) build.textContent = "v0.3.9c HOTFIX";
    return result;
  };

  installGearCaptureGuard();
  setTimeout(() => {
    cleanupGearGhosts();
    if (!$("gear")?.classList.contains("hidden")) renderGearNoDrag();
  }, 0);
})();