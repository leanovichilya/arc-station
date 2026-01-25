export type ChainConfig = {
  id: number;
  name: string;
  explorer: string;
};

export const chains = {
  arcTestnet: {
    id: 5042002,
    name: "Arc Testnet",
    explorer: "https://testnet.arcscan.app",
  },
  baseSepolia: {
    id: 84532,
    name: "Base Sepolia",
    explorer: "https://sepolia.basescan.org",
  },
  ethereumSepolia: {
    id: 11155111,
    name: "Ethereum Sepolia",
    explorer: "https://sepolia.etherscan.io",
  },
} as const;
