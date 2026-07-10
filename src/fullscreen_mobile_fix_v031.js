(() => {
  if (!window.CherriftGame || !window.UI) return;

  const queueViewportFix = game => {
    const g = game || window.UI?.game;
    const run = () => {
      const canvas = g?.canvas || document.getElementById("game");
      if (!canvas) return;

      canvas.style.position = "fixed";
      canvas.style.inset = "0";
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      canvas.style.minWidth = "100vw";
      canvas.style.minHeight = "100vh";
      canvas.style.display = "block";
      canvas.style.visibility = "visible";
      canvas.style.opacity = "1";

      try { g?.resize?.(); } catch (_) {}
      try { g?.render?.(); } catch (_) {}
    };

    requestAnimationFrame(run);
    setTimeout(run, 50);
    setTimeout(run, 160);
    setTimeout(run, 360);
    setTimeout(run, 700);
  };

  if (!CherriftGame.prototype.__fullscreenMobileStartFix) {
    const originalStart = CherriftGame.prototype.start;
    CherriftGame.prototype.start = async function fullscreenMobileStartFix(...args) {
      const result = await originalStart.apply(this, args);
      queueViewportFix(this);
      return result;
    };
    CherriftGame.prototype.__fullscreenMobileStartFix = true;
  }

  if (!UI.__fullscreenMobileLaunchFix && typeof UI.launchSelectedWorld === "function") {
    const originalLaunchSelectedWorld = UI.launchSelectedWorld.bind(UI);
    UI.launchSelectedWorld = function fullscreenMobileLaunchFix(...args) {
      ["worlds", "menu", "skins", "gear", "chests", "settings", "stageClearModal"].forEach(id => {
        document.getElementById(id)?.classList.add("hidden");
      });

      const result = originalLaunchSelectedWorld(...args);
      queueViewportFix(this.game);
      return result;
    };
    UI.__fullscreenMobileLaunchFix = true;
  }

  if (!UI.__fullscreenButtonViewportFix && typeof UI.fullscreen === "function") {
    const originalFullscreen = UI.fullscreen.bind(UI);
    UI.fullscreen = function fullscreenButtonViewportFix(...args) {
      const result = originalFullscreen(...args);
      queueViewportFix(this.game);
      return result;
    };
    UI.__fullscreenButtonViewportFix = true;
  }

  ["resize", "orientationchange", "fullscreenchange", "webkitfullscreenchange"].forEach(eventName => {
    window.addEventListener(eventName, () => queueViewportFix(window.UI?.game), { passive: true });
    document.addEventListener(eventName, () => queueViewportFix(window.UI?.game), { passive: true });
  });

  window.addEventListener("pageshow", () => queueViewportFix(window.UI?.game), { passive: true });
})();