// scripts/oracleServer.js
const express = require('express');
const { ethers } = require('hardhat');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 3001;
const HYDROPROOF_ADDRESS = "YOUR_DEPLOYED_CONTRACT_ADDRESS"; 

app.post('/api/telemetry', async (req, res) => {
  const { deviceId, escrowId, totalLitersConsumed, signature } = req.body;

  console.log(`\n[ORACLE RECEIVED TELEMETRY]`);
  console.log(`Device ID: ${deviceId} | Escrow ID: ${escrowId}`);
  console.log(`Water Usage: ${totalLitersConsumed.toLocaleString()} Liters`);

  try {
    const [oracleSigner] = await ethers.getSigners();
    const hydroProof = await ethers.getContractAt("HydroProof", HYDROPROOF_ADDRESS, oracleSigner);

    // Fetch threshold from contract
    const escrow = await hydroProof.escrows(escrowId);
    const threshold = Number(escrow.waterThresholdLiters);

    if (totalLitersConsumed > threshold && Number(escrow.status) === 1) { // Status 1 = FUNDED
      console.log(`🚨 BREACH DETECTED: ${totalLitersConsumed} L exceeds ${threshold} L threshold!`);
      console.log(`Executing automated settlement on Arbitrum Sepolia...`);

      const tx = await hydroProof.settleEscrowWithWaterData(escrowId, totalLitersConsumed);
      await tx.wait();

      console.log(`SUCCESS: Escrow #${escrowId} settled on-chain. Compensation released.`);
      return res.json({ status: "SETTLED_ON_CHAIN", txHash: tx.hash });
    }

    res.json({ status: "LOGGED_UNDER_THRESHOLD", usage: totalLitersConsumed });
  } catch (err) {
    console.error("Oracle processing error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Oracle Bridge listening on http://localhost:${PORT}`));