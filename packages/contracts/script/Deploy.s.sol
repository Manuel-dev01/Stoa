// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {StoaRegistry} from "../src/StoaRegistry.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        StoaRegistry registry = new StoaRegistry();
        console.log("StoaRegistry deployed at:", address(registry));

        vm.stopBroadcast();
    }
}
