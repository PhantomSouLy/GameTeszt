import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM, VirtualConsole } from "jsdom";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".wav": "audio/wav"
};

function safeFile(urlPath) {
  const pathname = decodeURIComponent(new URL(urlPath, "http://localhost").pathname);
  const requested = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
  return requested === root || requested.startsWith(`${root}${path.sep}`) ? requested : null;
}

const server = createServer(async (request, response) => {
  const file = safeFile(request.url || "/");
  if (!file) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const info = await stat(file);
    const target = info.isDirectory() ? path.join(file, "index.html") : file;
    const body = await readFile(target);
    response.writeHead(200, {
      "content-type": contentTypes[path.extname(target).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(body);
  } catch (_) {
    response.writeHead(404).end("Not found");
  }
});

await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}/`;

function canvasContext() {
  const gradient = { addColorStop() {} };
  const values = {
    canvas: null,
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => ({ setTransform() {} }),
    getImageData: (_x, _y, width = 1, height = 1) => ({
      data: new Uint8ClampedArray(Math.max(4, width * height * 4)),
      width,
      height
    }),
    createImageData: (width = 1, height = 1) => ({
      data: new Uint8ClampedArray(Math.max(4, width * height * 4)),
      width,
      height
    }),
    measureText: text => ({ width: String(text).length * 8 }),
    isPointInPath: () => false,
    isPointInStroke: () => false
  };
  return new Proxy(values, {
    get(target, property) {
      if (property in target) return target[property];
      return () => {};
    },
    set(target, property, value) {
      target[property] = value;
      return true;
    }
  });
}

function installBrowserStubs(window, width, height) {
  Object.defineProperties(window, {
    innerWidth: { configurable: true, value: width },
    innerHeight: { configurable: true, value: height },
    devicePixelRatio: { configurable: true, value: 1 },
    visualViewport: {
      configurable: true,
      value: { width, height, addEventListener() {}, removeEventListener() {} }
    }
  });

  window.matchMedia = query => {
    const max = query.match(/max-width\s*:\s*(\d+)px/i);
    const min = query.match(/min-width\s*:\s*(\d+)px/i);
    const matches = (!max || width <= Number(max[1])) &&
      (!min || width >= Number(min[1])) &&
      !query.includes("prefers-reduced-motion") &&
      !(query.includes("hover:hover") && width <= 820);
    return {
      matches,
      media: query,
      onchange: null,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent: () => true
    };
  };

  class FakeImage extends window.EventTarget {
    constructor() {
      super();
      this.width = 192;
      this.height = 192;
      this.naturalWidth = 192;
      this.naturalHeight = 192;
      this.complete = false;
      this.onload = null;
      this.onerror = null;
      this.decoding = "async";
      this._src = "";
    }
    set src(value) {
      this._src = String(value);
      window.setTimeout(() => {
        this.complete = true;
        this.onload?.(new window.Event("load"));
        this.dispatchEvent(new window.Event("load"));
      }, 0);
    }
    get src() { return this._src; }
    decode() { return Promise.resolve(); }
  }
  window.Image = FakeImage;

  class FakeAudio {
    constructor(source = "") { this.src = source; this.volume = 1; this.currentTime = 0; this.preload = "auto"; }
    load() {}
    play() { return Promise.resolve(); }
    pause() {}
    cloneNode() { return new FakeAudio(this.src); }
  }
  window.Audio = FakeAudio;

  window.HTMLCanvasElement.prototype.getContext = function getContext() {
    const context = canvasContext();
    context.canvas = this;
    return context;
  };
  window.HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,";
  window.HTMLCanvasElement.prototype.getBoundingClientRect = () => ({
    x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height,
    toJSON() { return this; }
  });

  window.Element.prototype.scrollIntoView ||= () => {};
  window.Element.prototype.animate ||= () => ({ cancel() {}, finished: Promise.resolve() });
  window.HTMLElement.prototype.requestFullscreen ||= () => Promise.resolve();
  window.document.exitFullscreen ||= () => Promise.resolve();
  window.navigator.vibrate ||= () => true;
  window.requestIdleCallback ||= callback => window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 20 }), 0);
  window.cancelIdleCallback ||= handle => window.clearTimeout(handle);
  window.ResizeObserver ||= class { observe() {} unobserve() {} disconnect() {} };
}

async function waitFor(check, message, timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = check();
    if (value) return value;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out: ${message}`);
}

async function loadApp(name, width, height) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", error => errors.push(`jsdom: ${error.message}`));
  virtualConsole.on("error", (...values) => errors.push(values.map(String).join(" ")));

  const dom = await JSDOM.fromURL(`${baseUrl}?smoke=${name}`, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) { installBrowserStubs(window, width, height); }
  });

  await waitFor(
    () => dom.window.CHERRIFT_V062 && dom.window.UI?.save && dom.window.UI?.game,
    `${name} startup`
  );
  assert.equal(dom.window.document.body.classList.contains("v062-startup-failed"), false, `${name}: startup failure screen`);
  return { dom, window: dom.window, errors };
}

function click(window, element, label) {
  assert.ok(element, `${label}: control exists`);
  element.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
}

async function exercise(name, width, height) {
  const { dom, window, errors } = await loadApp(name, width, height);
  const { document, UI } = window;
  try {
    assert.deepEqual([...window.CHERRIFT_V060.diagnostics().missingElements], [], `${name}: v0.6 UI is complete`);
    assert.deepEqual([...window.CHERRIFT_V062.diagnostics().duplicateIds], [], `${name}: no duplicate IDs`);
    assert.equal(window.CHERRIFT_V062.diagnostics().libraryServices, true, `${name}: Library services are present`);

    click(window, document.getElementById("dashboardPlayV060"), `${name}: dashboard Play`);
    await waitFor(() => !document.getElementById("worlds")?.classList.contains("hidden"), `${name} World Select`);
    assert.match(document.getElementById("worldLaunchBtn")?.textContent || "", /PLAY|JÁTÉK/i, `${name}: stage launch is enabled`);

    const startsBefore = Number(UI.save.stats?.runsStarted || 0);
    const launchButton = document.getElementById("worldLaunchBtn");
    click(window, launchButton, `${name}: World Select PLAY`);
    click(window, launchButton, `${name}: guarded second PLAY click`);
    await waitFor(() => UI.game.mode === "playing", `${name} game start`);
    assert.equal(UI.game.mode, "playing", `${name}: game starts`);
    assert.equal(document.body.classList.contains("is-playing"), true, `${name}: playing state is visible`);
    assert.ok(Number(UI.save.stats?.runsStarted || 0) <= startsBefore + 1, `${name}: double-click does not create two runs`);

    UI.game.input.keys.add("w");
    UI.game.input.skillQueued = true;
    UI.game.input.pointerActive = true;
    window.dispatchEvent(new window.Event("blur"));
    assert.equal(UI.game.input.keys.size, 0, `${name}: blur clears movement keys`);
    assert.equal(UI.game.input.skillQueued, false, `${name}: blur clears queued skill`);
    assert.equal(UI.game.input.pointerActive, false, `${name}: blur clears touch movement`);

    document.getElementById("raidWarningV040")?.classList.add("show");
    document.getElementById("bossHudV040")?.classList.add("show");
    UI.quit();
    assert.equal(document.getElementById("raidWarningV040")?.classList.contains("show"), false, `${name}: raid overlay clears on exit`);
    assert.equal(document.getElementById("bossHudV040")?.classList.contains("show"), false, `${name}: boss overlay clears on exit`);

    UI.open("libraryV0551");
    const skinsTab = document.querySelector('[data-library-tab="skins"]');
    click(window, skinsTab, `${name}: Library Skins`);
    await waitFor(() => skinsTab.classList.contains("active"), `${name} Library Skins rendering`);
    assert.ok(document.querySelectorAll("#libraryBodyV0551 .v0551-collect").length > 0, `${name}: Library Skins has visual cards`);
    assert.equal(window.getComputedStyle(document.getElementById("raidWarningV040")).pointerEvents, "none", `${name}: raid overlay cannot intercept menu clicks`);

    UI.open("chests");
    UI.save.settings.reducedMotion = true;
    const keysBeforeGacha = UI.save.keys;
    click(window, document.getElementById("openChest"), `${name}: Bloom Chest open`);
    await waitFor(() => UI.save.keys === keysBeforeGacha - 1, `${name} Gacha reward`);
    assert.ok(document.querySelector("#chestResult .gacha-reward-card-v061"), `${name}: Gacha result is a visual reward card`);
    assert.ok(document.querySelector("#chestResult .gacha-reward-icon-v061"), `${name}: Gacha result includes reward art`);

    UI.open("dailyQuests");
    await waitFor(() => document.querySelector("#dailyQuests h2")?.textContent.trim() === "Napi küldetések", `${name} Hungarian Daily Quests`);
    const englishQuestNames = new Set(["Slime Cleanup", "Keep Moving", "Stage Hunter", "Treasure Trail", "Open Sesame", "Gear Collector", "Boss Breaker"]);
    assert.equal(englishQuestNames.has(document.querySelector("#dailyListV055 h3")?.textContent.trim()), false, `${name}: dynamic quest title is Hungarian`);

    UI.open("shopV055");
    await waitFor(() => document.querySelector("#shopListV055 article p")?.textContent.trim() === "100 érme", `${name} Hungarian Shop rewards`);
    const shopRewards = [...document.querySelectorAll("#shopListV055 article p")].map(element => element.textContent.trim());
    assert.deepEqual(shopRewards, ["100 érme", "1 kulcs", "3 kulcs", "300 érme"], `${name}: Shop rewards have no dangling zero values`);

    UI.open("achievements");
    await waitFor(() => document.querySelector("#v052Achievements h3")?.textContent.trim() === "Első Virágzás", `${name} Hungarian achievement rendering`);

    UI.open("settings");
    assert.equal(document.getElementById("settingsResumeAction")?.classList.contains("hidden"), true, `${name}: Resume run stays hidden outside a paused run`);
    assert.equal(document.querySelector(".discord-login")?.disabled, true, `${name}: unfinished Discord login is safely disabled`);
    const language = document.getElementById("languageV060");
    language.value = "en";
    language.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal(document.documentElement.lang, "en", `${name}: English language applies`);
    assert.equal(document.querySelector("#settings h2")?.textContent.trim(), "Settings", `${name}: English Settings title`);
    assert.equal(window.CHERRIFT_I18N.translate("World 1-1 · Blooming Meadow"), "World 1-1 · Blooming Meadow", `${name}: English compound stage title`);
    assert.equal(window.CHERRIFT_I18N.translate("Válassz pályát lapozással, majd lent nyomj Play-t."), "Browse the stages, then press Play below.", `${name}: legacy Hungarian copy translates to English`);
    UI.open("dailyQuests");
    await waitFor(() => document.querySelector("#dailyQuests h2")?.textContent.trim() === "Daily Quests", `${name} English Daily Quests`);
    assert.equal(englishQuestNames.has(document.querySelector("#dailyListV055 h3")?.textContent.trim()), true, `${name}: dynamic quest title is English`);
    UI.openWorldSelect();
    await waitFor(() => document.getElementById("carouselStageDesc")?.textContent.includes("opening stage"), `${name} dynamic English stage description`);
    language.value = "hu";
    language.dispatchEvent(new window.Event("change", { bubbles: true }));
    assert.equal(document.documentElement.lang, "hu", `${name}: Hungarian language applies`);
    assert.equal(document.querySelector("#settings h2")?.textContent.trim(), "Beállítások", `${name}: Hungarian Settings title`);
    assert.equal(window.CHERRIFT_I18N.translate("World 1-1 · Blooming Meadow"), "Világ 1-1 · Virágzó Rét", `${name}: Hungarian compound stage title`);
    assert.equal(window.CHERRIFT_I18N.translate("Clear your first stage."), "Teljesítsd az első pályádat.", `${name}: achievement copy translates to Hungarian`);

    UI.save.settings.viewZoom = 1;
    const balancedZoom = window.CHERRIFT_V062.fairCameraZoom();
    UI.save.settings.viewZoom = 1.2;
    const closeZoom = window.CHERRIFT_V062.fairCameraZoom();
    assert.ok(closeZoom > balancedZoom && closeZoom <= 1.72, `${name}: camera setting changes a fair capped zoom`);

    window.localStorage.setItem(window.CherriftStorage.key, "{broken");
    window.localStorage.setItem("cherrift_save_backup_v04", JSON.stringify({ coins: 777, selectedSkin: "cherry_default" }));
    const recovered = window.CherriftStorage.load();
    assert.equal(recovered.coins, 777, `${name}: corrupt save recovers from backup`);
    assert.equal(recovered.schemaVersion, 5, `${name}: save migrates to schema 5`);

    if (width <= 820) {
      assert.equal(document.querySelectorAll("#globalMobileNavV052 [data-v060-open]").length, 6, `${name}: mobile nav includes all six destinations`);
      assert.ok(document.getElementById("upgradeTabsV061"), `${name}: Player Upgrade uses compact tabs`);
      assert.ok(document.getElementById("gearTabsV061"), `${name}: Gear uses compact tabs`);
      assert.ok(document.getElementById("libraryServicesV062"), `${name}: mobile Library exposes services`);
    }

    const meaningfulErrors = errors.filter(error => !/Not implemented: HTMLCanvasElement|Could not load link/i.test(error));
    assert.deepEqual(meaningfulErrors, [], `${name}: no runtime console errors`);
    return {
      name,
      viewport: `${width}x${height}`,
      camera: `${balancedZoom.toFixed(2)}–${closeZoom.toFixed(2)}`,
      libraryCards: document.querySelectorAll("#libraryBodyV0551 .v0551-collect").length
    };
  } finally {
    dom.window.close();
  }
}

try {
  const results = [];
  results.push(await exercise("desktop", 1440, 900));
  results.push(await exercise("mobile", 390, 844));
  for (const result of results) {
    console.log(`PASS ${result.name} ${result.viewport} · camera ${result.camera} · ${result.libraryCards} Library skin cards`);
  }
  console.log("CHERRIFT smoke tests passed.");
} finally {
  await new Promise(resolve => server.close(resolve));
}
