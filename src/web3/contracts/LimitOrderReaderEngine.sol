// SPDX-License-Identifier: MIT
pragma solidity 0.8.32;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

// Only the read functions of LimitOrder (Gnosis 0xc20229439E3eCcddB9f15bA8b2FfA24705Dae010)
interface ILimitOrder {
    function balance(address, address) external view returns (uint256);
    function getOrdersLength() external view returns (uint256);
    function orders(uint256 index) external view returns (
        uint256 id,
        address owner,
        address tokenDemand,
        address tokenSupply,
        uint256 amountDemand,
        uint256 amountSupply
    );
}

contract Constant {
    uint256 constant MAX = type(uint256).max;

    address constant ZERO = address(0);
    address constant DEAD = address(0xdead);

    ILimitOrder constant LIMIT_ORDER = ILimitOrder(0xc20229439E3eCcddB9f15bA8b2FfA24705Dae010);

    IERC20 constant TOKEN_A = IERC20(0xf3e9e3294d0f2Fc87AC5a1D650c51EAaF040AED2); // ...AED2
    IERC20 constant TOKEN_B = IERC20(0x95F915EEBE145d94977578b4A3235538B87D18A5); // ...18A5
}

contract Storage is Constant {
    bool _initialized;
    address _owner;

    struct Order {
        uint256 index;          // position in LimitOrder.orders, the value revokeOrder(orderIndex) needs
        uint256 id;
        address owner;
        address tokenDemand;
        address tokenSupply;
        uint256 amountDemand;
        uint256 amountSupply;
    }

    struct TokenInfo {
        address token;
        uint256 wallet;         // IERC20.balanceOf(account)
        uint256 inContract;     // LimitOrder.balance(...)
        uint256 inOrders;       // sum of amountSupply of open orders selling this token
        uint256 wantInOrders;   // sum of amountDemand of open orders asking for this token
    }

    struct UserInfo {
        address account;
        TokenInfo tokenA;
        TokenInfo tokenB;
        uint256 orderCount;     // open orders owned by account
        uint256 ordersScanned;  // LimitOrder.getOrdersLength() at read time
    }
}

contract LimitOrderReaderEngine is Storage {
    event OwnershipTransferred(address owner, address newOwner);

    modifier onlyOwner() {
        require(msg.sender == _owner, "Not owner");
        _;
    }

    function initialize(address owner_) external {
        require(!_initialized, "Already initialized");
        _initialized = true;
        _owner = owner_;
    }

    function getProxyInfo() public view returns (address, bool) {
        return (_owner, _initialized);
    }

    /* ---------- read */

    /// Everything one account still has across wallet, LimitOrder balance and open orders.
    function getUserInfo(address account_) public view returns (UserInfo memory info, Order[] memory userOrders) {
        info.account = account_;
        info.tokenA = _tokenInfo(TOKEN_A, account_);
        info.tokenB = _tokenInfo(TOKEN_B, account_);

        uint256 length = LIMIT_ORDER.getOrdersLength();
        info.ordersScanned = length;
        userOrders = new Order[](length);

        uint256 count;
        for (uint256 i = 0; i < length; i++) {
            Order memory order = _readOrder(i);
            if (order.owner != account_) continue;

            userOrders[count++] = order;
            _addOrder(info.tokenA, order);
            _addOrder(info.tokenB, order);
        }

        info.orderCount = count;
        // Shrink the result to the orders that belong to account_
        assembly { mstore(userOrders, count) }
    }

    /// Same as getUserInfo for several accounts in one call.
    function getUsersInfo(address[] calldata accounts_) external view returns (UserInfo[] memory infos) {
        infos = new UserInfo[](accounts_.length);
        for (uint256 i = 0; i < accounts_.length; i++) {
            (infos[i], ) = getUserInfo(accounts_[i]);
        }
    }

    /* ---------- internal */

    function _tokenInfo(IERC20 token_, address account_) internal view returns (TokenInfo memory info) {
        info.token = address(token_);
        info.wallet = token_.balanceOf(account_);
        info.inContract = _contractBalance(address(token_), account_);
    }

    // LimitOrder's ABI does not name the keys of balance(address,address).
    // Both orders are read: the swapped lookup is balance[user][token] of a token
    // that never deposits, so it is 0 and the sum is the real balance either way.
    function _contractBalance(address token_, address account_) internal view returns (uint256) {
        return LIMIT_ORDER.balance(token_, account_) + LIMIT_ORDER.balance(account_, token_);
    }

    function _readOrder(uint256 index_) internal view returns (Order memory order) {
        order.index = index_;
        (
            order.id,
            order.owner,
            order.tokenDemand,
            order.tokenSupply,
            order.amountDemand,
            order.amountSupply
        ) = LIMIT_ORDER.orders(index_);
    }

    function _addOrder(TokenInfo memory info_, Order memory order_) internal pure {
        if (order_.tokenSupply == info_.token) info_.inOrders += order_.amountSupply;
        if (order_.tokenDemand == info_.token) info_.wantInOrders += order_.amountDemand;
    }

    /* ---------- owner */

    function transferOwnership(address newOwner) public onlyOwner {
        emit OwnershipTransferred(_owner, newOwner);
        _owner = newOwner;
    }

    function transferETH(address to, uint256 amount) public onlyOwner {
        require(to != ZERO, "send ETH to zero");
        (bool success, ) = to.call{value: amount}("");
        require(success, "send ETH fail");
    }

    function transferToken(address token, address to, uint256 amount) public onlyOwner {
        IERC20(token).transfer(to, amount);
    }

    receive() external payable {}
}
