import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers } from "hardhat";
import { BaseProvider } from "@ethersproject/providers";
import { makeInterfaceId } from "@openzeppelin/test-helpers";

import {
    NonReceiver,
    NonReceiver__factory,
    ThePlatform,
    ThePlatform__factory,
} from "../typechain";

const minterRole = ethers.utils.solidityKeccak256(["string"], ["MINTER_ROLE"]);
const publisherRole = ethers.utils.solidityKeccak256(
    ["string"],
    ["PUBLISHER_ROLE"]
);

const beef = "0x000000000000000000000000000000000000bEEF";
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
    notOwner: "Ownable: caller is not the owner",
    tokenDNE: "URIQueryForNonexistentToken()",
    supplyZero: "SupplyMustBeNonZero()",
    insufficientSupply: "InsufficientSupplyRemaining()",
    duplicateEdition: "DuplicateEdition()",
    invalidRoyalties: "InvalidRoyalties()",
    invalidRolaltyRecipient: "InvalidRoyaltyDestination()",
    nonReceiver: "ERC1155: transfer to non ERC1155Receiver implementer",
};

describe("The Platform publication", function () {
    let accounts: SignerWithAddress[];
    let platformFactory: ThePlatform__factory;
    let platformContract: ThePlatform;
    let nonReceiverFactory: NonReceiver__factory;
    let nonReceiver: NonReceiver;

    this.beforeAll(async function () {
        accounts = await ethers.getSigners();

        platformFactory = (await ethers.getContractFactory(
            "ThePlatform",
            accounts[0]
        )) as ThePlatform__factory;

        nonReceiverFactory = (await ethers.getContractFactory(
            "NonReceiver",
            accounts[0]
        )) as NonReceiver__factory;
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

        it("Exposes different royalties based on edition", async function () {
            await platformContract.publishEdition(
                2,
                config.public,
                beef,
                config.royalties * 2,
                "2.json"
            );
            const royalties = await platformContract.royaltyInfo(
                2,
                ethers.utils.parseEther("10")
            );

            expect(royalties._receiver).to.equal(beef);
            expect(royalties._royaltyAmount.eq(ethers.utils.parseEther("2"))).to
                .be.true;
        });
    });

    describe("Publishing", function () {
        it("Should allow permissioned address to publish", async function () {
            await platformContract.publishEdition(
                1,
                config.public,
                config.sinkAddress,
                config.royalties,
                "1.json"
            );
            const edition = await platformContract.editions(1);
            expect(edition.maxSupply).to.equal(config.public);
            expect(edition.royaltyDestination).to.equal(config.sinkAddress);
            expect(edition.royaltyPoints).to.equal(config.royalties);
            expect(edition.uri).to.equal("1.json");
        });

        it("Does not allow anyone else to publish", async function () {
            platformContract = await platformContract.connect(accounts[1]);
            await expect(
                platformContract.publishEdition(
                    1,
                    config.public,
                    config.sinkAddress,
                    config.royalties,
                    "1.json"
                )
            ).to.be.revertedWith(
                `AccessControl: account ${accounts[1].address.toLowerCase()} is missing role ${publisherRole.toLowerCase()}`
            );
        });
        it("Fails to publish if supply 0", async function () {
            await expect(
                platformContract.publishEdition(
                    1,
                    0,
                    config.sinkAddress,
                    config.royalties,
                    "1.json"
                )
            ).to.be.revertedWith(errorMessages.supplyZero);
        });
        it("Fails to publish if duplicate edition", async function () {
            await platformContract.publishEdition(
                1,
                config.public,
                config.sinkAddress,
                config.royalties,
                "1.json"
            );
            await expect(
                platformContract.publishEdition(
                    1,
                    config.public,
                    config.sinkAddress,
                    config.royalties,
                    "1.json"
                )
            ).to.be.revertedWith(errorMessages.duplicateEdition);
        });
        it("Fails to publish if invalid royalty destination", async function () {
            await expect(
                platformContract.publishEdition(
                    1,
                    config.public,
                    zeroAddress,
                    config.royalties,
                    "1.json"
                )
            ).to.be.revertedWith(errorMessages.invalidRolaltyRecipient);
        });
        it("Fails to publish if invalid royalty amount", async function () {
            await expect(
                platformContract.publishEdition(
                    1,
                    config.public,
                    config.sinkAddress,
                    10001,
                    "1.json"
                )
            ).to.be.revertedWith(errorMessages.invalidRoyalties);
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

        it("Allows minting to max", async function () {
            await platformContract.mintEdition(
                1,
                config.public,
                accounts[1].address
            );
            expect(await platformContract.totalSupply(1)).to.equal(
                config.public
            );
        });

        it("Fails if supply exceeded", async function () {
            await expect(
                platformContract.mintEdition(
                    1,
                    config.public + 1,
                    accounts[1].address
                )
            ).to.be.revertedWith(errorMessages.insufficientSupply);
        });

        it("Fails if receiver cannot hold 1155", async function () {
            nonReceiver = await nonReceiverFactory.deploy();
            await expect(
                platformContract.mintEdition(1, 10, nonReceiver.address)
            ).to.be.revertedWith(errorMessages.nonReceiver);
        });

        it("Does not allow anyone else to mint", async function () {
            platformContract = await platformContract.connect(accounts[1]);
            await expect(
                platformContract.mintEdition(1, 10, accounts[1].address)
            ).to.be.revertedWith(
                `AccessControl: account ${accounts[1].address.toLowerCase()} is missing role ${minterRole.toLowerCase()}`
            );
        });

        it("returns token uri based on edition", async function () {
            await platformContract.mintEdition(1, 10, accounts[1].address);
            expect(await platformContract.uri(1)).to.equal("1.json");
        });

        it("Fails to return uri if token does not exist", async function () {
            await expect(platformContract.uri(1)).to.be.revertedWith(
                errorMessages.tokenDNE
            );
        });
    });

    describe("Configuration", function () {
        it("Allows owner to change contract URI", async function () {
            expect(await platformContract.contractURI()).to.equal(
                config.contractUri
            );

            await platformContract.setContractURI("new");
            expect(await platformContract.contractURI()).to.equal("new");
        });

        it("Does not allow anyone else to change contract URI", async function () {
            platformContract = await platformContract.connect(accounts[1]);
            await expect(
                platformContract.setContractURI("new")
            ).to.be.revertedWith(errorMessages.notOwner);
        });
        it("Supports interface", async function () {
            const erc1155InterfaceId = makeInterfaceId.ERC165([
                "balanceOf(address,uint256)",
                "balanceOfBatch(address[],uint256[])",
                "isApprovedForAll(address,address)",
                "safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)",
                "safeTransferFrom(address,address,uint256,uint256,bytes)",
                "setApprovalForAll(address,bool)",
            ]);
            const erc1155UriInterfaceId = makeInterfaceId.ERC165([
                "uri(uint256)",
            ]);
            const accessControlInterfaceId = makeInterfaceId.ERC165([
                "hasRole(bytes32,address)",
                "getRoleAdmin(bytes32)",
                "grantRole(bytes32,address)",
                "revokeRole(bytes32,address)",
                "renounceRole(bytes32,address)",
            ]);
            expect(
                await platformContract.supportsInterface(erc1155InterfaceId)
            ).to.equal(true);
            expect(
                await platformContract.supportsInterface(erc1155UriInterfaceId)
            ).to.equal(true);
            expect(
                await platformContract.supportsInterface(
                    accessControlInterfaceId
                )
            ).to.equal(true);
        });
        it("Fails if interface is wrong", async function () {
            const erc1155InterfaceId = makeInterfaceId.ERC165([
                "balanceOf(address)",
                "balanceOfBatch(address[],uint256[])",
                "isApprovedForAll(address,address)",
                "safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)",
                "safeTransferFrom(address,address,uint256,uint256,bytes)",
                "setApprovalForAll(address,bool)",
            ]);
            expect(
                await platformContract.supportsInterface(erc1155InterfaceId)
            ).to.equal(false);
        });
    });
});
