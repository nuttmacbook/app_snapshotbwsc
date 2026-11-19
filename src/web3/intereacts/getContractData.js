/**
 * Loads the frozen snapshot (public/snapshot.json). No RPC call on page load:
 * every visitor sees the same numbers, taken at one block.
 *
 * @param {object} wallet  current wallet state (unused, kept for the safeRenderApp contract)
 * @returns {Promise<{snapshot: object|null, error: string|null, fetchedAt: number}>}
 */
export async function getContractData(wallet) {
    const fetchedAt = Date.now() / 1000;
    try {
        const res = await fetch("/snapshot.json", { cache: "no-cache" });
        if (!res.ok) return { snapshot: null, error: "missing", fetchedAt };
        const snapshot = await res.json();
        return { snapshot, error: null, fetchedAt };
    } catch {
        return { snapshot: null, error: "missing", fetchedAt };
    }
}
