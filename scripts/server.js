require('dotenv').config();
const { ethers } = require('hardhat');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("👉 Press [ENTER] in this terminal during your demo to simulate a 1,250L water surge & trigger the smart contract!");

rl.on('line', async () => {
  console.log("\n🚨 [SIMULATED TRIGGER] Water usage crossed 1,250 Liters!");

  try {
    // 1. Read setup from .env
    const privateKey = process.env.PRIVATE_KEY;
    const rpcUrl = process.env.ARBITRUM_SEPOLIA_RPC;
    
    // Paste your deployed contract address string here if it's not in .env
    const contractAddress = process.env.CONTRACT_ADDRESS || "YOUR_DEPLOYED_CONTRACT_ADDRESS_HERE";

    // 2. Initialize provider & wallet signer
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    // 3. Attach to contract instance
    const hydroProofContract = await ethers.getContractAt("HydroProof", contractAddress, wallet);

    const targetEscrowId = 1;
    const simulatedUsage = 1250000; // 1,250 Liters in mL

    console.log("Sending automated penalty transaction to Arbitrum Sepolia...");
    const tx = await hydroProofContract.triggerPenalty(targetEscrowId, simulatedUsage);
    console.log(`✅ Transaction Hash: ${tx.hash}`);

    const receipt = await tx.wait();
    console.log(`🎉 Smart contract fulfilled on-chain in block ${receipt.blockNumber}!`);
  } catch (err) {
    console.error("Error triggering contract:", err);
  }
});