
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

## Wide link detail (backhaul)
- Clicking a backhaul link on Monitoring opens a wide modal (max 1020px) with a two-ended view: a vector dish for each end, a live beam + total traffic in the middle, and each end's data beneath it (signal, SNR, CCQ when the radio reports it, rate, traffic sent, Tx power).
- Each end shows the direction it transmits: far end = this radio's RX rate/traffic, this end = TX. Far-end signal/CCQ render only if a transport supplies `radio.remoteSignal` / `radio.remoteCcq` (none does yet).
- Reuses the existing detail modal and bps()/esc() helpers; other device types keep the narrow modal. Stacks to one column under 720px. Demo: East backhaul (airOS) now carries a CCQ.
- npm test + QA 655/655 pass.

## Links with both ends / slave only, and sector registration
- Link pairing (src/links.js, pure): when both radios of a link are managed they are paired (`peerId`) and shown as ONE link with each end's own live data; with only the slave managed, the far end shows what the slave reports. Pairing is explicit ("Other end of this link" in the device edit form, stored on both devices, cleared on re-pair/removal) or automatic (same link name, or one end names the other as its remote).
- Monitoring: the paired far end is folded into the primary card ("Both ends monitored" / "Slave end only" tag), its traffic is counted once in the KPI, and the wide link view marks each end Monitored / Not monitored with an "Open this end" button.
- Sectors: detail now has a wide Registration table of connected stations (name, MAC/IP, signal, CCQ, rate, traffic each way) from the airOS station list the metrics already collected.
- SAS match: stations are matched to RADIUS/SAS sessions by MAC address (same MAC when the PPPoE user is dialled on the CPE radio), showing the PPPoE username + plan, or "Not in SAS". Fetched from the existing /api/radius/subscribers at most every 30 s, only while a sector is open.
- Demo: East backhaul has both ends, North backhaul slave only; sector stations carry the demo SAS MACs plus one unmatched radio.
- test/links.js (19 assertions) added to npm test. No dependency added. npm test + QA 655/655 pass.

## Subscriber lookup + MikroTik sector registration
- src/lookup.js (pure): traces each RADIUS/SAS subscriber to the sector station it is registered on, by MAC. Exact match first; a MAC one step off (last byte +/-1, PPPoE dialled on another port of the CPE) is accepted only when unambiguous and flagged `near`. /api/radius/subscribers now returns `station` per subscriber and a `match` summary.
- SAS page: "Sector / radio" column shows the sector, signal, CCQ, station name and MAC; search also matches MAC and sector name.
- Monitoring registration table uses the same server-side match (so it gets the near-match rule too).
- MikroTik sectors: the wireless registration table (legacy wireless and the wifi package) is read through the existing API session and becomes the station list. Probed once per device; a router with no wireless menu is never asked again. Station rate code shared with airOS (applyStations), not duplicated.
- Tests: fake MikroTik serves a registration table (fields, live rates, role=sector); 10 new lookup/parser assertions in test/links.js. No dependency added. npm test + QA 655/655 pass.
- Not verified on a real MikroTik AP or a real SAS.

## No false "disconnected" alerts + SAS Radius 4 source
- Monitor: devices are grouped by network (IPv4 /24). When a network has 2+ devices and none answers (VPN closed / uplink out) those devices become "unknown/unreachable" instead of offline: no per-device event or alert, no downtime recorded, open offline alerts for them are closed, and one banner + one "Network x unreachable" event covers it. A device on another network that still answers (e.g. the home router) does not hide this.
- An offline alert now needs 3 failed checks in a row (alerts.OFFLINE_CONFIRM), so a single dropped ping raises nothing.
- On opening the app, a device not yet checked in this run shows "Checking…" rather than the status saved when the app was last closed.
- SAS Radius 4 subscriber source (src/transports/sas4.js, read-only): logs in to the SAS 4 admin API with a manager account and lists open sessions (index/online, paged); payload wrapping done with node:crypto (no dependency). Password encrypted at rest via storage.encrypt, one login reused ~50 min, live speed derived from byte-counter growth. Selectable under SAS > Connect server.
- Tests: fake SAS 4 panel (13 assertions), alert debounce + per-network unreachable (11 assertions). npm test passes. Playwright QA NOT run for this change (user asked to hold QA until the site is finished).
- Not verified against a real SAS 4 server.

## Sample pages hidden + "Needs attention" list
- Sidebar: pages that only show sample data (Overview, Tower Map, Remote Actions, Plans, Vouchers, Billing, Invoices, Tickets) are hidden with one CSS block in app.css; the fixed sample "200" SAS count is hidden too. The pages and routes still exist (reachable by address) — delete a CSS line to bring one back. This is a design change the user asked me to choose; visual baselines not touched.
- `/` now redirects to `/monitoring` (the sample Overview stays at `/dashboard`).
- Monitoring: "Needs attention" card above Live Devices — offline devices, failed logins, weak backhaul signal (<= -70 dBm), link >= 85% capacity, CPU >= 85%, and customer radios with signal <= -73 dBm or CCQ < 70% (named by SAS user when matched). Skips devices on an unreachable network. Click an item to open that device. Thresholds are the ATT constants in monitoring.js.
- npm test passes. Playwright QA NOT run (on hold until the site is finished).
