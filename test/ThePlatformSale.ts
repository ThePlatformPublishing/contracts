import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BaseProvider } from "@ethersproject/providers";

import {
    AnyERC20,
    AnyERC20__factory,
    InvalidPlatform,
    InvalidPlatform__factory,
    NonReceiver,
    NonReceiver__factory,
    ThePlatform,
    ThePlatformSale,
    ThePlatformSale__factory,
    ThePlatform__factory,
} from "../typechain";

const minterRole = ethers.utils.solidityKeccak256(["string"], ["MINTER_ROLE"]);
const publisherRole = ethers.utils.solidityKeccak256(
    ["string"],
    ["PUBLISHER_ROLE"]
);
const zeroAddress = "0x0000000000000000000000000000000000000000";

const config = {
    baseUri: "https://placeholder.com/",
    contractUri: "https://placeholder.com/contract.json",
    public: 150,
    sinkAddress: "0x000000000000000000000000000000000000dEaD",
    royalties: 1000,
    price: ethers.utils.parseEther("0.2"),
    name: "ThePlatform",
    symbol: "TP",
};

const errorMessages = {
    insufficientBalance: "ERC20: transfer amount exceeds balance",
    insufficientAllowance: "ERC20: insufficient allowance",
    saleDisabled: "SaleDisabled()",
    invalidPrice: "InvalidPrice()",
    purchaseLimitExceeded: "PurchaseLimitExceeded()",
    roundLimitExceeded: "RoundLimitExceeded()",
    maxSupplyExceeded: "InsufficientSupplyRemaining()",
    failedToMint: "FailedToMint()",
    invalidSale: "InvalidSale()",
};

async function blockTime() {
    const block = await ethers.provider.getBlock("latest");
    return block.timestamp;
}

const fastForwardTime = async (seconds: number) => {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine", []);
};

describe("The Platform sale", function () {
    let accounts: SignerWithAddress[];
    let platformFactory: ThePlatform__factory;
    let platformContract: ThePlatform;
    let erc20Factory: AnyERC20__factory;
    let erc20: AnyERC20;
    let platformSaleFactory: ThePlatformSale__factory;
    let platformSaleContract: ThePlatformSale;
    let invalidPlatformFactory: InvalidPlatform__factory;
    let invalidPlatform: InvalidPlatform;

    let provider: BaseProvider;

    this.beforeAll(async function () {
        provider = ethers.provider;
        accounts = await ethers.getSigners();

        platformFactory = (await ethers.getContractFactory(
            "ThePlatform",
            accounts[0]
        )) as ThePlatform__factory;
        platformSaleFactory = (await ethers.getContractFactory(
            "ThePlatformSale",
            accounts[0]
        )) as ThePlatformSale__factory;
        erc20Factory = (await ethers.getContractFactory(
            "AnyERC20",
            accounts[0]
        )) as AnyERC20__factory;
        invalidPlatformFactory = (await ethers.getContractFactory(
            "InvalidPlatform",
            accounts[0]
        )) as InvalidPlatform__factory;
    });

    beforeEach(async function () {
        erc20 = await erc20Factory.deploy();
        platformContract = await platformFactory.deploy(
            config.contractUri,
            config.name,
            config.symbol
        );
        platformSaleContract = await platformSaleFactory.deploy(
            platformContract.address
        );
        await platformContract.grantRole(publisherRole, accounts[0].address);
        await platformContract.grantRole(
            minterRole,
            platformSaleContract.address
        );
        await platformContract.publishEdition(
            1,
            config.public,
            config.sinkAddress,
            config.royalties,
            "1.json"
        );
        await erc20.mint(accounts[0].address, ethers.utils.parseEther("100"));
    });

    describe("Configuration", function () {
        it("Should setup tests", async function () {
            expect(true);
        });
    });

    describe("Sale", function () {
        this.beforeEach(async function () {
            await platformSaleContract.setSaleConfig(
                1,
                config.price,
                config.public,
                2,
                config.sinkAddress,
                erc20.address,
                1
            );
        });

        it("Should allow anyone to buy", async function () {
            await erc20.approve(platformSaleContract.address, config.price);
            await platformSaleContract.purchaseEdition(1, 1, {
                value: config.price,
            });
            expect(await platformContract.totalSupply(1)).to.equal(1);
            expect(
                await platformContract.balanceOf(accounts[0].address, 1)
            ).to.equal(1);
        });

        it("Should allow anyone to buy up to limit", async function () {
            await erc20.approve(
                platformSaleContract.address,
                config.price.mul(2)
            );
            await platformSaleContract.purchaseEdition(1, 2, {
                value: config.price.mul(2),
            });
            expect(await platformContract.totalSupply(1)).to.equal(2);
            expect(
                await platformContract.balanceOf(accounts[0].address, 1)
            ).to.equal(2);
        });

        it("Fails if over limit per purchase", async function () {
            await erc20.approve(
                platformSaleContract.address,
                config.price.mul(3)
            );
            await expect(
                platformSaleContract.purchaseEdition(1, 3, {
                    value: config.price.mul(3),
                })
            ).to.be.revertedWith(errorMessages.purchaseLimitExceeded);
        });

        it("Fails if insufficient balance", async function () {
            erc20 = await erc20.connect(accounts[1]);
            platformSaleContract = await platformSaleContract.connect(
                accounts[1]
            );
            await erc20.approve(
                platformSaleContract.address,
                config.price.mul(2)
            );
            await expect(
                platformSaleContract.purchaseEdition(1, 2)
            ).to.be.revertedWith(errorMessages.insufficientBalance);
        });

        it("Fails if token not approved", async function () {
            await expect(
                platformSaleContract.purchaseEdition(1, 2)
            ).to.be.revertedWith(errorMessages.insufficientAllowance);
        });

        it("Fails if sale config not set", async function () {
            await platformContract.publishEdition(
                2,
                config.public,
                config.sinkAddress,
                config.royalties,
                "2.json"
            );
            await erc20.approve(
                platformSaleContract.address,
                config.price.mul(2)
            );
            await expect(
                platformSaleContract.purchaseEdition(2, 2)
            ).to.be.revertedWith(errorMessages.saleDisabled);
        });

        it("Fails if sale config not set and token not published", async function () {
            await erc20.approve(
                platformSaleContract.address,
                config.price.mul(2)
            );
            await expect(
                platformSaleContract.purchaseEdition(2, 2)
            ).to.be.revertedWith(errorMessages.saleDisabled);
        });

        it("Fails if sale not enabled yet", async function () {
            const now = await blockTime();
            const startTime = now + 1000;
            await platformSaleContract.setSaleConfig(
                1,
                config.price,
                config.public,
                2,
                config.sinkAddress,
                erc20.address,
                startTime
            );
            await erc20.approve(
                platformSaleContract.address,
                config.price.mul(2)
            );
            await expect(
                platformSaleContract.purchaseEdition(1, 2)
            ).to.be.revertedWith(errorMessages.saleDisabled);
        });

        it("Fails if sale start is 0", async function () {
            await platformSaleContract.setSaleConfig(
                1,
                config.price,
                config.public,
                2,
                config.sinkAddress,
                erc20.address,
                0
            );
            await erc20.approve(
                platformSaleContract.address,
                config.price.mul(2)
            );
            await expect(
                platformSaleContract.purchaseEdition(1, 2)
            ).to.be.revertedWith(errorMessages.saleDisabled);
        });

        it("Fails if platform mint fails", async function () {
            invalidPlatform = await invalidPlatformFactory.deploy();
            platformSaleContract = await platformSaleFactory.deploy(
                invalidPlatform.address
            );
            await platformSaleContract.setSaleConfig(
                1,
                config.price,
                config.public,
                2,
                config.sinkAddress,
                erc20.address,
                1
            );
            await erc20.approve(
                platformSaleContract.address,
                config.price.mul(2)
            );
            console.log("here");
            await expect(
                platformSaleContract.purchaseEdition(1, 2)
            ).to.be.revertedWith(errorMessages.failedToMint);
        });

        it("Fails if over round limit", async function () {
            await platformSaleContract.setSaleConfig(
                1,
                1,
                5,
                10,
                config.sinkAddress,
                erc20.address,
                1
            );
            await erc20.approve(platformSaleContract.address, 10);
            await expect(
                platformSaleContract.purchaseEdition(1, 10)
            ).to.be.revertedWith(errorMessages.roundLimitExceeded);
        });

        it("Fails if valid purchase over token max supply", async function () {
            await platformSaleContract.setSaleConfig(
                1,
                1,
                200,
                200,
                config.sinkAddress,
                erc20.address,
                1
            );
            await erc20.approve(platformSaleContract.address, 175);
            await expect(
                platformSaleContract.purchaseEdition(1, 175)
            ).to.be.revertedWith(errorMessages.maxSupplyExceeded);
        });

        it("Fails to set config if payment destination is 0", async function () {
            await expect(
                platformSaleContract.setSaleConfig(
                    1,
                    config.price,
                    config.public,
                    2,
                    zeroAddress,
                    erc20.address,
                    1
                )
            ).to.be.revertedWith(errorMessages.invalidSale);
        });

        it("Fails to set config if price is 0", async function () {
            await expect(
                platformSaleContract.setSaleConfig(
                    1,
                    0,
                    config.public,
                    2,
                    config.sinkAddress,
                    erc20.address,
                    1
                )
            ).to.be.revertedWith(errorMessages.invalidPrice);
        });
    });
});
