export const env = {
  hostChainId: Number(import.meta.env.VITE_HOST_CHAIN_ID ?? 11155111),
  gatewayChainId: Number(import.meta.env.VITE_GATEWAY_CHAIN_ID ?? 10901),
  relayerUrl: import.meta.env.VITE_RELAYER_URL ?? "https://relayer.testnet.zama.org",
  boardroomAddress: import.meta.env.VITE_BOARDROOM_CONTRACT_ADDRESS ?? "0x699F57090C5C74AcC3b7f7F2Fdc4f808Ff6a010F",
  boardroomTokenAddress: import.meta.env.VITE_BOARDROOM_TOKEN_ADDRESS ?? "0xA34d101011D4DBe18375FF2E7591b646E22c2Ff3",
  resultAdapterAddress: import.meta.env.VITE_RESULT_REVEAL_ADAPTER_ADDRESS ?? "0x0f36aa1064Cf545eb435E33e4F23dec098362E7C",
  sepoliaRpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com"
};
