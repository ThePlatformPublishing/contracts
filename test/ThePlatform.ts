import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BaseProvider } from "@ethersproject/providers";

import { ThePlatform, ThePlatform__factory } from "../typechain";

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

describe("The Platform publication", function () {
    let accounts: SignerWithAddress[];
    let platformFactory: ThePlatform__factory;
    let platformContract: ThePlatform;
    let provider: BaseProvider;

    this.beforeAll(async function () {
        provider = ethers.provider;
        accounts = await ethers.getSigners();

        platformFactory = (await ethers.getContractFactory(
            "ThePlatform",
            accounts[0]
        )) as ThePlatform__factory;
    });

    beforeEach(async function () {
        platformContract = await platformFactory.deploy(
            config.contractUri,
            config.name,
            config.symbol
        );
        await platformContract.grantRole(publisherRole, accounts[0].address);
        await platformContract.grantRole(minterRole, accounts[0].address);
    });

    describe("Configuration", function () {
        it("Should setup tests", async function () {
            expect(true);
        });
    });

    describe("Royalties", function () {
        this.beforeEach(async function () {
            await platformContract.publishEdition(
                1,
                config.public,
                config.sinkAddress,
                config.royalties,
                "1.json"
            );
        });
        it("Exposes 2981 interface to send royalties to contract", async function () {
            const royalties = await platformContract.royaltyInfo(
                1,
                ethers.utils.parseEther("10")
            );

            expect(royalties._receiver).to.equal(config.sinkAddress);
            expect(royalties._royaltyAmount.eq(ethers.utils.parseEther("1"))).to
                .be.true;
        });
    });

    describe("Permissioned Minting", function () {
        this.beforeEach(async function () {
            await platformContract.publishEdition(
                1,
                config.public,
                config.sinkAddress,
                config.royalties,
                "1.json"
            );
        });

        it("Should allow permissioned address to mint", async function () {
            await platformContract.mintEdition(1, 10, accounts[1].address);
            expect(await platformContract.totalSupply(1)).to.equal(10);
        });
    });
});
