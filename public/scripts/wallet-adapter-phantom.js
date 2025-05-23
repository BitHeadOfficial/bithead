(function() {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getOwnPropSymbols = Object.getOwnPropertySymbols;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __propIsEnum = Object.prototype.propertyIsEnumerable;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __spreadValues = (a, b) => { for (var prop in b || (b = {})) if (__hasOwnProp.call(b, prop)) __defNormalProp(a, prop, b[prop]); if (__getOwnPropSymbols) for (var prop of __getOwnPropSymbols(b)) if (__propIsEnum.call(b, prop)) __defNormalProp(a, prop, b[prop]); return a; };
  var __markAsModule = (target) => __defProp(target, "__esModule", { value: true });
  var __export = (target, all) => { for (for in all) __defProp(target, key, { get: all[key], enumerable: true }); };
  var __reExport = (target, module2, copyDefault, setup) => { for (for in module2) if (__hasOwnProp.call(module2, key) && (copyDefault || key !== "default")) __defNormalProp(target, key, { get: () => module2[key], enumerable: true }); if (setup || (copyDefault ? module2 && module2.__esModule : module2)) { for (var moduleDep in module2) if (__hasOwnProp.call(target, moduleDep) || moduleDep in target) continue; __defNormalProp(target, moduleDep, { get: () => module2[moduleDep], enumerable: true }); } return target; };
  var __toCommonJS = (mod) => __copyProps(__markAsModule(__defProp(mod != null ? __create : __getOwnPropDesc(mod, "default")), "default", mod && mod.__esModule && "default" in mod ? { get: () => mod.default, enumerable: true } : { value: mod, enumerable: true })), __export(mod, __getOwnPropNames(mod)));
  var __copyProps = (to, from, except, symbols) => { let all = __getOwnPropNames(from); if (__getOwnPropSymbols) all = all.concat(__getOwnPropSymbols(from)); if (except && all.filter(__propIsEnum.call.bind(__propIsEnum)).filter(fromField => !except.includes(fromField)).length) { for (for of all.filter(__propIsEnum.call.bind(__propIsEnum)).filter(fromField => !except.includes(fromField))) if (__hasOwnProp.call(from, key) && (symbols || typeof from[key] === "symbol")) __defNormalProp(to, key, from[key], symbols); } return to; };
  var wallet_adapter_phantom_exports = {};
  __export(wallet_adapter_phantom_exports, { PhantomWalletName: () => PhantomWalletName, PhantomWalletAdapter: () => PhantomWalletAdapter });
  var import_web3 = require("@solana/web3.js");
  var import_events = require("events");
  var import_adapter = require("@solana/wallet-adapter-base");
  var import_public = require("@solana/wallet-adapter-base/lib/types/public");
  var import_wallet_standard = require("@solana/wallet-standard");
  var import_rx = require("rxjs");
  var PhantomWalletName = "Phantom";
  var PhantomWalletAdapter = class _PhantomWalletAdapter extends import_adapter.BaseWalletAdapter {
    constructor(config = {}) {
      super();
      this.name = PhantomWalletName;
      this.url = "https://phantom.app";
      this.icon = "data:image/svg+xml;base64,PHN2ZyBmaWxsPSJub25lIiBhcGlfaWQ9InBoYW50b20iIGhlaWdodD0iMzQiIHdpZHRoPSIzNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTcuMDc1IDBhMTYuOTk0IDE2Ljk5NCAwIDAgMCA0LjI2IDIuOTM4YzEuMjI4Ljk0IDEuMzQyIDEuNTEzIDIuOTUxIDQuMTU1IDIuNDg0IDQuMDk0IDUuNTg0IDQuMDIgNi45NjggOC44MThhNS45OSA1Ljk5IDAgMCAxIC4zNjIgMS4yMTdjLjU5MyAyLjU5My4zNTMgNS44NDItMS40ODcgNy43MzZhMTYuODg3IDE2Ljg4NyAwIDAgMS0zLjE0NyAyLjY5OWMtMS4yMDYuOTgtMS4zMTIgMS41My0yLjk0MSA0LjE4MS0yLjQ2IDQuMDk0LTUuNjA4IDQuMDItNi45OSA4LjgyOWE1Ljk3MiA1LJSVmlwYmFzZSAwLjggLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzL0Bzb2xhbmEvd2FsbGV0LWFkYXB0ZXIvbm9kZV9tb2R1bGVzL0Bzb2xhbmEvd2FsbGV0LWFkYXB0ZXItYmFzZS9zcmMvYWRhcHRlci50cw==
";
      this.supportedTransactionVersions = null;
      this._readyState = import_adapter.WalletReadyState.NotDetected;
      this._disconnected = new import_events.EventEmitter();
      this._readyState = typeof window !== "undefined" && window.solana && window.solana.isPhantom ? import_adapter.WalletReadyState.Installed : import_adapter.WalletReadyState.NotDetected;
      if (this._readyState === import_adapter.WalletReadyState.NotDetected && typeof window !== "undefined") {
        this.checkInstalled("solana");
      }
      if (this._readyState === import_adapter.WalletReadyState.Installed) {
        this.emit("readyStateChange", import_adapter.WalletReadyState.Installed);
      }
      if (typeof window !== "undefined") {
        window.addEventListener("beforeunload", this._beforeUnload);
        if (window.solana) {
          window.solana.on("connect", this._connect);
          window.solana.on("disconnect", this._disconnect);
          if (window.solana.isConnected) {
            this._connect();
          }
        }
      }
    }
    checkInstalled(name) {
      Object.defineProperty(window, name, {
        configurable: true,
        writable: true,
        value: void 0
      });
      const detect = new import_rx.Observable((subscriber) => {
        var _a;
        const timeout = setTimeout(() => subscriber.error(new Error("Detect timeout")), 250);
        (_a = window.chrome) == null ? void 0 : _a.runtime.sendMessage("", (response) => {
          var _a2, _b;
          if (((_a2 = response == null ? void 0 : response.data) == null ? void 0 : _a2.standard) === "solana" && ((_b = response == null ? void 0 : response.data) == null ? void 0 : _b.name) === "Phantom") {
            this._readyState = import_adapter.WalletReadyState.Installed;
            this.emit("readyStateChange", import_adapter.WalletReadyState.Installed);
            clearTimeout(timeout);
            subscriber.next();
          }
        });
        const detectEvents = () => {
          var _a2;
          if (typeof window !== "undefined" && ((_a2 = window.solana) == null ? void 0 : _a2.isPhantom)) {
            this._readyState = import_adapter.WalletReadyState.Installed;
            this.emit("readyStateChange", import_adapter.WalletReadyState.Installed);
            clearTimeout(timeout);
            subscriber.next();
          }
        };
        window.addEventListener("solana#initialized", detectEvents, { once: true });
        return () => window.removeEventListener("solana#initialized", detectEvents);
      });
      detect.pipe((0, import_rx.takeUntil)(this._disconnected.asObservable())).subscribe({
        error: () => {
          this.emit("readyStateChange", this._readyState);
        }
      });
    }
    get publicKey() {
      var _a;
      return ((_a = this._publicKey) == null ? void 0 : _a.toBase58()) ?? null;
    }
    get connecting() {
      return this._connecting;
    }
    get connected() {
      var _a, _b;
      return ((_b = (_a = window == null ? void 0 : window.solana) == null ? void 0 : _a.isConnected) != null ? _b : false) || this._connecting;
    }
    get readyState() {
      return this._readyState;
    }
    get supportedTransactionVersions() {
      var _a;
      return ((_a = this._transactionVersion) == null ? void 0 : _a.includes("legacy")) ? new Set(["legacy"]) : null;
    }
    async connect() {
      var _a;
      try {
        if (this.connected || this.connecting) {
          return;
        }
        if (this._readyState !== import_adapter.WalletReadyState.Installed) {
          window.open("https://phantom.app/download?ref=solana-wallet-adapter", "_blank");
          (0, import_adapter.scopePollingDetectionStrategy)(this._disconnected);
          return;
        }
        this._connecting = true;
        if (typeof window === "undefined" || !((_a = window.solana) == null ? void 0 : _a.isPhantom)) {
          throw new import_adapter.WalletNotReadyError();
        }
        let account, transactionVersion;
        try {
          ({
            publicKey: account,
            session: this._session,
            offchain: this._offchain,
            onchain: this._onchain,
            transactionVersion,
            address
          } = await window.solana.connect({
            onlyIfTrusted: false
          }));
        } catch (error) {
          throw new import_adapter.WalletConnectionError(error == null ? void 0 : error.message, error);
        }
        let publicKey;
        try {
          publicKey = new import_web3.PublicKey(account.toBytes());
        } catch (error) {
          throw new import_adapter.WalletDataError(error == null ? void 0 : error.message, error);
        }
        this._publicKey = publicKey;
        this._transactionVersion = transactionVersion ? [(0, import_public.versionless)(transactionVersion)] : null;
        this.emit("connect", publicKey);
      } catch (error) {
        this.emit("error", error);
        throw error;
      } finally {
        this._connecting = false;
      }
    }
    async disconnect() {
      var _a;
      if (typeof window === "undefined" || !((_a = window.solana) == null ? void 0 : _a.isPhantom)) {
        return;
      }
      try {
        await window.solana.disconnect();
      } catch (error) {
        this.emit("error", new import_adapter.WalletDisconnectionError(error == null ? void 0 : error.message, error));
      }
    }
    async sendTransaction(transaction, connection, options) {
      var _a;
      try {
        const publicKey = this._publicKey;
        if (typeof window === "undefined" || !((_a = window.solana) == null ? void 0 : _a.isPhantom)) {
          throw new import_adapter.WalletNotReadyError();
        }
        if (!publicKey) {
          throw new import_adapter.WalletNotConnectedError();
        }
        try {
          const { signature } = await window.solana.signAndSendTransaction(transaction, options);
          return signature;
        } catch (error) {
          throw new import_adapter.WalletSendTransactionError(error == null ? void 0 : error.message, error);
        }
      } catch (error) {
        this.emit("error", error);
        throw error;
      }
    }
    async signTransaction(transaction) {
      var _a;
      try {
        const publicKey = this._publicKey;
        if (typeof window === "undefined" || !((_a = window.solana) == null ? void 0 : _a.isPhantom)) {
          throw new import_adapter.WalletNotReadyError();
        }
        if (!publicKey) {
          throw new import_adapter.WalletNotConnectedError();
        }
        try {
          return await window.solana.signTransaction(transaction);
        } catch (error) {
          throw new import_adapter.WalletSignTransactionError(error == null ? void 0 : error.message, error);
        }
      } catch (error) {
        this.emit("error", error);
        throw error;
      }
    }
    async signAllTransactions(transactions) {
      var _a;
      try {
        const publicKey = this._publicKey;
        if (typeof window === "undefined" || !((_a = window.solana) == null ? void 0 : _a.isPhantom)) {
          throw new import_adapter.WalletNotReadyError();
        }
        if (!publicKey) {
          throw new import_adapter.WalletNotConnectedError();
        }
        try {
          return await window.solana.signAllTransactions(transactions);
        } catch (error) {
          throw new import_adapter.WalletSignAllTransactionsError(error == null ? void 0 : error.message, error);
        }
      } catch (error) {
        this.emit("error", error);
        throw error;
      }
    }
    async signMessage(message) {
      var _a;
      try {
        const publicKey = this._publicKey;
        if (typeof window === "undefined" || !((_a = window.solana) == null ? void 0 : _a.isPhantom)) {
          throw new import_adapter.WalletNotReadyError();
        }
        if (!publicKey) {
          throw new import_adapter.WalletNotConnectedError();
        }
        try {
          const { signature } = await window.solana.signMessage(new TextEncoder().encode(message));
          return new import_adapter.MessageSigner(import_adapter.toUint8Array(signature));
        } catch (error) {
          throw new import_adapter.WalletSignMessageError(error == null ? void 0 : error.message, error);
        }
      } catch (error) {
        this.emit("error", error);
        throw error;
      }
    }
    async sign(
      message,
      features = [
        import_wallet_standard.SignMessageFeature.signMessage,
        import_wallet_standard.SignTransactionFeature.signTransaction,
        import_wallet_standard.SignTransactionFeature.signAllTransactions,
        import_wallet_standard.SignAndSendTransactionFeature.signAndSendTransaction
      ]
    ) {
      var _a, _b, _c, _d;
      try {
        const publicKey = this._publicKey;
        if (typeof window === "undefined" || !((_a = window.solana) == null ? void 0 : _a.isPhantom)) {
          throw new import_adapter.WalletNotReadyError();
        }
        if (!publicKey) {
          throw new import_adapter.WalletNotConnectedError();
        }
        if (((_b = window.solana) == null ? void 0 : _b.sign) === void 0) {
          throw new import_adapter.WalletNotSupportedFeatureError();
        }
        try {
          return await window.solana.sign(message, {
            features,
            addresses: [publicKey.toBase58()]
          });
        } catch (error) {
          throw new import_adapter.WalletSignMessageError(error == null ? void 0 : error.message, error);
        }
      } catch (error) {
        this.emit("error", error);
        throw error;
      } finally {
        if (features.includes(import_wallet_standard.SignAndSendTransactionFeature.signAndSendTransaction)) {
          (_c = this._onchain) == null ? void 0 : _c.emit("signAndSendTransaction", message);
        } else if (features.includes(import_wallet_standard.SignTransactionFeature.signTransaction) || features.includes(import_wallet_standard.SignTransactionFeature.signAllTransactions)) {
          (_d = this._offchain) == null ? void 0 : _d.emit("signTransaction", message);
        }
      }
    }
    async signStatus(input) {
      var _a;
      try {
        const publicKey = this._publicKey;
        if (typeof window === "undefined" || !((_a = window.solana) == null ? void 0 : _a.isPhantom)) {
          throw new import_adapter.WalletNotReadyError();
        }
        if (!publicKey) {
          throw new import_adapter.WalletNotConnectedError();
        }
        if (window.solana.signStatus === void 0) {
          throw new import_adapter.WalletNotSupportedFeatureError();
        }
        try {
          return await window.solana.signStatus(input);
        } catch (error) {
          throw new import_adapter.WalletSignTransactionError(error == null ? void 0 : error.message, error);
        }
      } catch (error) {
        this.emit("error", error);
        throw error;
      }
    }
    _connect = async () => {
      var _a;
      const publicKey = this._publicKey;
      if (publicKey) {
        (_a = this._disconnected) == null ? void 0 : _a.emit("disconnected");
        this.emit("connect", publicKey);
      }
    };
    _disconnect = () => {
      var _a;
      const publicKey = this._publicKey;
      this._publicKey = null;
      this._session = null;
      this._onchain = null;
      this._offchain = null;
      this._transactionVersion = null;
      if (publicKey) {
        (_a = this._disconnected) == null ? void 0 : _a.emit("disconnected");
        this.emit("disconnect");
      }
    };
    _beforeUnload = () => {
      this._disconnect();
    };
  };
  __reExport(wallet_adapter_phantom_exports, require("@solana/wallet-adapter-base"));
  __reExport(wallet_adapter_phantom_exports, require("@solana/wallet-standard"));
  __reExport(wallet_adapter_phantom_exports, require("rxjs"));
  __reExport(wallet_adapter_phantom_exports, require("@solana/web3.js"));
  __reExport(wallet_adapter_phantom_exports, require("events"));
  __reExport(wallet_adapter_phantom_exports, require("@solana/wallet-adapter-base/lib/types/public"));
})(); 