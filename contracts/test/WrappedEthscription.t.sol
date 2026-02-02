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

contract BadReceiver {}

contract WrappedEthscriptionTest is Test {
    WrappedEthscription nft;

    address admin = address(this);
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
    event Wrapped(bytes32 indexed ethscriptionId, address indexed owner);
    event Unwrapped(bytes32 indexed ethscriptionId, address indexed owner);
    event ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
        address indexed previousOwner,
        address indexed recipient,
        bytes32 indexed ethscriptionId
    );

    function setUp() public {
        nft = new WrappedEthscription(BASE_URI);
    }

    // ---- Constructor ----

    function test_constructor() public view {
        assertEq(nft.name(), "Wrapped Ethscription");
        assertEq(nft.symbol(), "wESC");
        assertEq(nft.admin(), admin);
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

    // ---- Wrap ----

    function test_wrap_success() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit Transfer(address(0), alice, tokenId1);
        vm.expectEmit(true, true, false, false);
        emit Wrapped(escId1, alice);
        nft.wrap(escId1);

        assertEq(nft.ownerOf(tokenId1), alice);
        assertEq(nft.balanceOf(alice), 1);
        assertEq(nft.depositors(escId1), alice);
    }

    function test_wrap_multiple() public {
        vm.prank(alice);
        nft.wrap(escId1);
        vm.prank(alice);
        nft.wrap(escId2);

        assertEq(nft.balanceOf(alice), 2);
        assertEq(nft.ownerOf(tokenId1), alice);
        assertEq(nft.ownerOf(tokenId2), alice);
    }

    function test_wrap_different_users() public {
        vm.prank(alice);
        nft.wrap(escId1);
        vm.prank(bob);
        nft.wrap(escId2);

        assertEq(nft.depositors(escId1), alice);
        assertEq(nft.depositors(escId2), bob);
    }

    function test_wrap_reverts_already_wrapped() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(bob);
        vm.expectRevert("Already wrapped");
        nft.wrap(escId1);
    }

    // ---- Unwrap ----

    function test_unwrap_success() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit Transfer(alice, address(0), tokenId1);
        vm.expectEmit(true, true, false, false);
        emit Unwrapped(escId1, alice);
        nft.unwrap(tokenId1);

        assertEq(nft.balanceOf(alice), 0);
        assertEq(nft.depositors(escId1), address(0));

        vm.expectRevert("Token does not exist");
        nft.ownerOf(tokenId1);
    }

    function test_unwrap_emits_esip2_transfer() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            address(nft),
            alice,
            escId1
        );
        nft.unwrap(tokenId1);
    }

    function test_unwrap_reverts_not_owner() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(bob);
        vm.expectRevert("Not token owner");
        nft.unwrap(tokenId1);
    }

    function test_unwrap_clears_approval() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(alice);
        nft.approve(bob, tokenId1);
        assertEq(nft.getApproved(tokenId1), bob);

        vm.prank(alice);
        nft.unwrap(tokenId1);

        vm.expectRevert("Token does not exist");
        nft.getApproved(tokenId1);
    }

    // ---- Wrap → Transfer → Unwrap (OpenSea sale flow) ----

    function test_wrap_transfer_unwrap() public {
        // Alice wraps
        vm.prank(alice);
        nft.wrap(escId1);

        // Alice sells/transfers NFT to Bob (e.g. OpenSea)
        vm.prank(alice);
        nft.transferFrom(alice, bob, tokenId1);
        assertEq(nft.ownerOf(tokenId1), bob);

        // Bob unwraps — gets the ethscription via ESIP-2
        vm.prank(bob);
        vm.expectEmit(true, true, true, false);
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            address(nft),
            bob,
            escId1
        );
        nft.unwrap(tokenId1);

        assertEq(nft.balanceOf(bob), 0);
        assertEq(nft.depositors(escId1), address(0));
    }

    // ---- Re-wrap cycle ----

    function test_rewrap_after_unwrap() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(alice);
        nft.unwrap(tokenId1);

        // Can wrap again
        vm.prank(bob);
        nft.wrap(escId1);
        assertEq(nft.ownerOf(tokenId1), bob);
        assertEq(nft.depositors(escId1), bob);
    }

    // ---- TokenURI ----

    function test_tokenURI() public {
        vm.prank(alice);
        nft.wrap(escId1);

        string memory uri = nft.tokenURI(tokenId1);
        assertTrue(bytes(uri).length > 0);
        assertTrue(_startsWith(uri, BASE_URI));
    }

    function test_tokenURI_reverts_nonexistent() public {
        vm.expectRevert("Token does not exist");
        nft.tokenURI(tokenId1);
    }

    // ---- Transfers ----

    function test_transferFrom() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(alice);
        nft.transferFrom(alice, bob, tokenId1);

        assertEq(nft.ownerOf(tokenId1), bob);
        assertEq(nft.balanceOf(alice), 0);
        assertEq(nft.balanceOf(bob), 1);
    }

    function test_transferFrom_approved() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(alice);
        nft.approve(bob, tokenId1);

        vm.prank(bob);
        nft.transferFrom(alice, bob, tokenId1);
        assertEq(nft.ownerOf(tokenId1), bob);
    }

    function test_transferFrom_operator() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(alice);
        nft.setApprovalForAll(bob, true);

        vm.prank(bob);
        nft.transferFrom(alice, charlie, tokenId1);
        assertEq(nft.ownerOf(tokenId1), charlie);
    }

    function test_transferFrom_reverts_unauthorized() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(bob);
        vm.expectRevert("Not authorized");
        nft.transferFrom(alice, bob, tokenId1);
    }

    function test_transferFrom_reverts_wrong_from() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(alice);
        vm.expectRevert("Not owner");
        nft.transferFrom(bob, charlie, tokenId1);
    }

    function test_transferFrom_reverts_to_zero() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(alice);
        vm.expectRevert("Zero address");
        nft.transferFrom(alice, address(0), tokenId1);
    }

    function test_transferFrom_clears_approval() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(alice);
        nft.approve(bob, tokenId1);

        vm.prank(alice);
        nft.transferFrom(alice, charlie, tokenId1);

        assertEq(nft.getApproved(tokenId1), address(0));
    }

    // ---- safeTransferFrom ----

    function test_safeTransferFrom_to_eoa() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(alice);
        nft.safeTransferFrom(alice, bob, tokenId1);
        assertEq(nft.ownerOf(tokenId1), bob);
    }

    function test_safeTransferFrom_to_receiver_contract() public {
        ERC721Receiver receiver = new ERC721Receiver();

        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(alice);
        nft.safeTransferFrom(alice, address(receiver), tokenId1);
        assertEq(nft.ownerOf(tokenId1), address(receiver));
    }

    function test_safeTransferFrom_reverts_bad_receiver() public {
        BadReceiver bad = new BadReceiver();

        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(alice);
        vm.expectRevert("Non-ERC721 receiver");
        nft.safeTransferFrom(alice, address(bad), tokenId1);
    }

    // ---- Approval ----

    function test_approve() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(alice);
        vm.expectEmit(true, true, true, false);
        emit Approval(alice, bob, tokenId1);
        nft.approve(bob, tokenId1);

        assertEq(nft.getApproved(tokenId1), bob);
    }

    function test_approve_reverts_unauthorized() public {
        vm.prank(alice);
        nft.wrap(escId1);

        vm.prank(bob);
        vm.expectRevert("Not authorized");
        nft.approve(charlie, tokenId1);
    }

    function test_approve_by_operator() public {
        vm.prank(alice);
        nft.wrap(escId1);

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

    function test_transferAdmin() public {
        nft.transferAdmin(alice);
        assertEq(nft.admin(), alice);
    }

    // ---- Multiple wraps simultaneously ----

    function test_multiple_wraps_partial_unwrap() public {
        bytes32 id1 = keccak256("data:,name1");
        bytes32 id2 = keccak256("data:,name2");
        bytes32 id3 = keccak256("data:,name3");

        vm.startPrank(alice);
        nft.wrap(id1);
        nft.wrap(id2);
        nft.wrap(id3);
        vm.stopPrank();

        assertEq(nft.balanceOf(alice), 3);

        // Unwrap one
        vm.prank(alice);
        nft.unwrap(uint256(id2));
        assertEq(nft.balanceOf(alice), 2);
        assertEq(nft.depositors(id2), address(0));
        // Others still wrapped
        assertEq(nft.depositors(id1), alice);
        assertEq(nft.depositors(id3), alice);
    }

    // ---- Fuzz ----

    function testFuzz_wrap_unwrap_cycle(bytes32 id, address user) public {
        vm.assume(user != address(0));
        vm.assume(user.code.length == 0);

        uint256 tokenId = uint256(id);

        vm.prank(user);
        nft.wrap(id);
        assertEq(nft.ownerOf(tokenId), user);
        assertEq(nft.balanceOf(user), 1);

        vm.prank(user);
        nft.unwrap(tokenId);
        assertEq(nft.balanceOf(user), 0);
    }

    function testFuzz_wrap_transfer(bytes32 id, address from, address to) public {
        vm.assume(from != address(0) && to != address(0));
        vm.assume(from != to);
        vm.assume(from.code.length == 0 && to.code.length == 0);

        uint256 tokenId = uint256(id);

        vm.prank(from);
        nft.wrap(id);

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
