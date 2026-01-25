export type ChainConfig = {
  chainId: number;
  name: string;
  rpcUrl: string;
  explorerBaseUrl: string;
};

export const chains = {
  arcTestnet: {
    chainId: 5042002,
    name: "Arc Testnet",
    rpcUrl: process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL ?? "",
    explorerBaseUrl: "https://testnet.arcscan.app",
  },
  baseSepolia: {
    chainId: 84532,
    name: "Base Sepolia",
    rpcUrl: process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ?? "",
    explorerBaseUrl: "https://sepolia.basescan.org",
  },
  ethereumSepolia: {
    chainId: 11155111,
    name: "Ethereum Sepolia",
    rpcUrl: process.env.NEXT_PUBLIC_ETHEREUM_SEPOLIA_RPC_URL ?? "",
    explorerBaseUrl: "https://sepolia.etherscan.io",
  },
} as const;
