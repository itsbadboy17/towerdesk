
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

## Features branch (uncommitted to main): staff, messages, finance, switches, wizard, designs
Dependencies: none added. Telegram sending is the only new internet use and is off until a bot is configured.
- Staff accounts (src/auth.js, public/staff.js): admin / technician / viewer; roles enforced server-side (canAccess), UI hides what a role cannot use. First account can only be created from the PC itself.
- Outage impact (public/impact-model.js): what is behind a device (link diagram parents) and the customers on it; shown in Needs attention, status report and alerts.
- Maintenance windows (src/maintenance.js): mute alerts and messages for a device or site for a set time.
- Messages (src/notify.js, public/messages-model.js): Telegram bot (token encrypted at rest, never returned), status report, "Tell customers" with per-customer WhatsApp links (nothing is auto-sent on WhatsApp).
- Neighbours (src/neighbors.js): MikroTik neighbour discovery, LLDP, CDP, ARP, MAC table over SNMP or the MikroTik API; suggestions for "gets its internet from"; scheduled scan every 6 h logs changes.
- Switch ports (snmp.readSwitchPorts, metrics.portList): Cisco Catalyst / MikroTik switches, Ports tab with link state, speed, traffic, devices behind each port, who is plugged in. New device type "switch".
- Guided Add Device: replaced by the 3-step "Add a device" flow (see "Add Device redesign" below).
- Finance (src/finance.js, public/finance-model.js, finance.html): estimates from plan prices x active subscribers, renewals, reminders, costs, daily trend. Admin only.
- Quick search (Ctrl+K), device notes.
- Design switcher next to the language selector: Design A (default) and Design B "Blueprint" (public/design-b.css, loaded only when chosen).
- Fixed: Topology site cards showed NaN; app.css symbols were corrupted by an encoding slip (repaired).
Not done: the phone app (left out on purpose); airOS radios cannot report neighbours; Arabic covers the main new labels only; QA suite not run.
## Set up a radio (features branch)
- public/provision-model.js: templates (sector, customer radio, PtP master/slave), strict validation, airOS key mapping, MikroTik command preview.
- src/provision.js + airos-ssh.changeKeys: plan is READ-ONLY; apply is OFF by default (Settings > Radio setup, admin). Apply = copy + on-radio undo timer first, then write only existing allowed keys, verify, roll back on mismatch; Keep saves, Undo restores.
- Never invents a setting the radio lacks; the admin password and other keys are not on the allowed list. Typed passwords are not stored; held in memory only during the undo window.
- UNVERIFIED on real hardware: the airOS key names (radio.1.mode, aaa.1.wpa.psk, ...) come from knowledge of system.cfg, not from the owner's radios (they were unreachable when checked). Test on a spare radio before switching writing on.
- MikroTik: preview only. Planned next: reach a router that has no IP by its MAC through another MikroTik (SSH + /tool mac-telnet, fixed script), then add it and continue to setup.
## Reach a MikroTik by MAC through another MikroTik (features branch)
- public/macreach-model.js: validation + the fixed command script (+ revert script). Every address/route/firewall rule TowerDesk adds carries the comment "TowerDesk setup".
- src/transports/mikrotik-mac.js: prompt-driven driver: SSH to the relay, /tool mac-telnet <mac>, login, type the commands, wait for the prompt each time; handles unreachable MAC, missing tool, wrong factory login, forced password change, refused commands, silent routers.
- src/macreach.js: plan (read-only: asks the relay over the API whether it sees the MAC and whether the address is taken) and apply (same admin "allow writing" switch as Set up a radio; verifies the new router on its API; removes what it added if that fails).
- UNVERIFIED on real hardware: RouterOS prompt/banner text and the exact mac-telnet behaviour across versions. Tested only against a fake router (25 checks).
- Needs: relay = a MikroTik added with the API and with SSH enabled; new router on the same switch/VLAN.
- Topology "seen, not added": a MikroTik with no IP gets a "Set up by MAC" button (real-data mode).
## GNS3 lab and what testing against it found (features branch)
- lab/: scripts to rebuild the GNS3 test network (MikroTik CHR + Cisco IOU L2 from the user's own GNS3 VM). See lab/README.md.
- Neighbours: with devices on one wire (bridges), neighbour discovery alone cannot show the order; the tree is now rebuilt from MAC tables
  (gateway-facing port per switch/bridge; the closest device that has another below it). Devices with several addresses are matched by name.
  Verified on the lab: Gateway > Master > Slave > Cisco-SW > Sector1..3 (all "high").
- Reach by MAC: verified on the lab through Sector1 to an untouched CHR (address, API, name, new password; verified over the API).
  Found and fixed: a brand-new RouterOS asks "see the software license? [Y/n]" and then forces a new password at first login.
- scripts/mock-sas4.js: pretend SAS 4 server (60 subscribers) for testing finance, notices and the SAS page.
- Not tested on a real device: Set up a radio (Ubiquiti), and any real tower hardware.
## Lab data mode (features branch)
- Top-bar switch is now a menu: Real data / Demo data / Lab data. Lab data starts (if needed) and opens a SECOND TowerDesk (src/lab.js):
  own data folder (never the real one), own port (default 3001), localhost only, marked TOWERDESK_LAB=1 so every page shows a banner.
  It also starts the pretend SAS (scripts/mock-sas4.js) unless switched off. Settings > Lab data (admin): folder, port, start/stop.
- Port safety: a TowerDesk on the lab port that does not say it is the lab is never opened as lab data.
- Tested: test/lab.js (11 checks) and by hand: Real > Lab > Real in the browser against the GNS3 lab.
## Scan neighbours now connects the devices (features branch)
- After "Scan neighbours" (and the 6-hourly scan) devices are connected automatically to what their neighbours show, closest to the internet first. A device whose parent was set by hand (or before this existed) is never moved; only empty ones and ones TowerDesk connected itself (`parentSource: 'auto'`). Switch: "Connect automatically" next to the scan button (`/api/neighbors/settings`). Changes are written to Recent changes.
- Selecting a device shows "Interfaces and what they connect to": each interface, link state, the device on the other end, that device's port, and whether it leads towards the internet or below. Built in `analyse().ports` from neighbour rows and MAC tables (MikroTik `interface-name` is now read as the neighbour's port). No new dependency.
- Tested: test/neighbors.js (ports, autoConnect, setting) and by hand on the GNS3 lab (Gateway > Master > Slave > Cisco-SW > Sector1/2/HRINS-New, with ports).

## Set up a device, step by step (features branch)
- "Set up a radio" is now "Set up a device" (page /provision, nav, quick search; the Settings card is "Device setup"). One step at a time: step 1 asks what is being set up (new MikroTik with no IP / sector / customer radio / PtP master / PtP slave) and the steps after it depend on the answer (`provisionModel.flow`). Next checks a step before moving on; the step chips are markers, not buttons (owner: no jumping between steps).
- New MikroTik: choose the MikroTik it is plugged in next to, then choose the new router from what that MikroTik sees right now (`POST /api/macreach/look` > `macreach.look`, read-only). Nobody has to find or type a MAC address (typing one stays as a fallback under "It is not in the list"). Devices already in TowerDesk (matched by address or MAC, never by name: every new MikroTik is called "MikroTik") and non-MikroTiks are listed but cannot be chosen. The new router's own port that faces the relay prefills "Port that faces the switch".
- `neighbors.ownerIndex` was extracted from `analyse` (no behaviour change) and is shared by both; MikroTik neighbour rows now keep `board` and `version`. No new dependency.
- Tested: test/provision.js (flow), test/macreach.js (candidates, facingPort, look), test/neighbors.js (ownerIndex); by hand on the GNS3 lab: Slave listed a brand-new CHR by itself and the preview reached "Run it" (not run).
- GNS3 lab: the GNS3 VM has no KVM on this PC, so both MikroTik templates now carry `-machine accel=tcg` (a new MikroTik node starts). See lab/README.md.

## New MikroTik setup: fixes from the owner's first real run (features branch)
- A forced "new password" question at first login is skipped with Ctrl+C when no new password is chosen (as a person does in a terminal); a new password may be any length.
- Network size empty = 24; gateway empty = the .1 of its network. "Port that faces the switch" and "Allow the API from" moved under More options.
- The relay suggests a free address in its own /24 (the network TowerDesk already reaches it on); an address in another network gets a warning (the owner's 10.172.192.5 run timed out for that reason). A DHCP address the router already has is explained.
- After a verified setup the router is added to TowerDesk automatically (MikroTik API, the login that worked).
- Tested: test/macreach.js; on the GNS3 lab a fresh CHR set up through Slave with no password, address and gateway left to defaults, added automatically.

## Add Device redesign, device card, auto type/name (features branch)
- Add Device is one card, 3 steps in order (Find it, Log in, Name it): type and connection method are worked out (hand choice only under "set it yourself"); Log in is skipped when a saved login (or a new MikroTik's factory login on the API) already works; the name comes from the device. Shared step helper `public/stepper.js` (also used by Set up a device); add-wizard.js removed.
- Server: type follows what a successful login proves (`vendorFromTest`; switch/ONU/OLT never changed; wrong types corrected at start-up); only the IP is required; empty username = admin (ubnt for airOS; telnet only with a password); `/connect` takes `credentialId` for one saved login/community; CPU/RAM stored as whole numbers.
- Device card: Connection panel (Automatic / login / SNMP community / ping, pick a saved one or type a new one, keeps its state through refreshes); "Planned work / Start maintenance" removed (an existing window can still be ended); new System section with CPU/RAM meters and uptime.
- Confirmations are a dialog (`TowerDesk.confirm`; `inlineConfirm` kept as the old name).
- Tested: npm test (devices.js covers the server changes); by hand on the GNS3 lab: added a brand-new CHR with only its IP (found as MikroTik, named MikroTik, API, admin), Slave's card (connection panel, System, no maintenance). Not checked: Arabic for the new texts, RTL, 375 px for the card.

## Pretend OLT for the lab (features branch)
- No free OLT image exists for GNS3 (OLT firmware ships only inside vendor hardware). `scripts/mock-olt.js` is a pretend EPON OLT (C-Data/HSGQ style, the NSCRTV MIB TowerDesk already reads): 6 invented ONUs with names, MACs, distance, optical power, temperature; one weak (-27 dBm), one drops off 1 minute in 5; three interfaces with moving traffic. SNMP via net-snmp (already a dependency), community public, port 1161.
- Tested: test/mock-olt.js reads it with src/transports/olt.js; by hand in the lab TowerDesk (Lab-OLT, 192.168.229.1:1161): 6 fibre customers and the "weak fibre signal" alert.
