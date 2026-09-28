# Failure Log

## [2026-06-23] -- Guard long-lived content script runtime calls after extension reload

When a Chrome/Edge MV3 extension is reloaded, old content script instances can keep page timers/listeners alive while their extension context is invalidated. Do not leave direct `chrome.runtime.sendMessage`, `chrome.storage.*`, or long-lived `setInterval` calls in content scripts. Route them through a guard that detects "Extension context invalidated", clears intervals, and stops sending messages silently.
