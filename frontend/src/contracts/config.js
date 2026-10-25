import HydroProofArtifact from "./HydroProof.json";
import MockUSDCArtifact from "./MockUSDC.json";

export const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;

export const CONTRACT_ADDRESSES = {
  MockUSDC: "0x928A5bB1690ef3A5A176aa22a9eA3c57aeF03B38",
  HydroProof: "0xf3B1C5890BCC0DD1bC3b9B8F2088B1734e2ccc95",
};

export const CONTRACT_ABIS = {
  MockUSDC: MockUSDCArtifact.abi,
  HydroProof: HydroProofArtifact.abi,
};

export const ARBITRUM_SEPOLIA_NETWORK_PARAMS = {
  chainId: "0x66EEE", // 421614 in hex
  chainName: "Arbitrum Sepolia",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
  blockExplorerUrls: ["https://sepolia.arbiscan.io/"],
};