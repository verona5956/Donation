import { FhevmRelayerSDKType, FhevmWindowType } from "./fhevmTypes";
import { SDK_CDN_URL, SDK_LOCAL_URL } from "./constants";

type TraceType = (message?: unknown, ...optionalParams: unknown[]) => void;

export class RelayerSDKLoader {
  private _trace?: TraceType;

  constructor(options: { trace?: TraceType }) {
    this._trace = options.trace;
  }

  public load(): Promise<void> {
    if (typeof window === "undefined") {
      return Promise.reject(new Error("RelayerSDKLoader: can only be used in the browser."));
    }

    if ("relayerSDK" in window) {
      if (!isFhevmRelayerSDKType(window.relayerSDK, this._trace)) {
        throw new Error("RelayerSDKLoader: Unable to load FHEVM Relayer SDK");
      }
      return Promise.resolve();
    }

    const attemptLoad = (url: string) =>
      new Promise<void>((resolve, reject) => {
        const existingScript = document.querySelector(`script[src="${url}"]`);
        if (existingScript) {
          if (!isFhevmWindowType(window, this._trace)) {
            reject(new Error("RelayerSDKLoader: window object invalid"));
            return;
          }
          resolve();
          return;
        }
        const script = document.createElement("script");
        script.src = url;
        script.type = "text/javascript";
        script.async = true;
        script.onload = () => {
          if (!isFhevmWindowType(window, this._trace)) {
            reject(new Error(`RelayerSDKLoader: SDK loaded but invalid relayerSDK object from ${url}`));
            return;
          }
          resolve();
        };
        script.onerror = () => reject(new Error(`RelayerSDKLoader: Failed to load Relayer SDK from ${url}`));
        document.head.appendChild(script);
      });

    return attemptLoad(SDK_CDN_URL).catch(async () => {
      this._trace?.(`RelayerSDKLoader: CDN load failed, trying local SDK at ${SDK_LOCAL_URL}`);
      return attemptLoad(SDK_LOCAL_URL);
    });
  }
}

export function isFhevmWindowType(win: unknown, trace?: TraceType): win is FhevmWindowType {
  if (typeof win !== "object" || win === null) {
    trace?.("RelayerSDKLoader: window is invalid");
    return false;
  }
  if (!("relayerSDK" in win)) {
    trace?.("RelayerSDKLoader: missing window.relayerSDK");
    return false;
  }
  return isFhevmRelayerSDKType((win as any).relayerSDK, trace);
}

function isFhevmRelayerSDKType(o: unknown, trace?: TraceType): o is FhevmRelayerSDKType {
  if (typeof o !== "object" || o === null) {
    trace?.("RelayerSDKLoader: relayerSDK invalid");
    return false;
  }
  const has = (k: string, t: string) => {
    const v = (o as any)[k];
    return typeof v === t;
  };
  if (!has("initSDK", "function")) return false;
  if (!has("createInstance", "function")) return false;
  if (!has("EthereumConfig", "object")) return false;
  return true;
}


