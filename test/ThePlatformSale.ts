import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BaseProvider } from "@ethersproject/providers";

import {
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
    maxSupply: "MaxSupplyExceeded()",
    claimLimit: "ClaimLimitExceeded()",
    allowListDisabled: "AllowlistDisabled()",
    publicDisabled: "PublicDisabled()",
    notOwner: "Ownable: caller is not the owner",
    invalidSig: "Invalid Signature",
    sigUsed: "signature used",
    tokenDNE: "URIQueryForNonexistentToken()",
    nonEOA: "NonEOADisabled()",
};

describe("The Platform sale", function () {
    let accounts: SignerWithAddress[];
    let platformFactory: ThePlatform__factory;
    let platformContract: ThePlatform;
    let platformSaleFactory: ThePlatformSale__factory;
    let platformSaleContract: ThePlatformSale;
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
    });

    beforeEach(async function () {
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
                1
            );
        });

        it.only("Should allow anyone to buy", async function () {
            await platformSaleContract.purchaseEdition(1, 2, {
                value: config.price.mul(2),
            });
            expect(await platformContract.totalSupply(1)).to.equal(2);
        });

        it("Fails if price is wrong", async function () {
            await expect(
                platformSaleContract.purchaseEdition(1, 2, {
                    value: config.price,
                })
            ).to.be.revertedWith("InsufficientValue()");
        });
    });
});
