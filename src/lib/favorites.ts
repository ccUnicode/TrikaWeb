export function getFavorites(): number[] {
    if (typeof window === "undefined") return [];
    try {
        const stored = localStorage.getItem("trikaweb:favorites");
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
}

export function isFavorite(id: number): boolean {
    const favs = getFavorites();
    return favs.includes(id);
}

export function toggleFavorite(id: number): void {
    const favs = getFavorites();
    const index = favs.indexOf(id);
    if (index >= 0) {
        favs.splice(index, 1);
    } else {
        favs.push(id);
    }
    localStorage.setItem("trikaweb:favorites", JSON.stringify(favs));

    // Dispatch custom event for UI updates
    window.dispatchEvent(new CustomEvent("favorites:updated", { detail: { id, active: index === -1 } }));
}
