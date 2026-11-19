import { timeText, short, LABEL } from "./ui.js";

const SCAN = "https://gnosisscan.io";

/** Sticky top bar, same layout as bluewolfchain.com */
export function renderTopBar() {
    return /*html*/`
        <header class="sticky top-0 z-30 border-b border-white/[0.06] bg-ink-950/80 backdrop-blur-xl">
            <div class="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
                <a href="https://www.bluewolfchain.com/" class="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400">
                    <img src="/logo.svg" alt="" class="h-8 w-[30px] shrink-0 object-contain" />
                    <span class="truncate text-[15px] font-semibold tracking-tight text-white sm:text-base">Bluewolfchain</span>
                </a>
                <nav class="flex items-center gap-0.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1 text-[13px] font-medium">
                    <a href="#lookup" class="rounded-lg px-3 py-1.5 text-white hover:bg-white/[0.06]">Check</a>
                    <a href="#holders" class="rounded-lg px-3 py-1.5 text-zinc-400 hover:bg-white/[0.06] hover:text-white">All addresses</a>
                </nav>
            </div>
        </header>
    `;
}

/** Hero + snapshot stat strip */
export function renderHeader(meta, counts) {
    const link = (a) => a ? `<a class="hover:text-white" href="${SCAN}/address/${a}" target="_blank" rel="noopener">${short(a)}</a>` : "-";
    const stat = (label, value, note) => /*html*/`
        <div class="min-w-0 px-4 py-5 sm:px-6">
            <p class="${LABEL}">${label}</p>
            <p class="num mt-2 truncate font-mono text-[18px] tracking-tight text-white sm:text-[26px]">${value}</p>
            <p class="mt-1 truncate text-[12px] text-zinc-500">${note}</p>
        </div>
    `;
    return /*html*/`
        ${renderTopBar()}
        <section class="mx-auto max-w-6xl px-4 pb-8 pt-14 sm:px-6 sm:pt-20">
            <span class="inline-flex items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.03] py-1 pl-2 pr-3.5 font-mono text-[11px] uppercase tracking-[0.18em] text-zinc-300">
                <span class="size-1.5 rounded-full bg-mint-400"></span>Gnosis · LimitOrder migration
            </span>
            <h1 class="mt-7 text-[40px] font-semibold leading-[1.02] tracking-[-0.035em] text-white sm:text-[56px]">
                Check your tokens<br /><span class="brand-text">before the move.</span>
            </h1>
            <p class="mt-6 max-w-xl text-[16px] leading-relaxed text-zinc-400 sm:text-[17px]">
                Paste your Gnosis address to see what you hold: in your wallet, deposited in LimitOrder,
                and locked in open orders. These are the balances carried over to Bluewolfchain.
            </p>
            ${meta ? /*html*/`
            <div class="mt-12 grid grid-cols-2 divide-white/[0.06] rounded-3xl border border-white/[0.07] bg-ink-950/80 backdrop-blur lg:grid-cols-4 lg:divide-x [&>*:nth-child(-n+2)]:border-b [&>*:nth-child(-n+2)]:border-white/[0.06] lg:[&>*:nth-child(-n+2)]:border-b-0">
                ${stat("Snapshot block", `<a class="hover:text-brand-300" href="${SCAN}/block/${meta.block}" target="_blank" rel="noopener">#${meta.block.toLocaleString("en-US")}</a>`, timeText(meta.blockTime))}
                ${stat("Addresses", (counts?.users ?? 0).toLocaleString("en-US"), `${(counts?.stuck ?? 0).toLocaleString("en-US")} with tokens in LimitOrder`)}
                ${stat("Open orders", (counts?.orders ?? 0).toLocaleString("en-US"), "on LimitOrder at snapshot")}
                ${stat("Contracts", `<span class="text-[18px] sm:text-[20px]">${link(meta.limitOrder)}</span>`, `LimitOrder · reader ${link(meta.reader)}`)}
            </div>` : ""}
        </section>
    `;
}
