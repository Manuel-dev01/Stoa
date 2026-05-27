from __future__ import annotations

import base64
import json
import time
import uuid
from datetime import datetime, timezone

import httpx
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding
from web3 import Web3

from stoa_agent.chain.abis import STOA_REGISTRY_ABI
from stoa_agent.config import Settings
from stoa_agent.errors import ArcSubmitError

_CIRCLE_BASE = "https://api.circle.com/v1/w3s"


def _log_circle(msg: str) -> None:
    ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[{ts}] {msg}", flush=True)


def _get_entity_ciphertext(api_key: str, entity_secret: str) -> str:
    """Return entity secret ciphertext for Circle API calls.

    If entity_secret looks like raw hex (64 chars), encrypt it with Circle's public key.
    If it looks like base64 ciphertext (longer), return it as-is.
    """
    # Raw 32-byte hex secret is exactly 64 hex characters
    if len(entity_secret) == 64 and all(c in "0123456789abcdefABCDEF" for c in entity_secret):
        headers = {"Authorization": f"Bearer {api_key}"}
        with httpx.Client(timeout=30) as client:
            resp = client.get(f"{_CIRCLE_BASE}/config/entity/publicKey", headers=headers)
            if resp.status_code >= 400:
                raise ArcSubmitError(f"Failed to fetch Circle public key ({resp.status_code}): {resp.text}")
            pem = resp.json()["data"]["publicKey"]

        public_key = serialization.load_pem_public_key(pem.encode())
        ciphertext = public_key.encrypt(
            bytes.fromhex(entity_secret),
            padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA256()), algorithm=hashes.SHA256(), label=None),
        )
        return base64.b64encode(ciphertext).decode()

    # Already ciphertext (from Circle console)
    return entity_secret
_TERMINAL_STATES = {"COMPLETE", "FAILED", "DENIED", "CANCELLED"}
_SUCCESS_STATES = {"COMPLETE"}
_POLL_INTERVAL = 2.0
_POLL_TIMEOUT = 90.0
# Circle reports a tx COMPLETE before the public Arc RPC node necessarily has
# the receipt indexed, so a bare get_transaction_receipt right after can throw
# TransactionNotFound. Poll the RPC until the receipt lands.
_RECEIPT_TIMEOUT = 60.0
_RECEIPT_POLL = 1.0


class CircleArcClient:
    """Arc chain client using Circle Programmable Wallets REST API.

    Same interface as ArcClient — register_agent() and publish_trace() —
    but Circle holds the key and handles signing/broadcasting.
    """

    def __init__(self, settings: Settings) -> None:
        self._wallet_id = settings.circle_wallet_id
        self._registry_address = settings.stoa_registry_address
        self._w3 = Web3(Web3.HTTPProvider(settings.arc_testnet_rpc))
        self._registry = self._w3.eth.contract(
            address=Web3.to_checksum_address(settings.stoa_registry_address),
            abi=STOA_REGISTRY_ABI,
        )
        self._headers = {
            "Authorization": f"Bearer {settings.circle_api_key}",
            "Content-Type": "application/json",
        }
        self._api_key = settings.circle_api_key
        self._entity_secret = settings.circle_entity_secret

    def _get_entity_ciphertext(self) -> str:
        """Get fresh entity secret ciphertext. Cannot be reused across calls."""
        return _get_entity_ciphertext(self._api_key, self._entity_secret)

    def register_agent(self, wallet_id: str | None = None) -> str:
        """Register a new agent via Circle wallet. Returns the agentId."""
        tx_id = self._execute_contract("registerAgent()", [], wallet_id=wallet_id)
        tx = self._poll_transaction(tx_id)
        tx_hash = self._extract_tx_hash(tx, tx_id)

        receipt = self._await_receipt(tx_hash)
        if receipt["status"] != 1:
            raise ArcSubmitError(f"registerAgent reverted: {tx_hash}")

        logs = self._registry.events.AgentRegistered().process_receipt(receipt)
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
        wallet_id: str | None = None,
    ) -> str:
        """Publish a trace on-chain via Circle wallet. Returns the tx hash."""
        def _hex(v: str) -> str:
            return v if v.startswith("0x") else f"0x{v}"

        tx_id = self._execute_contract(
            "publishTrace(bytes32,bytes32,bytes32,int8,uint16,string)",
            [_hex(agent_id), _hex(market_id), _hex(trace_hash), str(rating), str(confidence_bps), irys_receipt],
            wallet_id=wallet_id,
        )
        tx = self._poll_transaction(tx_id)
        tx_hash = self._extract_tx_hash(tx, tx_id)

        receipt = self._await_receipt(tx_hash)
        if receipt["status"] != 1:
            raise ArcSubmitError(f"publishTrace reverted: {tx_hash}")

        return tx_hash

    def _execute_contract(
        self,
        function_signature: str,
        parameters: list[str],
        contract_address: str | None = None,
        wallet_id: str | None = None,
    ) -> str:
        """Call Circle's contractExecution endpoint. Returns the transaction ID."""
        body = {
            "idempotencyKey": str(uuid.uuid4()),
            "walletId": wallet_id or self._wallet_id,
            "contractAddress": contract_address or self._registry_address,
            "abiFunctionSignature": function_signature,
            "feeLevel": "MEDIUM",
            "entitySecretCiphertext": self._get_entity_ciphertext(),
        }
        if parameters:
            body["abiParameters"] = parameters

        with httpx.Client(timeout=30) as client:
            resp = client.post(
                f"{_CIRCLE_BASE}/developer/transactions/contractExecution",
                json=body,
                headers=self._headers,
            )
            if resp.status_code >= 400:
                raise ArcSubmitError(f"Circle contractExecution failed ({resp.status_code}): {resp.text}")

            data = resp.json()
            tx_id = data.get("data", {}).get("id")
            if not tx_id:
                raise ArcSubmitError(f"Circle returned no transaction ID: {data}")
            return tx_id

    def execute_on_contract(
        self,
        contract_address: str,
        function_signature: str,
        parameters: list[str],
        wallet_id: str | None = None,
    ) -> str:
        """Execute a function on any contract via Circle wallet. Returns the tx hash."""
        tx_id = self._execute_contract(
            function_signature,
            parameters,
            contract_address=contract_address,
            wallet_id=wallet_id,
        )
        tx = self._poll_transaction(tx_id)
        return self._extract_tx_hash(tx, tx_id)

    def _poll_transaction(self, transaction_id: str) -> dict:
        """Poll a Circle transaction until terminal state. Returns the tx dict."""
        deadline = time.monotonic() + _POLL_TIMEOUT
        last_state = None

        with httpx.Client(timeout=30) as client:
            while time.monotonic() < deadline:
                try:
                    resp = client.get(
                        f"{_CIRCLE_BASE}/transactions/{transaction_id}",
                        headers=self._headers,
                    )
                    if resp.status_code >= 400:
                        time.sleep(_POLL_INTERVAL)
                        continue

                    resp_data = resp.json().get("data", {})
                    tx = resp_data.get("transaction", resp_data)
                    state = tx.get("state")
                    if state != last_state:
                        last_state = state

                    if state in _TERMINAL_STATES:
                        if state in _SUCCESS_STATES:
                            return tx
                        # Log full transaction details for debugging
                        error_detail = tx.get("errorDetails") or tx.get("errorMessage") or tx.get("errorReason") or ""
                        _log_circle(f"Circle tx {transaction_id} FAILED. state={state}, error={error_detail}, full={json.dumps(tx, indent=2)}")
                        # Try to get revert reason from Arc RPC
                        tx_hash = tx.get("txHash")
                        if tx_hash:
                            try:
                                if not tx_hash.startswith("0x"):
                                    tx_hash = f"0x{tx_hash}"
                                receipt = self._w3.eth.get_transaction_receipt(tx_hash)
                                _log_circle(f"  On-chain receipt: status={receipt.get('status')}, gasUsed={receipt.get('gasUsed')}")
                            except Exception as e:
                                _log_circle(f"  Could not fetch receipt: {e}")
                        raise ArcSubmitError(
                            f"Circle transaction {transaction_id} ended in state: {state}. {error_detail}"
                        )
                except ArcSubmitError:
                    raise
                except Exception:
                    pass

                time.sleep(_POLL_INTERVAL)

        raise ArcSubmitError(
            f"Circle transaction {transaction_id} timed out after {_POLL_TIMEOUT}s. Last state: {last_state}"
        )

    def _await_receipt(self, tx_hash: str) -> dict:
        """Wait for the Arc RPC to surface the receipt for a Circle-submitted tx.

        Circle marks a tx COMPLETE once it's confirmed on its side, but the
        public RPC node web3.py queries may lag by a few hundred ms to a couple
        seconds before the receipt is retrievable. web3's wait_for_transaction_receipt
        polls until it appears (or times out), which avoids the TransactionNotFound
        we'd get from a bare get_transaction_receipt called too early.
        """
        try:
            return self._w3.eth.wait_for_transaction_receipt(
                tx_hash, timeout=_RECEIPT_TIMEOUT, poll_latency=_RECEIPT_POLL
            )
        except Exception as e:
            raise ArcSubmitError(
                f"Receipt for {tx_hash} not found within {_RECEIPT_TIMEOUT}s "
                f"(Circle reported the tx complete, RPC has not surfaced it): {e}"
            ) from e

    @staticmethod
    def _extract_tx_hash(tx: dict, transaction_id: str) -> str:
        """Extract on-chain tx hash from a completed Circle transaction."""
        tx_hash = tx.get("txHash")
        if not tx_hash:
            raise ArcSubmitError(
                f"Circle transaction {transaction_id} completed but returned no tx hash"
            )
        return tx_hash if tx_hash.startswith("0x") else f"0x{tx_hash}"


def create_circle_wallet(
    api_key: str,
    entity_secret: str,
    wallet_set_id: str | None = None,
) -> dict:
    """Create a Circle wallet set + wallet on ARC-TESTNET. Returns {wallet_set_id, wallet_id, address}."""
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    ciphertext = _get_entity_ciphertext(api_key, entity_secret)

    with httpx.Client(timeout=30) as client:
        # Create wallet set if needed
        if not wallet_set_id:
            resp = client.post(
                f"{_CIRCLE_BASE}/developer/walletSets",
                json={
                    "idempotencyKey": str(uuid.uuid4()),
                    "name": "stoa-agent",
                    "entitySecretCiphertext": ciphertext,
                },
                headers=headers,
            )
            if resp.status_code >= 400:
                raise ArcSubmitError(f"Failed to create wallet set ({resp.status_code}): {resp.text}")
            wallet_set_id = resp.json()["data"]["id"]

        # Create wallet on Arc testnet
        resp = client.post(
            f"{_CIRCLE_BASE}/developer/wallets",
            json={
                "idempotencyKey": str(uuid.uuid4()),
                "walletSetId": wallet_set_id,
                "blockchains": ["ARC-TESTNET"],
                "count": 1,
                "accountType": "EOA",
                "entitySecretCiphertext": ciphertext,
            },
            headers=headers,
        )
        if resp.status_code >= 400:
            raise ArcSubmitError(f"Failed to create wallet ({resp.status_code}): {resp.text}")

        wallets = resp.json().get("data", {}).get("wallets", [])
        if not wallets:
            raise ArcSubmitError("Circle returned no wallets")

        wallet = wallets[0]
        return {
            "wallet_set_id": wallet_set_id,
            "wallet_id": wallet["id"],
            "address": wallet["address"],
        }


def get_circle_balance(api_key: str, wallet_id: str) -> list[dict]:
    """Get token balances for a Circle wallet. Returns list of {symbol, amount}."""
    headers = {"Authorization": f"Bearer {api_key}"}

    with httpx.Client(timeout=30) as client:
        resp = client.get(
            f"{_CIRCLE_BASE}/wallets/{wallet_id}/balances",
            headers=headers,
        )
        if resp.status_code >= 400:
            raise ArcSubmitError(f"Failed to get balance ({resp.status_code}): {resp.text}")

        balances = resp.json().get("data", {}).get("tokenBalances", [])
        return [
            {"symbol": b.get("token", {}).get("symbol", "?"), "amount": b.get("amount", "0")}
            for b in balances
        ]
