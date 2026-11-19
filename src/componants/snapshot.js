// Turns public/snapshot.json into objects the pages use. Pure: input → output.
import { units } from "./ui.js";

/** CSV of every address with exact amounts, for the migration list. */
export function toCsv(users, tokens) {
    const A = tokens.a.symbol, B = tokens.b.symbol;
    const head = ["address", "is_contract",
        `${A}_wallet`, `${A}_deposited`, `${A}_in_orders`, `${A}_in_limitorder_total`, `${A}_to_migrate`,
        `${B}_wallet`, `${B}_deposited`, `${B}_in_orders`, `${B}_in_limitorder_total`, `${B}_to_migrate`, "open_orders"];
    const rows = users.map((u) => [u.address, u.isContract ? 1 : 0,
        ...["wallet", "inContract", "inOrders", "stuck", "total"].map((f) => units(u.a[f], tokens.a.decimals)),
        ...["wallet", "inContract", "inOrders", "stuck", "total"].map((f) => units(u.b[f], tokens.b.decimals)),
        u.orders.length]);
    return [head, ...rows].map((r) => r.join(",")).join("\n");
}

const big = (v) => BigInt(v ?? 0);

/**
 * @param {object} raw  parsed snapshot.json
 * @returns {{meta: object, tokens: {a: object, b: object}, users: Array<object>, byAddress: Map, orders: Array<object>, totals: object}}
 */
export function readSnapshot(raw) {
    const [ta, tb] = raw.tokens;
    const tokens = { a: ta, b: tb };

    const orders = (raw.orders ?? []).map(toOrder);
    const ordersByOwner = new Map();
    orders.forEach((o) => {
        const list = ordersByOwner.get(o.owner) ?? [];
        list.push(o);
        ordersByOwner.set(o.owner, list);
    });

    const users = raw.users.map((r) => {
        const address = r[0].toLowerCase();
        const a = side(r[2], r[3], r[4], r[5]);
        const b = side(r[6], r[7], r[8], r[9]);
        return { address, isContract: Boolean(r[1]), a, b, orderCount: Number(r[10] ?? 0), orders: ordersByOwner.get(address) ?? [] };
    });

    const byAddress = new Map(users.map((u) => [u.address, u]));

    return {
        meta: {
            chainId: raw.chainId, block: raw.block, blockTime: raw.blockTime, generatedAt: raw.generatedAt,
            limitOrder: raw.contracts?.limitOrder, reader: raw.contracts?.reader,
            reconcile: {
                a: { held: big(raw.reconcile?.a?.held), owed: big(raw.reconcile?.a?.owed) },
                b: { held: big(raw.reconcile?.b?.held), owed: big(raw.reconcile?.b?.owed) },
            },
        },
        tokens, users, byAddress, orders,
        totals: totalsOf(users),
    };
}

export function side(wallet, inContract, inOrders, wantInOrders) {
    const s = { wallet: big(wallet), inContract: big(inContract), inOrders: big(inOrders), wantInOrders: big(wantInOrders) };
    s.stuck = s.inContract + s.inOrders;   // balance() does not include amounts locked in orders
    s.total = s.wallet + s.stuck;
    return s;
}

export function toOrder(r) {
    return {
        index: Number(r[0]), id: String(r[1]), owner: String(r[2]).toLowerCase(),
        tokenDemand: String(r[3]).toLowerCase(), tokenSupply: String(r[4]).toLowerCase(),
        amountDemand: big(r[5]), amountSupply: big(r[6]),
    };
}

// Contracts (LimitOrder itself, LP pools) are counted apart so they don't double the users' totals
export function totalsOf(users) {
    const zero = () => ({ wallet: 0n, inContract: 0n, inOrders: 0n, stuck: 0n, total: 0n });
    const t = { users: { a: zero(), b: zero(), count: 0, stuckCount: 0 }, contracts: { a: zero(), b: zero(), count: 0 } };
    users.forEach((u) => {
        const g = u.isContract ? t.contracts : t.users;
        g.count += 1;
        if (!u.isContract && (u.a.stuck > 0n || u.b.stuck > 0n)) g.stuckCount += 1;
        ["a", "b"].forEach((k) => Object.keys(g[k]).forEach((f) => { g[k][f] += u[k][f]; }));
    });
    return t;
}

/**
 * @param {Array<object>} users
 * @param {{query?: string, filter?: "all"|"stuck"|"wallet", sort?: string, hideContracts?: boolean}} options
 */
export function filterUsers(users, { query = "", filter = "all", sort = "stuckA", hideContracts = true } = {}) {
    const q = query.trim().toLowerCase();
    const list = users.filter((u) => {
        if (hideContracts && u.isContract) return false;
        if (q && !u.address.includes(q)) return false;
        if (filter === "stuck") return u.a.stuck > 0n || u.b.stuck > 0n;
        if (filter === "orders") return u.orders.length > 0;
        return true;
    });
    const key = {
        stuckA: (u) => u.a.stuck, stuckB: (u) => u.b.stuck,
        totalA: (u) => u.a.total, totalB: (u) => u.b.total,
    }[sort] ?? ((u) => u.a.stuck);
    return list.sort((x, y) => (key(y) > key(x) ? 1 : key(y) < key(x) ? -1 : 0));
}

/** Price of an order in tokenDemand per 1 tokenSupply, as a display string. */
export function orderPrice(order, decimalsDemand = 18, decimalsSupply = 18, fixed = 6) {
    if (order.amountSupply === 0n) return "-";
    const scale = 10n ** BigInt(fixed);
    const p = (order.amountDemand * 10n ** BigInt(decimalsSupply) * scale) / (order.amountSupply * 10n ** BigInt(decimalsDemand));
    const whole = p / scale;
    const frac = (p % scale).toString().padStart(fixed, "0").replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : `${whole}`;
}
