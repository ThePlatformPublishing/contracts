pragma solidity >=0.8.0;

contract InvalidPlatform {
    function mintEdition(
        uint256 _id,
        uint256 _qty,
        address _dst
    ) public returns (bool) {
        return false;
    }

    function totalSupply(uint256 _id) public returns (uint256) {
        return 0;
    }
}
