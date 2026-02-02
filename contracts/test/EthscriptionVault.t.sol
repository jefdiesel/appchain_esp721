// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/EthscriptionVault.sol";

contract EthscriptionVaultTest is Test {
    EthscriptionVault vault;

    address admin = address(this);
    address relayer = address(0xBEEF);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    bytes32 escId1 = keccak256("data:,hello");
    bytes32 escId2 = keccak256("data:,world");

    event Deposited(bytes32 indexed ethscriptionId, address indexed owner);
    event Withdrawn(bytes32 indexed ethscriptionId, address indexed to);
    event ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
        address indexed previousOwner,
        address indexed recipient,
        bytes32 indexed ethscriptionId
    );

    function setUp() public {
        vault = new EthscriptionVault(relayer);
    }

    // ---- Constructor ----

    function test_constructor() public view {
        assertEq(vault.admin(), admin);
        assertEq(vault.relayer(), relayer);
    }

    // ---- Deposit ----

    function test_deposit_success() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit Deposited(escId1, alice);
        vault.deposit(escId1);

        assertEq(vault.depositors(escId1), alice);
    }

    function test_deposit_multiple_different_ids() public {
        vm.prank(alice);
        vault.deposit(escId1);

        vm.prank(bob);
        vault.deposit(escId2);

        assertEq(vault.depositors(escId1), alice);
        assertEq(vault.depositors(escId2), bob);
    }

    function test_deposit_reverts_if_already_deposited() public {
        vm.prank(alice);
        vault.deposit(escId1);

        vm.prank(bob);
        vm.expectRevert("Already deposited");
        vault.deposit(escId1);
    }

    function test_deposit_same_user_different_ids() public {
        vm.prank(alice);
        vault.deposit(escId1);

        vm.prank(alice);
        vault.deposit(escId2);

        assertEq(vault.depositors(escId1), alice);
        assertEq(vault.depositors(escId2), alice);
    }

    // ---- Withdraw ----

    function test_withdraw_success() public {
        vm.prank(alice);
        vault.deposit(escId1);

        vm.prank(relayer);
        vm.expectEmit(true, true, false, false);
        emit Withdrawn(escId1, alice);
        vault.withdraw(escId1, alice);

        assertEq(vault.depositors(escId1), address(0));
    }

    function test_withdraw_emits_esip2_transfer() public {
        vm.prank(alice);
        vault.deposit(escId1);

        vm.prank(relayer);
        vm.expectEmit(true, true, true, false);
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            address(vault),
            alice,
            escId1
        );
        vault.withdraw(escId1, alice);
    }

    function test_withdraw_to_different_address() public {
        vm.prank(alice);
        vault.deposit(escId1);

        vm.prank(relayer);
        vault.withdraw(escId1, bob);
        assertEq(vault.depositors(escId1), address(0));
    }

    function test_withdraw_reverts_if_not_deposited() public {
        vm.prank(relayer);
        vm.expectRevert("Not deposited");
        vault.withdraw(escId1, alice);
    }

    function test_withdraw_reverts_if_not_relayer() public {
        vm.prank(alice);
        vault.deposit(escId1);

        vm.prank(alice);
        vm.expectRevert("Not relayer");
        vault.withdraw(escId1, alice);
    }

    function test_withdraw_then_redeposit() public {
        vm.prank(alice);
        vault.deposit(escId1);

        vm.prank(relayer);
        vault.withdraw(escId1, alice);

        // Can deposit again after withdrawal
        vm.prank(bob);
        vault.deposit(escId1);
        assertEq(vault.depositors(escId1), bob);
    }

    // ---- Admin ----

    function test_setRelayer() public {
        vault.setRelayer(alice);
        assertEq(vault.relayer(), alice);
    }

    function test_setRelayer_reverts_if_not_admin() public {
        vm.prank(alice);
        vm.expectRevert("Not admin");
        vault.setRelayer(bob);
    }

    function test_transferAdmin() public {
        vault.transferAdmin(alice);
        assertEq(vault.admin(), alice);

        // Old admin can no longer call admin functions
        vm.expectRevert("Not admin");
        vault.setRelayer(bob);

        // New admin can
        vm.prank(alice);
        vault.setRelayer(bob);
        assertEq(vault.relayer(), bob);
    }

    function test_transferAdmin_reverts_if_not_admin() public {
        vm.prank(alice);
        vm.expectRevert("Not admin");
        vault.transferAdmin(alice);
    }

    // ---- Fuzz ----

    function testFuzz_deposit_withdraw(bytes32 id, address depositor, address withdrawTo) public {
        vm.assume(depositor != address(0));
        vm.assume(withdrawTo != address(0));

        vm.prank(depositor);
        vault.deposit(id);
        assertEq(vault.depositors(id), depositor);

        vm.prank(relayer);
        vault.withdraw(id, withdrawTo);
        assertEq(vault.depositors(id), address(0));
    }
}
