from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

from eth_utils import keccak

from stoa_agent.config import Settings
from stoa_agent.errors import IrysUploadError

# Path to the Node.js Irys upload script
_SCRIPT_DIR = Path(__file__).resolve().parent.parent.parent / "scripts"
_UPLOAD_SCRIPT = _SCRIPT_DIR / "irys_upload.mjs"


def canonicalize(data: dict) -> bytes:
    """JSON-canonicalize a dict: sorted keys, no whitespace, UTF-8 encoded."""
    return json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")


def compute_trace_hash(trace_json: dict) -> str:
    """Keccak256 of the canonicalized trace JSON, returned as 0x-prefixed hex."""
    canonical = canonicalize(trace_json)
    return "0x" + keccak(canonical).hex()


async def upload_trace(trace_json: dict, settings: Settings) -> str:
    """Upload canonicalized JSON to Irys via Node.js SDK, return the receipt id.

    Falls back to HTTP API if Node.js script is unavailable.
    """
    body = canonicalize(trace_json).decode("utf-8")

    payload = json.dumps({
        "data": body,
        "token": settings.irys_token,
        "nodeUrl": settings.irys_node_url,
        "privateKey": settings.irys_private_key,
        "providerUrl": settings.irys_provider_url,
    })

    # Try Node.js SDK first
    if _UPLOAD_SCRIPT.exists():
        return await _upload_via_node(payload, settings)

    # Fallback: try the HTTP /tx/data endpoint (works on some devnet configs)
    return await _upload_via_http(body, settings)


async def _upload_via_node(payload: str, settings: Settings) -> str:
    """Upload via Node.js @irys/sdk subprocess."""
    proc = await asyncio.create_subprocess_exec(
        "node",
        str(_UPLOAD_SCRIPT),
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await proc.communicate(input=payload.encode("utf-8"))

    if proc.returncode != 0:
        err_text = stderr.decode("utf-8").strip()
        try:
            err_json = json.loads(err_text)
            err_msg = err_json.get("error", err_text)
        except (json.JSONDecodeError, ValueError):
            err_msg = err_text
        raise IrysUploadError(f"Irys Node.js upload failed: {err_msg}")

    try:
        result = json.loads(stdout.decode("utf-8"))
    except json.JSONDecodeError as e:
        raise IrysUploadError(f"Irys upload: invalid response: {stdout.decode('utf-8')[:200]}") from e

    receipt_id = result.get("id")
    if not receipt_id:
        raise IrysUploadError(f"Irys upload: no receipt id in response: {result}")
    return receipt_id


async def _upload_via_http(body: str, settings: Settings) -> str:
    """Fallback: upload via Irys HTTP API."""
    import httpx

    headers = {
        "Content-Type": "application/octet-stream",
        "x-chain": settings.irys_token,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            f"{settings.irys_node_url}/tx/data",
            content=body.encode("utf-8"),
            headers=headers,
        )

        if resp.status_code not in (200, 201):
            raise IrysUploadError(
                f"Irys HTTP upload failed ({resp.status_code}): {resp.text[:300]}"
            )

        result = resp.json()
        receipt_id = result.get("id") or result.get("txId")
        if not receipt_id:
            raise IrysUploadError(f"Irys HTTP upload: no receipt id: {result}")
        return receipt_id
