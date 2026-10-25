// Press the 'Spacebar' or 'Enter' in your terminal while recording to simulate the spike instantly!
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("👉 Press [ENTER] in this terminal during your demo to simulate a 1,250L water surge & trigger the smart contract!");

rl.on('line', async () => {
  console.log("\n🚨 [SIMULATED TRIGGER] Water usage crossed 1,250 Liters!");
  
  // Directly call your contract execution logic here
  try {
    const targetEscrowId = 0;
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