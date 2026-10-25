// scripts/iotSensorSimulator.js
const axios = require('axios');
const crypto = require('crypto');

// Configuration
const ORACLE_ENDPOINT = 'http://localhost:3001/api/telemetry';
const DEVICE_ID = 'ESP32-HYDRO-METER-09X';
const ESCROW_ID = 1;

// Base configuration: baseline liters per second
let totalLitersConsumed = 850000; // Starts at 850k Liters

function generateTelemetryPacket() {
  // Simulate continuous water flow in a cooling tower
  const flowRatePerSec = Math.floor(Math.random() * 50) + 100; // 100-150 L/s
  totalLitersConsumed += flowRatePerSec * 100; // Fast-forwarded time increment

  const payload = {
    deviceId: DEVICE_ID,
    escrowId: ESCROW_ID,
    timestamp: new Date().toISOString(),
    flowRateLitersPerSec: flowRatePerSec,
    totalLitersConsumed: totalLitersConsumed,
    // Simulate a device signature to prove payload authenticity
    signature: crypto.createHash('sha256').update(`${DEVICE_ID}:${totalLitersConsumed}`).digest('hex')
  };

  return payload;
}

async function startIoTSensor() {
  console.log(`====================================================`);
  console.log(`🤖 [Hardware Simulator Started]: ${DEVICE_ID}`);
  console.log(`📡 Emulating YF-S201 Water Flow Sensor Telemetry`);
  console.log(`====================================================\n`);

  setInterval(async () => {
    const telemetry = generateTelemetryPacket();
    console.log(`[SENSOR OUTPUT] Timestamp: ${telemetry.timestamp}`);
    console.log(`               Total Water Consumed: ${telemetry.totalLitersConsumed.toLocaleString()} Liters`);
    console.log(`               Flow Rate: ${telemetry.flowRateLitersPerSec} L/s`);

    try {
      // Send telemetry to the Oracle server
      const response = await axios.post(ORACLE_ENDPOINT, telemetry);
      console.log(`STATUS: Telemetry broadcasted to Oracle -> ${response.data.status}\n`);
    } catch (error) {
      console.log(`STATUS: Telemetry logged locally (Oracle offline or pending trigger)\n`);
    }
  }, 3000); // Sends telemetry packet every 3 seconds
}

startIoTSensor();