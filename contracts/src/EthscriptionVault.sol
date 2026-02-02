// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EthscriptionVault
 * @notice Holds ethscriptions deposited for ERC-721 wrapping on Base
 * @dev Uses ESIP-2 for trustless ethscription transfers
 */
contract EthscriptionVault {

    // ESIP-2 transfer event
    event ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
        address indexed previousOwner,
        address indexed recipient,
        bytes32 indexed ethscriptionId
    );

    event Deposited(bytes32 indexed ethscriptionId, address indexed owner);
    event Withdrawn(bytes32 indexed ethscriptionId, address indexed to);

    // Ethscriptions contract on AppChain
    address public constant ETHSCRIPTIONS = 0x3300000000000000000000000000000000000001;

    address public admin;
    address public relayer;

    // ethscriptionId => depositor
    mapping(bytes32 => address) public depositors;

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    modifier onlyRelayer() {
        require(msg.sender == relayer, "Not relayer");
        _;
    }

    constructor(address _relayer) {
        admin = msg.sender;
        relayer = _relayer;
    }

    /**
     * @notice Deposit an ethscription into the vault for wrapping
     * @dev User must first transfer the ethscription to this contract via ESIP-2,
     *      then call deposit() to register ownership
     * @param ethscriptionId The SHA256 hash of the ethscription content
     */
    function deposit(bytes32 ethscriptionId) external {
        require(depositors[ethscriptionId] == address(0), "Already deposited");
        depositors[ethscriptionId] = msg.sender;
        emit Deposited(ethscriptionId, msg.sender);
    }

    /**
     * @notice Withdraw an ethscription back to its owner (called by relayer after NFT burn)
     * @param ethscriptionId The ethscription to return
     * @param to The address to return it to
     */
    function withdraw(bytes32 ethscriptionId, address to) external onlyRelayer {
        require(depositors[ethscriptionId] != address(0), "Not deposited");
        delete depositors[ethscriptionId];

        // ESIP-2: transfer ethscription back to owner
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            address(this),
            to,
            ethscriptionId
        );

        emit Withdrawn(ethscriptionId, to);
    }

    function setRelayer(address _relayer) external onlyAdmin {
        relayer = _relayer;
    }

    function transferAdmin(address _admin) external onlyAdmin {
        admin = _admin;
    }
}
