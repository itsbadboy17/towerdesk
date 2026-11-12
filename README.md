# TowerDesk

Portable ISP dashboard for small networks (single admin, 1–3 towers, < 500 subscribers).

## Requirements

- Windows 10/11 (portable build) or any OS with Node.js 18+.
- No internet required at runtime (all UI/API served locally; no external CDN).

## Run (development)

```bat
cd towerdesk
npm install
npm start
```

Open http://localhost:3000

## Run (portable)

Copy the app folder (or build the portable exe) to another PC and run `start.bat`.

## Login

Set an admin login before letting anyone else open the dashboard:

```bat
npm run set-password
```

The password is stored only as a scrypt hash in `data/auth.json`. Once a login exists, every page and API requires signing in. Restart the server after changing a password.

## Adding real devices

Open **Add Device**:

1. Enter the IP and press **Auto-detect**. TowerDesk scans for ping, SSH, Telnet, web, SNMP and the MikroTik API, then suggests the vendor and the best way to connect.
2. Pick a method:

| Method | Needs | What it checks |
|---|---|---|
| Ping only | nothing | device is up |
| MikroTik API / API-SSL | user + password | identity, RouterOS version, board, CPU, uptime |
| SSH | user + password | login works (no commands run) |
| Telnet | user + password | login works (common on ONUs) |
| SNMP v2c / v1 | community | name, description, uptime |
| Web UI (HTTP/HTTPS) | optional | web page answers, model/firmware; verifies HTTP Basic logins |

3. Press **Test Connection**, then **Add Device**. Saved devices are checked for reachability every minute.

All connections are read-only. Passwords are encrypted in `data/devices.json` using the key in `data/secret.key`. Keep the `data` folder private.

## Remote access (OpenVPN)

Connect this PC to the remote site's OpenVPN server as a client. Users on that VPN can then open
`http://<this PC's VPN IP>:3000`. Windows Firewall must allow Node.js on that network.

## Tests

The Playwright QA suite starts its own server with `TOWERDESK_AUTH=off`. Stop any running server on port 3000 first.

```bat
npm test
```

## Features in progress

- Mock connectors for MikroTik / Cisco / Ubnt / Mimosa with dummy data (200 subscribers, 2 towers, 12 devices).
- Monitoring dashboard, bandwidth chart, tower map pages.
- Subscribers / plans / vouchers / billing / alerts / tickets / remote pages.
- Reports CSV export (`/api/reports/subscribers`).

## Mock vs real

All data and actions are currently mocked. Real connectors (MikroTik RouterOS API, SNMP, SSH) are planned for a later milestone.

## Start instructions for portable build

See `start.bat` / packaging milestone (M10) when the portable build is produced.
