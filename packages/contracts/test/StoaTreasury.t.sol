// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {StoaTreasury} from "../src/StoaTreasury.sol";
import {IERC20} from "../src/StoaTreasury.sol";
import {IERC4626} from "../src/StoaTreasury.sol";

/// @dev Mock USDC for testing. No allowance checks — simplified for test speed.
contract MockUSDC {
    mapping(address => uint256) public balanceOf;

    function transfer(address to, uint256 amount) external returns (bool) {
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function approve(address, uint256) external pure returns (bool) {
        return true;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }
}

/// @dev Mock ERC-4626 vault for testing. 1:1 exchange rate.
contract MockVault {
    IERC20 public asset;
    mapping(address => uint256) public balanceOf;

    constructor(address _asset) {
        asset = IERC20(_asset);
    }

    function deposit(uint256 assets, address receiver) external returns (uint256 shares) {
        asset.transferFrom(msg.sender, address(this), assets);
        balanceOf[receiver] += assets;
        return assets;
    }

    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets) {
        require(balanceOf[owner] >= shares);
        balanceOf[owner] -= shares;
        assets = shares; // 1:1
        asset.transfer(receiver, assets);
        return assets;
    }

    function convertToAssets(uint256 shares) external pure returns (uint256) {
        return shares; // 1:1
    }

    function convertToShares(uint256 assets) external pure returns (uint256) {
        return assets; // 1:1
    }
}

contract StoaTreasuryTest is Test {
    StoaTreasury treasury;
    MockUSDC usdc;
    MockVault vault;

    address alice = makeAddr("alice");
    bytes32 agentId = keccak256("agent1");

    function setUp() public {
        usdc = new MockUSDC();
        treasury = new StoaTreasury(address(usdc));
        vault = new MockVault(address(usdc));

        // Fund alice with 1000 USDC
        usdc.mint(alice, 1000e6);
    }

    function test_Subscribe_DepositsUSDC() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), 100e6);
        treasury.subscribe(agentId, 100e6);
        vm.stopPrank();

        assertEq(treasury.agentShares(agentId), 100e6);
        assertEq(usdc.balanceOf(address(treasury)), 100e6);
    }

    function test_Subscribe_RevertsOnZero() public {
        vm.prank(alice);
        usdc.approve(address(treasury), 0);
        vm.expectRevert(StoaTreasury.ZeroDeposit.selector);
        treasury.subscribe(agentId, 0);
    }

    function test_Redeem_ReturnsUSDC() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), 100e6);
        treasury.subscribe(agentId, 100e6);

        uint256 before = usdc.balanceOf(alice);
        treasury.redeem(agentId, 50e6);
        uint256 afterBal = usdc.balanceOf(alice);

        assertEq(afterBal - before, 50e6);
        assertEq(treasury.agentShares(agentId), 50e6);
        vm.stopPrank();
    }

    function test_Redeem_MaxRedeemsAll() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), 100e6);
        treasury.subscribe(agentId, 100e6);

        treasury.redeem(agentId, type(uint256).max);
        assertEq(treasury.agentShares(agentId), 0);
        assertEq(usdc.balanceOf(alice), 1000e6);
        vm.stopPrank();
    }

    function test_Redeem_RevertsOnInsufficient() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), 100e6);
        treasury.subscribe(agentId, 100e6);

        vm.expectRevert(StoaTreasury.InsufficientShares.selector);
        treasury.redeem(agentId, 200e6);
        vm.stopPrank();
    }

    function test_Subscribe_WithYieldVault() public {
        treasury.setYieldVault(address(vault));

        vm.startPrank(alice);
        usdc.approve(address(treasury), 100e6);
        treasury.subscribe(agentId, 100e6);
        vm.stopPrank();

        // Shares are vault shares (1:1 in mock)
        assertEq(treasury.agentShares(agentId), 100e6);
        // USDC went from alice -> treasury -> vault
        assertEq(usdc.balanceOf(address(vault)), 100e6);
    }

    function test_Redeem_WithYieldVault() public {
        treasury.setYieldVault(address(vault));

        vm.startPrank(alice);
        usdc.approve(address(treasury), 100e6);
        treasury.subscribe(agentId, 100e6);

        uint256 before = usdc.balanceOf(alice);
        treasury.redeem(agentId, 60e6);
        uint256 afterBal = usdc.balanceOf(alice);

        assertEq(afterBal - before, 60e6);
        assertEq(treasury.agentShares(agentId), 40e6);
        vm.stopPrank();
    }

    function test_AgentValue_NoVault() public {
        vm.startPrank(alice);
        usdc.approve(address(treasury), 100e6);
        treasury.subscribe(agentId, 100e6);
        vm.stopPrank();

        assertEq(treasury.agentValue(agentId), 100e6);
    }

    function test_AgentValue_WithVault() public {
        treasury.setYieldVault(address(vault));

        vm.startPrank(alice);
        usdc.approve(address(treasury), 100e6);
        treasury.subscribe(agentId, 100e6);
        vm.stopPrank();

        assertEq(treasury.agentValue(agentId), 100e6);
    }

    function test_SetYieldVault_RevertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert("not owner");
        treasury.setYieldVault(address(vault));
    }

    function test_SetYieldVault_RevertsOnWrongAsset() public {
        MockUSDC otherToken = new MockUSDC();
        MockVault wrongVault = new MockVault(address(otherToken));

        vm.expectRevert("vault asset != usdc");
        treasury.setYieldVault(address(wrongVault));
    }

    function test_TransferOwnership() public {
        treasury.transferOwnership(alice);
        assertEq(treasury.owner(), alice);
    }
}
