import { createInstance, initSDK, SepoliaConfig } from "@zama-fhe/relayer-sdk/bundle";
import { env } from "../lib/env";

let relayerPromise: Promise<Awaited<ReturnType<typeof createInstance>>> | null = null;
let initPromise: Promise<unknown> | null = null;

async function ensureSdk() {
  if (!initPromise) {
    initPromise = initSDK().catch((error: unknown) => {
      initPromise = null;
      throw error;
    });
  }

  await initPromise;
}

export async function getRelayer() {
  if (!relayerPromise) {
    await ensureSdk();

    relayerPromise = createInstance({
      ...SepoliaConfig,
      network: window.ethereum ?? env.sepoliaRpcUrl
    }).catch((error: unknown) => {
      relayerPromise = null;
      throw error;
    });
  }

  return relayerPromise;
}
