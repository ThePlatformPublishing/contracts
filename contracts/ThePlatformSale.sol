// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "./ThePlatform.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

error SaleDisabled(uint256 tokenId);
error InvalidToken(uint256 tokenId);
error InvalidSale();
error FailedToMint();
error LengthMismatch();
error PurchaseLimitExceeded();
error InsufficientValue();
error RoundLimitExceeded();
error FailedToSendETH();

contract ThePlatformSale is Ownable {
    /* Track prices and limits for sales*/
    struct SaleConfig {
        uint256 price;
        uint256 limit;
        uint256 limitPerPurchase;
        address payable ethSink;
        uint256 saleStart;
    }

    ThePlatform public publication;

    mapping(uint256 => SaleConfig) public saleConfig; /*Token IDs to sale configuration*/

    constructor(address _publication) {
        ThePlatform publication = ThePlatform(_publication);
    }

    /*****************
    EXTERNAL MINTING FUNCTIONS
    *****************/
    function purchaseEdition(uint256 _tokenId, uint256 _qty) external payable {
        SaleConfig _saleConfig = saleConfig[_tokenId];
        if (
            _saleConfig.saleStart == 0 ||
            _saleConfig.saleStart > block.timestamp
        ) revert SaleDisabled(_tokenId);
        if (_saleConfig.price == 0) revert InvalidToken(_tokenId); /*Do not allow 0 value purchase. If desired use separate function for free claim*/
        if (_qty > _saleConfig.limitPerPurchase) revert PurchaseLimitExceeded();
        if (msg.value != (_saleConfig.price * _qty)) revert InsufficientValue();

        if (publication.totalSupply(_tokenId) + _qty) > _limit)
            revert RoundLimitExceeded();

        (bool _success, ) = saleConfig.ethSink.call{value: msg.value}(""); /*Send ETH to sink first*/
        if (!_success) revert FailedToSendETH();

        if (!publication.mintEdition(_tokenId, _qty, msg.sender))
            revert FailedToMint();
    }

    /*****************
    CONFIG FUNCTIONS
    *****************/

    function setSaleConfig(uint256 _tokenId, uint256 _price, uint256 _limit, uint256 _limitPerPurchase, address payable _sink, uint256 _saleStart)
        external
        onlyOwner
    {
      if (_sink == address(0)) revert InvalidSale();
      saleConfig[_tokenId] = SaleConfig(_price, _limit, _limitPerPurchase, _sink, _saleStart);
    }

}
