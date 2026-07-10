window.CherriftStorage = {
  key: "cherrift_save_v021",
  defaults() {
    return {
      coins: 0,
      keys: 3,
      selectedSkin: "cherry_default",
      unlockedSkins: ["cherry_default"],
      inventory: [],
      equipped: {},
      best: { time:0, kills:0 },
      settings: { volume:60, touchMode:true }
    };
  },
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? { ...this.defaults(), ...JSON.parse(raw) } : this.defaults();
    } catch(e) { return this.defaults(); }
  },
  save(data) { localStorage.setItem(this.key, JSON.stringify(data)); }
};