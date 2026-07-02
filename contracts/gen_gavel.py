# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
import typing
from datetime import datetime

class GenGavel(gl.Contract):
    """
    GenGavel is a decentralized SLA escrow and intelligent arbitration contract.
    It resolves qualitative contractual agreements using validator LLM consensus.
    """
    dispute_count: i32
    disputes: TreeMap[str, str]
    charter: str

    def __init__(self, charter: str):
        """
        Initializes the arbitration contract with a set DAO charter / rule guidelines.
        """
        self.dispute_count = i32(0)
        self.charter = charter

    @gl.public.write.payable
    def lodge_dispute(self, title: str, complaint: str, evidence: str, defendant: str, duration_hours: int) -> i32:
        """
        Allows a claimant to file a dispute under the charter rules by locking a deposit.
        """
        stake = gl.message.value
        if stake == u256(0):
            raise gl.vm.UserError("Arbitration filing requires staking an escrow deposit.")

        self.dispute_count = i32(int(self.dispute_count) + 1)
        dispute_id = str(int(self.dispute_count))

        now_sec = self._parse_timestamp(gl.message_raw["datetime"])
        deadline_sec = now_sec + duration_hours * 3600

        dispute_data = {
            "dispute_id": dispute_id,
            "claimant": str(gl.message.sender_address),
            "defendant": defendant,
            "title": title,
            "complaint": complaint,
            "evidence": evidence,
            "rebuttal": "",
            "rebuttal_evidence": "",
            "claimant_stake": str(stake),
            "defendant_stake": "0",
            "escrow_pool": str(stake),
            "stage": 0,  # 0=Filed, 1=Answered, 2=Adjudicated, 3=Escalated, 4=Defaulted, 5=Finalized
            "initial_ruling": "",
            "appeal_deadline": 0,
            "appealed_by": "",
            "appeal_ruling": "",
            "created_at": now_sec,
            "deadline": deadline_sec,
        }
        self.disputes[dispute_id] = json.dumps(dispute_data)
        return self.dispute_count

    @gl.public.write.payable
    def submit_rebuttal(self, dispute_id: str, rebuttal: str, evidence: str) -> None:
        """
        Allows the designated defendant to stake a matching deposit and file their defense.
        """
        dispute = json.loads(self.disputes[dispute_id])
        if dispute.get("stage") != 0:
            raise gl.vm.UserError("This dispute is not awaiting a rebuttal.")
        if str(gl.message.sender_address).lower() != dispute.get("defendant", "").lower():
            raise gl.vm.UserError("Only the designated defendant can respond.")

        now_sec = self._parse_timestamp(gl.message_raw["datetime"])
        if now_sec > int(dispute.get("deadline", 0)):
            raise gl.vm.UserError("Rebuttal submission deadline has expired.")

        stake = gl.message.value
        required_stake = u256(int(dispute.get("claimant_stake", 0)))
        if stake != required_stake:
            raise gl.vm.UserError(f"Rebuttal requires staking a matching deposit of {dispute.get('claimant_stake')} wei.")

        dispute["rebuttal"] = rebuttal
        dispute["rebuttal_evidence"] = evidence
        dispute["defendant_stake"] = str(stake)
        dispute["escrow_pool"] = str(u256(int(dispute.get("escrow_pool", 0))) + stake)
        dispute["stage"] = 1  # 1 = Answered / Active Adjudication
        self.disputes[dispute_id] = json.dumps(dispute)

    @gl.public.write
    def claim_default_judgment(self, dispute_id: str) -> None:
        """
        Allows the claimant to claim a default judgment and retrieve their escrow
        if the defendant fails to respond within the allotted window.
        """
        dispute = json.loads(self.disputes[dispute_id])
        if dispute.get("stage") != 0:
            raise gl.vm.UserError("This dispute is not eligible for default judgment.")
        if str(gl.message.sender_address).lower() != dispute.get("claimant", "").lower():
            raise gl.vm.UserError("Only the claimant can request default judgment.")

        now_sec = self._parse_timestamp(gl.message_raw["datetime"])
        if now_sec <= int(dispute.get("deadline", 0)):
            raise gl.vm.UserError("The rebuttal period is still active.")

        dispute["stage"] = 4  # 4 = Defaulted
        dispute["escrow_pool"] = "0"
        self.disputes[dispute_id] = json.dumps(dispute)

        claimant_stake = u256(int(dispute.get("claimant_stake", 0)))
        self._pay(dispute.get("claimant"), claimant_stake)

    def _pay(self, recipient: str, amount: u256) -> None:
        """
        Transfers native tokens (GEN) to a recipient address.
        """
        @gl.evm.contract_interface
        class _Recipient:
            class View:
                pass
            class Write:
                pass
        _Recipient(Address(recipient)).emit_transfer(value=amount)

    def _parse_timestamp(self, iso_str: str) -> int:
        """
        Helper method to parse transaction ISO timestamps deterministically.
        """
        normalized = iso_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        return int(dt.timestamp())
