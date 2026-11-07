import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

describe("Marketplace escrow", function () {
  async function createEscrow() {
    const marketplace = await ethers.deployContract("Marketplace");
    const [, seller, buyer] = await ethers.getSigners();
    const price = 1000n;

    await marketplace.connect(seller).listProduct("Item", "Description", price, "");
    const purchase = marketplace.connect(buyer).buyProductWithEscrow(1, { value: price });
    await purchase;

    return { marketplace, seller, buyer, price, purchase };
  }

  it("holds the purchase price and records the purchase when escrow is created", async function () {
    const { marketplace, seller, buyer, price, purchase } = await createEscrow();
    const escrow = await marketplace.getEscrow(1);

    await expect(purchase).to.emit(marketplace, "ProductSold")
      .withArgs(1n, "Item", price, seller.address, buyer.address);
    expect(await ethers.provider.getBalance(await marketplace.getAddress())).to.equal(price);
    expect(escrow.seller).to.equal(seller.address);
    expect(escrow.buyer).to.equal(buyer.address);
    expect(escrow.state).to.equal(1n);
    await expect(marketplace.connect(buyer).buyProductWithEscrow(1, { value: price }))
      .to.be.revertedWith("Product is already sold");
  });

  it("releases held funds to the seller when the buyer confirms", async function () {
    const { marketplace, seller, buyer, price } = await createEscrow();
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

    await marketplace.connect(buyer).releaseEscrow(1);

    expect(await ethers.provider.getBalance(seller.address)).to.equal(sellerBalanceBefore + price);
    expect(await ethers.provider.getBalance(await marketplace.getAddress())).to.equal(0n);
    expect((await marketplace.getEscrow(1)).state).to.equal(2n);
  });

  it("refunds the buyer and returns the product to the seller's active listings", async function () {
    const { marketplace, seller, buyer, price } = await createEscrow();
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);
    const buyerBalanceBefore = await ethers.provider.getBalance(buyer.address);

    const refund = await marketplace.connect(buyer).refundEscrow(1);
    const receipt = await refund.wait();

    await expect(refund)
      .to.emit(marketplace, "EscrowRefunded")
      .withArgs(1n, 1n, buyer.address, price);

    const product = await marketplace.products(1);
    const activeProducts = await marketplace.getAllForSaleProducts();
    expect(await ethers.provider.getBalance(await marketplace.getAddress())).to.equal(0n);
    expect(await ethers.provider.getBalance(seller.address)).to.equal(sellerBalanceBefore);
    expect(await ethers.provider.getBalance(buyer.address))
      .to.equal(buyerBalanceBefore + price - receipt.fee);
    expect(product.buyer).to.equal(ethers.ZeroAddress);
    expect(product.isSold).to.equal(false);
    expect(activeProducts).to.have.length(1);
    expect(activeProducts[0].id).to.equal(1n);
    expect((await marketplace.getEscrow(1)).state).to.equal(3n);
    await expect(marketplace.connect(buyer).refundEscrow(1))
      .to.be.revertedWith("Escrow cannot be refunded in its current state");
  });

  it("allows the seller to purchase the relisted product again after a refund", async function () {
    const { marketplace, seller, buyer, price } = await createEscrow();
    const [, , , nextBuyer] = await ethers.getSigners();

    await marketplace.connect(buyer).refundEscrow(1);
    await marketplace.connect(nextBuyer).buyProductWithEscrow(1, { value: price });

    const product = await marketplace.products(1);
    const escrow = await marketplace.getEscrow(1);
    expect(product.isSold).to.equal(true);
    expect(product.buyer).to.equal(nextBuyer.address);
    expect(escrow.seller).to.equal(seller.address);
    expect(escrow.buyer).to.equal(nextBuyer.address);
    expect(escrow.id).to.equal(2n);
  });

  it("does not allow release after a dispute, but still allows a buyer refund", async function () {
    const { marketplace, buyer, seller, price } = await createEscrow();

    await marketplace.connect(seller).disputeEscrow(1);
    await expect(marketplace.connect(buyer).releaseEscrow(1))
      .to.be.revertedWith("Escrow is not in a releasable state");
    await marketplace.connect(buyer).refundEscrow(1);

    expect(await ethers.provider.getBalance(await marketplace.getAddress())).to.equal(0n);
    expect((await marketplace.getEscrow(1)).state).to.equal(3n);
  });
});
