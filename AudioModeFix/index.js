var __plugin__ = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/index.ts
  var src_exports = {};
  __export(src_exports, {
    default: () => src_default
  });
  var { instead } = vendetta.patcher;
  var { findByProps } = vendetta.metro;
  var { FluxDispatcher } = vendetta.metro.common;
  var { showToast } = vendetta.ui.toasts;
  var { getAssetIDByName } = vendetta.ui.assets;
  var MODULE_CANDIDATES = [
    "InCallManager",
    "AudioManager",
    "RTCManager",
    "VoiceEngine",
    "MediaEngine",
    "RNInCallManager",
    "AndroidAudioManager"
  ];
  var MODE_NORMAL = 0;
  var MODE_IN_COMMUNICATION = 3;
  var MODE_IN_CALL = 2;
  var TYPE_BLUETOOTH_SCO = 7;
  var unpatches = [];
  var patchCount = 0;
  function log(msg) {
    console.log(`[AudioModeFix] ${msg}`);
  }
  function patchMethod(moduleName, module, method, handler) {
    if (!module || typeof module[method] !== "function")
      return;
    const key = `${moduleName}.${method}`;
    try {
      const unpatch = instead(method, module, (args, orig) => {
        return handler(args, orig);
      });
      unpatches.push(unpatch);
      patchCount++;
      log(`Patched ${key}`);
    } catch (e) {
      const original = module[method].bind(module);
      module[method] = (...args) => handler(args, original);
      unpatches.push(() => {
        module[method] = original;
      });
      patchCount++;
      log(`Patched ${key} (fallback/direct replace)`);
    }
  }
  function discoverAndPatch() {
    patchCount = 0;
    const patched = /* @__PURE__ */ new Set();
    const RN = globalThis.ReactNative ?? require?.("react-native");
    const nativeModules = RN?.NativeModules ?? {};
    for (const name of MODULE_CANDIDATES) {
      const mod = nativeModules[name];
      if (!mod)
        continue;
      log(`Found native module: ${name}`);
      applyPatches(name, mod, patched);
    }
    try {
      const modBySetMode = findByProps("setMode", "getMode");
      if (modBySetMode && !patched.has("setMode")) {
        log("Found module via findByProps(setMode)");
        applyPatches("MetroSetMode", modBySetMode, patched);
      }
    } catch (_) {
    }
    try {
      const modBySco = findByProps("startBluetoothSco");
      if (modBySco && !patched.has("startBluetoothSco")) {
        log("Found module via findByProps(startBluetoothSco)");
        applyPatches("MetroSco", modBySco, patched);
      }
    } catch (_) {
    }
    for (const [name, mod] of Object.entries(nativeModules)) {
      if (!mod || typeof mod !== "object")
        continue;
      const hasAudioMethods = typeof mod.setMode === "function" || typeof mod.startBluetoothSco === "function";
      if (hasAudioMethods) {
        log(`Found via brute scan: ${name}`);
        applyPatches(name, mod, patched);
      }
    }
    log(`Total patches applied: ${patchCount} | Methods: ${[...patched].join(", ")}`);
    if (patchCount > 0) {
      showToast("AudioModeFix aktif \u{1F3B5}", getAssetIDByName("ic_headset"));
    } else {
      log("WARN: 0 patches! Discord mungkin update nama modul.");
      showToast("AudioModeFix: modul tidak ditemukan \u26A0\uFE0F", getAssetIDByName("ic_warning"));
    }
  }
  function applyPatches(moduleName, mod, patched) {
    if (typeof mod.setMode === "function" && !patched.has("setMode")) {
      patched.add("setMode");
      patchMethod(moduleName, mod, "setMode", (args, orig) => {
        const mode = args[0];
        if (mode === MODE_IN_COMMUNICATION || mode === MODE_IN_CALL) {
          log(`BLOCKED setMode(${mode}) \u2192 dipaksa MODE_NORMAL`);
          return orig(MODE_NORMAL);
        }
        return orig(...args);
      });
    }
    if (typeof mod.startBluetoothSco === "function" && !patched.has("startBluetoothSco")) {
      patched.add("startBluetoothSco");
      patchMethod(moduleName, mod, "startBluetoothSco", (_args, _orig) => {
        log("BLOCKED startBluetoothSco()");
        return void 0;
      });
    }
    if (typeof mod.setBluetoothScoOn === "function" && !patched.has("setBluetoothScoOn")) {
      patched.add("setBluetoothScoOn");
      patchMethod(moduleName, mod, "setBluetoothScoOn", (_args, _orig) => {
        log("BLOCKED setBluetoothScoOn()");
        return void 0;
      });
    }
    if (typeof mod.setCommunicationDevice === "function" && !patched.has("setCommunicationDevice")) {
      patched.add("setCommunicationDevice");
      patchMethod(moduleName, mod, "setCommunicationDevice", (args, orig) => {
        const device = args[0];
        if (device?.type === TYPE_BLUETOOTH_SCO) {
          log(`BLOCKED setCommunicationDevice(BT_SCO)`);
          return void 0;
        }
        return orig(...args);
      });
    }
  }
  function onVoiceChannelSelect({ channelId }) {
    if (channelId !== null) {
      log(`Join voice channel ${channelId} \u2014 memastikan patch aktif`);
      if (patchCount === 0)
        discoverAndPatch();
    }
  }
  var src_default = {
    onLoad() {
      log("Plugin loaded, menginisialisasi patch...");
      discoverAndPatch();
      FluxDispatcher.subscribe("VOICE_CHANNEL_SELECT", onVoiceChannelSelect);
    },
    onUnload() {
      log("Plugin unloaded, membersihkan semua patch...");
      FluxDispatcher.unsubscribe("VOICE_CHANNEL_SELECT", onVoiceChannelSelect);
      for (const unpatch of unpatches) {
        try {
          unpatch();
        } catch (_) {
        }
      }
      unpatches.length = 0;
      patchCount = 0;
    }
  };
  return __toCommonJS(src_exports);
})();
module.exports = __plugin__?.default ?? __plugin__;
