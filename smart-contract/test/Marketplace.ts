import { expect } from "chai";
import { network } from "hardhat";

const { ethers } = await network.create();

async function deployMarketplace() {
  return ethers.deployContract("Marketplace");
}

async function createEscrow() {
  const [seller, buyer, other] = await ethers.getSigners();
  const marketplace = await deployMarketplace();
  const price = 1000n;

  await marketplace.connect(seller).listProduct("Item", "Description", price, "ipfs://test");
  const purchase = marketplace.connect(buyer).buyProductWithEscrow(1, { value: price });
  await purchase;

  return { marketplace, seller, buyer, other, price, purchase };
}

describe("Marketplace escrow", function () {
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

  it("releases to a claimable seller balance only after buyer confirmation and supports withdrawal", async function () {
    const { marketplace, seller, buyer, price } = await createEscrow();
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

    await marketplace.connect(buyer).releaseEscrow(1);

    expect(await marketplace.pendingWithdrawals(seller.address)).to.equal(price);
    expect(await ethers.provider.getBalance(await marketplace.getAddress())).to.equal(price);
    expect((await marketplace.getEscrow(1)).state).to.equal(2n);

    const withdrawal = await marketplace.connect(seller).withdrawPayments();
    await expect(withdrawal).to.emit(marketplace, "PaymentWithdrawn").withArgs(seller.address, price);
    const receipt = await withdrawal.wait();
    expect(await ethers.provider.getBalance(seller.address)).to.equal(sellerBalanceBefore + price - receipt.fee);
    expect(await marketplace.pendingWithdrawals(seller.address)).to.equal(0n);
    expect(await ethers.provider.getBalance(await marketplace.getAddress())).to.equal(0n);
  });

  it("allows only the buyer to refund active escrow and returns the listing", async function () {
    const { marketplace, seller, buyer, price } = await createEscrow();
    const [owner] = await ethers.getSigners();

    await expect(marketplace.connect(seller).refundEscrow(1))
      .to.be.revertedWith("Only buyer can refund escrow");
    await expect(marketplace.connect(owner).refundEscrow(1))
      .to.be.revertedWith("Only buyer can refund escrow");

    await marketplace.connect(buyer).refundEscrow(1);

    const product = await marketplace.products(1);
    const activeProducts = await marketplace.getAllForSaleProducts();
    expect(await marketplace.pendingWithdrawals(buyer.address)).to.equal(price);
    expect(await ethers.provider.getBalance(await marketplace.getAddress())).to.equal(price);
    expect(product.buyer).to.equal(ethers.ZeroAddress);
    expect(product.isSold).to.equal(false);
    expect(activeProducts).to.have.length(1);
    expect(activeProducts[0].id).to.equal(1n);
    expect((await marketplace.getEscrow(1)).state).to.equal(3n);
    await expect(marketplace.connect(buyer).refundEscrow(1))
      .to.be.revertedWith("Escrow cannot be refunded in its current state");
  });

  it("allows only the buyer to dispute and requires matching buyer/seller votes", async function () {
    const { marketplace, buyer, seller, other, price } = await createEscrow();

    await expect(marketplace.connect(seller).disputeEscrow(1))
      .to.be.revertedWith("Only buyer can dispute escrow");
    await expect(marketplace.connect(other).disputeEscrow(1))
      .to.be.revertedWith("Only buyer can dispute escrow");
    await marketplace.connect(buyer).disputeEscrow(1);

    await marketplace.connect(buyer).voteDisputeResolution(1, true);
    expect(await marketplace.disputeResolutionVotes(1)).to.equal(2n);
    expect((await marketplace.getEscrow(1)).state).to.equal(4n);
    await marketplace.connect(seller).voteDisputeResolution(1, false);
    expect((await marketplace.getEscrow(1)).state).to.equal(4n);
    expect(await marketplace.pendingWithdrawals(seller.address)).to.equal(0n);

    await marketplace.connect(seller).voteDisputeResolution(1, true);
    expect(await marketplace.pendingWithdrawals(seller.address)).to.equal(price);
    expect((await marketplace.getEscrow(1)).state).to.equal(2n);
    expect((await marketplace.escrowHistory(1)).state).to.equal(2n);
  });

  it("refunds a disputed purchase only after both parties choose refund", async function () {
    const { marketplace, buyer, seller, price } = await createEscrow();
    await marketplace.connect(buyer).disputeEscrow(1);

    await marketplace.connect(buyer).voteDisputeResolution(1, false);
    expect(await marketplace.disputeResolutionVotes(1)).to.equal(1n);
    await expect(marketplace.connect(seller).voteDisputeResolution(1, false))
      .to.emit(marketplace, "EscrowRefunded")
      .withArgs(1n, 1n, buyer.address, price);

    expect(await marketplace.pendingWithdrawals(buyer.address)).to.equal(price);
    expect((await marketplace.getEscrow(1)).state).to.equal(3n);
    expect((await marketplace.escrowHistory(1)).state).to.equal(3n);
  });

  it("allows repurchase after a refund without overwriting prior escrow history", async function () {
    const { marketplace, seller, buyer, price } = await createEscrow();
    await marketplace.connect(buyer).refundEscrow(1);
    const [, , , nextBuyer] = await ethers.getSigners();
    await marketplace.connect(nextBuyer).buyProductWithEscrow(1, { value: price });

    const product = await marketplace.products(1);
    const escrow = await marketplace.getEscrow(1);
    expect(product.isSold).to.equal(true);
    expect(product.buyer).to.equal(nextBuyer.address);
    expect(escrow.seller).to.equal(seller.address);
    expect(escrow.buyer).to.equal(nextBuyer.address);
    expect(escrow.id).to.equal(2n);
    expect((await marketplace.escrowHistory(1)).state).to.equal(3n);
    expect((await marketplace.escrowHistory(2)).state).to.equal(1n);
  });

  it("paginates active products by bounded product-ID ranges", async function () {
    const marketplace = await deployMarketplace();
    const [, seller, buyer] = await ethers.getSigners();
    await marketplace.connect(seller).listProduct("One", "Description", 1000n, "ipfs://one");
    await marketplace.connect(seller).listProduct("Two", "Description", 2000n, "ipfs://two");
    await marketplace.connect(seller).listProduct("Three", "Description", 3000n, "ipfs://three");
    await marketplace.connect(buyer).buyProductWithEscrow(2, { value: 2000n });

    const firstPage = await marketplace.getForSaleProductsPage(0, 2);
    expect(firstPage.productsPage.map((product: any) => product.id)).to.deep.equal([1n]);
    expect(firstPage.nextCursor).to.equal(3n);

    const secondPage = await marketplace.getForSaleProductsPage(firstPage.nextCursor, 2);
    expect(secondPage.productsPage.map((product: any) => product.id)).to.deep.equal([3n]);
    expect(secondPage.nextCursor).to.equal(0n);
    await expect(marketplace.getForSaleProductsPage(0, 101))
      .to.be.revertedWith("Invalid page size");
  });

  it("removes fulfillment and timeout actions while retaining escrow safeguards", async function () {
    const marketplace = await deployMarketplace();
    expect(marketplace.interface.getFunction("submitFulfillment")).to.equal(null);
    expect(marketplace.interface.getFunction("refundForNonFulfillment")).to.equal(null);
    expect(marketplace.interface.getFunction("escalateUnansweredEscrow")).to.equal(null);
    expect(marketplace.interface.getFunction("finalizeDisputeTimeout")).to.equal(null);
    expect(marketplace.interface.getFunction("buyProduct")).to.equal(null);
    expect(marketplace.interface.getFunction("arbitrator")).to.equal(null);
    expect(marketplace.interface.getFunction("resolveDispute")).to.equal(null);
  });

  it("enforces on-chain listing byte limits", async function () {
    const marketplace = await deployMarketplace();
    const [, seller] = await ethers.getSigners();

    await marketplace.connect(seller).listProduct("n".repeat(100), "d".repeat(2000), 1n, "i".repeat(4096));
    await expect(marketplace.connect(seller).listProduct("n".repeat(101), "Description", 1n, "image"))
      .to.be.revertedWith("Invalid name length");
    await expect(marketplace.connect(seller).listProduct("Name", "d".repeat(2001), 1n, "image"))
      .to.be.revertedWith("Invalid description length");
    await expect(marketplace.connect(seller).listProduct("Name", "Description", 1n, "i".repeat(4097)))
      .to.be.revertedWith("Invalid image metadata length");
    await expect(marketplace.connect(seller).listProduct("", "Description", 1n, "image"))
      .to.be.revertedWith("Invalid name length");
  });
});
