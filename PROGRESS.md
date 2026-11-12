
## Provider tabs (Monitoring)
- Monitoring page now shows upstream-provider tabs (All / each provider / Unassigned) with per-provider device counts; clicking a tab filters the live grid + recomputes the KPI row and persists the choice (localStorage td-provider). Tabs stay hidden until >1 provider exists.
- Devices carry an optional `provider` field: editable from the device detail panel (new Tower details section: provider + location), saved via PUT /api/devices/:id + devices.edit, surfaced in monitor snapshot and demo data.
- Verified in demo mode (All 7 / HRINS core 5 / Horizon Telecom 2, filtering + KPI recompute correct). npm test + 605/605 QA pass.


## New KPI row (Monitoring)
- Replaced the Avg Latency KPI with three tower-focused metrics: Total Traffic (sum of RX+TX across online devices' interfaces, humanized bps), Sectors (count of role=sector, sub-label shows how many are online), and Subscribers (sum of connected clients/stations across sectors). Devices / Online / Offline retained -> 6-card row.
- All KPIs recompute against the active provider-tab filter. Verified in demo mode: All = 7 dev / 1.26 Gbps / 3 sectors (2 online) / 9 subscribers; Horizon Telecom = 2 dev / 1 sector / 0 subs. npm test + 605/605 QA pass.


## RADIUS/SAS subscribers
- New src/subscribers.js normalises customer sessions from a RADIUS/SAS source into one shape (username, name, plan + rate, online, framed IP, MAC, NAS/sector, session time, bytes down/up, live rate, signal). Sources: demo (deterministic, advances over time), mikrotik (PPP active via existing transport, fully defensive -> empty + note on failure), freeradius (documented stub, no DB driver bundled to stay offline). Config in data/radius.json with the server secret encrypted at rest; never returned.
- Routes: GET /api/radius/subscribers (honours ?demo / TOWERDESK_DEMO), GET/POST /api/radius/config. Old /api/subscribers + CSV report left untouched.
- Rebuilt /sas (subscribers.html) into a live RADIUS session view: Online/Subscribers/Download/Upload KPI row, source banner, All/Online/Offline filter + search, session table with status, plan+rate, IP, sector/NAS, session time, data used and live rate; polls every 8s. Added .status-badge.offline + .source-banner CSS.
- No new dependencies. test/subscribers.js added to npm test (24 assertions). Verified in demo mode (24 subs, 13 online, 190 Mbps down; Offline filter correct). npm test + 605/605 QA pass.


## RADIUS settings UI
- Added a Connect server panel to /sas: pick Source (Not connected / Demo / MikroTik NAS / FreeRADIUS), with Host, Port, Username, Password (leave blank to keep) and Sector/NAS label revealed only for the server sources. Prefills from GET /api/radius/config, saves via POST, then re-polls so the table reflects the new source immediately.
- Fixed src/subscribers.js setConfig so 'none' is a valid source (operator can disconnect); previously it fell back to demo. Added disconnect assertions to test/subscribers.js.
- Verified end-to-end in a non-demo server: unconfigured empty state -> open panel -> MikroTik reveals fields -> save Demo -> page fills with 24 live sessions; then reset to none. npm test + 605/605 QA pass.


## SQLite history store
- New src/history.js persists one sample per device per poll (online, latency, rx/tx, cpu) to data/history.db. Dependency choice: Node's built-in node:sqlite (DatabaseSync) on Node 24 — real SQLite with ZERO npm dependency added and nothing to compile, so the portable build stays self-contained. The one experimental warning is suppressed; on very old Node the store self-disables and the app still runs. TOWERDESK_HISTORY=off disables it (used by the devices test + QA server so their temp data dirs stay unlocked on Windows).
- monitor.js records each poll and, on (re)start, seeds every device's live sparkline from history.recent() so traffic/uptime no longer start blank after a restart. Snapshot gained uptime24hPct; pruning drops samples past a 7-day window and for removed devices (also history.forget on device delete). New route GET /api/history/:id.
- test/history.js proves record/recent/uptime/forget/prune AND persistence across a close-reopen (restart). Verified end-to-end: added a ping device, recorded 3 samples, restarted -> 4 samples, snapshot sparkline seeded (len 5), then cleaned up. npm test + 605/605 QA pass.


## Portable build + self-updater
- scripts/make-portable.ps1 (npm run build:portable) assembles dist/TowerDesk: app/ (never data/, tests or VCS), a bundled node\node.exe runtime, and launchers; -Zip also produces dist/TowerDesk-portable.zip (~40 MB). End user installs nothing — unzip and double-click TowerDesk.cmd (or TowerDesk-no-window.vbs) to run at http://localhost:3000, fully offline.
- src/updater.js: operator sets a GitHub repo (owner/name) or manifest URL; check() compares the published version, stage() downloads + unpacks (via Windows built-in tar, no npm dep) and stages the new files; the launcher applies the staged update on next start with robocopy, leaving app/data untouched. No npm dependency added. check/install return 200 with an {error} field so the SPA shows failures inline (and QA click-everything stays clean).
- New /settings page (Software updates panel + About tiles), wired from the sidebar Settings link; added to QA routes. Routes: GET /api/update/status|config, POST /api/update/config|check|install|cancel.
- test/updater.js (17 assertions: version compare, release parsing, config, staging incl nested-folder + foreign-bundle + smuggled-data/ guards). Verified end-to-end: built dist, bundled node served /settings + /api/update/status, simulated a staged update -> apply preserved data/secret.key and bumped version, error path shows inline. npm test + 655/655 QA pass.


## Git repository + private-repo updater token
- Project is a git repo (branch main), pushed to a private GitHub repository. `.gitignore` also excludes `tests/qa/screenshots/` (regenerated every QA run).
- Updater: optional access token for private repositories. Stored encrypted in data/update.json via the existing storage.encrypt; never returned by the API (only `hasToken`), never logged. Blank save keeps it; "Remove saved token" clears it.
- The token is only attached to HTTPS requests to api.github.com (`requestHeaders`), so a manifest URL or a caller-supplied download URL cannot leak it. With a token, downloads use the release asset's API URL (octet-stream) or the zipball.
- Clearer 401/404 messages (404 without a token hints that the repo may be private).
- No dependency added. test/updater.js: 12 new assertions. npm test + QA 655/655 pass.
- Version bumped to 0.1.1 (first build with the updater token field); portable zip rebuilt.
- 0.1.2: updater's stageFromDir also accepts the portable zip layout (app\ or TowerDesk\app\), staging only the app; so the portable zip can be attached to a release as the update bundle. 3 new assertions; verified by extracting the real built zip and staging it.
