import { CARD, escapeHtml } from '../componants/ui';

// Shared by pages/index.js and every page folder. Kept apart from pages/index.js because
// page modules bind window handlers on load, before pages/index.js finishes evaluating.

// Wraps window handlers so an error shows instead of failing silently
export const guard = (fn) => async (...args) => {
    try {
        return await fn(...args);
    } catch (error) {
        console.error(error);
        const box = document.querySelector('[data-live-result]') ?? document.querySelector('[data-lookup-result]');
        if (box) box.innerHTML = `<div class="mt-3 rounded-xl border border-rose-400/20 bg-rose-400/[0.06] p-3 text-[13px] text-rose-300">Could not read this. Try again in a moment. (${escapeHtml(error?.message ?? error)})</div>`;
    }
};

let snap = null;
export const getSnap = () => snap;
export const setSnap = (value) => { snap = value; };
