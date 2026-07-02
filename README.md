# ⚖️ GenGavel

**An Intelligent Decentralized Arbitration & Escrow Protocol powered by GenLayer.**

GenGavel is a game-theoretically balanced SLA (Service Level Agreement) dispute resolution protocol. It leverages decentralized AI consensus on GenLayer to evaluate and arbitrate qualitative claims (such as contract fulfillment, software delivery, service standards, and other natural-language terms) without relying on centralized human judges or single-point-of-failure LLM integrations.

## 🚀 Key Standout Features

### 1. Game-Theoretic Incentive Design
To prevent spam, frivolous disputes, or low-effort claims:
* **Filing Escrow:** The plaintiff (claimant) locks a filing fee/escrow stake.
* **Matching Rebuttal Stake:** To defend themselves, the defendant must match the plaintiff's stake. 
* **Winner-Take-All:** The winning party (determined by validator consensus) claims the combined pool.

### 2. Griefing Prevention via Default Judgment
If the defendant fails to respond or stake within the customizable resolution window, the dispute can be unilaterally closed by the plaintiff via `claim_default_resolution()`, returning the plaintiff's original stake and preventing locked-fund hostage situations.

### 3. Escape-Proof Escrow & Appeal Window
Adjudication does not immediately disburse funds. GenGavel introduces a **24-hour Appeal Window** after the initial ruling:
* If no appeal is filed, the winning party can finalize the case and claim the escrow.
* The losing party can challenge the decision by posting a matching appeal bond, escalating the dispute to a **Supreme Appeal**.

### 4. Appellate Review (Supreme Appeal)
When appealed, a secondary appellate AI prompt is executed (`resolve_appeal`). This prompt instructs GenLayer validators to act as a Supreme Court, auditing the initial judge's decision, reviewing the original claims/rebuttal, and rendering an absolute, unappealable final ruling.

### 5. Deterministic Time Mechanics
Instead of relying on non-deterministic system clock calls (which cause validation forks), GenGavel parses the transaction's ISO 8601 string (`gl.message_raw["datetime"]`) into a UTC Unix timestamp using a deterministic timezone offset conversion, ensuring consensus validity across all validating nodes.

### 6. Fault-Tolerant & Defensive JSON Extractors
GenGavel uses a defensive extractor helper (`_extract_json`) that parses LLM responses safely, scrubbing markdown wrapper elements (e.g. ` ```json ` blocks), and handles parsing failures gracefully to avoid transaction failures.

---

## 🛠️ Smart Contract API

| Method | Type | Description |
|--------|------|-------------|
| `lodge_dispute(title, complaint, evidence, defendant, duration_hours)` | Write (Payable) | Claimant files a dispute, locks their escrow stake, and sets a deadline. |
| `submit_rebuttal(dispute_id, defense, evidence)` | Write (Payable) | Defendant uploads their defense and deposits a matching stake. |
| `claim_default_resolution(dispute_id)` | Write | Returns the plaintiff's stake if the defendant misses the response window. |
| `resolve_dispute(dispute_id)` | Write (AI) | Triggers the initial AI validator consensus judgment. |
| `escalate_appeal(dispute_id)` | Write (Payable) | Allows the losing party to appeal by posting an appeal bond. |
| `resolve_appeal(dispute_id)` | Write (AI) | Resolves the Supreme Appeal and distributes the pool. |
| `finalize_disposal(dispute_id)` | Write | Distributes the locked escrow pool after the appeal window expires. |
| `get_dispute(dispute_id)` | View | Returns serialized JSON details of the case. |
| `is_expired(dispute_id)` | View | Returns whether a dispute has exceeded its deadline. |

---

## 💻 Tech Stack & Local Setup

### Prerequisites
* Node.js (v18+)
* `genlayer` CLI toolkit

### Local Installation

1. **Deploy Contract:**
```bash
genlayer network set studionet
genlayer account unlock
genlayer deploy --contract contracts/gen_gavel.py --args "1. Deliverables must match specifications. 2. Work must be professional. 3. Disputes must be filed in good faith."
```

2. **Frontend Deployment:**
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:3000` to interact with the Classy GenGavel Dashboard.
