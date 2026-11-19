import { getLiveUserInfo } from '../../web3/connect';
import { side, toOrder, orderPrice } from '../../componants/snapshot';
import { BUTTON, CARD, EYEBROW, LABEL, badge, money, short, isAddress, escapeHtml } from '../../componants/ui';
import { guard, getSnap } from '../shared';

/* ---------- handlers */

window.lookupAddress = guard(async (event) => {
    event?.preventDefault?.();
    const input = document.querySelector('[data-lookup-input]');
    showAddress(String(input?.value ?? '').trim());
});

window.pickAddress = guard(async (address) => {
    const input = document.querySelector('[data-lookup-input]');
    if (input) input.value = address;
    showAddress(address);
    document.querySelector('[data-lookup]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

window.liveCheck = guard(async (address) => {
    const box = document.querySelector('[data-live-result]');
    if (!box) return;
    box.innerHTML = `<p class="mt-4 text-[13px] text-zinc-500">Reading the chain…</p>`;
    const live = await getLiveUserInfo(address);
    const s = getSnap();
    const user = {
        a: side(live.a.wallet, live.a.inContract, live.a.inOrders, live.a.wantInOrders),
        b: side(live.b.wallet, live.b.inContract, live.b.inOrders, live.b.wantInOrders),
        orders: live.orders.map(toOrder),
    };
    box.innerHTML = /*html*/`
        <div class="rise mt-5 flex flex-wrap items-center gap-2">
            ${badge('live', 'Live now')}
            <span class="text-[12px] text-zinc-500">Read from Gnosis just now. The migration uses the snapshot above.</span>
        </div>
        ${renderBalances(s, user)}
        ${renderOrders(s, user.orders)}
    `;
});

window.copyText = guard(async (text, el) => {
    await navigator.clipboard.writeText(text);
    if (el) { const old = el.textContent; el.textContent = 'Copied'; setTimeout(() => { el.textContent = old; }, 1200); }
});

function showAddress(address) {
    const box = document.querySelector('[data-lookup-result]');
    if (!box) return;
    if (!isAddress(address)) {
        box.innerHTML = `<p class="mt-4 text-[13px] text-amber-300">That is not a valid address. It starts with 0x and has 42 characters.</p>`;
        return;
    }
    const url = new URL(location.href);
    url.searchParams.set('address', address);
    history.replaceState(null, '', url);
    box.innerHTML = renderResult(getSnap(), address.toLowerCase());
}

/* ---------- render */

export function renderLookupPage() {
    return /*html*/`
        <section id="lookup" data-lookup class="${CARD} scroll-mt-24">
            <p class="${EYEBROW}">Your balance</p>
            <h2 class="mt-3 text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[32px]">Find your address.</h2>
            <form class="mt-6 flex flex-col gap-2 sm:flex-row" onsubmit="window.lookupAddress(event)">
                <label class="sr-only" for="lookup-input">Your address</label>
                <input id="lookup-input" data-lookup-input autocomplete="off" spellcheck="false"
                    placeholder="0x… your Gnosis address"
                    class="min-h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-brand-400/60 focus:outline-none focus:ring-2 focus:ring-brand-400/30" />
                <button class="${BUTTON.primary}" type="submit">Check balance</button>
            </form>
            <div data-lookup-result></div>
        </section>
    `;
}

export function mountLookup() {
    const address = new URLSearchParams(location.search).get('address');
    if (!address) return;
    const input = document.querySelector('[data-lookup-input]');
    if (input) input.value = address;
    showAddress(address);
}

function renderResult(snap, address) {
    const user = snap.byAddress.get(address);
    const head = /*html*/`
        <div class="rise mt-6 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-5">
            <span class="break-all font-mono text-[13px] text-zinc-300">${address}</span>
            ${user?.isContract ? badge('contract', 'Contract') : ''}
        </div>
    `;
    const live = /*html*/`
        <div class="mt-6 border-t border-white/[0.06] pt-4">
            <button class="${BUTTON.small}" onclick="window.liveCheck('${address}')">↻ Check live balance</button>
            <div data-live-result></div>
        </div>
    `;

    if (!user) {
        return /*html*/`
            ${head}
            <p class="mt-3 text-zinc-200">This address is not in the snapshot.</p>
            <p class="mt-1 text-[14px] text-zinc-500">At block #${snap.meta.block.toLocaleString('en-US')} it held no ${escapeHtml(snap.tokens.a.symbol)} or ${escapeHtml(snap.tokens.b.symbol)}: nothing in the wallet, nothing in LimitOrder and no open orders.</p>
            ${live}
        `;
    }

    const isStuck = user.a.stuck > 0n || user.b.stuck > 0n;
    return /*html*/`
        ${head}
        <p class="mt-3">${isStuck ? badge('stuck', 'Tokens in LimitOrder') : badge('clean', 'Nothing in LimitOrder')}</p>
        ${renderBalances(snap, user)}
        ${renderOrders(snap, user.orders)}
        ${live}
    `;
}

function renderBalances(snap, user) {
    const { a: A, b: B } = snap.tokens;
    const total = (token, s, color) => /*html*/`
        <div class="min-w-0 px-5 py-5">
            <p class="${LABEL}">${escapeHtml(token.symbol)} to migrate</p>
            <p class="num mt-2 truncate font-mono text-[22px] font-semibold tracking-tight sm:text-[26px] ${color}">${money(s.total, token.decimals)}</p>
            <p class="mt-1 text-[12px] text-zinc-500">wallet + deposited + locked in orders</p>
        </div>
    `;
    return /*html*/`
        <div class="rise mt-5 grid grid-cols-1 divide-y divide-white/[0.06] rounded-2xl border border-brand-400/20 bg-brand-500/[0.06] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
            ${total(A, user.a, 'text-token-a')}
            ${total(B, user.b, 'text-token-b')}
        </div>
        <div class="rise mt-3 grid gap-3 md:grid-cols-2">
            ${tokenPanel(snap.tokens.a, user.a, 'text-token-a')}
            ${tokenPanel(snap.tokens.b, user.b, 'text-token-b')}
        </div>
    `;
}

function tokenPanel(token, s, color) {
    const row = (label, value, hint = '') => /*html*/`
        <div class="flex items-baseline justify-between gap-3 py-2.5">
            <dt class="text-[14px] text-zinc-400">${label}${hint ? `<span class="block text-[12px] text-zinc-600">${hint}</span>` : ''}</dt>
            <dd class="num font-mono text-[14px] text-zinc-100">${money(value, token.decimals)}</dd>
        </div>
    `;
    return /*html*/`
        <div class="rounded-2xl border border-white/[0.07] bg-ink-950/60 p-4 sm:p-5">
            <div class="flex items-center justify-between">
                <p class="font-mono text-[13px] font-medium uppercase tracking-[0.14em] ${color}">${escapeHtml(token.symbol)}</p>
                <button class="${BUTTON.small} font-mono" onclick="window.copyText('${token.address}', this)">${short(token.address)}</button>
            </div>
            <dl class="mt-2 divide-y divide-white/[0.06]">
                ${row('Wallet', s.wallet)}
                ${row('Deposited in LimitOrder', s.inContract, 'withdrawable')}
                ${row('Locked in open orders', s.inOrders, 'returns when the order is cancelled')}
                <div class="flex items-baseline justify-between gap-3 py-3">
                    <dt class="text-[14px] font-medium text-white">In LimitOrder<span class="block text-[12px] font-normal text-zinc-600">deposited + locked in orders</span></dt>
                    <dd class="num font-mono text-[16px] font-semibold ${color}">${money(s.stuck, token.decimals)}</dd>
                </div>
                <div class="flex items-baseline justify-between gap-3 py-3">
                    <dt class="text-[14px] font-medium text-white">Total to migrate<span class="block text-[12px] font-normal text-zinc-600">wallet + LimitOrder</span></dt>
                    <dd class="num font-mono text-[20px] font-semibold tracking-tight text-white">${money(s.total, token.decimals)}</dd>
                </div>
            </dl>
            ${s.wantInOrders > 0n ? `<p class="mt-2 text-[12px] text-zinc-500">Your open orders would bring in ${money(s.wantInOrders, token.decimals)} ${escapeHtml(token.symbol)} if fully filled. Not counted in the total.</p>` : ''}
        </div>
    `;
}

function renderOrders(snap, orders) {
    if (!orders.length) return `<p class="mt-5 text-[13px] text-zinc-500">No open orders.</p>`;
    const meta = (addr) => [snap.tokens.a, snap.tokens.b].find((x) => x.address.toLowerCase() === addr) ?? { symbol: short(addr), decimals: 18 };
    const rows = orders.map((o) => {
        const give = meta(o.tokenSupply), want = meta(o.tokenDemand);
        return /*html*/`
            <tr class="border-t border-white/[0.06]">
                <td class="py-2.5 pr-3 font-mono text-zinc-200">#${o.id}</td>
                <td class="py-2.5 pr-3 font-mono text-zinc-500">${o.index}</td>
                <td class="num py-2.5 pr-3 text-right font-mono text-zinc-100">${money(o.amountSupply, give.decimals)} <span class="text-zinc-500">${escapeHtml(give.symbol)}</span></td>
                <td class="num py-2.5 pr-3 text-right font-mono text-zinc-100">${money(o.amountDemand, want.decimals)} <span class="text-zinc-500">${escapeHtml(want.symbol)}</span></td>
                <td class="num py-2.5 text-right font-mono text-zinc-400">${orderPrice(o, want.decimals, give.decimals)}</td>
            </tr>
        `;
    }).join('');
    return /*html*/`
        <div class="rise mt-6">
            <p class="${LABEL}">Open orders · ${orders.length}</p>
            <div class="mt-2 overflow-x-auto">
                <table class="w-full min-w-[34rem] text-[13px]">
                    <thead class="${LABEL} text-left">
                        <tr><th class="py-2 pr-3 font-normal">Order</th><th class="py-2 pr-3 font-normal">Index</th><th class="py-2 pr-3 text-right font-normal">Selling</th><th class="py-2 pr-3 text-right font-normal">For</th><th class="py-2 text-right font-normal">Price</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        </div>
    `;
}
