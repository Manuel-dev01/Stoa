// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {StoaRegistry} from "../src/StoaRegistry.sol";

contract StoaRegistryTest is Test {
    StoaRegistry registry;
    address alice = makeAddr("alice");

    function setUp() public {
        registry = new StoaRegistry();
    }

    function test_RegisterAgent_AssignsBytes32Identity() public {
        vm.prank(alice);
        bytes32 agentId = registry.registerAgent();
        assertEq(registry.agentOwner(agentId), alice);
    }

    function test_RegisterAgent_AllowsSameAddressToRegisterMultipleAgents() public {
        vm.startPrank(alice);
        bytes32 agentId1 = registry.registerAgent();
        bytes32 agentId2 = registry.registerAgent();
        vm.stopPrank();

        assertTrue(agentId1 != agentId2, "agentIds must differ");
        assertEq(registry.agentOwner(agentId1), alice);
        assertEq(registry.agentOwner(agentId2), alice);
    }

    function test_RegisterAgent_EmitsAgentRegisteredEvent() public {
        bytes32 expectedAgentId = keccak256(abi.encodePacked(alice, uint256(0)));

        vm.expectEmit(true, true, false, true);
        emit StoaRegistry.AgentRegistered(expectedAgentId, alice, block.timestamp);

        vm.prank(alice);
        registry.registerAgent();
    }

    function test_PublishTrace_StoredCorrectlyAsEvent() public {
        vm.prank(alice);
        bytes32 agentId = registry.registerAgent();

        bytes32 marketId = keccak256("test-market");
        bytes32 traceHash = keccak256("test-trace");
        int8 rating = 2;
        uint16 confidenceBps = 7500;
        string memory irysReceipt = "irys-tx-abc123";

        vm.expectEmit(true, true, false, true);
        emit StoaRegistry.TracePublished(
            agentId, marketId, traceHash, rating, confidenceBps, irysReceipt, block.timestamp
        );

        vm.prank(alice);
        registry.publishTrace(agentId, marketId, traceHash, rating, confidenceBps, irysReceipt);
    }

    function test_PublishTrace_RevertsWhenCallerIsNotOwner() public {
        vm.prank(alice);
        bytes32 agentId = registry.registerAgent();

        address bob = makeAddr("bob");
        vm.prank(bob);
        vm.expectRevert(StoaRegistry.NotAgentOwner.selector);
        registry.publishTrace(agentId, keccak256("m"), keccak256("t"), 1, 5000, "receipt");
    }

    function test_PublishTrace_RevertsOnRatingBelowMin() public {
        vm.prank(alice);
        bytes32 agentId = registry.registerAgent();

        vm.prank(alice);
        vm.expectRevert(StoaRegistry.InvalidRating.selector);
        registry.publishTrace(agentId, keccak256("m"), keccak256("t"), -4, 5000, "receipt");
    }

    function test_PublishTrace_RevertsOnRatingAboveMax() public {
        vm.prank(alice);
        bytes32 agentId = registry.registerAgent();

        vm.prank(alice);
        vm.expectRevert(StoaRegistry.InvalidRating.selector);
        registry.publishTrace(agentId, keccak256("m"), keccak256("t"), 4, 5000, "receipt");
    }

    function test_PublishTrace_RevertsOnConfidenceAbove10000() public {
        vm.prank(alice);
        bytes32 agentId = registry.registerAgent();

        vm.prank(alice);
        vm.expectRevert(StoaRegistry.InvalidConfidence.selector);
        registry.publishTrace(agentId, keccak256("m"), keccak256("t"), 1, 10001, "receipt");
    }

    function test_PublishTrace_AcceptsRatingZeroAsNeutral() public {
        vm.prank(alice);
        bytes32 agentId = registry.registerAgent();

        vm.prank(alice);
        registry.publishTrace(agentId, keccak256("m"), keccak256("t"), 0, 5000, "receipt");
    }
}
