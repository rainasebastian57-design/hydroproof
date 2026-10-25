const { ethers } = require("hardhat");

async function main() {
  const escrowId = process.env.ESCROW_ID || 1;
  const simulatedWaterUsageLiters = process.env.WATER_USAGE || 1250000; // e.g. 1.25M Liters

  console.log(`\n--- HydroProof Automated Water Oracle ---`);
  console.log(`Fetching live IoT telemetry data for Data Center...`);
  console.log(`Reported Water Usage: ${simulatedWaterUsageLiters.toLocaleString()} Liters`);

  const [oracleSigner] = await ethers.getSigners();
  const hydroProofAddress = "0xf3B1C5890BCC0DD1bC3b9B8F2088B1734e2ccc95"; // Your deployed address

  const hydroProof = await ethers.getContractAt("HydroProof", hydroProofAddress, oracleSigner);

  console.log(`Submitting telemetry proof to Arbitrum Sepolia for Escrow #${escrowId}...`);
  const tx = await hydroProof.settleEscrowWithWaterData(escrowId, simulatedWaterUsageLiters);
  await tx.wait();

  console.log(`\nTransaction Confirmed! Escrow #${escrowId} settled automatically on-chain.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});