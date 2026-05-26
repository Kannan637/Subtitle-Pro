function deleteIndexedDb(name: string): Promise<void> {
    return new Promise((resolve) => {
        if (typeof window === 'undefined' || !('indexedDB' in window)) {
            resolve();
            return;
        }
        const request = window.indexedDB.deleteDatabase(name);
        request.onsuccess = () => resolve();
        request.onerror = () => resolve();
        request.onblocked = () => resolve();
    });
}

export async function clearFirebaseBrowserStorage(): Promise<void> {
    if (typeof window === 'undefined') return;

    for (const storage of [window.localStorage, window.sessionStorage]) {
        const keysToRemove: string[] = [];
        for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index);
            if (key?.toLowerCase().includes('firebase')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach((key) => storage.removeItem(key));
    }

    await deleteIndexedDb('firebaseLocalStorageDb');
}
