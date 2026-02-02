// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title WrappedEthscription
 * @notice ERC-721 that wraps ethscriptions for OpenSea compatibility.
 *         Deployed on Ethereum mainnet (where ethscriptions live as calldata).
 *
 * Flow:
 *   1. User transfers ethscription to this contract via ESIP-2
 *   2. User calls wrap(ethscriptionId) → gets ERC-721 minted
 *   3. NFT is tradeable on OpenSea
 *   4. Owner calls unwrap(tokenId) → burns NFT, ESIP-2 transfers ethscription back
 *
 * tokenId = uint256(ethscriptionId) for 1:1 mapping
 */
contract WrappedEthscription {

    // --- ERC-721 events ---
    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    // --- ESIP-2: trustless ethscription transfer ---
    event ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
        address indexed previousOwner,
        address indexed recipient,
        bytes32 indexed ethscriptionId
    );

    // --- Wrap/unwrap events ---
    event Wrapped(bytes32 indexed ethscriptionId, address indexed owner);
    event Unwrapped(bytes32 indexed ethscriptionId, address indexed owner);

    string public name = "Wrapped Ethscription";
    string public symbol = "wESC";

    string public baseURI;
    address public admin;

    // ethscriptionId => depositor (who sent it to this contract)
    mapping(bytes32 => address) public depositors;

    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    constructor(string memory _baseURI) {
        admin = msg.sender;
        baseURI = _baseURI;
    }

    // --- ERC-165 ---
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == 0x80ac58cd  // ERC-721
            || interfaceId == 0x5b5e139f  // ERC-721 Metadata
            || interfaceId == 0x01ffc9a7; // ERC-165
    }

    // --- ERC-721 core ---
    function balanceOf(address owner) public view returns (uint256) {
        require(owner != address(0), "Zero address");
        return _balances[owner];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "Token does not exist");
        return owner;
    }

    function approve(address to, uint256 tokenId) public {
        address owner = ownerOf(tokenId);
        require(msg.sender == owner || _operatorApprovals[owner][msg.sender], "Not authorized");
        _tokenApprovals[tokenId] = to;
        emit Approval(owner, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public {
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner, address operator) public view returns (bool) {
        return _operatorApprovals[owner][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public {
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Not authorized");
        _transfer(from, to, tokenId);
        require(_checkOnERC721Received(from, to, tokenId, data), "Non-ERC721 receiver");
    }

    // --- ERC-721 Metadata ---
    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(_owners[tokenId] != address(0), "Token does not exist");
        return string(abi.encodePacked(baseURI, _toHexString(bytes32(tokenId))));
    }

    // --- Wrap & Unwrap ---

    /**
     * @notice Wrap an ethscription as an ERC-721 NFT.
     * @dev User must first transfer the ethscription to this contract via ESIP-2
     *      (send a mainnet tx to this contract with the ethscriptionId as calldata).
     *      Then call wrap() to register and mint.
     * @param ethscriptionId The SHA256 hash of the ethscription content
     */
    function wrap(bytes32 ethscriptionId) external {
        require(depositors[ethscriptionId] == address(0), "Already wrapped");

        uint256 tokenId = uint256(ethscriptionId);
        require(_owners[tokenId] == address(0), "Already minted");

        depositors[ethscriptionId] = msg.sender;
        _balances[msg.sender] += 1;
        _owners[tokenId] = msg.sender;

        emit Transfer(address(0), msg.sender, tokenId);
        emit Wrapped(ethscriptionId, msg.sender);
    }

    /**
     * @notice Unwrap: burn the NFT and get the ethscription back via ESIP-2.
     * @param tokenId The token to burn (= uint256 of ethscriptionId)
     */
    function unwrap(uint256 tokenId) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        bytes32 ethscriptionId = bytes32(tokenId);

        // Clear NFT state
        delete _tokenApprovals[tokenId];
        _balances[msg.sender] -= 1;
        delete _owners[tokenId];
        delete depositors[ethscriptionId];

        emit Transfer(msg.sender, address(0), tokenId);
        emit Unwrapped(ethscriptionId, msg.sender);

        // ESIP-2: return ethscription to the burner
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            address(this),
            msg.sender,
            ethscriptionId
        );
    }

    // --- Admin ---
    function setBaseURI(string memory _baseURI) external onlyAdmin {
        baseURI = _baseURI;
    }

    function transferAdmin(address _admin) external onlyAdmin {
        admin = _admin;
    }

    // --- Internal ---
    function _transfer(address from, address to, uint256 tokenId) internal {
        require(ownerOf(tokenId) == from, "Not owner");
        require(to != address(0), "Zero address");
        delete _tokenApprovals[tokenId];
        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;
        emit Transfer(from, to, tokenId);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        address owner = ownerOf(tokenId);
        return spender == owner || _tokenApprovals[tokenId] == spender || _operatorApprovals[owner][spender];
    }

    function _checkOnERC721Received(address from, address to, uint256 tokenId, bytes memory data) internal returns (bool) {
        if (to.code.length == 0) return true;
        (bool success, bytes memory result) = to.call(
            abi.encodeWithSelector(0x150b7a02, msg.sender, from, tokenId, data)
        );
        return success && abi.decode(result, (bytes4)) == 0x150b7a02;
    }

    function _toHexString(bytes32 value) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(66); // 0x + 64 chars
        str[0] = "0";
        str[1] = "x";
        for (uint256 i = 0; i < 32; i++) {
            str[2 + i * 2] = alphabet[uint8(value[i] >> 4)];
            str[3 + i * 2] = alphabet[uint8(value[i] & 0x0f)];
        }
        return string(str);
    }
}
