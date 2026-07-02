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

    def _parse_timestamp(self, iso_str: str) -> int:
        """
        Helper method to parse transaction ISO timestamps deterministically.
        """
        normalized = iso_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(normalized)
        return int(dt.timestamp())
