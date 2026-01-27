import { BridgeKit } from "@circle-fin/bridge-kit";
import { createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import type { EIP1193Provider } from "viem";

const kit = new BridgeKit();

export function getBridgeKit() {
  return kit;
}

export async function createBrowserAdapter(provider: EIP1193Provider) {
  return createViemAdapterFromProvider({ provider });
}

const BRIDGE_CHAIN_BY_ID: Record<number, string> = {
  5042002: "Arc_Testnet",
  84532: "Base_Sepolia",
  11155111: "Ethereum_Sepolia",
};

export function getBridgeChainName(chainId: number) {
  return BRIDGE_CHAIN_BY_ID[chainId] ?? null;
}

const TOKEN_MESSENGER_V2_BY_CHAIN_ID: Record<number, string> = {
  5042002: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
  84532: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
  11155111: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA",
};

export function getTokenMessengerV2Address(chainId: number) {
  return TOKEN_MESSENGER_V2_BY_CHAIN_ID[chainId] ?? null;
}
