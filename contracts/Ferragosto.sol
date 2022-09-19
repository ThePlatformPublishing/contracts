// SPDX-License-Identifier: MIT
pragma solidity 0.8.13;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "./Royalties/ERC2981/IERC2981Royalties.sol";

error InsufficientSupplyRemaining();
error SupplyMustBeNonZero();
error DuplicateEdition();
error InvalidRoyalties();
error InvalidRoyaltyDestination();
error URIQueryForNonexistentToken();

contract Ferragosto is
    ERC1155Supply,
    AccessControl,
    Ownable,
    IERC2981Royalties
{
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE"); /*Minter can mint new editions up to max supply*/
    bytes32 public constant PUBLISHER_ROLE = keccak256("PUBLISHER_ROLE"); /*Publisher can initiate new editions*/

    string public contractURI; /*contractURI contract metadata json*/

    string public name; /*Token name override*/
    string public symbol; /*Token symbol override*/

    struct Edition {
        uint256 maxSupply;
        address royaltyDestination;
        uint256 royaltyPoints;
        string uri;
    }

    mapping(uint256 => Edition) public editions;

    event NewEdition(
        uint256 indexed _id,
        uint256 _maxSupply,
        address _royaltyDestination,
        uint256 _royaltyPoints,
        string _uri
    );

    /// @dev Construtor sets the token and contract URIs
    /// @param _contractURI URI with marketplace metadata
    /// @param _name Token name
    /// @param _symbol Token symbol
    constructor(
        string memory _contractURI,
        string memory _name,
        string memory _symbol
    ) ERC1155("N/A") {
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender); /*Grant deployer admin roles*/
        contractURI = _contractURI; /*Set marketplace metadata*/

        name = _name; /*Set explorer name*/
        symbol = _symbol; /*Set exploer symbol*/
    }

    function publishEdition(
        uint256 _id,
        uint256 _maxSupply,
        address _royaltyDestination,
        uint256 _royaltyPoints,
        string calldata _uri
    ) public onlyRole(PUBLISHER_ROLE) {
        if (_maxSupply == 0) revert SupplyMustBeNonZero();
        if (editions[_id].maxSupply > 0) revert DuplicateEdition();
        if (_royaltyDestination == address(0))
            revert InvalidRoyaltyDestination();
        if (_royaltyPoints > 10000) revert InvalidRoyalties();
        editions[_id] = Edition(
            _maxSupply,
            _royaltyDestination,
            _royaltyPoints,
            _uri
        );
        emit NewEdition(
            _id,
            _maxSupply,
            _royaltyDestination,
            _royaltyPoints,
            _uri
        );
    }

    function mintEdition(
        uint256 _id,
        uint256 _qty,
        address _dst
    ) public onlyRole(MINTER_ROLE) returns (bool) {
        uint256 _mintedSupply = totalSupply(_id); /*Check how many have been minted already*/
        if (editions[_id].maxSupply - _mintedSupply < _qty)
            revert InsufficientSupplyRemaining(); /*Only allow up to amount set on mint*/
        _mint(_dst, _id, _qty, "");
        return true;
    }

    function uri(uint256 _tokenId)
        public
        view
        override
        returns (string memory)
    {
        if (totalSupply(_tokenId) == 0) revert URIQueryForNonexistentToken();
        return editions[_tokenId].uri;
    }

    /// @notice Set new contract URI
    /// @param _contractURI Contract metadata json
    function setContractURI(string memory _contractURI) external onlyOwner {
        contractURI = _contractURI;
    }

    /*****************
    Public interfaces
    *****************/
    ///@dev Support interfaces for ERC1155
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC1155, AccessControl)
        returns (bool)
    {
        return
            interfaceId == type(IERC1155).interfaceId ||
            interfaceId == type(IERC1155MetadataURI).interfaceId ||
            interfaceId == type(IAccessControl).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function royaltyInfo(uint256 _tokenId, uint256 _value)
        external
        view
        override(IERC2981Royalties)
        returns (address _receiver, uint256 _royaltyAmount)
    {
        Edition memory _edition = editions[_tokenId];
        return (
            _edition.royaltyDestination,
            (_value * _edition.royaltyPoints) / 10000
        );
    }
}
