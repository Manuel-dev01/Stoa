// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @dev Minimal ERC-20 interface.
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
}

/// @dev Minimal ERC-4626 interface.
interface IERC4626 {
    function asset() external view returns (address);
    function deposit(uint256 assets, address receiver) external returns (uint256 shares);
    function redeem(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function convertToAssets(uint256 shares) external view returns (uint256 assets);
    function convertToShares(uint256 assets) external view returns (uint256 shares);
}

/// @title StoaTreasury
/// @notice USDC/USYC treasury management for Stoa agents.
/// @dev Agents deposit USDC via `subscribe`. If a yield vault (USYC) is set, USDC is
///      forwarded into it for yield. `redeem` burns shares and returns USDC to the agent.
///      If no vault is set, USDC sits in the treasury contract directly.
contract StoaTreasury {
    // --- Events ---

    event Subscribed(bytes32 indexed agentId, uint256 assets, uint256 shares, uint256 timestamp);
    event Redeemed(bytes32 indexed agentId, uint256 shares, uint256 assets, uint256 timestamp);
    event YieldVaultSet(address indexed vault, uint256 timestamp);

    // --- Errors ---

    error ZeroDeposit();
    error InsufficientShares();
    error TransferFailed();
    error VaultAssetMismatch();

    // --- State ---

    address public owner;
    IERC4626 public yieldVault;
    IERC20 public immutable usdc;

    /// @notice Shares held per agent. When yieldVault is set, these are vault shares.
    ///         When yieldVault is not set, these are 1:1 with USDC (6 decimals).
    mapping(bytes32 => uint256) public agentShares;

    // --- Modifiers ---

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    // --- Constructor ---

    constructor(address _usdc) {
        owner = msg.sender;
        usdc = IERC20(_usdc);
    }

    // --- External functions ---

    /// @notice Deposit USDC into the treasury for an agent.
    /// @dev Caller must have approved this contract to spend `amount` USDC.
    ///      If a yield vault is set, USDC is forwarded into it for yield.
    ///      If no vault is set, shares are 1:1 with USDC (6 decimals).
    function subscribe(bytes32 agentId, uint256 amount) external {
        if (amount == 0) revert ZeroDeposit();

        bool ok = usdc.transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        uint256 shares;
        if (address(yieldVault) != address(0)) {
            usdc.approve(address(yieldVault), amount);
            shares = yieldVault.deposit(amount, address(this));
        } else {
            shares = amount; // 1:1 when no vault
        }

        agentShares[agentId] += shares;

        emit Subscribed(agentId, amount, shares, block.timestamp);
    }

    /// @notice Redeem shares for USDC.
    /// @param agentId The agent whose shares to redeem.
    /// @param sharesToRedeem Number of shares to redeem. Pass type(uint256).max for all.
    function redeem(bytes32 agentId, uint256 sharesToRedeem) external {
        uint256 held = agentShares[agentId];
        if (sharesToRedeem == type(uint256).max) {
            sharesToRedeem = held;
        }
        if (sharesToRedeem > held) revert InsufficientShares();

        agentShares[agentId] -= sharesToRedeem;

        uint256 assets;
        if (address(yieldVault) != address(0)) {
            assets = yieldVault.redeem(sharesToRedeem, msg.sender, address(this));
        } else {
            assets = sharesToRedeem; // 1:1 when no vault
            bool ok = usdc.transfer(msg.sender, assets);
            if (!ok) revert TransferFailed();
        }

        emit Redeemed(agentId, sharesToRedeem, assets, block.timestamp);
    }

    // --- View functions ---

    /// @notice The USDC value of an agent's shares.
    function agentValue(bytes32 agentId) external view returns (uint256) {
        uint256 shares = agentShares[agentId];
        if (shares == 0) return 0;
        if (address(yieldVault) != address(0)) {
            return yieldVault.convertToAssets(shares);
        }
        return shares;
    }

    /// @notice Total USDC held by the treasury (including what's in the vault).
    function totalAssets() external view returns (uint256) {
        uint256 idle = usdc.balanceOf(address(this));
        if (address(yieldVault) != address(0)) {
            uint256 vaultBalance = IERC20(address(yieldVault)).balanceOf(address(this));
            return idle + yieldVault.convertToAssets(vaultBalance);
        }
        return idle;
    }

    // --- Admin ---

    /// @notice Set or update the yield vault (USYC). Only owner.
    function setYieldVault(address _vault) external onlyOwner {
        if (_vault != address(0)) {
            require(IERC4626(_vault).asset() == address(usdc), "vault asset != usdc");
            yieldVault = IERC4626(_vault);
        } else {
            yieldVault = IERC4626(address(0));
        }
        emit YieldVaultSet(_vault, block.timestamp);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
