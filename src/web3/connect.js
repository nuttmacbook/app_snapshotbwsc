import { kitbox, chain, utils, etherjs } from "kitbox";

const baseNetwork = chain[import.meta.env.VITE_CHAIN ?? "gnosis"];
const network = import.meta.env.VITE_RPC_URL
    ? { ...baseNetwork, rpcUrls: { ...baseNetwork.rpcUrls, default: { http: [import.meta.env.VITE_RPC_URL] } } }
    : baseNetwork;

const box = new kitbox();
const modal = box.createModal(import.meta.env.VITE_PROJECT_ID, [network], "dark");
const CHAIN_ID = BigInt(network.id);

// web3.js returns { 0, 1, __length__ } for several outputs; the app reads arrays
const asTuple = (result) => (result && typeof result === "object" && !Array.isArray(result) && "__length__" in result
    ? Array.from({ length: Number(result.__length__) }, (_, i) => result[i])
    : result);

const readAsArrays = (kit) => {
    const create = kit.createWeb3Contract.bind(kit);
    kit.createWeb3Contract = (smartcontract, rpc) => {
        const contract = create(smartcontract, rpc);
        const methods = new Proxy({}, {
            get: (_, name) => (...args) => ({ call: async () => asTuple(await contract.methods[name](...args).call()) }),
        });
        return { methods };
    };
};
readAsArrays(box);

const getRpc = () => {
    if (import.meta.env.VITE_RPC_URL) return import.meta.env.VITE_RPC_URL;
    try { return box.getCurrentRpc(); } catch { return network.rpcUrls.default.http[0]; }
};

const disconnectWallet = async () => modal?.disconnect?.();
const { shortAddress, timestampToUTC, delay } = utils;

export { box, modal, etherjs, CHAIN_ID, getRpc, disconnectWallet, shortAddress, timestampToUTC, delay };

export { getContractData } from './intereacts/getContractData';
export { getLiveUserInfo } from './intereacts/getLiveUserInfo';
