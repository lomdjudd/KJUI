// Stockage persistant : passe par le pont Android (SharedPreferences) quand le jeu
// tourne dans l'APK, sinon par localStorage. Toutes les erreurs sont absorbées :
// le jeu doit rester jouable même si le stockage est indisponible (navigation privée…).

const bridge = typeof window !== 'undefined' ? window.AndroidBridge : null;
const memory = new Map();

function lsGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.has(key) ? memory.get(key) : null;
  }
}
function lsSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
}
function lsRemove(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    memory.delete(key);
  }
}

export const storage = {
  native: !!bridge,
  get(key) {
    if (bridge) {
      try {
        const v = bridge.getItem(key);
        if (v !== null && v !== undefined && v !== '') return v;
      } catch {
        /* repli sur localStorage */
      }
    }
    return lsGet(key);
  },
  set(key, value) {
    if (bridge) {
      try {
        bridge.setItem(key, value);
      } catch {
        /* repli */
      }
    }
    lsSet(key, value);
  },
  remove(key) {
    if (bridge) {
      try {
        bridge.removeItem(key);
      } catch {
        /* repli */
      }
    }
    lsRemove(key);
  },
  getJSON(key, fallback = null) {
    const raw = this.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },
  setJSON(key, obj) {
    this.set(key, JSON.stringify(obj));
  },
};

export const native = {
  available: !!bridge,
  vibrate(ms) {
    if (bridge && bridge.vibrate) {
      try {
        bridge.vibrate(Math.round(ms));
      } catch {
        /* ignore */
      }
    } else if (navigator.vibrate) {
      try {
        navigator.vibrate(Math.round(ms));
      } catch {
        /* ignore */
      }
    }
  },
  exit() {
    if (bridge && bridge.exitApp) bridge.exitApp();
  },
  deviceInfo() {
    if (bridge && bridge.deviceInfo) {
      try {
        return JSON.parse(bridge.deviceInfo());
      } catch {
        return null;
      }
    }
    return null;
  },
};
