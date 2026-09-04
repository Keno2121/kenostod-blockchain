const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("KenostodTokenV3", function () {
  async function deployFixture() {
    const [deployer, owner, treasury, user, nextOwner] =
      await ethers.getSigners();
    const Token = await ethers.getContractFactory("KenostodTokenV3", deployer);
    const token = await Token.deploy(owner.address, treasury.address);
    await token.waitForDeployment();

    return { token, deployer, owner, treasury, user, nextOwner };
  }

  it("mints the fixed supply once to the chosen recipient", async function () {
    const { token, deployer, owner, treasury } = await deployFixture();
    const supply = ethers.parseEther("1000000000");

    expect(await token.totalSupply()).to.equal(supply);
    expect(await token.MAX_SUPPLY()).to.equal(supply);
    expect(await token.balanceOf(treasury.address)).to.equal(supply);
    expect(await token.balanceOf(deployer.address)).to.equal(0);
    expect(await token.balanceOf(owner.address)).to.equal(0);
  });

  it("keeps the deployer separate from ownership", async function () {
    const { token, deployer, owner } = await deployFixture();

    expect(await token.owner()).to.equal(owner.address);
    await expect(token.connect(deployer).pause())
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
      .withArgs(deployer.address);
  });

  it("allows normal ERC-20 transfers", async function () {
    const { token, treasury, user } = await deployFixture();
    const amount = ethers.parseEther("100");

    await token.connect(treasury).transfer(user.address, amount);
    expect(await token.balanceOf(user.address)).to.equal(amount);
  });

  it("lets only the owner pause and unpause transfers", async function () {
    const { token, owner, treasury, user } = await deployFixture();

    await expect(token.connect(user).pause())
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
      .withArgs(user.address);

    await token.connect(owner).pause();
    await expect(
      token.connect(treasury).transfer(user.address, 1)
    ).to.be.revertedWithCustomError(token, "EnforcedPause");
    await expect(token.connect(user).unpause())
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
      .withArgs(user.address);

    await token.connect(owner).unpause();
    await token.connect(treasury).transfer(user.address, 1);
    expect(await token.balanceOf(user.address)).to.equal(1);
  });

  it("blocks allowance-based transfers while paused", async function () {
    const { token, owner, treasury, user, nextOwner } = await deployFixture();
    const amount = ethers.parseEther("10");

    await token.connect(treasury).approve(user.address, amount);
    await token.connect(owner).pause();
    await expect(
      token
        .connect(user)
        .transferFrom(treasury.address, nextOwner.address, amount)
    ).to.be.revertedWithCustomError(token, "EnforcedPause");
  });

  it("requires the proposed owner to accept ownership", async function () {
    const { token, owner, user, nextOwner } = await deployFixture();

    await token.connect(owner).transferOwnership(nextOwner.address);
    expect(await token.owner()).to.equal(owner.address);
    expect(await token.pendingOwner()).to.equal(nextOwner.address);
    await expect(token.connect(user).acceptOwnership())
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
      .withArgs(user.address);

    await token.connect(nextOwner).acceptOwnership();
    expect(await token.owner()).to.equal(nextOwner.address);
  });

  it("lets the current owner replace a pending ownership transfer", async function () {
    const { token, owner, user, nextOwner } = await deployFixture();

    await token.connect(owner).transferOwnership(user.address);
    await token.connect(owner).transferOwnership(nextOwner.address);
    expect(await token.pendingOwner()).to.equal(nextOwner.address);
    await expect(token.connect(user).acceptOwnership())
      .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
      .withArgs(user.address);
  });

  it("does not permit ownership renunciation", async function () {
    const { token, owner } = await deployFixture();

    await expect(token.connect(owner).renounceOwnership())
      .to.be.revertedWithCustomError(token, "RenouncingOwnershipDisabled");
  });

  it("exposes no mint, blacklist, clawback, or forced-transfer functions", async function () {
    const { token } = await deployFixture();
    const forbidden = [
      "mint(address,uint256)",
      "blacklist(address)",
      "clawback(address,uint256)",
      "forceTransfer(address,address,uint256)",
    ];

    for (const signature of forbidden) {
      expect(token.interface.getFunction(signature)).to.equal(null);
    }
  });

  it("rejects zero owner and supply-recipient addresses", async function () {
    const [deployer, owner, treasury] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("KenostodTokenV3", deployer);

    await expect(
      Token.deploy(ethers.ZeroAddress, treasury.address)
    ).to.be.revertedWithCustomError(Token, "OwnableInvalidOwner");

    await expect(
      Token.deploy(owner.address, ethers.ZeroAddress)
    ).to.be.revertedWith("KENO: recipient is zero");
  });

  it("enforces separation from the one-time deployer", async function () {
    const [deployer, owner, treasury] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("KenostodTokenV3", deployer);

    await expect(
      Token.deploy(deployer.address, treasury.address)
    ).to.be.revertedWithCustomError(Token, "DeployerCannotBeOwner");

    await expect(
      Token.deploy(owner.address, deployer.address)
    ).to.be.revertedWithCustomError(Token, "DeployerCannotReceiveSupply");
  });
});