import React, { useState, useEffect } from "react";
import { ethers } from "ethers";
import {
  CONTRACT_ADDRESSES,
  CONTRACT_ABIS,
  ARBITRUM_SEPOLIA_CHAIN_ID,
  ARBITRUM_SEPOLIA_NETWORK_PARAMS,
} from "./contracts/config";

const ESCROW_STATUS_MAP = ["AWAITING_DEPOSIT", "FUNDED", "COMPLETED", "REFUNDED"];

export default function App() {
  const [account, setAccount] = useState(null);
  const [networkOk, setNetworkOk] = useState(false);
  const [usdcBalance, setUsdcBalance] = useState("0");
  const [ethBalance, setEthBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  // Create Escrow State
  const [sellerAddress, setSellerAddress] = useState("");
  const [escrowAmount, setEscrowAmount] = useState("");

  // Escrow Lookup State
  const [searchId, setSearchId] = useState("");
  const [activeEscrow, setActiveEscrow] = useState(null);

  const checkConnection = async () => {
    if (!window.ethereum) return;
    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_accounts", []);
      const network = await provider.getNetwork();

      const isCorrectNetwork = Number(network.chainId) === ARBITRUM_SEPOLIA_CHAIN_ID;
      setNetworkOk(isCorrectNetwork);

      if (accounts.length > 0) {
        setAccount(accounts[0]);
        if (isCorrectNetwork) {
          fetchBalances(accounts[0], provider);
        }
      }
    } catch (err) {
      console.error("Connection check failed:", err);
    }
  };

  useEffect(() => {
    checkConnection();

    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accounts) => {
        if (accounts.length > 0) {
          setAccount(accounts[0]);
          checkConnection();
        } else {
          setAccount(null);
          setUsdcBalance("0");
          setEthBalance("0");
        }
      });

      window.ethereum.on("chainChanged", () => {
        window.location.reload();
      });
    }
  }, []);

  const switchNetwork = async () => {
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: ARBITRUM_SEPOLIA_NETWORK_PARAMS.chainId }],
      });
    } catch (switchError) {
      if (switchError.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [ARBITRUM_SEPOLIA_NETWORK_PARAMS],
        });
      }
    }
  };

  const connectWallet = async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask to use HydroProof.");
      return;
    }
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const accounts = await provider.send("eth_requestAccounts", []);
      const network = await provider.getNetwork();

      if (Number(network.chainId) !== ARBITRUM_SEPOLIA_CHAIN_ID) {
        await switchNetwork();
      }

      setAccount(accounts[0]);
      setNetworkOk(true);
      fetchBalances(accounts[0], provider);
    } catch (err) {
      console.error("Wallet connection failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchBalances = async (userAddress, provider) => {
    try {
      const rawEth = await provider.getBalance(userAddress);
      setEthBalance(parseFloat(ethers.formatEther(rawEth)).toFixed(4));

      const usdcContract = new ethers.Contract(
        CONTRACT_ADDRESSES.MockUSDC,
        CONTRACT_ABIS.MockUSDC,
        provider
      );

      const rawUsdc = await usdcContract.balanceOf(userAddress);
      const decimals = await usdcContract.decimals();
      setUsdcBalance(ethers.formatUnits(rawUsdc, decimals));
    } catch (err) {
      console.error("Error fetching balances:", err);
    }
  };

  const handleCreateEscrow = async () => {
    if (!sellerAddress || !escrowAmount) {
      alert("Provide both seller address and amount.");
      return;
    }
    try {
      setLoading(true);
      setStatusMessage("Creating escrow contract...");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const usdcContract = new ethers.Contract(CONTRACT_ADDRESSES.MockUSDC, CONTRACT_ABIS.MockUSDC, provider);
      const decimals = await usdcContract.decimals();
      const parsedAmount = ethers.parseUnits(escrowAmount, decimals);

      const hydroProof = new ethers.Contract(CONTRACT_ADDRESSES.HydroProof, CONTRACT_ABIS.HydroProof, signer);
      const tx = await hydroProof.createEscrow(sellerAddress, CONTRACT_ADDRESSES.MockUSDC, parsedAmount);

      setStatusMessage("Transaction submitted. Waiting for confirmation...");
      const receipt = await tx.wait();

      const event = receipt.logs.find((log) => {
        try {
          return hydroProof.interface.parseLog(log)?.name === "EscrowCreated";
        } catch {
          return false;
        }
      });

      if (event) {
        const parsedLog = hydroProof.interface.parseLog(event);
        const newId = parsedLog.args.escrowId.toString();
        setStatusMessage(`Escrow #${newId} created successfully!`);
        setSearchId(newId);
        fetchEscrowDetails(newId);
      } else {
        setStatusMessage("Escrow created successfully!");
      }
    } catch (err) {
      console.error("Create Escrow failed:", err);
      setStatusMessage(`Error: ${err.reason || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchEscrowDetails = async (idToFetch) => {
    const id = idToFetch || searchId;
    if (!id) return;
    try {
      setLoading(true);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const hydroProof = new ethers.Contract(CONTRACT_ADDRESSES.HydroProof, CONTRACT_ABIS.HydroProof, provider);

      const escrowData = await hydroProof.escrows(id);

      if (escrowData.buyer === ethers.ZeroAddress) {
        setStatusMessage(`Escrow #${id} does not exist.`);
        setActiveEscrow(null);
        return;
      }

      const usdcContract = new ethers.Contract(CONTRACT_ADDRESSES.MockUSDC, CONTRACT_ABIS.MockUSDC, provider);
      const decimals = await usdcContract.decimals();

      setActiveEscrow({
        id,
        buyer: escrowData.buyer,
        seller: escrowData.seller,
        token: escrowData.token,
        amount: ethers.formatUnits(escrowData.amount, decimals),
        rawAmount: escrowData.amount,
        status: Number(escrowData.status),
        statusName: ESCROW_STATUS_MAP[Number(escrowData.status)],
      });
      setStatusMessage(`Loaded Escrow #${id}`);
    } catch (err) {
      console.error("Fetch Escrow failed:", err);
      setStatusMessage(`Error fetching escrow: ${err.reason || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUSDC = async () => {
    if (!activeEscrow) return;
    try {
      setLoading(true);
      setStatusMessage("Approving USDC spending allowance...");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const usdcContract = new ethers.Contract(CONTRACT_ADDRESSES.MockUSDC, CONTRACT_ABIS.MockUSDC, signer);
      const tx = await usdcContract.approve(CONTRACT_ADDRESSES.HydroProof, activeEscrow.rawAmount);

      setStatusMessage("Approval pending...");
      await tx.wait();
      setStatusMessage("USDC spending approved! Now click 'Fund Escrow'.");
    } catch (err) {
      console.error("Approval failed:", err);
      setStatusMessage(`Approval error: ${err.reason || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!activeEscrow) return;
    try {
      setLoading(true);
      setStatusMessage(`Depositing ${activeEscrow.amount} USDC...`);
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const hydroProof = new ethers.Contract(CONTRACT_ADDRESSES.HydroProof, CONTRACT_ABIS.HydroProof, signer);
      const tx = await hydroProof.deposit(activeEscrow.id);

      setStatusMessage("Deposit transaction pending...");
      await tx.wait();
      setStatusMessage(`Escrow #${activeEscrow.id} successfully funded!`);
      fetchEscrowDetails(activeEscrow.id);
      fetchBalances(account, provider);
    } catch (err) {
      console.error("Deposit failed:", err);
      setStatusMessage(`Deposit error: ${err.reason || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRelease = async () => {
    if (!activeEscrow) return;
    try {
      setLoading(true);
      setStatusMessage("Releasing escrow funds to seller...");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const hydroProof = new ethers.Contract(CONTRACT_ADDRESSES.HydroProof, CONTRACT_ABIS.HydroProof, signer);
      const tx = await hydroProof.release(activeEscrow.id);

      setStatusMessage("Release transaction pending...");
      await tx.wait();
      setStatusMessage(`Escrow #${activeEscrow.id} completed! Funds released.`);
      fetchEscrowDetails(activeEscrow.id);
      fetchBalances(account, provider);
    } catch (err) {
      console.error("Release failed:", err);
      setStatusMessage(`Release error: ${err.reason || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!activeEscrow) return;
    try {
      setLoading(true);
      setStatusMessage("Refunding escrow funds to buyer...");
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const hydroProof = new ethers.Contract(CONTRACT_ADDRESSES.HydroProof, CONTRACT_ABIS.HydroProof, signer);
      const tx = await hydroProof.refund(activeEscrow.id);

      setStatusMessage("Refund transaction pending...");
      await tx.wait();
      setStatusMessage(`Escrow #${activeEscrow.id} refunded to buyer.`);
      fetchEscrowDetails(activeEscrow.id);
      fetchBalances(account, provider);
    } catch (err) {
      console.error("Refund failed:", err);
      setStatusMessage(`Refund error: ${err.reason || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.logoArea}>
          <span style={styles.logoDot}></span>
          <h1 style={styles.logoText}>HYDROPROOF</h1>
          <span style={styles.networkBadge}>Arbitrum Sepolia</span>
        </div>
        <div>
          {!account ? (
            <button onClick={connectWallet} disabled={loading} style={styles.primaryButton}>
              {loading ? "Connecting..." : "Connect Wallet"}
            </button>
          ) : (
            <div style={styles.accountBadge}>
              <span style={{ color: networkOk ? "#10b981" : "#ef4444" }}>●</span>
              <span>{account.substring(0, 6)}...{account.substring(account.length - 4)}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main style={styles.main}>
        {!account ? (
          <div style={styles.welcomeCard}>
            <h2 style={styles.welcomeTitle}>HydroProof Protocol</h2>
            <p style={styles.welcomeSubtitle}>Trustless water accountability & automated escrow for AI infrastructure.</p>
            <button onClick={connectWallet} disabled={loading} style={styles.largeButton}>
              {loading ? "Connecting..." : "Connect MetaMask to Start"}
            </button>
          </div>
        ) : (
          <div style={styles.grid}>
            {/* Left Column: Balances & Info */}
            <div style={styles.column}>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Wallet Overview</h3>
                <div style={styles.balanceRow}>
                  <span style={styles.label}>ETH Balance:</span>
                  <span style={styles.value}>{ethBalance} ETH</span>
                </div>
                <div style={styles.balanceRow}>
                  <span style={styles.label}>USDC Balance:</span>
                  <span style={styles.value}>{usdcBalance} USDC</span>
                </div>
                <button 
                  onClick={() => fetchBalances(account, new ethers.BrowserProvider(window.ethereum))}
                  style={styles.secondaryButton}
                >
                  Refresh Balances
                </button>
              </div>

              {/* Create Escrow Card */}
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Create New Escrow</h3>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>Seller Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={sellerAddress}
                    onChange={(e) => setSellerAddress(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <div style={styles.inputGroup}>
                  <label style={styles.inputLabel}>Amount (USDC)</label>
                  <input
                    type="number"
                    placeholder="100"
                    value={escrowAmount}
                    onChange={(e) => setEscrowAmount(e.target.value)}
                    style={styles.input}
                  />
                </div>
                <button onClick={handleCreateEscrow} disabled={loading} style={styles.primaryButtonFull}>
                  {loading ? "Processing..." : "Create Escrow Contract"}
                </button>
              </div>
            </div>

            {/* Right Column: Lookup & Management */}
            <div style={styles.column}>
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Manage Escrow Contract</h3>
                <div style={styles.searchRow}>
                  <input
                    type="number"
                    placeholder="Enter Escrow ID"
                    value={searchId}
                    onChange={(e) => setSearchId(e.target.value)}
                    style={styles.inputFlex}
                  />
                  <button onClick={() => fetchEscrowDetails()} disabled={loading} style={styles.secondaryButton}>
                    Fetch ID
                  </button>
                </div>

                {activeEscrow && (
                  <div style={styles.escrowBox}>
                    <div style={styles.escrowHeader}>
                      <strong>Escrow #{activeEscrow.id}</strong>
                      <span style={styles.statusBadge}>{activeEscrow.statusName}</span>
                    </div>
                    <p style={styles.escrowText}><strong>Buyer:</strong> {activeEscrow.buyer}</p>
                    <p style={styles.escrowText}><strong>Seller:</strong> {activeEscrow.seller}</p>
                    <p style={styles.escrowText}><strong>Amount:</strong> {activeEscrow.amount} USDC</p>

                    <div style={styles.actionRow}>
                      {activeEscrow.status === 0 && (
                        <>
                          <button onClick={handleApproveUSDC} disabled={loading} style={styles.warningButton}>
                            1. Approve USDC
                          </button>
                          <button onClick={handleDeposit} disabled={loading} style={styles.successButton}>
                            2. Fund Escrow
                          </button>
                        </>
                      )}

                      {activeEscrow.status === 1 && (
                        <>
                          <button onClick={handleRelease} disabled={loading} style={styles.successButton}>
                            Release Funds
                          </button>
                          <button onClick={handleRefund} disabled={loading} style={styles.dangerButton}>
                            Refund Buyer
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {statusMessage && (
                <div style={styles.statusBanner}>
                  <strong>Status:</strong> {statusMessage}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  container: {
    minHeight: "100vh", backgroundColor: "#f8fafc", color: "#1e293b", fontFamily: "Inter, sans-serif", display: "flex", flexDirection: "column"
  },
  header: {
    height: "70px", backgroundColor: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "0 2rem", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
  },
  logoArea: {
    display: "flex", alignItems: "center", gap: "0.75rem"
  },
  logoDot: {
    width: "12px", height: "12px", backgroundColor: "#3b82f6", borderRadius: "50%"
  },
  logoText: {
    fontSize: "1.2rem", fontWeight: "800", letterSpacing: "0.05em", color: "#0f172a", margin: 0
  },
  networkBadge: {
    fontSize: "0.75rem", backgroundColor: "#eff6ff", color: "#3b82f6", padding: "0.2rem 0.6rem", borderRadius: "20px", fontWeight: "600", marginLeft: "1rem"
  },
  accountBadge: {
    display: "flex", alignItems: "center", gap: "0.5rem", backgroundColor: "#f1f5f9", padding: "0.4rem 0.8rem", borderRadius: "8px", fontSize: "0.85rem", fontWeight: "600"
  },
  main: {
    flex: 1, padding: "2.5rem", maxWidth: "1200px", width: "100%", margin: "0 auto", boxSizing: "border-box"
  },
  welcomeCard: {
    backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "4rem 2rem", textAlign: "center", maxWidth: "600px", margin: "4rem auto", boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)"
  },
  welcomeTitle: {
    fontSize: "2rem", fontWeight: "800", color: "#0f172a", marginBottom: "0.75rem"
  },
  welcomeSubtitle: {
    fontSize: "1rem", color: "#64748b", marginBottom: "2rem"
  },
  grid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem"
  },
  column: {
    display: "flex", flexDirection: "column", gap: "1.5rem"
  },
  card: {
    backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "1.5rem", boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
  },
  cardTitle: {
    fontSize: "1.1rem", fontWeight: "700", color: "#0f172a", marginBottom: "1.25rem", borderBottom: "1px solid #f1f5f9", paddingBottom: "0.75rem"
  },
  balanceRow: {
    display: "flex", justifyContent: "space-between", marginBottom: "0.75rem", fontSize: "0.95rem"
  },
  label: {
    color: "#64748b"
  },
  value: {
    fontWeight: "700", color: "#0f172a"
  },
  inputGroup: {
    marginBottom: "1rem"
  },
  inputLabel: {
    display: "block", fontSize: "0.85rem", fontWeight: "600", color: "#475569", marginBottom: "0.4rem"
  },
  input: {
    width: "100%", padding: "0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#f8fafc", fontSize: "0.95rem", boxSizing: "border-box"
  },
  searchRow: {
    display: "flex", gap: "0.75rem", marginBottom: "1rem"
  },
  inputFlex: {
    flex: 1, padding: "0.75rem", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#f8fafc", fontSize: "0.95rem"
  },
  primaryButton: {
    backgroundColor: "#3b82f6", color: "#ffffff", border: "none", padding: "0.6rem 1.25rem", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "0.9rem"
  },
  primaryButtonFull: {
    width: "100%", backgroundColor: "#3b82f6", color: "#ffffff", border: "none", padding: "0.8rem", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "0.95rem", marginTop: "0.5rem"
  },
  largeButton: {
    backgroundColor: "#3b82f6", color: "#ffffff", border: "none", padding: "0.9rem 2rem", borderRadius: "10px", fontWeight: "700", cursor: "pointer", fontSize: "1rem"
  },
  secondaryButton: {
    backgroundColor: "#f1f5f9", color: "#334155", border: "1px solid #cbd5e1", padding: "0.6rem 1rem", borderRadius: "8px", fontWeight: "600", cursor: "pointer", fontSize: "0.9rem"
  },
  successButton: {
    backgroundColor: "#10b981", color: "#ffffff", border: "none", padding: "0.6rem 1rem", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "0.85rem"
  },
  warningButton: {
    backgroundColor: "#f59e0b", color: "#ffffff", border: "none", padding: "0.6rem 1rem", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "0.85rem"
  },
  dangerButton: {
    backgroundColor: "#ef4444", color: "#ffffff", border: "none", padding: "0.6rem 1rem", borderRadius: "6px", fontWeight: "600", cursor: "pointer", fontSize: "0.85rem"
  },
  escrowBox: {
    backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "1rem", marginTop: "1rem"
  },
  escrowHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem"
  },
  statusBadge: {
    backgroundColor: "#dbeafe", color: "#1d4ed8", padding: "0.2rem 0.5rem", borderRadius: "6px", fontSize: "0.75rem", fontWeight: "700"
  },
  escrowText: {
    fontSize: "0.85rem", color: "#475569", margin: "0.3rem 0", wordBreak: "break-all"
  },
  actionRow: {
    display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap"
  },
  statusBanner: {
    backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e40af", padding: "1rem", borderRadius: "8px", fontSize: "0.9rem"
  }
};