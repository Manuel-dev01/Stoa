// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {StoaTreasury} from "../src/StoaTreasury.sol";

contract DeployTreasury is Script {
    function run() external {
        address usdc = vm.envOr("USDC_ARC_ADDRESS", address(0));
        address registry = vm.envOr("STOA_REGISTRY_ADDRESS", address(0));
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        StoaTreasury treasury = new StoaTreasury(usdc, registry);
        vm.stopBroadcast();

        console.log("StoaTreasury deployed at:", address(treasury));
        console.log("USDC address:", usdc);
        console.log("Registry address:", registry);
    }
}
