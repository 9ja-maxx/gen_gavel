"use client";

import { useState, useEffect, useCallback } from "react";
import { CONTRACT_ADDRESS, connectWallet, readClient, truncateAddress, type WalletState } from "@/lib/genlayer";
import { TransactionStatus } from "genlayer-js/types";

type Dispute = {
  dispute_id: string;
  claimant: string;
  defendant: string;
  title: string;
  complaint: string;
  evidence: string;
  rebuttal: string;
  rebuttal_evidence: string;
  claimant_stake: string;
  defendant_stake: string;
  escrow_pool: string;
  stage: number; // 0=Filed, 1=Answered, 2=Adjudicated, 3=Escalated, 4=Defaulted, 5=Finalized
  initial_ruling: string;
  appeal_deadline: number;
  appealed_by: string;
  appeal_ruling: string;
  created_at: number;
  deadline: number;
};

const STAGE_LABELS = [
  "Dispute Lodged",
  "Rebuttal Submitted",
  "Consensus Adjudicated",
  "Supreme Appeal Filed",
  "Default Forfeited",
  "Escrow Finalized"
];

const STAGE_COLORS = [
  "#d4af37", // Gold
  "#3b82f6", // Royal Blue
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#ef4444", // Crimson
  "#10b981"  // Emerald
];

export default function Home() {
  const [wallet, setWallet] = useState<WalletState>({ address: null, client: null });
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [charter, setCharter] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [showLodgeModal, setShowLodgeModal] = useState(false);
  
  // Form states
  const [lodgeForm, setLodgeForm] = useState({ title: "", complaint: "", evidence: "", defendant: "", stake: "", durationHours: "24" });
  const [rebuttalForm, setRebuttalForm] = useState({ narrative: "", evidence: "" });
  const [consoleMsg, setConsoleMsg] = useState("");

  const fetchContractState = useCallback(async () => {
    try {
      const client = readClient();
      
      // Fetch Charter
      try {
        const charterData = await client.readContract({
          address: CONTRACT_ADDRESS,
          functionName: "get_charter",
          args: []
        });
        setCharter(charterData as string);
      } catch (err) {
        console.warn("Failed to read charter:", err);
      }

      // Fetch disputes count and iterate
      const countRaw = await client.readContract({
        address: CONTRACT_ADDRESS,
        functionName: "get_dispute_count",
        args: []
      });
      const count = Number(countRaw);

      const fetchedList: Dispute[] = [];
      for (let i = 1; i <= count; i++) {
        try {
          const disputeRaw = await client.readContract({
            address: CONTRACT_ADDRESS,
            functionName: "get_dispute",
            args: [String(i)]
          });
          fetchedList.push(JSON.parse(disputeRaw as string));
        } catch (err) {
          console.error(`Failed to load dispute ${i}:`, err);
        }
      }
      setDisputes(fetchedList.reverse());
    } catch (e) {
      console.error("General read contract state error:", e);
    }
  }, []);

  useEffect(() => {
    fetchContractState();
  }, [fetchContractState]);

  async function handleWalletConnect() {
    setConsoleMsg("Connecting to GenLayer network...");
    try {
      const state = await connectWallet();
      setWallet(state);
      setConsoleMsg("Wallet connected successfully.");
      setTimeout(() => setConsoleMsg(""), 3000);
    } catch (err: any) {
      setConsoleMsg(err.message || "Wallet connection rejected.");
    }
  }

  async function handleTransaction(functionName: string, args: any[], value?: bigint) {
    if (!wallet.client || !wallet.address) {
      setConsoleMsg("Please connect your wallet to submit transactions.");
      return;
    }
    setLoading(true);
    setConsoleMsg(`Submitting '${functionName}' transaction to GenVM...`);
    try {
      const hash = await wallet.client.writeContract({
        address: CONTRACT_ADDRESS,
        functionName,
        args,
        value: value ?? BigInt(0)
      });
      setConsoleMsg("Awaiting validator block execution consensus...");
      await wallet.client.waitForTransactionReceipt({ hash, status: TransactionStatus.ACCEPTED });
      setConsoleMsg("Transaction executed and accepted into state!");
      setTimeout(() => setConsoleMsg(""), 4000);
      
      // Reset forms and reload
      setSelected(null);
      setShowLodgeModal(false);
      setRebuttalForm({ narrative: "", evidence: "" });
      await fetchContractState();
    } catch (err: any) {
      setConsoleMsg(`Execution failed: ${err.message || err}`);
    }
    setLoading(false);
  }

  const formatStakeValue = (weiString: string) => {
    return (Number(weiString) / 1e18).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const getStageBadge = (stageNum: number) => {
    const label = STAGE_LABELS[stageNum] || "Unknown Stage";
    const color = STAGE_COLORS[stageNum] || "#64748b";
    return { label, color };
  };

  return (
    <div style={containerStyle}>
      {/* Import Serif Typography for Classic Legal Feel and Jakarta for body */}
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Styled Luxury Header */}
      <header style={headerStyle}>
        <div style={logoContainerStyle}>
          <span style={logoScaleStyle}>⚖️</span>
          <div>
            <h1 style={logoTitleStyle}>GenGavel</h1>
            <p style={logoSubtitleStyle}>Decentralized SLA Escrow & AI Arbitration Courtroom</p>
          </div>
        </div>

        <div style={headerActionsStyle}>
          {wallet.address ? (
            <div style={connectionWrapperStyle}>
              <div style={walletInfoBadgeStyle}>
                <span style={onlineIndicatorStyle}></span>
                <span style={addressTextStyle}>{truncateAddress(wallet.address)}</span>
              </div>
              <button onClick={() => setWallet({ address: null, client: null })} style={btnDisconnectStyle}>
                Disconnect
              </button>
            </div>
          ) : (
            <button onClick={handleWalletConnect} style={btnConnectStyle}>
              Connect Magistrate Wallet
            </button>
          )}
        </div>
      </header>

      {/* Status Log Box */}
      {consoleMsg && (
        <div style={consoleBannerStyle}>
          <span style={{ marginRight: 8 }}>📢</span>
          {consoleMsg}
        </div>
      )}

      {/* Main Interface Layout */}
      <main style={mainContentStyle}>
        
        {/* Top Summary Banner */}
        <section style={statGridStyle}>
          <div style={statCardStyle}>
            <div style={statLabelStyle}>Escrow Active Charter</div>
            <div style={charterValueStyle}>{charter || "No active charter configured."}</div>
          </div>
          <div style={statCardSideStyle}>
            <div style={statLabelStyle}>Total Disputes Logged</div>
            <div style={statNumberStyle}>{disputes.length}</div>
          </div>
        </section>

        {/* Dashboard Chamber split */}
        <div style={chamberLayoutStyle}>
          
          {/* Left: Court Docket List */}
          <div style={docketPanelStyle}>
            <div style={panelHeaderStyle}>
              <h2 style={panelTitleStyle}>Court Docket</h2>
              <button onClick={() => setShowLodgeModal(true)} style={btnLodgeDisputeStyle}>
                Lodge New Claim
              </button>
            </div>

            <div style={docketListStyle}>
              {disputes.length === 0 ? (
                <div style={emptyDocketStateStyle}>
                  No arbitration dockets found. Use "Lodge New Claim" to initiate a dispute.
                </div>
              ) : (
                disputes.map((dispute) => {
                  const badge = getStageBadge(dispute.stage);
                  const isSelected = selected?.dispute_id === dispute.dispute_id;
                  return (
                    <div
                      key={dispute.dispute_id}
                      onClick={() => setSelected(dispute)}
                      style={{
                        ...docketItemStyle,
                        borderColor: isSelected ? "#d4af37" : "#1a2136",
                        background: isSelected ? "rgba(212, 175, 55, 0.05)" : "#0c1122"
                      }}
                    >
                      <div style={docketHeaderStyle}>
                        <span style={docketIdStyle}>Docket #{dispute.dispute_id}</span>
                        <span style={{ ...stageBadgeStyle, backgroundColor: `${badge.color}15`, color: badge.color }}>
                          {badge.label}
                        </span>
                      </div>
                      <div style={docketTitleStyle}>{dispute.title}</div>
                      <div style={docketPartiesStyle}>
                        <span>{truncateAddress(dispute.claimant)}</span>
                        <span style={{ color: "#d4af37", margin: "0 6px" }}>v.</span>
                        <span>{truncateAddress(dispute.defendant)}</span>
                      </div>
                      <div style={docketEscrowStyle}>
                        Locked Escrow: {formatStakeValue(dispute.escrow_pool)} GEN
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Adjudication Chamber */}
          <div style={adjudicationChamberStyle}>
            {selected ? (
              <div style={chamberConsoleStyle}>
                {/* Chamber Header */}
                <div style={chamberHeaderStyle}>
                  <div>
                    <h3 style={caseHeaderTitleStyle}>{selected.title}</h3>
                    <div style={caseMetadataStyle}>
                      <span>Docket Number: {selected.dispute_id}</span>
                      <span style={{ color: "#1e293b" }}>|</span>
                      <span>Created At: {new Date(selected.created_at * 1000).toLocaleDateString()}</span>
                    </div>
                  </div>

                  <div style={poolBannerStyle}>
                    <div style={poolLabelStyle}>Total Escrow Held</div>
                    <div style={poolValueStyle}>{formatStakeValue(selected.escrow_pool)} GEN</div>
                  </div>
                </div>

                {/* Vertical Interactive Flow Stepper */}
                <div style={flowStepperStyle}>
                  {[
                    { label: "Pleadings Lodged", completed: selected.stage >= 0 },
                    { label: "Rebuttal Staked", completed: selected.stage >= 1 || selected.stage === 4 },
                    { label: "Arbiter Adjudication", completed: selected.stage >= 2 && selected.stage !== 4 },
                    { label: "Court Settlement", completed: selected.stage === 5 }
                  ].map((step, idx) => (
                    <div key={idx} style={stepContainerStyle}>
                      <div style={{
                        ...stepIndicatorStyle,
                        backgroundColor: step.completed ? "#d4af37" : "#161c2e",
                        boxShadow: step.completed ? "0 0 12px rgba(212, 175, 55, 0.4)" : "none"
                      }}>
                        {idx + 1}
                      </div>
                      <span style={{ ...stepLabelStyle, color: step.completed ? "#e2e8f0" : "#475569" }}>
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Case File Pleading Cards */}
                <div style={evidenceGridStyle}>
                  {/* Claimant Side */}
                  <div style={evidenceCardStyle}>
                    <div style={claimantHeaderStyle}>Claimant Brief & Pleading</div>
                    <div style={cardBodyStyle}>
                      <h4 style={cardLabelStyle}>SLA Violation Complaint</h4>
                      <p style={cardParagraphStyle}>{selected.complaint}</p>
                      <h4 style={cardLabelStyle}>Evidentiary Files/Links</h4>
                      <p style={cardParagraphStyle}>{selected.evidence}</p>
                      <div style={cardFooterBadgeStyle}>
                        Deposited Stake: {formatStakeValue(selected.claimant_stake)} GEN
                      </div>
                    </div>
                  </div>

                  {/* Defendant Side */}
                  <div style={evidenceCardStyle}>
                    <div style={defendantHeaderStyle}>Defendant Rebuttal Brief</div>
                    <div style={cardBodyStyle}>
                      {selected.rebuttal ? (
                        <>
                          <h4 style={cardLabelStyle}>Defense Narrative</h4>
                          <p style={cardParagraphStyle}>{selected.rebuttal}</p>
                          <h4 style={cardLabelStyle}>Rebuttal Evidence Links</h4>
                          <p style={cardParagraphStyle}>{selected.rebuttal_evidence}</p>
                          <div style={cardFooterBadgeStyle}>
                            Deposited Stake: {formatStakeValue(selected.defendant_stake)} GEN
                          </div>
                        </>
                      ) : (
                        <div style={awaitingDefenseBoxStyle}>
                          <span style={{ fontSize: 24, marginBottom: 8 }}>⏳</span>
                          <span style={{ fontWeight: 500 }}>Awaiting Defendant Response</span>
                          {selected.deadline && (
                            <span style={deadlineDateStyle}>
                              Deadline: {new Date(selected.deadline * 1000).toLocaleString()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Rulings and appeal details */}
                {selected.initial_ruling && (
                  <div style={verdictBoxStyle}>
                    <h4 style={verdictHeaderStyle}>🏛️ Initial AI Consensus Ruling</h4>
                    {(() => {
                      const rulingObj = JSON.parse(selected.initial_ruling);
                      const isClaimantWin = rulingObj.verdict === "claimant";
                      return (
                        <div style={verdictInnerStyle}>
                          <div style={verdictRowStyle}>
                            <span>
                              <strong>Outcome:</strong>{" "}
                              <span style={{ color: isClaimantWin ? "#10b981" : "#ef4444" }}>
                                {isClaimantWin ? "CLAIMANT" : "DEFENDANT"} FAVORED
                              </span>
                            </span>
                            <span>
                              <strong>Breach Identified:</strong>{" "}
                              {rulingObj.violation_found ? "⚠️ Yes" : "✅ No"}
                            </span>
                          </div>
                          <p style={verdictReasonStyle}>"{rulingObj.reasoning}"</p>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {selected.appeal_ruling && (
                  <div style={{ ...verdictBoxStyle, borderColor: "#ec4899" }}>
                    <h4 style={{ ...verdictHeaderStyle, color: "#f472b6" }}>⚖️ Supreme Court Final Judgment</h4>
                    {(() => {
                      const rulingObj = JSON.parse(selected.appeal_ruling);
                      const isClaimantWin = rulingObj.verdict === "claimant";
                      return (
                        <div style={verdictInnerStyle}>
                          <div style={verdictRowStyle}>
                            <span>
                              <strong>Outcome:</strong>{" "}
                              <span style={{ color: isClaimantWin ? "#10b981" : "#ef4444" }}>
                                {isClaimantWin ? "CLAIMANT" : "DEFENDANT"} FAVORED (FINAL & BINDING)
                              </span>
                            </span>
                          </div>
                          <p style={verdictReasonStyle}>"{rulingObj.reasoning}"</p>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Console / Action Console Bench */}
                <div style={magistrateBenchStyle}>
                  <h4 style={benchHeaderStyle}>Magistrate Actions</h4>

                  <div style={benchActionsStyle}>
                    {/* Defendant submit defense form */}
                    {selected.stage === 0 && wallet.address?.toLowerCase() === selected.defendant.toLowerCase() && (
                      <div style={actionFormCardStyle}>
                        <h5 style={formCardTitleStyle}>File Formal Rebuttal Brief</h5>
                        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                          <textarea
                            placeholder="State your defense narrative..."
                            value={rebuttalForm.narrative}
                            onChange={(e) => setRebuttalForm({ ...rebuttalForm, narrative: e.target.value })}
                            style={textareaStyle}
                            rows={3}
                          />
                          <textarea
                            placeholder="Provide link/references to counter-evidence..."
                            value={rebuttalForm.evidence}
                            onChange={(e) => setRebuttalForm({ ...rebuttalForm, evidence: e.target.value })}
                            style={textareaStyle}
                            rows={2}
                          />
                          <button
                            onClick={() =>
                              handleTransaction(
                                "submit_rebuttal",
                                [selected.dispute_id, rebuttalForm.narrative, rebuttalForm.evidence],
                                BigInt(selected.claimant_stake)
                              )
                            }
                            disabled={loading || !rebuttalForm.narrative}
                            style={btnSubmitActionStyle}
                          >
                            Staker Deposit & Submit Rebuttal ({formatStakeValue(selected.claimant_stake)} GEN)
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Claimant claim default judgment */}
                    {selected.stage === 0 && wallet.address?.toLowerCase() === selected.claimant.toLowerCase() && (
                      <div style={actionFormCardStyle}>
                        <h5 style={formCardTitleStyle}>Petition for Default Resolution</h5>
                        <p style={formDescriptionStyle}>
                          If the defendant fails to answer before the deadline, you can reclaim your staked deposit.
                        </p>
                        <button
                          onClick={() => handleTransaction("claim_default_judgment", [selected.dispute_id])}
                          disabled={loading}
                          style={{ ...btnSubmitActionStyle, backgroundColor: "#ef4444" }}
                        >
                          Claim Default Resolution & Refund
                        </button>
                      </div>
                    )}

                    {/* Trigger adjudication */}
                    {selected.stage === 1 && (
                      <div style={actionFormCardStyle}>
                        <h5 style={formCardTitleStyle}>Initiate Case Adjudication</h5>
                        <p style={formDescriptionStyle}>
                          Both parties have submitted pleadings and stakes. Engage validator LLM consensus to arbitrate.
                        </p>
                        <button
                          onClick={() => handleTransaction("resolve_dispute", [selected.dispute_id])}
                          disabled={loading}
                          style={{ ...btnSubmitActionStyle, backgroundColor: "#c5a028" }}
                        >
                          Run Initial Arbitration
                        </button>
                      </div>
                    )}

                    {/* Appeal ruling */}
                    {selected.stage === 2 && (
                      <div style={actionFormCardStyle}>
                        <h5 style={formCardTitleStyle}>Petition for Appellate Review</h5>
                        <p style={formDescriptionStyle}>
                          Challenge the initial verdict in Supreme Court. Requires matching the filing stake as an appeal bond.
                        </p>
                        <button
                          onClick={() =>
                            handleTransaction("escalate_appeal", [selected.dispute_id], BigInt(selected.claimant_stake))
                          }
                          disabled={loading}
                          style={{ ...btnSubmitActionStyle, backgroundColor: "#8b5cf6" }}
                        >
                          File Supreme Appeal ({formatStakeValue(selected.claimant_stake)} GEN)
                        </button>
                      </div>
                    )}

                    {/* Finalize ruling */}
                    {selected.stage === 2 && (
                      <div style={actionFormCardStyle}>
                        <h5 style={formCardTitleStyle}>Disburse Settled Funds</h5>
                        <p style={formDescriptionStyle}>
                          Once the 24-hour challenge window expires, finalize the docket to disburse funds to the prevailing party.
                        </p>
                        <button
                          onClick={() => handleTransaction("finalize_disposal", [selected.dispute_id])}
                          disabled={loading}
                          style={{ ...btnSubmitActionStyle, backgroundColor: "#10b981" }}
                        >
                          Finalize Docket & Release Funds
                        </button>
                      </div>
                    )}

                    {/* Resolve appeal */}
                    {selected.stage === 3 && (
                      <div style={actionFormCardStyle}>
                        <h5 style={formCardTitleStyle}>Conclude Supreme Appellate Review</h5>
                        <p style={formDescriptionStyle}>
                          Both parties have submitted appeals. Invoke the supreme validator tribunal to render the final payout ruling.
                        </p>
                        <button
                          onClick={() => handleTransaction("resolve_appeal", [selected.dispute_id])}
                          disabled={loading}
                          style={{ ...btnSubmitActionStyle, backgroundColor: "#db2777" }}
                        >
                          Conclude Supreme Appeal
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={emptyChamberStateStyle}>
                <span style={{ fontSize: 64, color: "#d4af37", marginBottom: 16 }}>⚖️</span>
                <h3 style={emptyTitleStyle}>GenGavel Courtroom</h3>
                <p style={emptySubtitleStyle}>
                  Select an active dispute case docket from the list, or file a new service contract dispute.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Lodge Dispute Modal */}
      {showLodgeModal && (
        <div onClick={() => setShowLodgeModal(false)} style={modalOverlayStyle}>
          <form
            onClick={(e) => e.stopPropagation()}
            onSubmit={(e) => {
              e.preventDefault();
              handleTransaction(
                "lodge_dispute",
                [lodgeForm.title, lodgeForm.complaint, lodgeForm.evidence, lodgeForm.defendant, Number(lodgeForm.durationHours)],
                BigInt(lodgeForm.stake) * BigInt(1e18)
              );
            }}
            style={modalContentStyle}
          >
            <h3 style={modalTitleStyle}>Lodge Pleading Brief</h3>
            
            <div style={formFieldStyle}>
              <label style={modalLabelStyle}>Dispute Case Title</label>
              <input
                placeholder="e.g. Milestone 2 Deliverable Defect"
                value={lodgeForm.title}
                onChange={(e) => setLodgeForm({ ...lodgeForm, title: e.target.value })}
                required
                style={modalInputStyle}
              />
            </div>

            <div style={formFieldStyle}>
              <label style={modalLabelStyle}>Defendant Wallet Address (0x...)</label>
              <input
                placeholder="0x..."
                value={lodgeForm.defendant}
                onChange={(e) => setLodgeForm({ ...lodgeForm, defendant: e.target.value })}
                required
                style={modalInputStyle}
              />
            </div>

            <div style={formFieldStyle}>
              <label style={modalLabelStyle}>Complaints & Breach Details</label>
              <textarea
                placeholder="List specific charter rules violated and details..."
                value={lodgeForm.complaint}
                onChange={(e) => setLodgeForm({ ...lodgeForm, complaint: e.target.value })}
                required
                rows={3}
                style={modalTextareaStyle}
              />
            </div>

            <div style={formFieldStyle}>
              <label style={modalLabelStyle}>Evidence Link/Dossier</label>
              <textarea
                placeholder="Links to git commits, deliverables, or documents..."
                value={lodgeForm.evidence}
                onChange={(e) => setLodgeForm({ ...lodgeForm, evidence: e.target.value })}
                required
                rows={2}
                style={modalTextareaStyle}
              />
            </div>

            <div style={modalSplitFieldsStyle}>
              <div style={{ flex: 1 }}>
                <label style={modalLabelStyle}>Staked Escrow (GEN)</label>
                <input
                  type="number"
                  min="1"
                  placeholder="100"
                  value={lodgeForm.stake}
                  onChange={(e) => setLodgeForm({ ...lodgeForm, stake: e.target.value })}
                  required
                  style={modalInputStyle}
                />
              </div>

              <div style={{ flex: 1 }}>
                <label style={modalLabelStyle}>Rebuttal Limit (Hours)</label>
                <input
                  type="number"
                  placeholder="24"
                  value={lodgeForm.durationHours}
                  onChange={(e) => setLodgeForm({ ...lodgeForm, durationHours: e.target.value })}
                  required
                  style={modalInputStyle}
                />
              </div>
            </div>

            <button type="submit" disabled={loading} style={btnSubmitModalStyle}>
              Lodge Case & Stake Escrow
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// Styling system: Classic Elegant Legal Scale UI Theme
const containerStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "#060913",
  color: "#f8fafc",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  paddingBottom: 60
};

const headerStyle: React.CSSProperties = {
  background: "rgba(10, 15, 30, 0.8)",
  borderBottom: "1px solid #1a2136",
  padding: "20px 48px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  position: "sticky",
  top: 0,
  zIndex: 99,
  backdropFilter: "blur(12px)"
};

const logoContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16
};

const logoScaleStyle: React.CSSProperties = {
  fontSize: 32,
  color: "#d4af37",
  filter: "drop-shadow(0 0 8px rgba(212, 175, 55, 0.3))"
};

const logoTitleStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 28,
  fontWeight: 700,
  margin: 0,
  color: "#e2e8f0",
  letterSpacing: "0.5px"
};

const logoSubtitleStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#d4af37",
  margin: "4px 0 0 0",
  letterSpacing: "1px",
  textTransform: "uppercase"
};

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 16
};

const connectionWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12
};

const walletInfoBadgeStyle: React.CSSProperties = {
  background: "#0c1122",
  border: "1px solid #1a2136",
  padding: "8px 16px",
  borderRadius: "6px",
  display: "flex",
  alignItems: "center",
  gap: 8
};

const onlineIndicatorStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  backgroundColor: "#10b981",
  borderRadius: "50%",
  boxShadow: "0 0 8px #10b981"
};

const addressTextStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "#cbd5e1",
  fontFamily: "monospace"
};

const btnConnectStyle: React.CSSProperties = {
  background: "linear-gradient(135deg, #d4af37 0%, #c5a028 100%)",
  color: "#060913",
  border: "none",
  borderRadius: "6px",
  padding: "10px 22px",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: 14,
  boxShadow: "0 4px 12px rgba(212, 175, 55, 0.2)",
  transition: "all 0.2s"
};

const btnDisconnectStyle: React.CSSProperties = {
  background: "transparent",
  color: "#ef4444",
  border: "1px solid #ef4444",
  borderRadius: "6px",
  padding: "8px 14px",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
  transition: "all 0.2s"
};

const consoleBannerStyle: React.CSSProperties = {
  background: "#0a152e",
  borderBottom: "1px solid #1c325e",
  padding: "12px 48px",
  color: "#60a5fa",
  fontSize: 14,
  display: "flex",
  alignItems: "center"
};

const mainContentStyle: React.CSSProperties = {
  maxWidth: 1400,
  margin: "32px auto 0",
  padding: "0 24px"
};

const statGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "3fr 1fr",
  gap: 24,
  marginBottom: 32
};

const statCardStyle: React.CSSProperties = {
  background: "#0c1122",
  border: "1px solid #1a2136",
  borderRadius: "10px",
  padding: "20px 24px",
  display: "flex",
  flexDirection: "column",
  gap: 8
};

const statCardSideStyle: React.CSSProperties = {
  background: "#0c1122",
  border: "1px solid #1a2136",
  borderRadius: "10px",
  padding: "20px 24px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  alignItems: "center"
};

const statLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#d4af37",
  textTransform: "uppercase",
  letterSpacing: "1.5px",
  fontWeight: 600
};

const charterValueStyle: React.CSSProperties = {
  fontSize: 15,
  lineHeight: 1.6,
  color: "#94a3b8",
  fontStyle: "italic"
};

const statNumberStyle: React.CSSProperties = {
  fontSize: 32,
  fontWeight: 700,
  color: "#e2e8f0",
  marginTop: 4
};

const chamberLayoutStyle: React.CSSProperties = {
  display: "flex",
  gap: 28,
  alignItems: "flex-start"
};

const docketPanelStyle: React.CSSProperties = {
  width: 400,
  flexShrink: 0,
  background: "#0c1122",
  border: "1px solid #1a2136",
  borderRadius: "12px",
  padding: "24px",
  boxSizing: "border-box"
};

const panelHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 20
};

const panelTitleStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 20,
  fontWeight: 700,
  margin: 0,
  color: "#e2e8f0"
};

const btnLodgeDisputeStyle: React.CSSProperties = {
  backgroundColor: "transparent",
  color: "#d4af37",
  border: "1px solid #d4af37",
  borderRadius: "6px",
  padding: "8px 14px",
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  transition: "all 0.2s"
};

const docketListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 14
};

const emptyDocketStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "48px 12px",
  color: "#475569",
  fontSize: 13,
  lineHeight: 1.5,
  fontStyle: "italic"
};

const docketItemStyle: React.CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: "8px",
  padding: "18px",
  cursor: "pointer",
  transition: "all 0.15s ease-in-out"
};

const docketHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 10
};

const docketIdStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#64748b",
  letterSpacing: "0.5px"
};

const stageBadgeStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  padding: "3px 8px",
  borderRadius: "4px",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const docketTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: "#f1f5f9",
  marginBottom: 8
};

const docketPartiesStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#94a3b8",
  marginBottom: 12,
  fontFamily: "monospace"
};

const docketEscrowStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "#d4af37"
};

const adjudicationChamberStyle: React.CSSProperties = {
  flexGrow: 1,
  background: "#0c1122",
  border: "1px solid #1a2136",
  borderRadius: "12px",
  minHeight: 600,
  display: "flex"
};

const emptyChamberStateStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  flexGrow: 1,
  padding: "80px 40px",
  textAlign: "center"
};

const emptyTitleStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 24,
  fontWeight: 700,
  margin: "0 0 12px 0"
};

const emptySubtitleStyle: React.CSSProperties = {
  color: "#64748b",
  fontSize: 14,
  maxWidth: 400,
  lineHeight: 1.6
};

const chamberConsoleStyle: React.CSSProperties = {
  padding: 36,
  display: "flex",
  flexDirection: "column",
  width: "100%",
  boxSizing: "border-box"
};

const chamberHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  borderBottom: "1px solid #1a2136",
  paddingBottom: 28
};

const caseHeaderTitleStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 26,
  fontWeight: 700,
  margin: 0,
  color: "#f1f5f9"
};

const caseMetadataStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  fontSize: 12,
  color: "#475569",
  marginTop: 8
};

const poolBannerStyle: React.CSSProperties = {
  background: "rgba(212, 175, 55, 0.05)",
  border: "1px solid rgba(212, 175, 55, 0.2)",
  borderRadius: "8px",
  padding: "12px 20px",
  textAlign: "right"
};

const poolLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#d4af37",
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontWeight: 600
};

const poolValueStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "#d4af37",
  marginTop: 4
};

const flowStepperStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  margin: "32px 0",
  padding: "16px 24px",
  background: "#080c18",
  borderRadius: "8px",
  border: "1px solid #121828"
};

const stepContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10
};

const stepIndicatorStyle: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontSize: 11,
  fontWeight: 700,
  color: "#060913"
};

const stepLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600
};

const evidenceGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 24,
  marginBottom: 32
};

const evidenceCardStyle: React.CSSProperties = {
  background: "#080c18",
  border: "1px solid #121828",
  borderRadius: "8px",
  overflow: "hidden"
};

const claimantHeaderStyle: React.CSSProperties = {
  background: "rgba(212, 175, 55, 0.06)",
  borderBottom: "1px solid #1c243a",
  color: "#d4af37",
  padding: "12px 18px",
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const defendantHeaderStyle: React.CSSProperties = {
  background: "rgba(59, 130, 246, 0.06)",
  borderBottom: "1px solid #1c243a",
  color: "#3b82f6",
  padding: "12px 18px",
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const cardBodyStyle: React.CSSProperties = {
  padding: 20
};

const cardLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#d4af37",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  margin: "0 0 6px 0"
};

const cardParagraphStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: "#cbd5e1",
  margin: "0 0 20px 0"
};

const cardFooterBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: 11,
  color: "#64748b",
  background: "#0c1122",
  border: "1px solid #1a2136",
  padding: "4px 10px",
  borderRadius: "4px"
};

const awaitingDefenseBoxStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: 160,
  color: "#475569",
  fontStyle: "italic",
  fontSize: 14
};

const deadlineDateStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  marginTop: 6,
  fontFamily: "monospace"
};

const verdictBoxStyle: React.CSSProperties = {
  background: "rgba(10, 15, 30, 0.5)",
  border: "1px solid rgba(212, 175, 55, 0.3)",
  borderRadius: "8px",
  padding: "24px",
  marginBottom: 32
};

const verdictHeaderStyle: React.CSSProperties = {
  fontSize: 15,
  color: "#d4af37",
  margin: "0 0 16px 0",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const verdictInnerStyle: React.CSSProperties = {
  background: "#060913",
  border: "1px solid #121828",
  borderRadius: "6px",
  padding: 18
};

const verdictRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: 14,
  color: "#e2e8f0",
  marginBottom: 12
};

const verdictReasonStyle: React.CSSProperties = {
  fontSize: 14,
  lineHeight: 1.6,
  color: "#94a3b8",
  margin: 0,
  fontStyle: "italic"
};

const magistrateBenchStyle: React.CSSProperties = {
  borderTop: "1px solid #1a2136",
  paddingTop: 28
};

const benchHeaderStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 18,
  color: "#e2e8f0",
  margin: "0 0 16px 0"
};

const benchActionsStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 16
};

const actionFormCardStyle: React.CSSProperties = {
  background: "#080c18",
  border: "1px solid #121828",
  borderRadius: "8px",
  padding: 24
};

const formCardTitleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  margin: "0 0 10px 0",
  color: "#d4af37",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const formDescriptionStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#64748b",
  margin: "0 0 16px 0"
};

const textareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  background: "#060913",
  border: "1px solid #1c243a",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: 14,
  boxSizing: "border-box",
  fontFamily: "inherit"
};

const btnSubmitActionStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  border: "none",
  borderRadius: "6px",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.15)"
};

// Modal Design
const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(6, 9, 19, 0.8)",
  backdropFilter: "blur(8px)",
  display: "grid",
  placeItems: "center",
  zIndex: 1000,
  padding: 20
};

const modalContentStyle: React.CSSProperties = {
  background: "#0c1122",
  border: "1px solid #d4af37",
  borderRadius: "12px",
  padding: "36px",
  maxWidth: 600,
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto"
};

const modalTitleStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 22,
  fontWeight: 700,
  margin: "0 0 24px 0",
  color: "#d4af37"
};

const formFieldStyle: React.CSSProperties = {
  marginBottom: 16
};

const modalLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "#64748b",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const modalInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "#060913",
  border: "1px solid #1a2136",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: 14,
  boxSizing: "border-box"
};

const modalTextareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  background: "#060913",
  border: "1px solid #1a2136",
  borderRadius: "6px",
  color: "#ffffff",
  fontSize: 14,
  boxSizing: "border-box",
  fontFamily: "inherit"
};

const modalSplitFieldsStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  marginBottom: 24
};

const btnSubmitModalStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px",
  background: "linear-gradient(135deg, #d4af37 0%, #c5a028 100%)",
  color: "#060913",
  border: "none",
  borderRadius: "6px",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: "0 4px 16px rgba(212, 175, 55, 0.15)",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};
