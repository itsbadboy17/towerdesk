
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

## Batch: tools, subscribers, history, Topology, Overview, Arabic (not yet QA'd or released)
- Tools: "Open device page" link, Ping / Traceroute (src/tools.js; host validated with the existing isValidHost and passed as one execFile argument, no shell), and "Export to Excel" (CSV with BOM, built in the browser) for the subscriber list and sector registration tables.
- Backup and restore (src/backup.js, Settings page): one JSON file with data/*.json + secret.key; restore validates, keeps a copy of what it replaces in data/before-restore/, and needs a restart. The file contains the key next to the encrypted passwords — the UI says to keep it private.
- Subscribers: detail card (click a row), top users, mismatch lists (radios with no SAS user / online users with no radio), and offline SAS 4 accounts via index/user (cached 5 min; falls back to online-only with a note).
- Station signal history: station_samples table in history.db, one sample per radio every 5 min while the app is open; click a station row in the registration table to see it.
- Topology page (/topology, nav link injected by app.js) and a real Overview page at / (live totals, needs attention, uplinks, sectors, top users, recent changes). Overview is back in the sidebar.
- Shared client logic moved to public/insights.js (pairing + attention rules) and TowerDesk.fmt / exportCsv / netTools in app.js — monitoring.js now uses these instead of its own copies.
- Arabic: public/i18n.js (about 240 phrases + patterns), loaded only when Arabic is chosen; translates in place and restores on switching back. Device names, usernames and technical terms are left as they are. Coverage is the visible pages' main labels, not every sentence.
- Tests: test/tools.js (21 assertions) added; history, subscribers and links tests extended. npm test passes.
- Playwright QA NOT run: the run was blocked in this session. tests/qa/helpers.js already lists /topology. The mandatory QA loop and the 0.1.3 release are still to do.
- Not verified on real hardware: SAS 4 (incl. index/user field names), MikroTik registration, traceroute output on a live network.

## 0.1.3 — QA PASSED, released
- QA round 1: 699/705, 6 failures, all in click-everything (/monitoring x5, /sas x1): the "Needs attention" rows were buttons, so the test opened the device card and stalled behind it (and started a ping). Fix: rows are links that open the card in place; exporting an empty subscriber list no longer starts a download.
- QA round 2: 705/705 — QA PASSED. (705 = 14 routes incl. the new /topology.)
- Version 0.1.3; portable zip rebuilt and checked (no data folder, no .git).
- The hold on per-change QA is lifted for this release; it was run because the user asked for QA + release.

## 0.1.4
- Updater defaults to the project repository (itsbadboy17/towerdesk), now public, so no repo name or token has to be entered. Still only contacted when Check for updates is pressed.
- Git history rewritten to a GitHub no-reply author address before publishing; the old private repo is kept as towerdesk-private.

## 0.1.5
- Updater unpacks with the Windows tar.exe by full path (Git's tar earlier on PATH could not read the zip). Found by a real end-to-end update test: 0.1.3 copy -> 0.1.4 from the public repo, no token.
- Known limit: a self-update replaces app files only, not node_modules; a release that adds a dependency needs the full zip.

## OLT support and Arabic pass (unreleased)
- New `src/transports/olt.js`: reads an OLT's ONUs over SNMP (optical Rx/Tx power, Rx at the OLT, temperature, fibre length, online state). Profiles: Huawei GPON (HUAWEI-XPON-MIB), ZTE GPON (C300/C320), BDCOM EPON, and the NSCRTV standard EPON MIB used by C-Data / HSGQ. Picked from sysObjectID, otherwise each is tried. Walk-only, read-only. No new dependency (uses net-snmp, already present).
- Any SNMP device is probed once; one added with type "OLT" is retried every 10 min. ONU list refreshes once a minute (walks are heavy).
- Monitoring: OLT detail card with a searchable ONU table, Excel export, weak-light / hot-ONU warnings in "Needs attention" (thresholds: Rx <= -27 dBm, temp >= 75 C).
- SAS matching: EPON ONUs by MAC; GPON ONUs (serial only) by ONU name = PPPoE username. Subscriber page shows the ONU readings next to the user.
- NOT verified on real OLTs. ZTE scaling (tx/temperature columns) and the NSCRTV port numbering are the least certain. VSOL's own MIB, Telnet/SSH and web-page-only OLTs are not built.
- Arabic: went through every page in Arabic, added ~150 phrases, icon-prefixed and " · "-joined text is now translated part by part, numbers with units stay left-to-right.
- Tests: test/olt.js (profile parsing, SAS matching, live read against a fake Huawei SNMP agent).

## Sector advisor (unreleased)
- New dependency `@anthropic-ai/sdk` (official Anthropic SDK, pure JS): the optional AI advisor on a sector's card calls Claude (model `claude-opus-5-5`, structured answer via one tool). Reason for the dependency: the official SDK handles auth, retries, typed errors and the refusal fallback. It is loaded only when the owner presses "Ask AI", so the app still starts and works offline without it; copies that were updated in place (the updater does not replace node_modules) say "get the full zip" instead of failing.
- `src/advisor.js`: built-in offline diagnosis (weak clients, good-signal/low-CCQ interference, noise, overlap with own radios, CPU), the API key (Settings, stored encrypted in data/ai.json, never returned), the anonymised snapshot (no names, usernames, MAC or IP addresses leave the PC), hard limits on proposed changes (same band, power only down or +3 dB, <= 27 dBm, width never written), server-side proposals bound to one sector.
- `src/radio.js`: the only code that changes a radio. MikroTik (legacy wireless) frequency and tx-power only. Before the change it writes a RouterOS scheduler entry that restores the old values after 5 min by itself, so a change that cuts TowerDesk off from the radio still undoes itself; "Keep" removes it, "Undo" restores now.
- Routes: /api/ai/config, /api/advisor/:id (+ /apply, /keep, /undo). Demo mode returns a sample answer and sends nothing.
- NOT verified on a real radio or with a real key. Ubiquiti airOS and Mimosa sectors get the diagnosis and the AI advice but no one-click apply (airOS config writes are not built).
- Tests: test/advisor.js (diagnosis, privacy of the snapshot, change limits, AI path with a fake client, apply/keep/undo/refused/expiry against a fake MikroTik).

## One-click apply on Ubiquiti airOS (unreleased, EXPERIMENTAL)
- `src/transports/airos-ssh.js` + `src/radio.js`: apply / keep / undo for airOS over SSH (ssh2, already a dependency). Settings are applied to the RUNNING copy (/tmp/system.cfg) only and re-applied with rc.softrestart; flash is untouched until "Keep" runs `cfgmtd -w -p /etc/`. So a reboot at any point restores the old settings, and a countdown job started on the radio (sleep 300; restore running copy) restores them if nobody presses Keep. Nothing depends on TowerDesk staying open.
- Guards: read-only preflight (settings file readable, tools present, no leftover change), the saved value must equal the value the owner was shown (frequency, power), values placed in commands are whole numbers only, a change the radio does not confirm is rolled back at once. "Test this radio (read-only)" button on the sector card.
- Needs SSH turned on in the radio's Services page (same login as the web page); SSH port from `sshPort` on the device record, default 22.
- NOT VERIFIED ON REAL airOS: the file paths and commands (/tmp/system.cfg keys `radio.1.freq` / `radio.1.txpower`, `/usr/etc/rc.d/rc.softrestart`, `cfgmtd -w -p /etc/`) come from general knowledge of airOS and could not be confirmed from documentation. The tests use a simulated radio, so they prove the ordering and guarantees, not the firmware's behaviour. First real use: one quiet sector, at a quiet hour.
- Tests: test/airos-apply.js (31 checks).

## 0.1.6 QA
- Full QA suite: round 1 passed 705 of 705. Unit tests: 286 checks.
- Unverified on real hardware: OLT readers (all brands), sector advisor with a real key, MikroTik one-click apply, Ubiquiti airOS one-click apply (experimental).

## Real data / Demo data switch (unreleased)
- Button next to the language selector on every page. One shared flag `window.TowerDesk.demo` (app.js), remembered in the browser (`td-demo`); a `?demo=1` link forces it on. Monitoring, Overview, Topology and SAS follow it; an amber notice sits at the top of the page content while demo is on. Alerts, Add Device and Settings always use the real setup (the notice says so).
- Demo never writes to a real radio and never calls the AI service (server-side `?demo=1` checks), so it is safe to try the advisor's apply flow there.
- Arabic text added. Full QA not re-run (header gained a button, visual captures will differ).

## Topology views (unreleased)
- The Topology page now has a switcher: Site cards, Link diagram, Trace a customer, and the original Tree. The last view is remembered (`td-topo-view`).
- Site cards: devices grouped by their Location. Tick devices, type a site name, "Place on site" (saved through POST /api/topology/layout; only `location` and `parentId` are written, no re-test). A sector whose client list was not read says "client list not read" instead of "0 clients".
- Link diagram: boxes and lines from a new optional `parentId` on each device ("connects to": another device, or `internet`); the two ends of a paired link are one box; loops are refused (server and page); devices with no connection sit in a "Not connected yet" row. Click a box to change what it connects to.
- Trace a customer: search a username, name, MAC, IP or ONU serial; shows customer -> radio/ONU -> sector/OLT -> each device it connects to -> Internet, with a plain verdict (offline upstream device, weak radio, weak fibre, PPPoE offline, or an incomplete path). Works without SAS using names/MACs seen on radios.
- Logic lives in `public/topo-model.js` (pure, unit-tested in test/topology.js).
- airOS M-series access points keep their clients on /sta.cgi, not in status.cgi: TowerDesk now reads it (once per poll, best effort, asked only of AP-mode radios). Verified on the real tower: the five M-series sectors that showed 0 clients now list 2-12 clients each with MAC, signal and CCQ.
- Demo mode has sites and connections so all views can be tried; editing is disabled in demo (nothing is saved there).

## Ask AI without an API key (stopgap, unreleased)
- With no key saved, "Ask AI" uses Claude Code on the PC: `src/advisor.js` finds `claude` (PATH, or the Claude desktop app's own copy under %LOCALAPPDATA%\Claude-Data\...\claude-code\...\claude.exe; override with TOWERDESK_CLAUDE_BIN) and runs it with `-p --output-format json --json-schema ... --tools "" --no-session-persistence --setting-sources project,local`, in an empty temp folder, with ANTHROPIC_API_KEY stripped from its environment. Same anonymised snapshot as the API path; same limits on proposed changes. A saved API key still wins.
- The bundled Claude Code on this PC was NOT signed in (`claude auth status` -> loggedIn false); the owner must run `claude auth login` once. Settings shows the exact command, and "Ask AI" says so if it is not signed in.
- NOT verified with a signed-in Claude Code: the success output shape is parsed defensively (structured_output, or JSON in `result`, code fences stripped) but has only been seen against a stand-in program. Only works on a PC that has Claude Code; copies sent to others still need a key.
- Tests: test/advisor.js (+19 checks) with test/fake-claude.js.

## After 0.1.6 (uncommitted): clarity pass
- Status words (Live data / Ping only / Wrong login / Not answering...), Mimosa master/slave roles, sector-traffic KPI.
- Recent changes feed (no online/offline); offline alerts are not kept in history.
- airOS M-series counters from /ifstats.cgi and clients from /sta.cgi.
- Charts (public/charts.js, no dependency), ping/traceroute formatter (public/nettools-model.js).
- Device card: Connection box + POST /api/devices/:id/connect (optional "save as default"); Enable SNMP removed (read-only).
- Advisor: channel finder, change history with go back, progress/error boxes.
- Topology: plain-language site/diagram wording, select all in card, row click.
