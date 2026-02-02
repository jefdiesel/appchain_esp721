// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/WrappedEthscription.sol";

contract ERC721Receiver {
    bytes4 constant SELECTOR = 0x150b7a02;
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return SELECTOR;
    }
}

contract BadReceiver {
    // Does NOT implement onERC721Received
}

contract WrappedEthscriptionTest is Test {
    WrappedEthscription nft;

    address admin = address(this);
    address relayer = address(0xBEEF);
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address charlie = address(0xC0C0);

    bytes32 escId1 = keccak256("data:,hello");
    bytes32 escId2 = keccak256("data:,world");
    uint256 tokenId1 = uint256(escId1);
    uint256 tokenId2 = uint256(escId2);

    string constant BASE_URI = "https://chainhost.online/api/metadata/";

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event Burned(bytes32 indexed ethscriptionId, address indexed owner);

    function setUp() public {
        nft = new WrappedEthscription(BASE_URI, relayer);
    }

    // ---- Constructor ----

    function test_constructor() public view {
        assertEq(nft.name(), "Wrapped Ethscription");
        assertEq(nft.symbol(), "wESC");
        assertEq(nft.admin(), admin);
        assertEq(nft.relayer(), relayer);
        assertEq(nft.baseURI(), BASE_URI);
    }

    // ---- ERC-165 ----

    function test_supportsInterface_ERC721() public view {
        assertTrue(nft.supportsInterface(0x80ac58cd));
    }

    function test_supportsInterface_ERC721Metadata() public view {
        assertTrue(nft.supportsInterface(0x5b5e139f));
    }

    function test_supportsInterface_ERC165() public view {
        assertTrue(nft.supportsInterface(0x01ffc9a7));
    }

    function test_supportsInterface_random_false() public view {
        assertFalse(nft.supportsInterface(0xdeadbeef));
    }

    // ---- Mint ----

    function test_mint_success() public {
        vm.prank(relayer);
        vm.expectEmit(true, true, true, false);
        emit Transfer(address(0), alice, tokenId1);
        nft.mint(escId1, alice);

        assertEq(nft.ownerOf(tokenId1), alice);
        assertEq(nft.balanceOf(alice), 1);
    }

    function test_mint_multiple() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);
        vm.prank(relayer);
        nft.mint(escId2, alice);

        assertEq(nft.balanceOf(alice), 2);
        assertEq(nft.ownerOf(tokenId1), alice);
        assertEq(nft.ownerOf(tokenId2), alice);
    }

    function test_mint_reverts_if_not_relayer() public {
        vm.prank(alice);
        vm.expectRevert("Not relayer");
        nft.mint(escId1, alice);
    }

    function test_mint_reverts_if_already_minted() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(relayer);
        vm.expectRevert("Already minted");
        nft.mint(escId1, bob);
    }

    function test_mint_reverts_zero_address() public {
        vm.prank(relayer);
        vm.expectRevert("Zero address");
        nft.mint(escId1, address(0));
    }

    // ---- Burn ----

    function test_burn_success() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        vm.expectEmit(true, true, false, false);
        emit Burned(escId1, alice);
        nft.burn(tokenId1);

        assertEq(nft.balanceOf(alice), 0);

        vm.expectRevert("Token does not exist");
        nft.ownerOf(tokenId1);
    }

    function test_burn_emits_transfer_to_zero() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit Transfer(alice, address(0), tokenId1);
        nft.burn(tokenId1);
    }

    function test_burn_reverts_if_not_owner() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(bob);
        vm.expectRevert("Not token owner");
        nft.burn(tokenId1);
    }

    function test_burn_clears_approval() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        nft.approve(bob, tokenId1);
        assertEq(nft.getApproved(tokenId1), bob);

        vm.prank(alice);
        nft.burn(tokenId1);

        // Token no longer exists
        vm.expectRevert("Token does not exist");
        nft.getApproved(tokenId1);
    }

    function test_burn_then_remint() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        nft.burn(tokenId1);

        // Can re-mint the same ID
        vm.prank(relayer);
        nft.mint(escId1, bob);
        assertEq(nft.ownerOf(tokenId1), bob);
    }

    // ---- TokenURI ----

    function test_tokenURI() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        string memory uri = nft.tokenURI(tokenId1);
        // Should be baseURI + hex(escId1)
        assertTrue(bytes(uri).length > 0);
        // Starts with base URI
        assertTrue(_startsWith(uri, BASE_URI));
    }

    function test_tokenURI_reverts_nonexistent() public {
        vm.expectRevert("Token does not exist");
        nft.tokenURI(tokenId1);
    }

    // ---- Transfers ----

    function test_transferFrom() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        nft.transferFrom(alice, bob, tokenId1);

        assertEq(nft.ownerOf(tokenId1), bob);
        assertEq(nft.balanceOf(alice), 0);
        assertEq(nft.balanceOf(bob), 1);
    }

    function test_transferFrom_approved() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        nft.approve(bob, tokenId1);

        vm.prank(bob);
        nft.transferFrom(alice, bob, tokenId1);
        assertEq(nft.ownerOf(tokenId1), bob);
    }

    function test_transferFrom_operator() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        nft.setApprovalForAll(bob, true);

        vm.prank(bob);
        nft.transferFrom(alice, charlie, tokenId1);
        assertEq(nft.ownerOf(tokenId1), charlie);
    }

    function test_transferFrom_reverts_unauthorized() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(bob);
        vm.expectRevert("Not authorized");
        nft.transferFrom(alice, bob, tokenId1);
    }

    function test_transferFrom_reverts_wrong_from() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        vm.expectRevert("Not owner");
        nft.transferFrom(bob, charlie, tokenId1);
    }

    function test_transferFrom_reverts_to_zero() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        vm.expectRevert("Zero address");
        nft.transferFrom(alice, address(0), tokenId1);
    }

    function test_transferFrom_clears_approval() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        nft.approve(bob, tokenId1);

        vm.prank(alice);
        nft.transferFrom(alice, charlie, tokenId1);

        assertEq(nft.getApproved(tokenId1), address(0));
    }

    // ---- safeTransferFrom ----

    function test_safeTransferFrom_to_eoa() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        nft.safeTransferFrom(alice, bob, tokenId1);
        assertEq(nft.ownerOf(tokenId1), bob);
    }

    function test_safeTransferFrom_to_receiver_contract() public {
        ERC721Receiver receiver = new ERC721Receiver();

        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        nft.safeTransferFrom(alice, address(receiver), tokenId1);
        assertEq(nft.ownerOf(tokenId1), address(receiver));
    }

    function test_safeTransferFrom_reverts_bad_receiver() public {
        BadReceiver bad = new BadReceiver();

        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        vm.expectRevert("Non-ERC721 receiver");
        nft.safeTransferFrom(alice, address(bad), tokenId1);
    }

    // ---- Approval ----

    function test_approve() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit Approval(alice, bob, tokenId1);
        nft.approve(bob, tokenId1);

        assertEq(nft.getApproved(tokenId1), bob);
    }

    function test_approve_reverts_unauthorized() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(bob);
        vm.expectRevert("Not authorized");
        nft.approve(charlie, tokenId1);
    }

    function test_approve_by_operator() public {
        vm.prank(relayer);
        nft.mint(escId1, alice);

        vm.prank(alice);
        nft.setApprovalForAll(bob, true);

        vm.prank(bob);
        nft.approve(charlie, tokenId1);
        assertEq(nft.getApproved(tokenId1), charlie);
    }

    function test_setApprovalForAll() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit ApprovalForAll(alice, bob, true);
        nft.setApprovalForAll(bob, true);

        assertTrue(nft.isApprovedForAll(alice, bob));

        vm.prank(alice);
        nft.setApprovalForAll(bob, false);
        assertFalse(nft.isApprovedForAll(alice, bob));
    }

    // ---- Admin ----

    function test_setBaseURI() public {
        string memory newURI = "https://new.example.com/";
        nft.setBaseURI(newURI);
        assertEq(nft.baseURI(), newURI);
    }

    function test_setBaseURI_reverts_not_admin() public {
        vm.prank(alice);
        vm.expectRevert("Not admin");
        nft.setBaseURI("x");
    }

    function test_setRelayer() public {
        nft.setRelayer(alice);
        assertEq(nft.relayer(), alice);
    }

    function test_transferAdmin() public {
        nft.transferAdmin(alice);
        assertEq(nft.admin(), alice);
    }

    // ---- Fuzz ----

    function testFuzz_mint_burn_cycle(bytes32 id, address user) public {
        vm.assume(user != address(0));
        vm.assume(user.code.length == 0); // EOA only

        uint256 tokenId = uint256(id);

        vm.prank(relayer);
        nft.mint(id, user);
        assertEq(nft.ownerOf(tokenId), user);
        assertEq(nft.balanceOf(user), 1);

        vm.prank(user);
        nft.burn(tokenId);
        assertEq(nft.balanceOf(user), 0);
    }

    function testFuzz_transfer(bytes32 id, address from, address to) public {
        vm.assume(from != address(0) && to != address(0));
        vm.assume(from != to);
        vm.assume(from.code.length == 0 && to.code.length == 0);

        uint256 tokenId = uint256(id);

        vm.prank(relayer);
        nft.mint(id, from);

        vm.prank(from);
        nft.transferFrom(from, to, tokenId);
        assertEq(nft.ownerOf(tokenId), to);
    }

    // ---- Helpers ----

    function _startsWith(string memory str, string memory prefix) internal pure returns (bool) {
        bytes memory s = bytes(str);
        bytes memory p = bytes(prefix);
        if (s.length < p.length) return false;
        for (uint i = 0; i < p.length; i++) {
            if (s[i] != p[i]) return false;
        }
        return true;
    }
}
