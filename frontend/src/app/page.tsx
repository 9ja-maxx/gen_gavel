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
  "Rebuttal Staked",
  "Initial Adjudication",
  "Appealed to Supreme",
  "Default Forfeited",
  "Docket Settled"
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
    const label = STAGE_LABELS[stageNum] || "Unknown";
    const color = STAGE_COLORS[stageNum] || "#64748b";
    return { label, color };
  };

  return (
    <div style={containerStyle}>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,400&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Styled Luxury Header */}
      <header style={headerStyle}>
        <div style={logoContainerStyle}>
          <span style={logoScaleStyle}>⚖️</span>
          <div>
            <h1 style={logoTitleStyle}>GenGavel</h1>
            <p style={logoSubtitleStyle}>The Decentralized SLA Courtroom</p>
          </div>
        </div>

        {consoleMsg && (
          <div style={consoleBadgeStyle}>
            <span style={blinkIndicatorStyle}></span>
            <span>{consoleMsg}</span>
          </div>
        )}

        <div style={headerActionsStyle}>
          {wallet.address ? (
            <div style={connectionWrapperStyle}>
              <div style={walletInfoBadgeStyle}>
                <span style={onlineIndicatorStyle}></span>
                <span style={addressTextStyle}>{truncateAddress(wallet.address)}</span>
              </div>
              <button onClick={() => setWallet({ address: null, client: null })} style={btnDisconnectStyle}>
                Exit Bench
              </button>
            </div>
          ) : (
            <button onClick={handleWalletConnect} style={btnConnectStyle}>
              Convene Magistrate
            </button>
          )}
        </div>
      </header>

      {/* Main Workspace Frame (Three-Column Monorepo Layout) */}
      <div style={workspaceFrameStyle}>
        
        {/* COLUMN 1: Docket Directory (Width: 22%) */}
        <aside style={docketColumnStyle}>
          <div style={columnHeaderStyle}>
            <h2 style={columnTitleStyle}>Active Dockets</h2>
            <button onClick={() => setShowLodgeModal(true)} style={btnLodgeDisputeStyle}>
              + Lodge Claim
            </button>
          </div>
          
          <div style={columnBodyStyle}>
            {disputes.length === 0 ? (
              <div style={emptyDocketStateStyle}>
                No disputes on record. Use the button above to lodge your claim.
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
                      borderColor: isSelected ? "#d4af37" : "#192135",
                      background: isSelected ? "#0f162a" : "#080c18"
                    }}
                  >
                    <div style={docketItemTopStyle}>
                      <span style={docketIdStyle}>Docket #{dispute.dispute_id}</span>
                      <span style={{ ...stageBadgeStyle, backgroundColor: `${badge.color}15`, color: badge.color }}>
                        {badge.label}
                      </span>
                    </div>
                    <div style={docketTitleStyle}>{dispute.title}</div>
                    <div style={docketStakeStyle}>
                      {formatStakeValue(dispute.escrow_pool)} GEN
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>

        {/* COLUMN 2: Pleading Chambers & Evidence dossiers (Width: 50%) */}
        <section style={pleadingColumnStyle}>
          {selected ? (
            <div style={columnBodyStyle}>
              <div style={chamberTitleBlockStyle}>
                <span style={charterNoticeStyle}>⚖️ Case Resolution dossier</span>
                <h2 style={caseMainTitleStyle}>{selected.title}</h2>
                <div style={casePartiesBadgeStyle}>
                  <div style={partyItemStyle}>
                    <strong>Claimant:</strong> <span>{selected.claimant}</span>
                  </div>
                  <div style={partyItemStyle}>
                    <strong>Respondent:</strong> <span>{selected.defendant}</span>
                  </div>
                </div>
              </div>

              {/* Vertical stacked dossier sections */}
              <div style={dossierSectionStyle}>
                <div style={claimantLabelHeaderStyle}>I. Claimant Pleadings & Complaints</div>
                <div style={dossierContentStyle}>
                  <h4 style={dossierLabelStyle}>Specific SLA Rules Breached</h4>
                  <p style={dossierParagraphStyle}>{selected.complaint}</p>
                  <h4 style={dossierLabelStyle}>Claimant Evidence & Link Logs</h4>
                  <p style={dossierParagraphStyle}>{selected.evidence}</p>
                  <div style={dossierStakeBadgeStyle}>
                    Locked Pleading Stake: {formatStakeValue(selected.claimant_stake)} GEN
                  </div>
                </div>
              </div>

              <div style={dossierSectionStyle}>
                <div style={defendantLabelHeaderStyle}>II. Respondent Defense & Rebuttals</div>
                <div style={dossierContentStyle}>
                  {selected.rebuttal ? (
                    <>
                      <h4 style={dossierLabelStyle}>Formal Refutation Narrative</h4>
                      <p style={dossierParagraphStyle}>{selected.rebuttal}</p>
                      <h4 style={dossierLabelStyle}>Respondent Evidence & Link Logs</h4>
                      <p style={dossierParagraphStyle}>{selected.rebuttal_evidence}</p>
                      <div style={dossierStakeBadgeStyle}>
                        Locked Rebuttal Stake: {formatStakeValue(selected.defendant_stake)} GEN
                      </div>
                    </>
                  ) : (
                    <div style={awaitingDefensePlaceholderStyle}>
                      <span style={{ fontSize: 24, marginBottom: 8 }}>⌛</span>
                      <span>Formal defense rebuttals not yet entered on docket.</span>
                      <span style={deadlineInfoStyle}>
                        Deadline: {new Date(selected.deadline * 1000).toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div style={emptyChamberStateStyle}>
              <span style={emptyScalesIconStyle}>⚖️</span>
              <h2 style={emptyChamberTitleStyle}>Magistrate Chambers</h2>
              <p style={emptyChamberSubtitleStyle}>
                Select an active docket from the directory to review complaints, examine staked evidence, and execute court judgments.
              </p>
              {charter && (
                <div style={charterBoxStyle}>
                  <div style={charterBoxTitleStyle}>📜 Active Court Guidelines Charter</div>
                  <p style={charterBoxTextStyle}>{charter}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* COLUMN 3: The Adjudication Console & Verdict Console (Width: 28%) */}
        <aside style={verdictColumnStyle}>
          {selected ? (
            <div style={columnBodyStyle}>
              <div style={columnHeaderStyle}>
                <h3 style={consoleTitleStyle}>Court Panel Bench</h3>
              </div>

              {/* Status Stepper */}
              <div style={verticalStepperStyle}>
                {[
                  { label: "Pleadings Lodged", active: selected.stage >= 0 },
                  { label: "Rebuttal Staked", active: selected.stage >= 1 || selected.stage === 4 },
                  { label: "Arbiter Consensus Adjudicated", active: selected.stage >= 2 && selected.stage !== 4 },
                  { label: "Docket Concluded", active: selected.stage === 5 }
                ].map((step, idx) => (
                  <div key={idx} style={verticalStepItemStyle}>
                    <div style={{
                      ...stepDotStyle,
                      backgroundColor: step.active ? "#d4af37" : "#1a2136",
                      color: step.active ? "#060913" : "#475569"
                    }}>
                      {step.active ? "✓" : idx + 1}
                    </div>
                    <span style={{ ...stepLabelStyle, color: step.active ? "#f8fafc" : "#475569" }}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>

              {/* Rulings display */}
              {selected.initial_ruling && (
                <div style={rulingBriefStyle}>
                  <div style={rulingTitleStyle}>🏛️ Initial Arbiter Consensus Verdict</div>
                  {(() => {
                    const r = JSON.parse(selected.initial_ruling);
                    const isPlaintiff = r.verdict === "claimant";
                    return (
                      <div style={rulingInnerStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: isPlaintiff ? "#10b981" : "#ef4444" }}>
                            {isPlaintiff ? "CLAIMANT WINS" : "DEFENDANT WINS"}
                          </span>
                          <span>Breach: {r.violation_found ? "⚠️ Yes" : "✅ No"}</span>
                        </div>
                        <p style={rulingTextParagraphStyle}>"{r.reasoning}"</p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {selected.appeal_ruling && (
                <div style={{ ...rulingBriefStyle, borderColor: "#ec4899" }}>
                  <div style={{ ...rulingTitleStyle, color: "#f472b6" }}>⚖️ Supreme Appeal Court Ruling</div>
                  {(() => {
                    const r = JSON.parse(selected.appeal_ruling);
                    const isPlaintiff = r.verdict === "claimant";
                    return (
                      <div style={rulingInnerStyle}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontWeight: 700, color: isPlaintiff ? "#10b981" : "#ef4444" }}>
                            {isPlaintiff ? "CLAIMANT WINS" : "DEFENDANT WINS"}
                          </span>
                        </div>
                        <p style={rulingTextParagraphStyle}>"{r.reasoning}"</p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Action operations console */}
              <div style={consoleConsoleStyle}>
                <h4 style={consoleSectionLabelStyle}>Bench Controls</h4>
                
                {/* Rebuttal submission */}
                {selected.stage === 0 && wallet.address?.toLowerCase() === selected.defendant.toLowerCase() && (
                  <div style={benchActionCardStyle}>
                    <h5 style={actionTitleStyle}>Submit Rebuttal Brief</h5>
                    <textarea
                      placeholder="Explain your defense argument..."
                      value={rebuttalForm.narrative}
                      onChange={(e) => setRebuttalForm({ ...rebuttalForm, narrative: e.target.value })}
                      style={textareaInputStyle}
                      rows={3}
                    />
                    <textarea
                      placeholder="Links to refutation evidence..."
                      value={rebuttalForm.evidence}
                      onChange={(e) => setRebuttalForm({ ...rebuttalForm, evidence: e.target.value })}
                      style={textareaInputStyle}
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
                      style={{ ...btnConsoleActionStyle, background: "#3b82f6" }}
                    >
                      Post Stake & Submit Rebuttal ({formatStakeValue(selected.claimant_stake)} GEN)
                    </button>
                  </div>
                )}

                {/* Default judgment */}
                {selected.stage === 0 && wallet.address?.toLowerCase() === selected.claimant.toLowerCase() && (
                  <div style={benchActionCardStyle}>
                    <h5 style={actionTitleStyle}>File Default Judgment Petition</h5>
                    <p style={actionDescStyle}>Defendant missed the rebuttal deadline. Reclaim your locked pleadings stake.</p>
                    <button
                      onClick={() => handleTransaction("claim_default_judgment", [selected.dispute_id])}
                      disabled={loading}
                      style={{ ...btnConsoleActionStyle, background: "#ef4444" }}
                    >
                      Claim Default & Dissolve Escrow
                    </button>
                  </div>
                )}

                {/* Initial resolution */}
                {selected.stage === 1 && (
                  <div style={benchActionCardStyle}>
                    <h5 style={actionTitleStyle}>Trigger AI Case Arbitration</h5>
                    <p style={actionDescStyle}>Engage the decentralized LLM consensus engine to adjudicate the pleadings evidence.</p>
                    <button
                      onClick={() => handleTransaction("resolve_dispute", [selected.dispute_id])}
                      disabled={loading}
                      style={{ ...btnConsoleActionStyle, background: "#d4af37", color: "#060913" }}
                    >
                      Convene Court Adjudication
                    </button>
                  </div>
                )}

                {/* Appeal decision */}
                {selected.stage === 2 && (
                  <div style={benchActionCardStyle}>
                    <h5 style={actionTitleStyle}>File Supreme Appeal Escalation</h5>
                    <p style={actionDescStyle}>Disagree with initial verdict? Deposit a matching appeal bond to escalate.</p>
                    <button
                      onClick={() =>
                        handleTransaction("escalate_appeal", [selected.dispute_id], BigInt(selected.claimant_stake))
                      }
                      disabled={loading}
                      style={{ ...btnConsoleActionStyle, background: "#ec4899" }}
                    >
                      File Supreme Appeal ({formatStakeValue(selected.claimant_stake)} GEN)
                    </button>
                  </div>
                )}

                {/* Release funds */}
                {selected.stage === 2 && (
                  <div style={benchActionCardStyle}>
                    <h5 style={actionTitleStyle}>Disburse Settled Escrow</h5>
                    <p style={actionDescStyle}>Appeal deadline expired without challenge. Release the escrow pool to winner.</p>
                    <button
                      onClick={() => handleTransaction("finalize_disposal", [selected.dispute_id])}
                      disabled={loading}
                      style={{ ...btnConsoleActionStyle, background: "#10b981" }}
                    >
                      Conclude Docket & Disburse
                    </button>
                  </div>
                )}

                {/* Resolve appeal */}
                {selected.stage === 3 && (
                  <div style={benchActionCardStyle}>
                    <h5 style={actionTitleStyle}>Trigger Supreme Court Review</h5>
                    <p style={actionDescStyle}>Invoke the appellate validator tribunal to render the final binding payout ruling.</p>
                    <button
                      onClick={() => handleTransaction("resolve_appeal", [selected.dispute_id])}
                      disabled={loading}
                      style={{ ...btnConsoleActionStyle, background: "#db2777" }}
                    >
                      Conclude Supreme Appeal
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={emptyBenchConsoleStyle}>
              <span>⚖️ Bench Status Offline</span>
            </div>
          )}
        </aside>

      </div>

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
                placeholder="e.g. Failure to deliver code milestones"
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
                placeholder="Specify rules violated under the court guidelines charter..."
                value={lodgeForm.complaint}
                onChange={(e) => setLodgeForm({ ...lodgeForm, complaint: e.target.value })}
                required
                rows={3}
                style={modalTextareaStyle}
              />
            </div>

            <div style={formFieldStyle}>
              <label style={modalLabelStyle}>Evidence dossier Logs/Links</label>
              <textarea
                placeholder="Provide link references to code commits, contracts or communications..."
                value={lodgeForm.evidence}
                onChange={(e) => setLodgeForm({ ...lodgeForm, evidence: e.target.value })}
                required
                rows={2}
                style={modalTextareaStyle}
              />
            </div>

            <div style={modalSplitFieldsStyle}>
              <div style={{ flex: 1 }}>
                <label style={modalLabelStyle}>Filing Escrow Deposit (GEN)</label>
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
              File Case & Stake Escrow
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// Styling system: Full Desktop Three-Column Magistrate Theme
const containerStyle: React.CSSProperties = {
  height: "100vh",
  background: "#060913",
  color: "#f8fafc",
  fontFamily: "'Plus Jakarta Sans', sans-serif",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

const headerStyle: React.CSSProperties = {
  height: "76px",
  background: "#080c18",
  borderBottom: "1px solid #141c30",
  padding: "0 32px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexShrink: 0
};

const logoContainerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12
};

const logoScaleStyle: React.CSSProperties = {
  fontSize: 28,
  color: "#d4af37",
  filter: "drop-shadow(0 0 6px rgba(212, 175, 55, 0.2))"
};

const logoTitleStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 22,
  fontWeight: 700,
  margin: 0,
  color: "#e2e8f0"
};

const logoSubtitleStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#d4af37",
  margin: 0,
  letterSpacing: "0.5px",
  textTransform: "uppercase"
};

const consoleBadgeStyle: React.CSSProperties = {
  background: "#0f162a",
  border: "1px solid #1e293b",
  padding: "6px 14px",
  borderRadius: "4px",
  fontSize: 12,
  color: "#3b82f6",
  display: "flex",
  alignItems: "center",
  gap: 8
};

const blinkIndicatorStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  borderRadius: "50%",
  backgroundColor: "#3b82f6",
  boxShadow: "0 0 6px #3b82f6"
};

const headerActionsStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center"
};

const connectionWrapperStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 12
};

const walletInfoBadgeStyle: React.CSSProperties = {
  background: "#0a0f1e",
  border: "1px solid #141c30",
  padding: "8px 14px",
  borderRadius: "4px",
  display: "flex",
  alignItems: "center",
  gap: 8
};

const onlineIndicatorStyle: React.CSSProperties = {
  width: 6,
  height: 6,
  backgroundColor: "#10b981",
  borderRadius: "50%",
  boxShadow: "0 0 6px #10b981"
};

const addressTextStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: "#94a3b8",
  fontFamily: "monospace"
};

const btnConnectStyle: React.CSSProperties = {
  background: "transparent",
  color: "#d4af37",
  border: "1px solid #d4af37",
  borderRadius: "4px",
  padding: "8px 18px",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 13,
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const btnDisconnectStyle: React.CSSProperties = {
  background: "transparent",
  color: "#ef4444",
  border: "1px solid #ef4444",
  borderRadius: "4px",
  padding: "6px 12px",
  fontWeight: 600,
  cursor: "pointer",
  fontSize: 12
};

const workspaceFrameStyle: React.CSSProperties = {
  flexGrow: 1,
  display: "flex",
  overflow: "hidden"
};

/* COLUMN 1: Dockets */
const docketColumnStyle: React.CSSProperties = {
  width: "300px",
  flexShrink: 0,
  background: "#080c18",
  borderRight: "1px solid #141c30",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

const columnHeaderStyle: React.CSSProperties = {
  padding: "20px",
  borderBottom: "1px solid #141c30",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexShrink: 0
};

const columnTitleStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 16,
  fontWeight: 700,
  margin: 0,
  color: "#e2e8f0"
};

const btnLodgeDisputeStyle: React.CSSProperties = {
  backgroundColor: "transparent",
  color: "#d4af37",
  border: "1px solid rgba(212, 175, 55, 0.4)",
  borderRadius: "4px",
  padding: "6px 10px",
  fontSize: 11,
  fontWeight: 600,
  cursor: "pointer"
};

const columnBodyStyle: React.CSSProperties = {
  flexGrow: 1,
  overflowY: "auto",
  padding: "20px"
};

const emptyDocketStateStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "40px 12px",
  color: "#475569",
  fontSize: 12,
  fontStyle: "italic",
  lineHeight: 1.5
};

const docketItemStyle: React.CSSProperties = {
  borderWidth: 1,
  borderStyle: "solid",
  borderRadius: "4px",
  padding: "14px",
  cursor: "pointer",
  marginBottom: 12,
  transition: "all 0.15s"
};

const docketItemTopStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: 8
};

const docketIdStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: "#475569"
};

const stageBadgeStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  padding: "2px 6px",
  borderRadius: "2px",
  textTransform: "uppercase"
};

const docketTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "#f1f5f9",
  marginBottom: 6
};

const docketStakeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "#d4af37"
};

/* COLUMN 2: Pleading Dossiers */
const pleadingColumnStyle: React.CSSProperties = {
  flexGrow: 1,
  background: "#060913",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

const chamberTitleBlockStyle: React.CSSProperties = {
  borderBottom: "1px solid #141c30",
  paddingBottom: 24,
  marginBottom: 24
};

const charterNoticeStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#d4af37",
  textTransform: "uppercase",
  letterSpacing: "1px",
  fontWeight: 600
};

const caseMainTitleStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 24,
  fontWeight: 700,
  margin: "8px 0 16px 0",
  color: "#f1f5f9"
};

const casePartiesBadgeStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6
};

const partyItemStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#64748b",
  fontFamily: "monospace"
};

const dossierSectionStyle: React.CSSProperties = {
  background: "#080c18",
  border: "1px solid #141c30",
  borderRadius: "4px",
  marginBottom: 24,
  overflow: "hidden"
};

const claimantLabelHeaderStyle: React.CSSProperties = {
  background: "rgba(212, 175, 55, 0.05)",
  borderBottom: "1px solid #141c30",
  color: "#d4af37",
  padding: "10px 16px",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase"
};

const defendantLabelHeaderStyle: React.CSSProperties = {
  background: "rgba(59, 130, 246, 0.05)",
  borderBottom: "1px solid #141c30",
  color: "#3b82f6",
  padding: "10px 16px",
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase"
};

const dossierContentStyle: React.CSSProperties = {
  padding: 18
};

const dossierLabelStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#64748b",
  textTransform: "uppercase",
  margin: "0 0 6px 0",
  fontWeight: 600
};

const dossierParagraphStyle: React.CSSProperties = {
  fontSize: 13,
  lineHeight: 1.6,
  color: "#cbd5e1",
  margin: "0 0 16px 0"
};

const dossierStakeBadgeStyle: React.CSSProperties = {
  display: "inline-block",
  fontSize: 11,
  color: "#94a3b8",
  background: "#0c1122",
  padding: "4px 8px",
  borderRadius: "2px",
  fontFamily: "monospace"
};

const awaitingDefensePlaceholderStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  height: 120,
  color: "#475569",
  fontSize: 12,
  fontStyle: "italic"
};

const deadlineInfoStyle: React.CSSProperties = {
  fontSize: 10,
  color: "#475569",
  marginTop: 4,
  fontFamily: "monospace"
};

const emptyChamberStateStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  flexGrow: 1,
  padding: "60px 40px",
  textAlign: "center"
};

const emptyScalesIconStyle: React.CSSProperties = {
  fontSize: 48,
  color: "#d4af37",
  marginBottom: 16
};

const emptyChamberTitleStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 20,
  fontWeight: 700,
  margin: "0 0 8px 0"
};

const emptyChamberSubtitleStyle: React.CSSProperties = {
  fontSize: 13,
  color: "#475569",
  maxWidth: 420,
  lineHeight: 1.6,
  marginBottom: 28
};

const charterBoxStyle: React.CSSProperties = {
  background: "#080c18",
  border: "1px solid #141c30",
  borderRadius: "4px",
  padding: "16px 20px",
  maxWidth: 600,
  textAlign: "left"
};

const charterBoxTitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#d4af37",
  fontWeight: 600,
  textTransform: "uppercase",
  marginBottom: 8
};

const charterBoxTextStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#94a3b8",
  lineHeight: 1.5
};

/* COLUMN 3: Verdict & Bench */
const verdictColumnStyle: React.CSSProperties = {
  width: "350px",
  flexShrink: 0,
  background: "#080c18",
  borderLeft: "1px solid #141c30",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

const emptyBenchConsoleStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  height: "100%",
  color: "#475569",
  fontSize: 12,
  fontStyle: "italic"
};

const consoleTitleStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 16,
  margin: 0,
  color: "#e2e8f0"
};

const verticalStepperStyle: React.CSSProperties = {
  background: "#060913",
  border: "1px solid #141c30",
  padding: "14px",
  borderRadius: "4px",
  marginBottom: 20,
  display: "flex",
  flexDirection: "column",
  gap: 12
};

const verticalStepItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10
};

const stepDotStyle: React.CSSProperties = {
  width: 18,
  height: 18,
  borderRadius: "50%",
  display: "grid",
  placeItems: "center",
  fontSize: 10,
  fontWeight: 700
};

const stepLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600
};

const rulingBriefStyle: React.CSSProperties = {
  border: "1px solid rgba(212, 175, 55, 0.3)",
  borderRadius: "4px",
  padding: 14,
  marginBottom: 20
};

const rulingTitleStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#d4af37",
  fontWeight: 700,
  textTransform: "uppercase",
  marginBottom: 8
};

const rulingInnerStyle: React.CSSProperties = {
  fontSize: 12,
  color: "#cbd5e1"
};

const rulingTextParagraphStyle: React.CSSProperties = {
  margin: 0,
  lineHeight: 1.5,
  fontStyle: "italic",
  color: "#94a3b8"
};

const consoleConsoleStyle: React.CSSProperties = {
  borderTop: "1px solid #141c30",
  paddingTop: 16
};

const consoleSectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  textTransform: "uppercase",
  margin: "0 0 12px 0"
};

const benchActionCardStyle: React.CSSProperties = {
  background: "#0c1122",
  border: "1px solid #1a2136",
  padding: 16,
  borderRadius: "4px"
};

const actionTitleStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: "#d4af37",
  textTransform: "uppercase",
  margin: "0 0 6px 0"
};

const actionDescStyle: React.CSSProperties = {
  fontSize: 11,
  color: "#64748b",
  margin: "0 0 12px 0",
  lineHeight: 1.4
};

const textareaInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px",
  background: "#060913",
  border: "1px solid #1a2136",
  borderRadius: "4px",
  color: "#ffffff",
  fontSize: 13,
  marginBottom: 10,
  fontFamily: "inherit"
};

const btnConsoleActionStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  border: "none",
  borderRadius: "4px",
  color: "#ffffff",
  fontWeight: 700,
  fontSize: 11,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

// Modal Design
const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(6, 9, 19, 0.85)",
  backdropFilter: "blur(8px)",
  display: "grid",
  placeItems: "center",
  zIndex: 1000,
  padding: 20
};

const modalContentStyle: React.CSSProperties = {
  background: "#0c1122",
  border: "1px solid #d4af37",
  borderRadius: "4px",
  padding: "30px",
  maxWidth: 560,
  width: "100%",
  maxHeight: "90vh",
  overflowY: "auto"
};

const modalTitleStyle: React.CSSProperties = {
  fontFamily: "'Playfair Display', serif",
  fontSize: 20,
  fontWeight: 700,
  margin: "0 0 20px 0",
  color: "#d4af37"
};

const formFieldStyle: React.CSSProperties = {
  marginBottom: 14
};

const modalLabelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  fontWeight: 600,
  color: "#64748b",
  marginBottom: 6,
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const modalInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "#060913",
  border: "1px solid #1a2136",
  borderRadius: "4px",
  color: "#ffffff",
  fontSize: 13,
  boxSizing: "border-box"
};

const modalTextareaStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  background: "#060913",
  border: "1px solid #1a2136",
  borderRadius: "4px",
  color: "#ffffff",
  fontSize: 13,
  boxSizing: "border-box",
  fontFamily: "inherit"
};

const modalSplitFieldsStyle: React.CSSProperties = {
  display: "flex",
  gap: 14,
  marginBottom: 20
};

const btnSubmitModalStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  background: "linear-gradient(135deg, #d4af37 0%, #c5a028 100%)",
  color: "#060913",
  border: "none",
  borderRadius: "4px",
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};
