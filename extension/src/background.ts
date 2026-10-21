// Service worker. Injects the creature on request (toolbar popup or keyboard shortcut) and keeps the
// "always on this site" and "every site" registrations in step with the settings.
import { FILES, NEVER, load } from "./settings";

const SITES_ID = "perch-sites";
const ALL_ID = "perch-all";

async function inject(tabId: number): Promise<void> {
  await chrome.scripting.executeScript({ target: { tabId }, files: FILES });
}

/** Show it on this tab, or hide it if it is already there. */
async function toggle(tabId: number): Promise<void> {
  try {
    const status = (await chrome.tabs.sendMessage(tabId, { type: "perch:toggle" })) as { active: boolean } | undefined;
    if (status) return;
  } catch { /* no content script yet */ }
  await inject(tabId);
}

/** Open the tuner panel on this tab (injecting the creature first if needed). */
async function customize(tabId: number): Promise<void> {
  try { await chrome.tabs.sendMessage(tabId, { type: "perch:status" }); } catch { await inject(tabId); }
  await chrome.tabs.sendMessage(tabId, { type: "perch:tuner" });
}

async function syncRegistrations(): Promise<void> {
  const s = await load();
  const existing = await chrome.scripting.getRegisteredContentScripts();
  const ids = existing.map((r) => r.id).filter((id) => id === SITES_ID || id === ALL_ID);
  if (ids.length) await chrome.scripting.unregisterContentScripts({ ids });
  const base = { js: FILES, runAt: "document_idle" as const, persistAcrossSessions: true, allFrames: false };
  const scripts: chrome.scripting.RegisteredContentScript[] = [];
  const everywhereOk = s.everywhere && (await chrome.permissions.contains({ origins: ["<all_urls>"] }));
  if (everywhereOk) scripts.push({ ...base, id: ALL_ID, matches: ["<all_urls>"], excludeMatches: NEVER });
  else if (s.sites.length) {
    const origins = s.sites.map((o) => `${o}/*`);
    const granted = [];
    for (const o of origins) if (await chrome.permissions.contains({ origins: [o] })) granted.push(o);
    if (granted.length) scripts.push({ ...base, id: SITES_ID, matches: granted });
  }
  if (scripts.length) await chrome.scripting.registerContentScripts(scripts);
}

chrome.runtime.onInstalled.addListener(() => void syncRegistrations());
chrome.runtime.onStartup.addListener(() => void syncRegistrations());
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && (changes.sites || changes.everywhere)) void syncRegistrations();
});
chrome.commands.onCommand.addListener((command, tab) => {
  if (tab?.id === undefined) return;
  const ignore = () => { /* a page Chrome does not allow */ };
  if (command === "toggle") void toggle(tab.id).catch(ignore);
  if (command === "customize") void customize(tab.id).catch(ignore);
});
