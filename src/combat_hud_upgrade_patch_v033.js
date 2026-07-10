(() => {
  if (!window.CHERRIFT_DATA || !window.CHERRIFT_CONFIG || !window.CherriftGame || !window.UI) return;

  const VERSION = "0.3.3-combat-hud-upgrade";
  CHERRIFT_CONFIG.version = VERSION;
  CHERRIFT_DATA.version = VERSION;

  const skinConfigOf = p => CHERRIFT_CONFIG.player?.skins?.[p?.skin] || {};
  const isMelee = p => skinConfigOf(p).attackType === "melee";

  function ensureCombatStats(p) {
    if (!p) return;
    p.projectileCount ||= 1;
    p.projectileSpread ||= 0.13;
    p.meleeRangeMult ||= 1;
    p.meleeConeBonus ||= 0;
    p.auraDps ||= 0;
  }

  function addUpgradeText(up) {
    return up;
  }

  CHERRIFT_DATA.upgrades = [
    addUpgradeText({
      id:"damage_core",
      name:"Bloom Force",
      desc:"Universal: +15% sebzés.",
      apply:p => { ensureCombatStats(p); p.damage *= 1.15; }
    }),
    addUpgradeText({
      id:"quick_core",
      name:"Quick Bloom",
      desc:"Universal: +12% attack speed.",
      apply:p => { ensureCombatStats(p); p.fireInterval *= 0.88; }
    }),
    addUpgradeText({
      id:"swift_core",
      name:"Swift Bunny",
      desc:"Universal: +10% mozgási sebesség.",
      apply:p => { ensureCombatStats(p); p.speed *= 1.10; }
    }),
    addUpgradeText({
      id:"hp_core",
      name:"Soft Shield",
      desc:"Universal: +24 max HP és kis gyógyítás.",
      apply:p => { ensureCombatStats(p); p.maxHp += 24; p.hp = Math.min(p.maxHp, p.hp + 32); }
    }),
    addUpgradeText({
      id:"pickup_core",
      name:"Petal Magnet",
      desc:"Universal: +32 pickup radius.",
      apply:p => { ensureCombatStats(p); p.pickup += 32; }
    }),
    addUpgradeText({
      id:"crit_core",
      name:"Lucky Bloom",
      desc:"Universal: +8% crit chance.",
      apply:p => { ensureCombatStats(p); p.crit += 0.08; }
    }),
    addUpgradeText({
      id:"skill_flow",
      name:"Skill Flow",
      desc:"Universal: -15% skill cooldown.",
      apply:p => { ensureCombatStats(p); p.skillCooldown = Math.max(2.5, p.skillCooldown * 0.85); }
    }),
    addUpgradeText({
      id:"multi_strike",
      name:"Multi Strike",
      desc:"Ranged: +1 projectile. Melee: +18% range.",
      apply:p => {
        ensureCombatStats(p);
        if (isMelee(p)) p.meleeRangeMult *= 1.18;
        else p.projectileCount = Math.min(5, (p.projectileCount || 1) + 1);
      }
    }),
    addUpgradeText({
      id:"combat_arc",
      name:"Combat Arc",
      desc:"Ranged: szélesebb lövés spread. Melee: szélesebb cone.",
      apply:p => {
        ensureCombatStats(p);
        if (isMelee(p)) p.meleeConeBonus = (p.meleeConeBonus || 0) + 14;
        else p.projectileSpread = Math.min(0.34, (p.projectileSpread || 0.13) + 0.04);
      }
    }),
    addUpgradeText({
      id:"thorn_aura",
      name:"Thorn Aura",
      desc:"Universal: közeli ellenfelek lassan sebződnek.",
      apply:p => { ensureCombatStats(p); p.auraDps = (p.auraDps || 0) + 5; }
    })
  ];

  const proto = CherriftGame.prototype;
  const oldStart = proto.start;
  proto.start = async function v033Start(...args) {
    const result = await oldStart.apply(this, args);
    ensureCombatStats(this.player);
    this.damageTexts = [];
    this.__lastRaidBannerText = "";
    return result;
  };

  const oldAutoFire = proto.autoFire;
  proto.autoFire = function v033AutoFire() {
    const p = this.player;
    if (!p) return oldAutoFire.call(this);
    ensureCombatStats(p);

    const skin = this.activeSkinConfig?.() || {};
    if (skin.attackType === "melee") return oldAutoFire.call(this);

    const count = Math.max(1, Math.min(5, Math.floor(p.projectileCount || 1)));
    if (count <= 1) return oldAutoFire.call(this);

    const interval = p.fireInterval * (p.skillBuff > 0 ? .55 : 1);
    if (p.fireTimer > 0) return;

    const target = this.nearest();
    if (!target) return;

    p.fireTimer = interval;
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const base = Math.atan2(dy, dx);
    const spread = p.projectileSpread || 0.13;
    const style = p.skin === "fairy_cherry" ? "petal" : "orb";

    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * spread;
      const a = base + offset;
      this.bullets.push({
        x:p.x,
        y:p.y - 10,
        vx:Math.cos(a) * p.bulletSpeed,
        vy:Math.sin(a) * p.bulletSpeed,
        r:style === "petal" ? 8 : 7,
        dmg:p.damage,
        life:1.45,
        style
      });
    }
  };

  if (proto.meleeHit && !proto.__v033MeleeHitPatched) {
    const oldMeleeHit = proto.meleeHit;
    proto.meleeHit = function v033MeleeHit(angle, range, coneDeg, damage) {
      const p = this.player;
      ensureCombatStats(p);
      return oldMeleeHit.call(
        this,
        angle,
        range * (p?.meleeRangeMult || 1),
        coneDeg + (p?.meleeConeBonus || 0),
        damage
      );
    };
    proto.__v033MeleeHitPatched = true;
  }

  const oldDamageEnemy = proto.damageEnemy;
  proto.damageEnemy = function v033DamageEnemy(e, dmg) {
    if (e && !e.dead && dmg > 0) {
      this.effects.push({
        type:"damageText",
        x:e.x + (Math.random() - .5) * 18,
        y:e.y - e.r - 8,
        value:Math.max(1, Math.round(dmg)),
        t:0,
        life:.48,
        big:dmg > (this.player?.damage || 20) * 1.45
      });
    }

    const wasDead = e?.dead;
    const result = oldDamageEnemy.call(this, e, dmg);

    if (e && !wasDead && e.dead) {
      this.effects.push({ type:"deathPop", x:e.x, y:e.y, r:e.r || 24, t:0, life:.28 });
    }

    return result;
  };

  const oldUpdate = proto.update;
  proto.update = function v033Update(dt) {
    oldUpdate.call(this, dt);

    const p = this.player;
    if (!p || this.mode !== "playing") return;
    ensureCombatStats(p);

    if (p.auraDps > 0) {
      const radius = 92 + Math.min(80, (p.pickup || 110) * .16);
      let touched = 0;
      for (const e of this.enemies || []) {
        if (e.dead) continue;
        if (Math.hypot(e.x - p.x, e.y - p.y) <= radius + e.r) {
          e.hp -= p.auraDps * dt;
          e.hit = Math.max(e.hit || 0, .04);
          touched++;
          if (e.hp <= 0 && !e.dead) this.damageEnemy(e, 1);
        }
      }

      if (touched && Math.floor(this.t * 8) % 8 === 0) {
        this.effects.push({ type:"auraPulse", x:p.x, y:p.y, r:radius, t:0, life:.32 });
      }
    }

    updateRaidWarning(this);
    updateBossHud(this);
  };

  const oldDrawEffect = proto.drawEffect;
  proto.drawEffect = function v033DrawEffect(c, e) {
    if (e.type === "damageText") {
      const a = Math.max(0, 1 - e.t / e.life);
      c.save();
      c.globalAlpha = a;
      c.font = `${e.big ? 24 : 18}px system-ui, sans-serif`;
      c.textAlign = "center";
      c.lineWidth = 4;
      c.strokeStyle = "rgba(0,0,0,.65)";
      c.fillStyle = e.big ? "#ffd76c" : "#fff4fb";
      const y = e.y - (1 - a) * 28;
      c.strokeText(String(e.value), e.x, y);
      c.fillText(String(e.value), e.x, y);
      c.restore();
      return;
    }

    if (e.type === "deathPop") {
      const a = Math.max(0, 1 - e.t / e.life);
      c.save();
      c.globalAlpha = a;
      c.strokeStyle = "rgba(255,210,233,.85)";
      c.lineWidth = 3;
      c.beginPath();
      c.arc(e.x, e.y, (e.r || 24) * (1.1 + (1 - a) * .75), 0, Math.PI * 2);
      c.stroke();
      c.restore();
      return;
    }

    if (e.type === "auraPulse") {
      const a = Math.max(0, 1 - e.t / e.life);
      c.save();
      c.globalAlpha = a * .42;
      c.strokeStyle = "#ff8ccc";
      c.lineWidth = 2;
      c.beginPath();
      c.arc(e.x, e.y, e.r * (0.92 + (1 - a) * .14), 0, Math.PI * 2);
      c.stroke();
      c.restore();
      return;
    }

    return oldDrawEffect.call(this, c, e);
  };

  function ensureRaidWarningNode() {
    let el = document.getElementById("raidWarningV033");
    if (el) return el;
    el = document.createElement("div");
    el.id = "raidWarningV033";
    el.className = "raid-warning-v033";
    el.innerHTML = "<b>RAID INCOMING</b><small>Wave approaching</small>";
    document.getElementById("app")?.appendChild(el);
    return el;
  }

  function updateRaidWarning(game) {
    const stage = game.stage;
    const el = ensureRaidWarningNode();
    if (!stage?.raidBanner || stage.raidBannerTimer <= 0) {
      el.classList.remove("show");
      return;
    }

    const boss = stage.raidBanner.includes("BOSS");
    el.querySelector("b").textContent = boss ? "MINI BOSS" : "RAID INCOMING";
    el.querySelector("small").textContent = stage.raidBanner;
    el.classList.add("show");
  }

  function ensureBossHudNode() {
    let el = document.getElementById("bossHudV033");
    if (el) return el;
    el = document.createElement("div");
    el.id = "bossHudV033";
    el.className = "boss-hud-v033";
    el.innerHTML = '<div class="boss-name">Boss</div><div class="boss-bar"><i></i></div>';
    document.getElementById("app")?.appendChild(el);
    return el;
  }

  function updateBossHud(game) {
    const el = ensureBossHudNode();
    const boss = (game.enemies || []).find(e => e.isBoss && !e.dead);
    if (!boss) {
      el.classList.remove("show");
      return;
    }

    el.querySelector(".boss-name").textContent = boss.name || "Mini Boss";
    el.querySelector(".boss-bar i").style.width = `${Math.max(0, Math.min(100, boss.hp / boss.maxHp * 100))}%`;
    el.classList.add("show");
  }

  const oldUpdateStageHUD = UI.updateStageHUD?.bind(UI);
  UI.updateStageHUD = function v033StageObjective(game) {
    if (oldUpdateStageHUD) oldUpdateStageHUD(game);

    const stage = game?.stage || game?.getSelectedStage?.();
    if (!stage) return;

    const name = document.getElementById("stageHudName");
    const goal = document.getElementById("stageHudGoal");

    if (name) name.textContent = stage.name || "World";
    if (goal) goal.textContent = `${Math.min(game.kills || 0, stage.goalKills || 0)}/${stage.goalKills || 0}`;
  };

  const oldShowStageClear = UI.showStageClear?.bind(UI);
  UI.showStageClear = function v033ShowStageClear(game, info) {
    if (oldShowStageClear) oldShowStageClear(game, info);

    const stage = game.stage;
    const set = (id, text) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    set("stageClearTitle", "STAGE CLEAR!");
    set("stageClearSubtitle", `${stage.name} · ${stage.title} · ${this.fmt(game.time)} · ${game.kills}/${stage.goalKills} defeated`);

    const modal = document.getElementById("stageClearModal");
    const actions = modal?.querySelector(".stage-clear-actions");
    if (actions && !document.getElementById("stageClearWorldBtn")) {
      const btn = document.createElement("button");
      btn.id = "stageClearWorldBtn";
      btn.className = "menu-btn center";
      btn.textContent = "WORLD SELECT";
      btn.onclick = () => {
        this.hideStageClear?.();
        document.body.classList.remove("is-playing");
        this.openWorldSelect?.();
      };
      const menuBtn = document.getElementById("stageClearToMenuBtn");
      actions.insertBefore(btn, menuBtn || null);
    }
  };

  const oldRefreshMenu = UI.refreshMenu?.bind(UI);
  UI.refreshMenu = function v033RefreshMenu(...args) {
    const result = oldRefreshMenu ? oldRefreshMenu(...args) : undefined;
    const build = document.getElementById("menuBuildVersion");
    if (build) build.textContent = "v0.3.3 EARLY BUILD";
    return result;
  };

  window.addEventListener("resize", () => updateBossHud(UI.game), { passive:true });
})();