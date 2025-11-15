// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "hardhat/console.sol";

contract Marketplace {
    uint256 private _productCounter;
    address public owner;

    mapping(uint256 => Product) public products;

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

    function deleteProduct(uint256 _id) public {
        Product storage _product = products[_id];

        require(_product.seller != address(0), "Product does not exist");
        require(msg.sender == _product.seller, "You are not the seller");
        require(_product.isSold == false, "Cannot delete a sold product");

        _product.seller = payable(address(0));

        emit ProductDeleted(_id, _product.name, msg.sender);
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