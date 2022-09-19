// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "./Ferragosto.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import {SafeTransferLib} from "@rari-capital/solmate/src/utils/SafeTransferLib.sol";
import {ERC20} from "@rari-capital/solmate/src/tokens/ERC20.sol";

error SaleDisabled();
error InvalidPrice();
error InvalidSale();
error FailedToMint();
error LengthMismatch();
error PurchaseLimitExceeded();
error InsufficientValue();
error RoundLimitExceeded();
error FailedToSendETH();

contract FerragostoSale is Ownable {
    using SafeTransferLib for ERC20;
    /* Track prices and limits for sales*/
    struct SaleConfig {
        uint256 price;
        uint256 limit;
        uint256 limitPerPurchase;
        address paymentRecipient;
        uint256 saleStart;
        ERC20 paymentToken;
    }

    Ferragosto public publication;

    mapping(uint256 => SaleConfig) public saleConfigs; /*Token IDs to sale configuration*/

    constructor(address _publication) {
        publication = Ferragosto(_publication);
    }

    /*****************
    EXTERNAL MINTING FUNCTIONS
    *****************/
    function purchaseEdition(uint256 _tokenId, uint256 _qty) external payable {
        SaleConfig memory _saleConfig = saleConfigs[_tokenId];
        if (
            _saleConfig.saleStart == 0 ||
            _saleConfig.saleStart > block.timestamp
        ) revert SaleDisabled();
        if (_qty > _saleConfig.limitPerPurchase) revert PurchaseLimitExceeded();

        if ((publication.totalSupply(_tokenId) + _qty) > _saleConfig.limit)
            revert RoundLimitExceeded();

        _saleConfig.paymentToken.safeTransferFrom(
            msg.sender,
            _saleConfig.paymentRecipient,
            _saleConfig.price * _qty
        );

        if (!publication.mintEdition(_tokenId, _qty, msg.sender))
            revert FailedToMint();
    }

    /*****************
    CONFIG FUNCTIONS
    *****************/

    function setSaleConfig(
        uint256 _tokenId,
        uint256 _price,
        uint256 _limit,
        uint256 _limitPerPurchase,
        address _paymentDestination,
        ERC20 _paymentToken,
        uint256 _saleStart
    ) external onlyOwner {
        if (_paymentDestination == address(0)) revert InvalidSale();
        if (_price == 0) revert InvalidPrice();
        saleConfigs[_tokenId] = SaleConfig(
            _price,
            _limit,
            _limitPerPurchase,
            _paymentDestination,
            _saleStart,
            _paymentToken
        );
    }
}
