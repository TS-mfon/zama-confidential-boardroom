import { createInstance, SepoliaConfig } from "@zama-fhe/relayer-sdk/web";
import { env } from "../lib/env";

let relayerPromise: Promise<Awaited<ReturnType<typeof createInstance>>> | null = null;

export async function getRelayer() {
  if (!relayerPromise) {
    relayerPromise = createInstance({
      ...SepoliaConfig,
      network: env.sepoliaRpcUrl
    }).catch((error: unknown) => {
      relayerPromise = null;
      throw error;
    });
  }

  return relayerPromise;
}
