import { env } from "../lib/env";

type RelayerSdk = typeof import("@zama-fhe/relayer-sdk/web");

let sdkPromise: Promise<RelayerSdk> | null = null;
let relayerPromise: Promise<Awaited<ReturnType<RelayerSdk["createInstance"]>>> | null = null;
let initPromise: Promise<unknown> | null = null;

function loadSdk() {
  if (!sdkPromise) {
    sdkPromise = import("@zama-fhe/relayer-sdk/web");
  }

  return sdkPromise;
}

async function ensureSdk() {
  if (!initPromise) {
    initPromise = loadSdk().then((sdk) => sdk.initSDK()).catch((error: unknown) => {
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
}

export async function getRelayer() {
  if (!relayerPromise) {
    await ensureSdk();
    const sdk = await loadSdk();

    relayerPromise = sdk.createInstance({
      ...sdk.SepoliaConfig,
      network: window.ethereum ?? env.sepoliaRpcUrl
    }).catch((error: unknown) => {
      relayerPromise = null;
      throw error;
    });
  }

  return relayerPromise;
}

export function warmRelayer() {
  void getRelayer().catch(() => {
    // The click handler will surface the actionable error if the SDK still fails.
  });
}
