const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying contracts with account:", deployer.address);

  // 1. Deploy MockUSDC
  console.log("Deploying MockUSDC...");
  const MockUSDC = await hre.ethers.getContractFactory("MockUSDC");
  const mockUsdc = await MockUSDC.deploy();
  await mockUsdc.waitForDeployment();
  const mockUsdcAddress = await mockUsdc.getAddress();
  console.log("MockUSDC deployed to:", mockUsdcAddress);

  // 2. Deploy HydroProof
  console.log("Deploying HydroProof...");
  const HydroProof = await hre.ethers.getContractFactory("HydroProof");
  const hydroProof = await HydroProof.deploy();
  await hydroProof.waitForDeployment();
  const hydroProofAddress = await hydroProof.getAddress();
  console.log("HydroProof deployed to:", hydroProofAddress);

  console.log("\nDeployment Summary:");
  console.log("-------------------");
  console.log("MockUSDC:", mockUsdcAddress);
  console.log("HydroProof:", hydroProofAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });