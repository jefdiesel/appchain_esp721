// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EthscriptionMarketplace
 * @notice Trustless marketplace for ethscriptions using ESIP-2 escrow
 * @dev Implements conditional transfers via ethscriptions_protocol_TransferEthscriptionForPreviousOwner
 */
contract EthscriptionMarketplace {

    // ESIP-2 transfer event - enables trustless escrow
    event ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
        address indexed previousOwner,
        address indexed recipient,
        bytes32 indexed ethscriptionId
    );

    // Marketplace events
    event Listed(bytes32 indexed ethscriptionId, address indexed seller, uint256 price);
    event Unlisted(bytes32 indexed ethscriptionId, address indexed seller);
    event Sold(bytes32 indexed ethscriptionId, address indexed seller, address indexed buyer, uint256 price);
    event OfferMade(bytes32 indexed ethscriptionId, address indexed buyer, uint256 amount);
    event OfferAccepted(bytes32 indexed ethscriptionId, address indexed seller, address indexed buyer, uint256 amount);

    struct Listing {
        address seller;
        uint256 price;
        uint64 listedAt;
        bool active;
    }

    struct Offer {
        address buyer;
        uint256 amount;
        uint64 expiresAt;
    }

    // ethscriptionId => Listing
    mapping(bytes32 => Listing) public listings;

    // ethscriptionId => depositor (tracks who deposited each ethscription)
    mapping(bytes32 => address) public depositors;

    // ethscriptionId => Offer[]
    mapping(bytes32 => Offer[]) public offers;

    // Minimum time before deposit can be withdrawn (prevents frontrunning)
    uint256 public constant DEPOSIT_COOLDOWN = 5;  // 5 blocks

    // Platform fee (2.5% = 250 basis points)
    uint256 public constant FEE_BPS = 250;
    uint256 public constant BPS_DENOMINATOR = 10000;

    address public owner;
    address public feeRecipient;

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
        feeRecipient = msg.sender;
    }

    /**
     * @notice Deposit an ethscription to the marketplace
     * @dev User sends ethscription to this contract, then calls this to register
     * @param ethscriptionId The SHA256 hash of the ethscription content
     */
    function deposit(bytes32 ethscriptionId) external {
        require(depositors[ethscriptionId] == address(0), "Already deposited");
        depositors[ethscriptionId] = msg.sender;
    }

    /**
     * @notice List a deposited ethscription for sale
     * @param ethscriptionId The ethscription to list
     * @param price Price in wei
     */
    function list(bytes32 ethscriptionId, uint256 price) external {
        require(depositors[ethscriptionId] == msg.sender, "Not depositor");
        require(price > 0, "Price must be > 0");
        require(!listings[ethscriptionId].active, "Already listed");

        listings[ethscriptionId] = Listing({
            seller: msg.sender,
            price: price,
            listedAt: uint64(block.number),
            active: true
        });

        emit Listed(ethscriptionId, msg.sender, price);
    }

    /**
     * @notice Deposit and list in one transaction
     * @param ethscriptionId The ethscription to list
     * @param price Price in wei
     */
    function depositAndList(bytes32 ethscriptionId, uint256 price) external {
        require(depositors[ethscriptionId] == address(0), "Already deposited");
        require(price > 0, "Price must be > 0");

        depositors[ethscriptionId] = msg.sender;
        listings[ethscriptionId] = Listing({
            seller: msg.sender,
            price: price,
            listedAt: uint64(block.number),
            active: true
        });

        emit Listed(ethscriptionId, msg.sender, price);
    }

    /**
     * @notice Buy a listed ethscription at the listed price
     * @param ethscriptionId The ethscription to buy
     */
    function buy(bytes32 ethscriptionId) external payable {
        Listing storage listing = listings[ethscriptionId];
        require(listing.active, "Not listed");
        require(msg.value == listing.price, "Wrong price");
        require(block.number >= listing.listedAt + DEPOSIT_COOLDOWN, "Cooldown not passed");

        address seller = listing.seller;
        uint256 price = listing.price;

        // Clear listing and deposit
        listing.active = false;
        delete depositors[ethscriptionId];

        // Calculate fee
        uint256 fee = (price * FEE_BPS) / BPS_DENOMINATOR;
        uint256 sellerProceeds = price - fee;

        // Transfer ethscription to buyer via ESIP-2
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            seller,
            msg.sender,
            ethscriptionId
        );

        // Pay seller
        (bool success, ) = payable(seller).call{value: sellerProceeds}("");
        require(success, "Payment failed");

        // Pay fee
        if (fee > 0) {
            (bool feeSuccess, ) = payable(feeRecipient).call{value: fee}("");
            require(feeSuccess, "Fee payment failed");
        }

        emit Sold(ethscriptionId, seller, msg.sender, price);
    }

    /**
     * @notice Cancel listing and withdraw ethscription
     * @param ethscriptionId The ethscription to withdraw
     */
    function cancelAndWithdraw(bytes32 ethscriptionId) external {
        require(depositors[ethscriptionId] == msg.sender, "Not depositor");

        Listing storage listing = listings[ethscriptionId];
        require(block.number >= listing.listedAt + DEPOSIT_COOLDOWN, "Cooldown not passed");

        // Clear listing and deposit
        if (listing.active) {
            listing.active = false;
            emit Unlisted(ethscriptionId, msg.sender);
        }
        delete depositors[ethscriptionId];

        // Transfer back to depositor via ESIP-2
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            msg.sender,
            msg.sender,
            ethscriptionId
        );
    }

    /**
     * @notice Make an offer on any ethscription (doesn't need to be listed)
     * @param ethscriptionId The ethscription to make offer on
     * @param expiresIn Number of blocks until offer expires
     */
    function makeOffer(bytes32 ethscriptionId, uint64 expiresIn) external payable {
        require(msg.value > 0, "Offer must be > 0");
        require(expiresIn > 0 && expiresIn <= 50400, "Invalid expiry"); // max ~1 week

        offers[ethscriptionId].push(Offer({
            buyer: msg.sender,
            amount: msg.value,
            expiresAt: uint64(block.number) + expiresIn
        }));

        emit OfferMade(ethscriptionId, msg.sender, msg.value);
    }

    /**
     * @notice Accept an offer (must have deposited the ethscription)
     * @param ethscriptionId The ethscription
     * @param offerIndex Index of the offer to accept
     */
    function acceptOffer(bytes32 ethscriptionId, uint256 offerIndex) external {
        require(depositors[ethscriptionId] == msg.sender, "Not depositor");

        Offer[] storage ethOffers = offers[ethscriptionId];
        require(offerIndex < ethOffers.length, "Invalid offer");

        Offer storage offer = ethOffers[offerIndex];
        require(offer.expiresAt > block.number, "Offer expired");
        require(offer.amount > 0, "Offer already accepted");

        address buyer = offer.buyer;
        uint256 amount = offer.amount;

        // Clear offer
        offer.amount = 0;

        // Clear listing if active
        Listing storage listing = listings[ethscriptionId];
        if (listing.active) {
            listing.active = false;
        }
        delete depositors[ethscriptionId];

        // Calculate fee
        uint256 fee = (amount * FEE_BPS) / BPS_DENOMINATOR;
        uint256 sellerProceeds = amount - fee;

        // Transfer ethscription to buyer via ESIP-2
        emit ethscriptions_protocol_TransferEthscriptionForPreviousOwner(
            msg.sender,
            buyer,
            ethscriptionId
        );

        // Pay seller
        (bool success, ) = payable(msg.sender).call{value: sellerProceeds}("");
        require(success, "Payment failed");

        // Pay fee
        if (fee > 0) {
            (bool feeSuccess, ) = payable(feeRecipient).call{value: fee}("");
            require(feeSuccess, "Fee payment failed");
        }

        emit OfferAccepted(ethscriptionId, msg.sender, buyer, amount);
    }

    /**
     * @notice Cancel an offer and get refund
     * @param ethscriptionId The ethscription
     * @param offerIndex Index of your offer
     */
    function cancelOffer(bytes32 ethscriptionId, uint256 offerIndex) external {
        Offer[] storage ethOffers = offers[ethscriptionId];
        require(offerIndex < ethOffers.length, "Invalid offer");

        Offer storage offer = ethOffers[offerIndex];
        require(offer.buyer == msg.sender, "Not your offer");
        require(offer.amount > 0, "Already cancelled");

        uint256 refund = offer.amount;
        offer.amount = 0;

        (bool success, ) = payable(msg.sender).call{value: refund}("");
        require(success, "Refund failed");
    }

    /**
     * @notice Update listing price
     * @param ethscriptionId The ethscription
     * @param newPrice New price in wei
     */
    function updatePrice(bytes32 ethscriptionId, uint256 newPrice) external {
        require(depositors[ethscriptionId] == msg.sender, "Not depositor");
        require(listings[ethscriptionId].active, "Not listed");
        require(newPrice > 0, "Price must be > 0");

        listings[ethscriptionId].price = newPrice;
        emit Listed(ethscriptionId, msg.sender, newPrice);
    }

    /**
     * @notice Get all active offers for an ethscription
     * @param ethscriptionId The ethscription
     * @return Active offers array
     */
    function getOffers(bytes32 ethscriptionId) external view returns (Offer[] memory) {
        return offers[ethscriptionId];
    }

    /**
     * @notice Check if an ethscription is listed
     * @param ethscriptionId The ethscription
     * @return active Whether the listing is active
     * @return seller The seller address
     * @return price The listing price
     */
    function getListing(bytes32 ethscriptionId) external view returns (bool active, address seller, uint256 price) {
        Listing storage listing = listings[ethscriptionId];
        return (listing.active, listing.seller, listing.price);
    }

    // Admin functions
    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        feeRecipient = _feeRecipient;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }

    // Receive ETH for offers
    receive() external payable {}
}
