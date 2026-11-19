// LimitOrderReader: address of the PROXY (VITE_READER_ADDRESS), with the engine ABI (read functions only).
const TOKEN_INFO = {
    internalType: "struct Storage.TokenInfo",
    type: "tuple",
    components: [
        { internalType: "address", name: "token", type: "address" },
        { internalType: "uint256", name: "wallet", type: "uint256" },
        { internalType: "uint256", name: "inContract", type: "uint256" },
        { internalType: "uint256", name: "inOrders", type: "uint256" },
        { internalType: "uint256", name: "wantInOrders", type: "uint256" },
    ],
};

const USER_INFO_COMPONENTS = [
    { internalType: "address", name: "account", type: "address" },
    { ...TOKEN_INFO, name: "tokenA" },
    { ...TOKEN_INFO, name: "tokenB" },
    { internalType: "uint256", name: "orderCount", type: "uint256" },
    { internalType: "uint256", name: "ordersScanned", type: "uint256" },
];

const ORDER_COMPONENTS = [
    { internalType: "uint256", name: "index", type: "uint256" },
    { internalType: "uint256", name: "id", type: "uint256" },
    { internalType: "address", name: "owner", type: "address" },
    { internalType: "address", name: "tokenDemand", type: "address" },
    { internalType: "address", name: "tokenSupply", type: "address" },
    { internalType: "uint256", name: "amountDemand", type: "uint256" },
    { internalType: "uint256", name: "amountSupply", type: "uint256" },
];

export const Reader = {
    address: import.meta.env.VITE_READER_ADDRESS,
    abi: [
        {
            inputs: [{ internalType: "address", name: "account_", type: "address" }],
            name: "getUserInfo",
            outputs: [
                { internalType: "struct Storage.UserInfo", name: "info", type: "tuple", components: USER_INFO_COMPONENTS },
                { internalType: "struct Storage.Order[]", name: "userOrders", type: "tuple[]", components: ORDER_COMPONENTS },
            ],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [{ internalType: "address[]", name: "accounts_", type: "address[]" }],
            name: "getUsersInfo",
            outputs: [
                { internalType: "struct Storage.UserInfo[]", name: "infos", type: "tuple[]", components: USER_INFO_COMPONENTS },
            ],
            stateMutability: "view",
            type: "function",
        },
        {
            inputs: [],
            name: "getProxyInfo",
            outputs: [
                { internalType: "address", name: "", type: "address" },
                { internalType: "bool", name: "", type: "bool" },
            ],
            stateMutability: "view",
            type: "function",
        },
    ],
};
