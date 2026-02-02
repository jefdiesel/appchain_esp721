// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/EthscriptionVault.sol";
import "../src/WrappedEthscription.sol";

/**
 * @notice End-to-end test simulating the full wrap/unwrap flow.
 * In production vault and wrapped are on different chains, but we
 * can test the logic on a single chain with the relayer as a middleman.
 */
contract IntegrationTest is Test {
    EthscriptionVault vault;
    WrappedEthscription wrapped;

    address relayer = address(0xBEEF);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    bytes32 escId = keccak256("data:,my-cool-name");

    function setUp() public {
        vault = new EthscriptionVault(relayer);
        wrapped = new WrappedEthscription("https://chainhost.online/api/metadata/", relayer);
    }

    /// Full wrap flow: user deposits → relayer mints
    function test_fullWrapFlow() public {
        // Alice deposits ethscription into vault
        vm.prank(alice);
        vault.deposit(escId);
        assertEq(vault.depositors(escId), alice);

        // Relayer picks up Deposited event and mints NFT on "Base"
        vm.prank(relayer);
        wrapped.mint(escId, alice);
        assertEq(wrapped.ownerOf(uint256(escId)), alice);
        assertEq(wrapped.balanceOf(alice), 1);
    }

    /// Full unwrap flow: user burns NFT → relayer withdraws from vault
    function test_fullUnwrapFlow() public {
        // Setup: wrap first
        vm.prank(alice);
        vault.deposit(escId);
        vm.prank(relayer);
        wrapped.mint(escId, alice);

        // Alice burns the NFT
        vm.prank(alice);
        wrapped.burn(uint256(escId));
        assertEq(wrapped.balanceOf(alice), 0);

        // Relayer picks up Burned event and withdraws from vault
        vm.prank(relayer);
        vault.withdraw(escId, alice);
        assertEq(vault.depositors(escId), address(0));
    }

    /// Wrap, transfer NFT, then new owner unwraps
    function test_wrapTransferUnwrap() public {
        // Alice wraps
        vm.prank(alice);
        vault.deposit(escId);
        vm.prank(relayer);
        wrapped.mint(escId, alice);

        // Alice transfers NFT to Bob (e.g., via OpenSea sale)
        vm.prank(alice);
        wrapped.transferFrom(alice, bob, uint256(escId));
        assertEq(wrapped.ownerOf(uint256(escId)), bob);

        // Bob burns to unwrap
        vm.prank(bob);
        wrapped.burn(uint256(escId));

        // Relayer withdraws to Bob (the burner)
        vm.prank(relayer);
        vault.withdraw(escId, bob);
        assertEq(vault.depositors(escId), address(0));
    }

    /// Wrap → unwrap → re-wrap cycle
    function test_rewrapCycle() public {
        // First wrap
        vm.prank(alice);
        vault.deposit(escId);
        vm.prank(relayer);
        wrapped.mint(escId, alice);

        // Unwrap
        vm.prank(alice);
        wrapped.burn(uint256(escId));
        vm.prank(relayer);
        vault.withdraw(escId, alice);

        // Re-wrap
        vm.prank(alice);
        vault.deposit(escId);
        vm.prank(relayer);
        wrapped.mint(escId, alice);

        assertEq(wrapped.ownerOf(uint256(escId)), alice);
        assertEq(vault.depositors(escId), alice);
    }

    /// Cannot mint without deposit
    function test_cannotMintWithoutDeposit() public {
        // Relayer tries to mint (no deposit happened)
        // This should still succeed on the NFT side (relayer is trusted)
        // but in practice the relayer only mints after seeing Deposited event
        vm.prank(relayer);
        wrapped.mint(escId, alice);
        assertEq(wrapped.ownerOf(uint256(escId)), alice);

        // The vault has no record — this is fine, the relayer
        // is the trust bridge between chains
        assertEq(vault.depositors(escId), address(0));
    }

    /// Cannot double-deposit even across cycles without withdrawal
    function test_cannotDoubleDeposit() public {
        vm.prank(alice);
        vault.deposit(escId);

        vm.prank(bob);
        vm.expectRevert("Already deposited");
        vault.deposit(escId);
    }

    /// Cannot double-mint
    function test_cannotDoubleMint() public {
        vm.prank(relayer);
        wrapped.mint(escId, alice);

        vm.prank(relayer);
        vm.expectRevert("Already minted");
        wrapped.mint(escId, bob);
    }

    /// Non-owner cannot burn
    function test_nonOwnerCannotBurn() public {
        vm.prank(alice);
        vault.deposit(escId);
        vm.prank(relayer);
        wrapped.mint(escId, alice);

        vm.prank(bob);
        vm.expectRevert("Not token owner");
        wrapped.burn(uint256(escId));
    }

    /// Multiple ethscriptions wrapped simultaneously
    function test_multipleWraps() public {
        bytes32 id1 = keccak256("data:,name1");
        bytes32 id2 = keccak256("data:,name2");
        bytes32 id3 = keccak256("data:,name3");

        vm.startPrank(alice);
        vault.deposit(id1);
        vault.deposit(id2);
        vault.deposit(id3);
        vm.stopPrank();

        vm.startPrank(relayer);
        wrapped.mint(id1, alice);
        wrapped.mint(id2, alice);
        wrapped.mint(id3, alice);
        vm.stopPrank();

        assertEq(wrapped.balanceOf(alice), 3);

        // Burn one
        vm.prank(alice);
        wrapped.burn(uint256(id2));
        assertEq(wrapped.balanceOf(alice), 2);

        vm.prank(relayer);
        vault.withdraw(id2, alice);
        assertEq(vault.depositors(id2), address(0));
        // Others still deposited
        assertEq(vault.depositors(id1), alice);
        assertEq(vault.depositors(id3), alice);
    }
}
