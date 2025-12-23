// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Names Registry - Permanent on-chain name → manifest mapping
/// @notice No expiry. First come, forever served.
contract Names {
    // Events
    event Claimed(string indexed nameHash, string name, address owner);
    event ManifestUpdated(string indexed nameHash, string name, bytes32 txHash);
    event Transferred(string indexed nameHash, string name, address from, address to);

    // Errors
    error AlreadyClaimed();
    error NotOwner();
    error InvalidName();

    // Storage
    mapping(bytes32 => address) public owners;      // keccak(name) → owner
    mapping(bytes32 => bytes32) public manifests;   // keccak(name) → manifest txHash
    mapping(bytes32 => string) public names;        // keccak(name) → name (for reverse lookup)

    /// @notice Claim a name. First come, first served, forever.
    function claim(string calldata name) external {
        if (bytes(name).length == 0 || bytes(name).length > 32) revert InvalidName();

        bytes32 node = keccak256(bytes(name));
        if (owners[node] != address(0)) revert AlreadyClaimed();

        owners[node] = msg.sender;
        names[node] = name;

        emit Claimed(name, name, msg.sender);
    }

    /// @notice Claim and set manifest in one transaction
    function claimAndSetManifest(string calldata name, bytes32 manifestTx) external {
        if (bytes(name).length == 0 || bytes(name).length > 32) revert InvalidName();

        bytes32 node = keccak256(bytes(name));
        if (owners[node] != address(0)) revert AlreadyClaimed();

        owners[node] = msg.sender;
        names[node] = name;
        manifests[node] = manifestTx;

        emit Claimed(name, name, msg.sender);
        emit ManifestUpdated(name, name, manifestTx);
    }

    /// @notice Update manifest txHash (only owner)
    function setManifest(string calldata name, bytes32 manifestTx) external {
        bytes32 node = keccak256(bytes(name));
        if (owners[node] != msg.sender) revert NotOwner();

        manifests[node] = manifestTx;

        emit ManifestUpdated(name, name, manifestTx);
    }

    /// @notice Transfer ownership (only owner)
    function transfer(string calldata name, address to) external {
        bytes32 node = keccak256(bytes(name));
        if (owners[node] != msg.sender) revert NotOwner();

        owners[node] = to;

        emit Transferred(name, name, msg.sender, to);
    }

    // ============ View Functions ============

    /// @notice Get owner of a name
    function ownerOf(string calldata name) external view returns (address) {
        return owners[keccak256(bytes(name))];
    }

    /// @notice Get manifest txHash for a name
    function manifestOf(string calldata name) external view returns (bytes32) {
        return manifests[keccak256(bytes(name))];
    }

    /// @notice Check if a name is available
    function available(string calldata name) external view returns (bool) {
        return owners[keccak256(bytes(name))] == address(0);
    }

    /// @notice Get full record for a name
    function resolve(string calldata name) external view returns (
        address owner,
        bytes32 manifest,
        bool exists
    ) {
        bytes32 node = keccak256(bytes(name));
        owner = owners[node];
        manifest = manifests[node];
        exists = owner != address(0);
    }
}
