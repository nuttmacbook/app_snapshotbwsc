import { readSnapshot } from '../componants/snapshot';
import { renderHeader } from '../componants/header';
import { CARD } from '../componants/ui';
import { getSnap, setSnap } from './shared';
import { renderLookupPage, mountLookup } from './lookup';
import { renderHoldersPage, mountHolders } from './holders';

/* ---------- render */

export function renderPages(data) {
    setSnap(data?.snapshot ? readSnapshot(data.snapshot) : null);
    const snap = getSnap();

    if (!snap) {
        return /*html*/`
            ${renderHeader(null)}
            <main class="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
                <div class="${CARD}">
                    <p class="font-semibold text-white">Balances are not published yet.</p>
                    <p class="mt-1 text-zinc-400">Check back soon. The list goes up once the snapshot block is taken.</p>
                </div>
            </main>
        `;
    }

    const counts = {
        users: snap.totals.users.count,
        stuck: snap.totals.users.stuckCount,
        orders: snap.orders.length,
    };

    return /*html*/`
        ${renderHeader(snap.meta, counts)}
        <main class="mx-auto max-w-6xl space-y-6 px-4 pb-24 sm:px-6">
            ${renderLookupPage(snap)}
            ${renderHoldersPage(snap)}
        </main>
        <footer class="border-t border-white/[0.06] py-8 text-center text-[12px] text-zinc-500">
            Balances read from Gnosis at block #${snap.meta.block.toLocaleString('en-US')} · Bluewolfchain
        </footer>
    `;
}

export function mountPages() {
    const snap = getSnap();
    if (!snap) return;
    mountLookup(snap);
    mountHolders(snap);
}
