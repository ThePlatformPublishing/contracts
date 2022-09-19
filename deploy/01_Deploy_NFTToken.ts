import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { ethers } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

import {
    ThePlatform__factory,
    ThePlatform,
    ThePlatformSale__factory,
    ThePlatformSale,
} from "../typechain";

const config = {
    contractUri: "ipfs://contract",
    name: "The Platform",
    symbol: "TP",
};

const minterRole = ethers.utils.solidityKeccak256(["string"], ["MINTER_ROLE"]);
const publisherRole = ethers.utils.solidityKeccak256(
    ["string"],
    ["PUBLISHER_ROLE"]
);

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
    let accounts: SignerWithAddress[];
    let platformFactory: ThePlatform__factory;
    let platformContract: ThePlatform;
    let platformSaleFactory: ThePlatformSale__factory;
    let platformSaleContract: ThePlatformSale;

    accounts = await hre.ethers.getSigners();

    accounts = await ethers.getSigners();
    platformFactory = (await ethers.getContractFactory(
        "ThePlatform",
        accounts[0]
    )) as ThePlatform__factory;
    platformSaleFactory = (await ethers.getContractFactory(
        "ThePlatformSale",
        accounts[0]
    )) as ThePlatformSale__factory;

    console.log(await accounts[0].getAddress());

    platformContract = await platformFactory.deploy(
        config.contractUri,
        config.name,
        config.symbol
    );
    await platformContract.deployed();
    platformSaleContract = await platformSaleFactory.deploy(
        platformContract.address
    );
    await platformSaleContract.deployed();
    const tx = await platformContract.grantRole(
        publisherRole,
        accounts[0].address
    );
    await tx.wait(2);
    const tx2 = await platformContract.grantRole(
        minterRole,
        platformSaleContract.address
    );
    await tx2.wait(2);

    await platformContract.publishEdition(
        1,
        50,
        accounts[1].address,
        1000,
        "1.json"
    );

    console.log({
        platformContract: platformContract.address,
        // splitContract: splitContract.address,
        saleContract: platformSaleContract.address,
    });

    console.log("Configured...");
};
export default func;
func.id = "nft_token_deploy";
func.tags = ["local"];
