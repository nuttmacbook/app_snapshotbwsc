import { box, getRpc } from "../connect";
import { Reader } from "../contracts/contract_reader";

// web3 structs carry both names and positions; read by name, fall back to position
const pick = (obj, name, index) => obj?.[name] ?? obj?.[index];
const big = (v) => BigInt(v ?? 0);

const token = (t) => ({
    wallet: big(pick(t, "wallet", 1)),
    inContract: big(pick(t, "inContract", 2)),
    inOrders: big(pick(t, "inOrders", 3)),
    wantInOrders: big(pick(t, "wantInOrders", 4)),
});

/**
 * Reads one address right now through LimitOrderReader (one RPC call).
 *
 * @param {string} account  address to check
 * @returns {Promise<{a: object, b: object, orderCount: number, orders: Array}>}
 *          amounts as bigint, orders in the same column order as snapshot.orders
 */
export async function getLiveUserInfo(account) {
    const [info, userOrders] = await box.createWeb3Contract(Reader, getRpc()).methods.getUserInfo(account).call();
    return {
        a: token(pick(info, "tokenA", 1)),
        b: token(pick(info, "tokenB", 2)),
        orderCount: Number(pick(info, "orderCount", 3) ?? 0),
        orders: (userOrders ?? []).map((o) => [
            Number(pick(o, "index", 0)), String(pick(o, "id", 1)), String(pick(o, "owner", 2)).toLowerCase(),
            String(pick(o, "tokenDemand", 3)).toLowerCase(), String(pick(o, "tokenSupply", 4)).toLowerCase(),
            String(pick(o, "amountDemand", 5)), String(pick(o, "amountSupply", 6)),
        ]),
    };
}
