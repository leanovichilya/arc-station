export const USDC_BY_CHAIN_ID: Record<number, { address: `0x${string}`; decimals: number }> = {
  5042002: { address: "0x3600000000000000000000000000000000000000", decimals: 6 },
  84532: { address: "0x036cbD53842c5426634e7929541eC2318f3dCF7e", decimals: 6 },
  11155111: { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", decimals: 6 },
};

export function getUsdcToken(chainId: number) {
  return USDC_BY_CHAIN_ID[chainId] ?? null;
}
