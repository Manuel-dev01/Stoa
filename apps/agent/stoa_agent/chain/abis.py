from __future__ import annotations

STOA_REGISTRY_ABI: list[dict] = [
    {
        "type": "event",
        "name": "AgentRegistered",
        "anonymous": False,
        "inputs": [
            {"name": "agentId", "type": "bytes32", "indexed": True},
            {"name": "owner", "type": "address", "indexed": True},
            {"name": "timestamp", "type": "uint256", "indexed": False},
        ],
    },
    {
        "type": "event",
        "name": "TracePublished",
        "anonymous": False,
        "inputs": [
            {"name": "agentId", "type": "bytes32", "indexed": True},
            {"name": "marketId", "type": "bytes32", "indexed": True},
            {"name": "traceHash", "type": "bytes32", "indexed": False},
            {"name": "rating", "type": "int8", "indexed": False},
            {"name": "confidenceBps", "type": "uint16", "indexed": False},
            {"name": "irysReceipt", "type": "string", "indexed": False},
            {"name": "timestamp", "type": "uint256", "indexed": False},
        ],
    },
    {
        "type": "function",
        "name": "registerAgent",
        "inputs": [],
        "outputs": [{"name": "agentId", "type": "bytes32"}],
        "stateMutability": "nonpayable",
    },
    {
        "type": "function",
        "name": "publishTrace",
        "inputs": [
            {"name": "agentId", "type": "bytes32"},
            {"name": "marketId", "type": "bytes32"},
            {"name": "traceHash", "type": "bytes32"},
            {"name": "rating", "type": "int8"},
            {"name": "confidenceBps", "type": "uint16"},
            {"name": "irysReceipt", "type": "string"},
        ],
        "outputs": [],
        "stateMutability": "nonpayable",
    },
    {
        "type": "function",
        "name": "agentOwner",
        "inputs": [{"name": "agentId", "type": "bytes32"}],
        "outputs": [{"name": "", "type": "address"}],
        "stateMutability": "view",
    },
    {
        "type": "function",
        "name": "agentNonce",
        "inputs": [{"name": "owner", "type": "address"}],
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
    },
]
