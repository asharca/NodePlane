import { useSyncExternalStore } from "react";

export type Theme = "light" | "dark";
const STORAGE_KEY = "theme";
const CHANGE_EVENT = "nodeplane:theme-change";
let sessionTheme: Theme | null = null;

function storedTheme(): Theme | null {
	try {
		const value = window.localStorage.getItem(STORAGE_KEY);
		return value === "light" || value === "dark" ? value : sessionTheme;
	} catch {
		return sessionTheme;
	}
}
function getSnapshot(): Theme {
	return document.documentElement.classList.contains("dark") ? "dark" : "light";
}
function subscribe(notify: () => void) {
	const media = window.matchMedia?.("(prefers-color-scheme: dark)");
	const sync = () => {
		const next = storedTheme() ?? (media?.matches ? "dark" : "light");
		document.documentElement.classList.toggle("dark", next === "dark");
		notify();
	};
	const onStorage = (event: StorageEvent) => {
		if (event.key === STORAGE_KEY || event.key === null) {
			sessionTheme = null;
			sync();
		}
	};
	window.addEventListener(CHANGE_EVENT, notify);
	window.addEventListener("storage", onStorage);
	media?.addEventListener("change", sync);
	sync();
	return () => {
		window.removeEventListener(CHANGE_EVENT, notify);
		window.removeEventListener("storage", onStorage);
		media?.removeEventListener("change", sync);
	};
}
const getServerSnapshot = (): Theme => "light";
function toggleTheme() {
	const next = getSnapshot() === "dark" ? "light" : "dark";
	sessionTheme = next;
	document.documentElement.classList.toggle("dark", next === "dark");
	try {
		window.localStorage.setItem(STORAGE_KEY, next);
	} catch {
		/* Session-only when storage is unavailable. */
	}
	window.dispatchEvent(new Event(CHANGE_EVENT));
}
export function useTheme() {
	return {
		theme: useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot),
		toggle: toggleTheme,
	};
}
