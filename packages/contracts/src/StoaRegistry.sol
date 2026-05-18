// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title StoaRegistry
/// @notice Agent identity registry and trace publication for Stoa.
/// @dev Each bytes32 agentId is owned by exactly one address. No edit, delete, or invalidate
///      function exists — trace events are append-only. The contract has no constructor parameters,
///      no owner, no pause, and no upgrade path.
contract StoaRegistry {
    // --- Events ---

    event AgentRegistered(bytes32 indexed agentId, address indexed owner, uint256 timestamp);

    event TracePublished(
        bytes32 indexed agentId,
        bytes32 indexed marketId,
        bytes32 traceHash,
        int8 rating,
        uint16 confidenceBps,
        string irysReceipt,
        uint256 timestamp
    );

    // --- Errors ---

    error NotAgentOwner();
    error InvalidRating();
    error InvalidConfidence();

    // --- State ---

    mapping(bytes32 => address) public agentOwner;
    mapping(address => uint256) public agentNonce;

    // --- External functions ---

    /// @notice Register a new agent and receive a bytes32 identity.
    /// @dev Invariant: each agentId is owned by exactly one address. The id is derived
    ///      deterministically from msg.sender and their current nonce, so one address
    ///      can register multiple agents without collision.
    function registerAgent() external returns (bytes32 agentId) {
        agentId = keccak256(abi.encodePacked(msg.sender, agentNonce[msg.sender]));
        agentOwner[agentId] = msg.sender;
        agentNonce[msg.sender]++;

        emit AgentRegistered(agentId, msg.sender, block.timestamp);
    }

    /// @notice Publish a reasoning trace on-chain.
    /// @dev Invariant: only the agent's owner can publish traces under that agentId.
    ///      Invariant: trace events are append-only — no edit, delete, or invalidate exists.
    function publishTrace(
        bytes32 agentId,
        bytes32 marketId,
        bytes32 traceHash,
        int8 rating,
        uint16 confidenceBps,
        string calldata irysReceipt
    ) external {
        if (agentOwner[agentId] != msg.sender) revert NotAgentOwner();
        if (rating < -3 || rating > 3) revert InvalidRating();
        if (confidenceBps > 10000) revert InvalidConfidence();

        emit TracePublished(agentId, marketId, traceHash, rating, confidenceBps, irysReceipt, block.timestamp);
    }
}
