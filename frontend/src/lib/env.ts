export const env = {
  hostChainId: Number(import.meta.env.VITE_HOST_CHAIN_ID ?? 11155111),
  gatewayChainId: Number(import.meta.env.VITE_GATEWAY_CHAIN_ID ?? 10901),
  relayerUrl: import.meta.env.VITE_RELAYER_URL ?? "https://relayer.testnet.zama.org",
  boardroomAddress: import.meta.env.VITE_BOARDROOM_CONTRACT_ADDRESS ?? "0x2Da12543C8389C4C70Ae5560c57830bE0C84B2C9",
  boardroomTokenAddress: import.meta.env.VITE_BOARDROOM_TOKEN_ADDRESS ?? "0x191B0d8E70b7866e834821D8DB2bC37780767538",
  resultAdapterAddress: import.meta.env.VITE_RESULT_REVEAL_ADAPTER_ADDRESS ?? "0x45119A32ca6C4d67424401dA92Abe4EC6c83f8Ce",
  sepoliaRpcUrl: import.meta.env.VITE_SEPOLIA_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com"
};
