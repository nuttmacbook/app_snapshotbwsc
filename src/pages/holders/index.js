import { filterUsers, toCsv } from '../../componants/snapshot';
import { BUTTON, CARD, EYEBROW, LABEL, badge, money, short, escapeHtml } from '../../componants/ui';
import { guard, getSnap } from '../shared';

const PAGE_SIZE = 50;
const view = { query: '', filter: 'all', sort: 'totalA', hideContracts: true, page: 0 };

const SELECT = "min-h-11 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[13px] text-zinc-200 focus:border-brand-400/60 focus:outline-none";

/* ---------- handlers */

window.holdersSet = guard(async (key, value) => {
    view[key] = value;
    view.page = 0;
    paintResults();
});

window.holdersPage = guard(async (page) => {
    view.page = page;
    paintResults();
    document.querySelector('[data-holders]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

window.downloadCsv = guard(async () => {
    const s = getSnap();
    const csv = toCsv(s.users, s.tokens);
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `limitorder-snapshot-${s.meta.block}.csv` });
    a.click();
    URL.revokeObjectURL(url);
});

/* ---------- render */

export function renderHoldersPage(snap) {
    const { a: A, b: B } = snap.tokens;
    const t = snap.totals.users;

    const stat = (label, value, token, color) => /*html*/`
        <div class="min-w-0 px-5 py-5">
            <p class="${LABEL}">${label}</p>
            <p class="num mt-2 truncate font-mono text-[20px] tracking-tight ${color}">${money(value, token.decimals, 2)}</p>
        </div>
    `;

    const check = (k, token) => {
        const r = snap.meta.reconcile[k];
        const diff = r.held - r.owed;
        const state = diff === 0n
            ? `<span class="text-mint-400">Matches</span>`
            : diff > 0n
                ? `<span class="text-mint-400">Surplus ${money(diff, token.decimals, 2)}</span>`
                : `<span class="text-rose-300">Short ${money(-diff, token.decimals, 2)}</span>`;
        return /*html*/`
            <li class="flex flex-wrap items-baseline justify-between gap-2">
                <span><span class="font-mono text-zinc-300">${escapeHtml(token.symbol)}</span> · LimitOrder holds
                <span class="num font-mono text-zinc-300">${money(r.held, token.decimals, 2)}</span>
                · owed to users <span class="num font-mono text-zinc-300">${money(r.owed, token.decimals, 2)}</span></span>
                ${state}
            </li>
        `;
    };

    return /*html*/`
        <section id="holders" data-holders class="${CARD} scroll-mt-24">
            <div class="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <p class="${EYEBROW}">Snapshot</p>
                    <h2 class="mt-3 text-[26px] font-semibold leading-[1.1] tracking-[-0.03em] text-white sm:text-[32px]">Every address.</h2>
                    <p class="mt-2 text-[14px] text-zinc-400">${t.count.toLocaleString('en-US')} addresses · ${t.stuckCount.toLocaleString('en-US')} with tokens in LimitOrder</p>
                </div>
                <button class="${BUTTON.ghost}" onclick="window.downloadCsv()">↓ Download CSV</button>
            </div>

            <div class="mt-6 grid grid-cols-2 divide-white/[0.06] rounded-2xl border border-white/[0.07] bg-ink-950/60 lg:grid-cols-4 lg:divide-x [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-white/[0.06] lg:[&>*:nth-child(-n+2)]:border-b-0">
                ${stat(`${escapeHtml(A.symbol)} to migrate`, t.a.total, A, 'text-token-a')}
                ${stat(`${escapeHtml(A.symbol)} in LimitOrder`, t.a.stuck, A, 'text-white')}
                ${stat(`${escapeHtml(B.symbol)} to migrate`, t.b.total, B, 'text-token-b')}
                ${stat(`${escapeHtml(B.symbol)} in LimitOrder`, t.b.stuck, B, 'text-white')}
            </div>

            <ul class="mt-4 space-y-1.5 text-[12px] text-zinc-500">
                ${check('a', A)}
                ${check('b', B)}
                <li>Contract addresses (${snap.totals.contracts.count}), such as LimitOrder itself, are left out of the totals so nothing is counted twice.</li>
            </ul>

            <div class="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <input data-holders-query autocomplete="off" spellcheck="false" placeholder="Filter by address"
                    oninput="window.holdersSet('query', this.value)"
                    class="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-3 font-mono text-zinc-100 placeholder:text-zinc-600 focus:border-brand-400/60 focus:outline-none" />
                <select onchange="window.holdersSet('filter', this.value)" class="${SELECT}">
                    <option value="all" selected>All holders</option>
                    <option value="stuck">Tokens in LimitOrder</option>
                    <option value="orders">Has open orders</option>
                </select>
                <select onchange="window.holdersSet('sort', this.value)" class="${SELECT}">
                    <option value="totalA" selected>Most ${escapeHtml(A.symbol)} to migrate</option>
                    <option value="totalB">Most ${escapeHtml(B.symbol)} to migrate</option>
                    <option value="stuckA">Most ${escapeHtml(A.symbol)} in LimitOrder</option>
                    <option value="stuckB">Most ${escapeHtml(B.symbol)} in LimitOrder</option>
                </select>
                <label class="flex min-h-11 items-center gap-2 px-1 text-[13px] text-zinc-400">
                    <input type="checkbox" class="size-4 accent-brand-500" onchange="window.holdersSet('hideContracts', !this.checked)" />
                    Show contracts
                </label>
            </div>

            <div data-holders-results class="mt-4"></div>
        </section>
    `;
}

export function mountHolders() {
    paintResults();
}

// Repaints only the results box, so typing in the filter keeps focus
function paintResults() {
    const box = document.querySelector('[data-holders-results]');
    const snap = getSnap();
    if (!box || !snap) return;

    const list = filterUsers(snap.users, view);
    const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const page = Math.min(view.page, pages - 1);
    const rows = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const { a: A, b: B } = snap.tokens;

    const cell = (v, token, tone = 'text-zinc-400') => `<td class="num whitespace-nowrap py-2.5 pl-3 text-right font-mono ${tone}">${v > 0n ? money(v, token.decimals, 2) : '<span class="text-zinc-700">0</span>'}</td>`;

    const body = rows.map((u, i) => /*html*/`
        <tr class="cursor-pointer border-t border-white/[0.06] transition hover:bg-white/[0.03]" onclick="window.pickAddress('${u.address}')">
            <td class="py-2.5 pr-2 font-mono text-[11px] text-zinc-600">${page * PAGE_SIZE + i + 1}</td>
            <td class="whitespace-nowrap py-2.5 font-mono text-brand-300"><span class="hidden 2xl:inline">${u.address}</span><span class="2xl:hidden">${short(u.address)}</span> ${u.isContract ? badge('contract', 'Contract') : ''}</td>
            ${cell(u.a.wallet, A)}${cell(u.a.inContract, A)}${cell(u.a.inOrders, A)}${cell(u.a.total, A, 'font-semibold text-token-a')}
            ${cell(u.b.wallet, B)}${cell(u.b.inContract, B)}${cell(u.b.inOrders, B)}${cell(u.b.total, B, 'font-semibold text-token-b')}
        </tr>
    `).join('');

    // Phones get a card per address; the 10-column table needs a wide screen
    const cards = rows.map((u, i) => /*html*/`
        <li>
            <button class="w-full rounded-2xl border border-white/[0.07] bg-ink-950/60 p-4 text-left transition hover:bg-white/[0.03]" onclick="window.pickAddress('${u.address}')">
                <span class="flex items-center justify-between gap-2">
                    <span class="font-mono text-[13px] text-brand-300">${short(u.address)} ${u.isContract ? badge('contract', 'Contract') : ''}</span>
                    <span class="font-mono text-[11px] text-zinc-600">#${page * PAGE_SIZE + i + 1}</span>
                </span>
                <span class="mt-3 grid grid-cols-2 gap-3">
                    <span><span class="${LABEL} block">${escapeHtml(A.symbol)} to migrate</span><span class="num mt-1 block font-mono text-[14px] font-semibold text-token-a">${money(u.a.total, A.decimals, 2)}</span><span class="num block font-mono text-[11px] text-zinc-500">${money(u.a.stuck, A.decimals, 2)} in LimitOrder</span></span>
                    <span><span class="${LABEL} block">${escapeHtml(B.symbol)} to migrate</span><span class="num mt-1 block font-mono text-[14px] font-semibold text-token-b">${money(u.b.total, B.decimals, 2)}</span><span class="num block font-mono text-[11px] text-zinc-500">${money(u.b.stuck, B.decimals, 2)} in LimitOrder</span></span>
                </span>
            </button>
        </li>
    `).join('');

    const pager = pages > 1 ? /*html*/`
        <div class="mt-4 flex items-center justify-between text-[13px] text-zinc-400">
            <button class="${BUTTON.small}" ${page === 0 ? 'disabled' : ''} onclick="window.holdersPage(${page - 1})">← Previous</button>
            <span class="font-mono text-[12px]">Page ${page + 1} / ${pages} · ${list.length.toLocaleString('en-US')} addresses</span>
            <button class="${BUTTON.small}" ${page >= pages - 1 ? 'disabled' : ''} onclick="window.holdersPage(${page + 1})">Next →</button>
        </div>
    ` : `<p class="mt-4 font-mono text-[12px] text-zinc-500">${list.length.toLocaleString('en-US')} addresses</p>`;

    box.innerHTML = list.length ? /*html*/`
        <ul class="space-y-2 md:hidden">${cards}</ul>
        <div class="hidden overflow-x-auto md:block">
            <table class="w-full min-w-[60rem] text-[13px]">
                <thead class="whitespace-nowrap ${LABEL}">
                    <tr>
                        <th></th><th></th>
                        <th colspan="4" class="pb-1 pl-3 text-right font-medium text-token-a">${escapeHtml(A.symbol)}</th>
                        <th colspan="4" class="pb-1 pl-3 text-right font-medium text-token-b">${escapeHtml(B.symbol)}</th>
                    </tr>
                    <tr class="text-right">
                        <th class="py-2 text-left font-normal">#</th><th class="py-2 text-left font-normal">Address</th>
                        <th class="py-2 pl-3 font-normal">Wallet</th><th class="py-2 pl-3 font-normal">Deposit</th><th class="py-2 pl-3 font-normal">Orders</th><th class="py-2 pl-3 font-normal text-zinc-300">To migrate</th>
                        <th class="py-2 pl-3 font-normal">Wallet</th><th class="py-2 pl-3 font-normal">Deposit</th><th class="py-2 pl-3 font-normal">Orders</th><th class="py-2 pl-3 font-normal text-zinc-300">To migrate</th>
                    </tr>
                </thead>
                <tbody>${body}</tbody>
            </table>
        </div>
        ${pager}
    ` : `<p class="py-10 text-center text-[14px] text-zinc-500">No address matches this filter.</p>`;
}
