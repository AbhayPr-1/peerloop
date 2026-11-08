// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

contract Marketplace {
    uint256 public constant MAX_PAGE_SIZE = 100;
    uint256 public constant MAX_NAME_BYTES = 100;
    uint256 public constant MAX_DESCRIPTION_BYTES = 2000;
    uint256 public constant MAX_IMAGE_URL_BYTES = 4096;
    uint256 private _productCounter;
    uint256 private _escrowCounter;
    bool private _withdrawalInProgress;

    mapping(uint256 => Product) public products;
    mapping(uint256 => Escrow) public escrows;
    mapping(uint256 => Escrow) public escrowHistory;
    mapping(uint256 => uint8) public disputeResolutionVotes;
    mapping(address => uint256) public pendingWithdrawals;

    enum EscrowState {
        None,
        Created,
        Released,
        Refunded,
        Disputed
    }

    struct Product {
        uint256 id;
        string name;
        string description;
        uint256 price; // Price in WEI
        string imageUrl;
        address payable seller;
        address payable buyer;
        bool isSold;
    }

    struct Escrow {
        uint256 id;
        uint256 productId;
        address payable seller;
        address payable buyer;
        uint256 amount;
        uint256 createdAt;
        EscrowState state;
    }

    event ProductListed(
        uint256 id,
        string name,
        uint256 price,
        string imageUrl,
        address seller
    );
    event ProductSold(
        uint256 id,
        string name,
        uint256 price,
        address seller,
        address buyer
    );
    event ProductDeleted(
        uint256 id,
        string name,
        address seller
    );
    event EscrowCreated(
        uint256 escrowId,
        uint256 productId,
        address seller,
        address buyer,
        uint256 amount
    );
    event EscrowReleased(
        uint256 escrowId,
        uint256 productId,
        address seller,
        uint256 amount
    );
    event EscrowRefunded(
        uint256 escrowId,
        uint256 productId,
        address buyer,
        uint256 amount
    );
    event EscrowDisputed(
        uint256 escrowId,
        uint256 productId,
        address initiator
    );
    event EscrowResolutionVoted(
        uint256 escrowId,
        uint256 productId,
        address voter,
        bool releaseToSeller,
        uint8 votes
    );
    event PaymentWithdrawn(address indexed payee, uint256 amount);

    function listProduct(
        string memory _name,
        string memory _description,
        uint256 _priceInWei,
        string memory _imageUrl
    ) public {
        require(bytes(_name).length > 0 && bytes(_name).length <= MAX_NAME_BYTES, "Invalid name length");
        require(
            bytes(_description).length > 0 && bytes(_description).length <= MAX_DESCRIPTION_BYTES,
            "Invalid description length"
        );
        require(
            bytes(_imageUrl).length > 0 && bytes(_imageUrl).length <= MAX_IMAGE_URL_BYTES,
            "Invalid image metadata length"
        );
        require(_priceInWei > 0, "Price must be greater than 0");

        _productCounter++;
        uint256 _id = _productCounter;

        products[_id] = Product(
            _id,
            _name,
            _description,
            _priceInWei,
            _imageUrl,
            payable(msg.sender),
            payable(address(0)),
            false
        );

        emit ProductListed(_id, _name, _priceInWei, _imageUrl, msg.sender);
    }

    function buyProductWithEscrow(uint256 _id) public payable {
        Product storage _product = products[_id];

        require(_product.seller != address(0), "Product does not exist");
        require(_product.isSold == false, "Product is already sold");
        require(msg.sender != _product.seller, "You cannot buy your own product");
        require(msg.value == _product.price, "Please provide the exact price");

        _product.buyer = payable(msg.sender);
        _product.isSold = true;

        _escrowCounter++;
        uint256 _escrowId = _escrowCounter;

        Escrow memory newEscrow = Escrow({
            id: _escrowId,
            productId: _id,
            seller: _product.seller,
            buyer: payable(msg.sender),
            amount: msg.value,
            createdAt: block.timestamp,
            state: EscrowState.Created
        });
        escrows[_id] = newEscrow;
        escrowHistory[_escrowId] = newEscrow;

        emit EscrowCreated(_escrowId, _id, _product.seller, msg.sender, msg.value);
        emit ProductSold(_id, _product.name, _product.price, _product.seller, _product.buyer);
    }

    function releaseEscrow(uint256 _id) public {
        Escrow storage _escrow = escrows[_id];

        require(_escrow.id != 0, "No escrow exists for this product");
        require(_escrow.state == EscrowState.Created, "Escrow is not in a releasable state");
        require(msg.sender == _escrow.buyer, "Only buyer can release escrow funds");

        _releaseEscrow(_id, _escrow);
    }

    function refundEscrow(uint256 _id) public {
        Escrow storage _escrow = escrows[_id];

        require(_escrow.id != 0, "No escrow exists for this product");
        require(_escrow.state == EscrowState.Created, "Escrow cannot be refunded in its current state");
        require(msg.sender == _escrow.buyer, "Only buyer can refund escrow");

        _refundEscrow(_id, _escrow);
    }

    function disputeEscrow(uint256 _id) public {
        Escrow storage _escrow = escrows[_id];

        require(_escrow.id != 0, "No escrow exists for this product");
        require(_escrow.state == EscrowState.Created, "Escrow is not currently active");
        require(msg.sender == _escrow.buyer, "Only buyer can dispute escrow");
        _escrow.state = EscrowState.Disputed;
        escrowHistory[_escrow.id] = _escrow;
        emit EscrowDisputed(_escrow.id, _id, msg.sender);
    }

    function voteDisputeResolution(uint256 _id, bool releaseToSeller) public {
        Escrow storage _escrow = escrows[_id];
        require(_escrow.id != 0, "No escrow exists for this product");
        require(_escrow.state == EscrowState.Disputed, "Escrow is not disputed");
        require(
            msg.sender == _escrow.buyer || msg.sender == _escrow.seller,
            "Only buyer or seller can vote"
        );

        uint8 votes = disputeResolutionVotes[_escrow.id];
        uint8 buyerVote = releaseToSeller ? 2 : 1;
        uint8 sellerVote = releaseToSeller ? 8 : 4;
        if (msg.sender == _escrow.buyer) {
            votes = (votes & 12) | buyerVote;
        } else {
            votes = (votes & 3) | sellerVote;
        }
        disputeResolutionVotes[_escrow.id] = votes;
        emit EscrowResolutionVoted(_escrow.id, _id, msg.sender, releaseToSeller, votes);

        bool buyerAgrees = releaseToSeller ? (votes & 2) != 0 : (votes & 1) != 0;
        bool sellerAgrees = releaseToSeller ? (votes & 8) != 0 : (votes & 4) != 0;
        if (!buyerAgrees || !sellerAgrees) return;

        if (releaseToSeller) {
            _releaseEscrow(_id, _escrow);
        } else {
            _refundEscrow(_id, _escrow);
        }
    }

    function withdrawPayments() external {
        require(!_withdrawalInProgress, "Withdrawal already in progress");
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No payment available to withdraw");

        pendingWithdrawals[msg.sender] = 0;
        _withdrawalInProgress = true;
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        _withdrawalInProgress = false;
        require(success, "Payment withdrawal failed");

        emit PaymentWithdrawn(msg.sender, amount);
    }

    function _releaseEscrow(uint256 _productId, Escrow storage _escrow) private {
        _escrow.state = EscrowState.Released;
        escrowHistory[_escrow.id].state = EscrowState.Released;
        pendingWithdrawals[_escrow.seller] += _escrow.amount;
        emit EscrowReleased(_escrow.id, _productId, _escrow.seller, _escrow.amount);
    }

    function _refundEscrow(uint256 _productId, Escrow storage _escrow) private {
        _escrow.state = EscrowState.Refunded;
        escrowHistory[_escrow.id].state = EscrowState.Refunded;
        pendingWithdrawals[_escrow.buyer] += _escrow.amount;

        Product storage _product = products[_productId];
        _product.buyer = payable(address(0));
        _product.isSold = false;

        emit EscrowRefunded(_escrow.id, _productId, _escrow.buyer, _escrow.amount);
    }

    function deleteProduct(uint256 _id) public {
        Product storage _product = products[_id];

        require(_product.seller != address(0), "Product does not exist");
        require(msg.sender == _product.seller, "You are not the seller");
        require(_product.isSold == false, "Cannot delete a sold product");

        _product.seller = payable(address(0));

        emit ProductDeleted(_id, _product.name, msg.sender);
    }

    function getEscrow(uint256 _id)
        public
        view
        returns (
            uint256 id,
            uint256 productId,
            address seller,
            address buyer,
            uint256 amount,
            uint256 createdAt,
            EscrowState state
        )
    {
        Escrow storage _escrow = escrows[_id];
        return (
            _escrow.id,
            _escrow.productId,
            _escrow.seller,
            _escrow.buyer,
            _escrow.amount,
            _escrow.createdAt,
            _escrow.state
        );
    }

    function getAllForSaleProducts() public view returns (Product[] memory) {
        uint256 unsoldCount = 0;
        for (uint256 i = 1; i <= _productCounter; i++) {
            if (products[i].isSold == false && products[i].seller != address(0)) {
                unsoldCount++;
            }
        }

        Product[] memory forSale = new Product[](unsoldCount);
        uint256 index = 0;
        for (uint256 i = 1; i <= _productCounter; i++) {
            if (products[i].isSold == false && products[i].seller != address(0)) {
                forSale[index] = products[i];
                index++;
            }
        }
        return forSale;
    }

    function getForSaleProductsPage(uint256 cursor, uint256 scanLimit)
        public
        view
        returns (Product[] memory productsPage, uint256 nextCursor)
    {
        require(scanLimit > 0 && scanLimit <= MAX_PAGE_SIZE, "Invalid page size");

        uint256 startId = cursor == 0 ? 1 : cursor;
        if (startId > _productCounter) {
            return (new Product[](0), 0);
        }

        uint256 remaining = _productCounter - startId + 1;
        uint256 endId = scanLimit >= remaining
            ? _productCounter
            : startId + scanLimit - 1;
        productsPage = new Product[](scanLimit);
        uint256 activeCount = 0;

        for (uint256 i = startId; i <= endId; i++) {
            if (!products[i].isSold && products[i].seller != address(0)) {
                productsPage[activeCount] = products[i];
                activeCount++;
            }
        }

        assembly {
            mstore(productsPage, activeCount)
        }
        nextCursor = endId < _productCounter ? endId + 1 : 0;
    }
}
