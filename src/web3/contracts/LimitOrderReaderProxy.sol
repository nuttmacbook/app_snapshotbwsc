// SPDX-License-Identifier: MIT
pragma solidity 0.8.32;

// EIP-1967 proxy for LimitOrderReaderEngine
contract LimitOrderReaderProxy {
    // keccak256("eip1967.proxy.implementation") - 1
    bytes32 constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    // keccak256("eip1967.proxy.admin") - 1
    bytes32 constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    event Upgraded(address indexed implementation);
    event AdminChanged(address previousAdmin, address newAdmin);

    modifier onlyAdmin() {
        require(msg.sender == _admin(), "Not admin");
        _;
    }

    // data_ = abi.encodeCall(LimitOrderReaderEngine.initialize, (owner)) so nobody can initialize first
    constructor(address impl_, bytes memory data_) payable {
        _setAdmin(msg.sender);
        _setImplementation(impl_);
        if (data_.length > 0) _delegate(impl_, data_);
    }

    function upgradeTo(address impl_) external onlyAdmin {
        _setImplementation(impl_);
    }

    function upgradeToAndCall(address impl_, bytes calldata data_) external payable onlyAdmin {
        _setImplementation(impl_);
        _delegate(impl_, data_);
    }

    function transferAdmin(address newAdmin_) external onlyAdmin {
        require(newAdmin_ != address(0), "Admin is zero");
        emit AdminChanged(_admin(), newAdmin_);
        _setAdmin(newAdmin_);
    }

    function proxyAdmin() external view returns (address) {
        return _admin();
    }

    function proxyImplementation() external view returns (address) {
        return _implementation();
    }

    /* ---------- internal */

    function _admin() internal view returns (address a) {
        bytes32 slot = ADMIN_SLOT;
        assembly { a := sload(slot) }
    }

    function _implementation() internal view returns (address i) {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly { i := sload(slot) }
    }

    function _setAdmin(address admin_) internal {
        bytes32 slot = ADMIN_SLOT;
        assembly { sstore(slot, admin_) }
    }

    function _setImplementation(address impl_) internal {
        require(impl_.code.length > 0, "Not a contract");
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly { sstore(slot, impl_) }
        emit Upgraded(impl_);
    }

    function _delegate(address impl_, bytes memory data_) internal {
        (bool success, bytes memory result) = impl_.delegatecall(data_);
        if (!success) {
            assembly { revert(add(result, 32), mload(result)) }
        }
    }

    fallback() external payable {
        address impl = _implementation();
        assembly {
            calldatacopy(0, 0, calldatasize())
            let ok := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch ok
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    receive() external payable {
        address impl = _implementation();
        assembly {
            let ok := delegatecall(gas(), impl, 0, 0, 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch ok
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
