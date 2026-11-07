// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "hardhat/console.sol";

contract Marketplace {
    uint256 private _productCounter;
    uint256 private _escrowCounter;
    address public owner;

    mapping(uint256 => Product) public products;
    mapping(uint256 => Escrow) public escrows;

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

    constructor() {
        owner = msg.sender;
    }

    function listProduct(
        string memory _name,
        string memory _description,
        uint256 _priceInWei,
        string memory _imageUrl
    ) public {
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

    function buyProduct(uint256 _id) public payable {
        Product storage _product = products[_id];

        require(_product.seller != address(0), "Product does not exist");
        require(_product.isSold == false, "Product is already sold");
        require(msg.sender != _product.seller, "You cannot buy your own product");
        require(msg.value == _product.price, "Please provide the exact price");

        _product.buyer = payable(msg.sender);
        _product.isSold = true;

        (bool success, ) = _product.seller.call{value: msg.value}("");
        require(success, "Payment transfer failed");

        emit ProductSold(_id, _product.name, _product.price, _product.seller, _product.buyer);
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

        escrows[_id] = Escrow({
            id: _escrowId,
            productId: _id,
            seller: _product.seller,
            buyer: payable(msg.sender),
            amount: msg.value,
            createdAt: block.timestamp,
            state: EscrowState.Created
        });

        emit EscrowCreated(_escrowId, _id, _product.seller, msg.sender, msg.value);
        emit ProductSold(_id, _product.name, _product.price, _product.seller, _product.buyer);
    }

    function releaseEscrow(uint256 _id) public {
        Escrow storage _escrow = escrows[_id];

        require(_escrow.id != 0, "No escrow exists for this product");
        require(_escrow.state == EscrowState.Created, "Escrow is not in a releasable state");
        require(msg.sender == _escrow.buyer, "Only buyer can release escrow funds");

        _escrow.state = EscrowState.Released;
        (bool success, ) = _escrow.seller.call{value: _escrow.amount}("");
        require(success, "Escrow payout failed");

        emit EscrowReleased(_escrow.id, _id, _escrow.seller, _escrow.amount);
    }

    function refundEscrow(uint256 _id) public {
        Escrow storage _escrow = escrows[_id];

        require(_escrow.id != 0, "No escrow exists for this product");
        require(
            _escrow.state == EscrowState.Created || _escrow.state == EscrowState.Disputed,
            "Escrow cannot be refunded in its current state"
        );
        require(
            msg.sender == _escrow.buyer || msg.sender == _escrow.seller || msg.sender == owner,
            "Only the parties involved may refund escrow"
        );

        _escrow.state = EscrowState.Refunded;
        (bool success, ) = _escrow.buyer.call{value: _escrow.amount}("");
        require(success, "Escrow refund failed");

        Product storage _product = products[_id];
        _product.buyer = payable(address(0));
        _product.isSold = false;

        emit EscrowRefunded(_escrow.id, _id, _escrow.buyer, _escrow.amount);
    }

    function disputeEscrow(uint256 _id) public {
        Escrow storage _escrow = escrows[_id];

        require(_escrow.id != 0, "No escrow exists for this product");
        require(_escrow.state == EscrowState.Created, "Escrow is not currently active");
        require(msg.sender == _escrow.buyer || msg.sender == _escrow.seller, "Unauthorized dispute");

        _escrow.state = EscrowState.Disputed;
        emit EscrowDisputed(_escrow.id, _id, msg.sender);
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
}