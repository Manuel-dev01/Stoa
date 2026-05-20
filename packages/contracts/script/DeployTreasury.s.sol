// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {StoaTreasury} from "../src/StoaTreasury.sol";

contract DeployTreasury is Script {
    function run() external {
        // USDC on Arc testnet — replace with real address when confirmed
        address usdc = vm.envOr("USDC_ARC_ADDRESS", address(0));

        vm.startBroadcast();
        StoaTreasury treasury = new StoaTreasury(usdc);
        vm.stopBroadcast();

        console.log("StoaTreasury deployed at:", address(treasury));
        console.log("USDC address:", usdc);
    }
}
