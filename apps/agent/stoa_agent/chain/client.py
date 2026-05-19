from __future__ import annotations

from eth_account import Account
from web3 import Web3
from web3.types import TxReceipt

from stoa_agent.chain.abis import STOA_REGISTRY_ABI
from stoa_agent.config import Settings
from stoa_agent.errors import ArcSubmitError


class ArcClient:
    def __init__(self, settings: Settings) -> None:
        self.w3 = Web3(Web3.HTTPProvider(settings.arc_testnet_rpc))
        self.account = Account.from_key(settings.agent_private_key)
        self.registry = self.w3.eth.contract(
            address=Web3.to_checksum_address(settings.stoa_registry_address),
            abi=STOA_REGISTRY_ABI,
        )

    def register_agent(self) -> str:
        """Register a new agent and return the agentId from the AgentRegistered event."""
        tx = self.registry.functions.registerAgent().build_transaction({
            "from": self.account.address,
            "nonce": self.w3.eth.get_transaction_count(self.account.address),
            "gas": 200_000,
            "gasPrice": self.w3.eth.gas_price,
            "chainId": self.w3.eth.chain_id,
        })
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

        if receipt["status"] != 1:
            raise ArcSubmitError(f"registerAgent reverted: {tx_hash.hex()}")

        agent_registered_event = self.registry.events.AgentRegistered()
        logs = agent_registered_event.process_receipt(receipt)
        if not logs:
            raise ArcSubmitError("AgentRegistered event not found in receipt")

        agent_id = logs[0]["args"]["agentId"].hex()
        return "0x" + agent_id if not agent_id.startswith("0x") else agent_id

    def publish_trace(
        self,
        agent_id: str,
        market_id: str,
        trace_hash: str,
        rating: int,
        confidence_bps: int,
        irys_receipt: str,
    ) -> str:
        """Publish a trace on-chain. Returns the tx hash."""
        tx = self.registry.functions.publishTrace(
            bytes.fromhex(agent_id[2:] if agent_id.startswith("0x") else agent_id),
            bytes.fromhex(market_id[2:] if market_id.startswith("0x") else market_id),
            bytes.fromhex(trace_hash[2:] if trace_hash.startswith("0x") else trace_hash),
            rating,
            confidence_bps,
            irys_receipt,
        ).build_transaction({
            "from": self.account.address,
            "nonce": self.w3.eth.get_transaction_count(self.account.address),
            "gas": 300_000,
            "gasPrice": self.w3.eth.gas_price,
            "chainId": self.w3.eth.chain_id,
        })
        signed = self.account.sign_transaction(tx)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)

        if receipt["status"] != 1:
            raise ArcSubmitError(f"publishTrace reverted: {tx_hash.hex()}")

        return tx_hash.hex()
