// Builds public/snapshot.json: every address that holds AED2 / 18A5 or ever used LimitOrder,
// read through LimitOrderReader at one pinned block so all numbers match each other.
//
//   node --env-file=.env scripts/snapshot.js
//
// No dependencies: plain JSON-RPC over fetch (Node 20+).

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

/* ---------- SETTINGS */

const RPC = process.env.SNAPSHOT_RPC || "https://rpc.gnosischain.com";
const READER = process.env.VITE_READER_ADDRESS;                  // Proxy of LimitOrderReader
const LIMIT_ORDER = "0xc20229439e3eccddb9f15ba8b2ffa24705dae010";
const TOKEN_A = "0xf3e9e3294d0f2fc87ac5a1d650c51eaaf040aed2";
const TOKEN_B = "0x95f915eebe145d94977578b4a3235538b87d18a5";

// First block to scan for each contract. 0 works but is slow; the deploy block is enough.
const START_BLOCK = {
    [TOKEN_A]: BigInt(process.env.START_BLOCK_A || 0),
    [TOKEN_B]: BigInt(process.env.START_BLOCK_B || 0),
    [LIMIT_ORDER]: BigInt(process.env.START_BLOCK_LIMIT_ORDER || 0),
};

const SNAPSHOT_BLOCK = process.env.SNAPSHOT_BLOCK;               // empty = latest block at start
const OUT_FILE = process.env.SNAPSHOT_OUT || "public/snapshot.json";
const EXTRA_FILE = "scripts/extra-addresses.txt";                // optional, one address per line

const USERS_PER_CALL = 10;      // each user scans every open order (~1M gas), RPCs cap eth_call gas
const RPC_BATCH = 50;           // requests per JSON-RPC batch
const LOG_CHUNK_MAX = 200000n;  // block range per eth_getLogs, shrinks on errors
const LOG_CHUNK_MIN = 50n;

/* ---------- ABI bits (precomputed keccak) */

const SEL = {
    getUsersInfo: "0x0e17f292",     // getUsersInfo(address[])
    getUserInfo: "0x6386c1c7",      // getUserInfo(address)
    getOrdersLength: "0x07c2e16c",  // getOrdersLength()
    orders: "0xa85c38ef",           // orders(uint256)
    balanceOf: "0x70a08231",        // balanceOf(address)
    symbol: "0x95d89b41",           // symbol()
    decimals: "0x313ce567",         // decimals()
};

const TOPIC = {
    Transfer: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
    Deposit: "0xdcbc1c05240f31ff3ad067ef1ee35ce4997762752e3a095284754544f4c709d7",
    Withdrawn: "0x91fb9d98b786c57d74c099ccd2beca1739e9f6a81fb49001ca465c4b7591bbe2",
    NewOrderPlace: "0x13db689eebfc80b695adafe299c29984cce76e245afffdca4a284d9c6698f929",
    MatchOrder: "0x964671a496d19c13e768ac4046fdf6a327fe1ca27fd658573666534fd25938a7",
    RevokedOrder: "0x3c25a00bf87f3cdd41e39de9ec92e951d5710876d057b9a30336a73c6783980b",
};

// Which indexed topics hold a user address, per LimitOrder event
const USER_TOPICS = {
    [TOPIC.Deposit]: [2],           // (tokenAddress, account)
    [TOPIC.Withdrawn]: [2],         // (tokenAddress, account)
    [TOPIC.NewOrderPlace]: [1],     // (owner, tokenDemand, tokenSupply)
    [TOPIC.MatchOrder]: [1, 2],     // (marker, owner, paymentToken)
    [TOPIC.RevokedOrder]: [1],      // (account)
};

/* ---------- rpc */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let rpcId = 0;

async function post(body) {
    for (let attempt = 1; ; attempt++) {
        try {
            const res = await fetch(RPC, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(body),
            });
            if (res.status === 429 || res.status >= 500) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (error) {
            if (attempt >= 4) throw error;
            await sleep(500 * 2 ** attempt);
        }
    }
}

async function rpc(method, params) {
    const json = await post({ jsonrpc: "2.0", id: ++rpcId, method, params });
    if (json.error) throw new Error(`${method}: ${json.error.message ?? JSON.stringify(json.error)}`);
    return json.result;
}

// Sends many calls as JSON-RPC batches; falls back to one by one if the RPC has no batch support
let isBatchOk = true;
async function rpcMany(calls) {
    const results = [];
    for (let i = 0; i < calls.length; i += RPC_BATCH) {
        const part = calls.slice(i, i + RPC_BATCH);
        if (isBatchOk) {
            const body = part.map(([method, params]) => ({ jsonrpc: "2.0", id: ++rpcId, method, params }));
            const json = await post(body).catch(() => null);
            if (Array.isArray(json) && json.length === part.length && json.every((x) => !x.error)) {
                const byId = new Map(json.map((x) => [x.id, x.result]));
                results.push(...body.map((x) => byId.get(x.id)));
                continue;
            }
            isBatchOk = false;
            console.warn("  RPC batch not usable, sending one by one");
        }
        for (const [method, params] of part) results.push(await rpc(method, params));
    }
    return results;
}

/* ---------- abi helpers */

const hexToBig = (hex) => BigInt(hex === "0x" ? 0 : hex);
const pad32 = (v) => BigInt(v).toString(16).padStart(64, "0");
const padAddr = (a) => a.toLowerCase().replace(/^0x/, "").padStart(64, "0");
const words = (hex) => hex.replace(/^0x/, "").match(/.{64}/g) ?? [];
const wordAddr = (w) => "0x" + w.slice(24);
const isAddressTopic = (t) => typeof t === "string" && /^0x0{24}[0-9a-f]{40}$/i.test(t);
const topicAddr = (t) => "0x" + t.slice(26).toLowerCase();

const ethCall = (to, data, block) => rpc("eth_call", [{ to, data }, block]);

function encodeUsersInfo(accounts) {
    return SEL.getUsersInfo + pad32(32) + pad32(accounts.length) + accounts.map(padAddr).join("");
}

// UserInfo is all static words: account, tokenA(5), tokenB(5), orderCount, ordersScanned
const USER_INFO_WORDS = 13;
function decodeUsersInfo(hex) {
    const w = words(hex);
    if (w.length < 2) throw new Error("getUsersInfo returned no data");
    const start = Number(BigInt("0x" + w[0]) / 32n);
    const length = Number(BigInt("0x" + w[start]));
    const out = [];
    for (let i = 0; i < length; i++) {
        const s = start + 1 + i * USER_INFO_WORDS;
        const n = (k) => BigInt("0x" + w[s + k]);
        out.push({
            account: wordAddr(w[s]),
            a: { wallet: n(2), inContract: n(3), inOrders: n(4), wantInOrders: n(5) },
            b: { wallet: n(7), inContract: n(8), inOrders: n(9), wantInOrders: n(10) },
            orderCount: n(11),
            ordersScanned: n(12),
        });
    }
    return out;
}

// getUserInfo returns (UserInfo, Order[]): UserInfo is the first 13 static words
function decodeUserInfo(hex) {
    const w = words(hex);
    if (w.length < USER_INFO_WORDS) throw new Error("getUserInfo returned no data");
    const n = (k) => BigInt("0x" + w[k]);
    return {
        account: wordAddr(w[0]),
        a: { wallet: n(2), inContract: n(3), inOrders: n(4), wantInOrders: n(5) },
        b: { wallet: n(7), inContract: n(8), inOrders: n(9), wantInOrders: n(10) },
        orderCount: n(11),
        ordersScanned: n(12),
    };
}

function decodeString(hex) {
    const w = words(hex);
    if (w.length === 1) return Buffer.from(w[0], "hex").toString("utf8").replace(/\0+$/, ""); // bytes32 tokens
    const length = Number(BigInt("0x" + w[1]));
    return Buffer.from(w.slice(2).join(""), "hex").subarray(0, length).toString("utf8");
}

/* ---------- steps */

async function tokenMeta(address, block) {
    const [symbolHex, decimalsHex] = await rpcMany([
        ["eth_call", [{ to: address, data: SEL.symbol }, block]],
        ["eth_call", [{ to: address, data: SEL.decimals }, block]],
    ]);
    return { address, symbol: decodeString(symbolHex), decimals: Number(hexToBig(decimalsHex)) };
}

async function scanLogs(address, topics, toBlock, onLog) {
    let from = START_BLOCK[address];
    let chunk = LOG_CHUNK_MAX;
    let count = 0;
    while (from <= toBlock) {
        const to = from + chunk - 1n > toBlock ? toBlock : from + chunk - 1n;
        try {
            const logs = await rpc("eth_getLogs", [{
                address, topics, fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16),
            }]);
            logs.forEach(onLog);
            count += logs.length;
            from = to + 1n;
            if (chunk < LOG_CHUNK_MAX) chunk *= 2n;
            process.stdout.write(`\r  ${address.slice(0, 8)}… block ${to} / ${toBlock}  logs ${count}   `);
        } catch (error) {
            if (chunk <= LOG_CHUNK_MIN) throw error;
            chunk /= 4n;
            if (chunk < LOG_CHUNK_MIN) chunk = LOG_CHUNK_MIN;
        }
    }
    process.stdout.write("\n");
}

async function readOrders(block) {
    const length = Number(hexToBig(await ethCall(LIMIT_ORDER, SEL.getOrdersLength, block)));
    const calls = Array.from({ length }, (_, i) => ["eth_call", [{ to: LIMIT_ORDER, data: SEL.orders + pad32(i) }, block]]);
    const results = await rpcMany(calls);
    return results.map((hex, index) => {
        const w = words(hex);
        return [index, BigInt("0x" + w[0]).toString(), wordAddr(w[1]), wordAddr(w[2]), wordAddr(w[3]),
            BigInt("0x" + w[4]).toString(), BigInt("0x" + w[5]).toString()];
    });
}

// Picks the reader call to use: getUsersInfo (10 addresses per call) or, if the deployed
// reader lacks it, getUserInfo one address at a time. Fails early with a clear reason.
async function checkReader(block) {
    const code = await rpc("eth_getCode", [READER, block]);
    if (!code || code === "0x") {
        throw new Error(`VITE_READER_ADDRESS ${READER} is not a contract on this chain at block ${BigInt(block)}. Put the Proxy address of LimitOrderReader in .env.`);
    }
    const probe = LIMIT_ORDER;
    const many = await ethCall(READER, encodeUsersInfo([probe]), block).catch(() => "0x");
    if (words(many).length >= 2 + USER_INFO_WORDS) return "many";
    const one = await ethCall(READER, SEL.getUserInfo + padAddr(probe), block).catch(() => "0x");
    if (words(one).length >= USER_INFO_WORDS) {
        console.warn("  reader has no getUsersInfo, reading one address per call");
        return "one";
    }
    throw new Error(`${READER} answers neither getUsersInfo nor getUserInfo. Is it the Proxy of LimitOrderReader, and was the Proxy deployed with the engine address?`);
}

async function readUsers(accounts, block, mode) {
    const out = [];
    if (mode === "one") {
        const calls = accounts.map((a) => ["eth_call", [{ to: READER, data: SEL.getUserInfo + padAddr(a) }, block]]);
        for (let i = 0; i < calls.length; i += RPC_BATCH) {
            (await rpcMany(calls.slice(i, i + RPC_BATCH))).forEach((hex) => out.push(decodeUserInfo(hex)));
            process.stdout.write(`\r  read ${Math.min(i + RPC_BATCH, calls.length)} / ${calls.length}   `);
        }
        process.stdout.write("\n");
        return out;
    }
    for (let i = 0; i < accounts.length; i += USERS_PER_CALL) {
        const part = accounts.slice(i, i + USERS_PER_CALL);
        const hex = await ethCall(READER, encodeUsersInfo(part), block);
        const infos = decodeUsersInfo(hex);
        if (infos.length !== part.length) throw new Error(`getUsersInfo returned ${infos.length} results for ${part.length} addresses`);
        out.push(...infos);
        process.stdout.write(`\r  read ${Math.min(i + USERS_PER_CALL, accounts.length)} / ${accounts.length}   `);
    }
    process.stdout.write("\n");
    return out;
}

async function main() {
    if (!/^0x[0-9a-fA-F]{40}$/.test(READER ?? "")) throw new Error("Set VITE_READER_ADDRESS in .env (Proxy of LimitOrderReader).");

    const chainId = Number(hexToBig(await rpc("eth_chainId", [])));
    const blockNumber = SNAPSHOT_BLOCK ? BigInt(SNAPSHOT_BLOCK) : hexToBig(await rpc("eth_blockNumber", []));
    const block = "0x" + blockNumber.toString(16);
    const blockInfo = await rpc("eth_getBlockByNumber", [block, false]);
    console.log(`chain ${chainId}, snapshot block ${blockNumber}`);
    const readerMode = await checkReader(block);

    const accounts = new Set();
    const add = (a) => a && accounts.add(a.toLowerCase());

    for (const token of [TOKEN_A, TOKEN_B]) {
        console.log(`scan Transfer of ${token}`);
        await scanLogs(token, [TOPIC.Transfer], blockNumber, (log) => {
            if (isAddressTopic(log.topics[1])) add(topicAddr(log.topics[1]));
            if (isAddressTopic(log.topics[2])) add(topicAddr(log.topics[2]));
        });
    }

    console.log("scan LimitOrder events");
    await scanLogs(LIMIT_ORDER, [Object.keys(USER_TOPICS)], blockNumber, (log) => {
        (USER_TOPICS[log.topics[0]] ?? []).forEach((k) => isAddressTopic(log.topics[k]) && add(topicAddr(log.topics[k])));
    });

    console.log("read open orders");
    const orders = await readOrders(block);
    orders.forEach((o) => add(o[2]));

    if (existsSync(EXTRA_FILE)) {
        const extra = (await readFile(EXTRA_FILE, "utf8")).match(/0x[0-9a-fA-F]{40}/g) ?? [];
        extra.forEach(add);
        console.log(`added ${extra.length} from ${EXTRA_FILE}`);
    }

    accounts.delete("0x0000000000000000000000000000000000000000");
    const list = [...accounts];
    console.log(`${list.length} addresses found, reading balances`);

    const infos = await readUsers(list, block, readerMode);
    const ordersScanned = infos[0]?.ordersScanned ?? 0n;
    if (ordersScanned !== BigInt(orders.length)) {
        console.warn(`  warning: reader scanned ${ordersScanned} orders, direct read found ${orders.length}`);
    }

    const has = (x) => x.wallet + x.inContract + x.inOrders > 0n;
    const kept = infos.filter((u) => has(u.a) || has(u.b));

    console.log(`check which of ${kept.length} addresses are contracts`);
    const codes = await rpcMany(kept.map((u) => ["eth_getCode", [u.account, block]]));

    const stuck = (x) => x.inContract + x.inOrders;
    kept.forEach((u, i) => { u.isContract = codes[i] !== "0x"; });
    kept.sort((x, y) => {
        const d = stuck(y.a) - stuck(x.a) || stuck(y.b) - stuck(x.b) || y.a.wallet - x.a.wallet || y.b.wallet - x.b.wallet;
        return d > 0n ? 1 : d < 0n ? -1 : 0;
    });

    const [metaA, metaB] = [await tokenMeta(TOKEN_A, block), await tokenMeta(TOKEN_B, block)];
    const [heldA, heldB] = (await rpcMany([
        ["eth_call", [{ to: TOKEN_A, data: SEL.balanceOf + padAddr(LIMIT_ORDER) }, block]],
        ["eth_call", [{ to: TOKEN_B, data: SEL.balanceOf + padAddr(LIMIT_ORDER) }, block]],
    ])).map(hexToBig);

    const sum = (key, field) => kept.reduce((t, u) => t + u[key][field], 0n);
    const s = (v) => v.toString();

    const snapshot = {
        version: 1,
        chainId,
        block: Number(blockNumber),
        blockTime: Number(hexToBig(blockInfo.timestamp)),
        generatedAt: Math.floor(Date.now() / 1000),
        contracts: { limitOrder: LIMIT_ORDER, reader: READER.toLowerCase() },
        tokens: [{ key: "a", ...metaA }, { key: "b", ...metaB }],
        // Tokens LimitOrder really holds vs what it owes users (balance + open orders)
        reconcile: {
            a: { held: s(heldA), owed: s(sum("a", "inContract") + sum("a", "inOrders")) },
            b: { held: s(heldB), owed: s(sum("b", "inContract") + sum("b", "inOrders")) },
        },
        columns: ["address", "isContract", "aWallet", "aInContract", "aInOrders", "aWant", "bWallet", "bInContract", "bInOrders", "bWant", "orderCount"],
        users: kept.map((u) => [u.account, u.isContract,
            s(u.a.wallet), s(u.a.inContract), s(u.a.inOrders), s(u.a.wantInOrders),
            s(u.b.wallet), s(u.b.inContract), s(u.b.inOrders), s(u.b.wantInOrders), Number(u.orderCount)]),
        orderColumns: ["index", "id", "owner", "tokenDemand", "tokenSupply", "amountDemand", "amountSupply"],
        orders,
    };

    await mkdir(OUT_FILE.split("/").slice(0, -1).join("/") || ".", { recursive: true });
    await writeFile(OUT_FILE, JSON.stringify(snapshot));
    console.log(`wrote ${OUT_FILE}: ${kept.length} addresses, ${orders.length} open orders`);
    console.log(`reconcile ${metaA.symbol}: held ${heldA} owed ${snapshot.reconcile.a.owed}`);
    console.log(`reconcile ${metaB.symbol}: held ${heldB} owed ${snapshot.reconcile.b.owed}`);
}

main().catch((error) => {
    const text = String(error?.message ?? error);
    console.error("\nsnapshot failed:", text);
    if (/missing trie|state.*not available|header not found|pruned/i.test(text)) {
        console.error("This RPC has no state for that block. Use an archive RPC in SNAPSHOT_RPC, or leave SNAPSHOT_BLOCK empty.");
    }
    process.exit(1);
});
