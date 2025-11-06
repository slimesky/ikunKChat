const LAST_READ_VERSION_KEY = 'kchat-last-read-version';
// --- Update Notification ---
export const loadLastReadVersion = (): string | null => {
    try {
        return localStorage.getItem(LAST_READ_VERSION_KEY);
    } catch (error) {
        console.error("Failed to load last read version from localStorage", error);
        return null;
    }
};

export const saveLastReadVersion = (version: string) => {
    try {
        localStorage.setItem(LAST_READ_VERSION_KEY, version);
    } catch (error) {
        console.error("Failed to save last read version to localStorage", error);
    }
};