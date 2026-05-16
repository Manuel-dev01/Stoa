// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title StoaRegistry
/// @notice Agent identity registry and trace publication for Stoa.
contract StoaRegistry {
    // --- Events ---

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

    error AgentAlreadyRegistered();

    // --- State ---

    mapping(bytes32 => address) public agentOwner;
    uint256 public agentCount;

    // --- External functions ---

    /// @notice Register a new agent and receive a bytes32 identity.
    /// @return agentId The deterministic bytes32 identity derived from the caller and count.
    function registerAgent() external returns (bytes32 agentId) {
        // TODO: implement registration logic
        revert("not implemented");
    }

    /// @notice Publish a reasoning trace on-chain.
    /// @param agentId The agent's bytes32 identity.
    /// @param traceHash Keccak256 of the trace JSON.
    /// @param marketId The bytes32 market identifier.
    /// @param rating Directional conviction from -3 (strong short) to +3 (strong long).
    /// @param confidenceBps Confidence in basis points (0–10000).
    /// @param irysReceipt Irys transaction receipt for the pinned trace.
    function publishTrace(
        bytes32 agentId,
        bytes32 traceHash,
        bytes32 marketId,
        int8 rating,
        uint16 confidenceBps,
        string calldata irysReceipt
    ) external {
        // TODO: implement trace publication logic
        revert("not implemented");
    }
}
