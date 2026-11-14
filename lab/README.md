# TowerDesk test lab (GNS3)

A safe, isolated copy of a small tower network for testing TowerDesk without touching a real one.

    Gateway - Master - Slave - Cisco-SW (IOU L2) - Sector1, Sector2, Sector3, New-MikroTik
    (Master/Slave are joined by a cable that stands in for the wireless link)

Built from the images already in the GNS3 VM: MikroTik CHR 6.49.13 and Cisco IOU L2 15.1g. Nothing is downloaded.

## What was set up on this PC (and how to undo it)
- GNS3 VM (`D:\VMs\GNS3\GNS3.vmx`): turned off `vpmc.enable` and `vhv.enable` (VMware refuses them while Windows' hypervisor is on),
  and the GNS3 VM is started with 4 GB / 4 CPUs (it was 8 GB / 6). Backup: `GNS3.vmx.bak-before-towerdesk`.
- `%APPDATA%\GNS3\2.2\gns3_server.ini`: `[Qemu]` acceleration off. Backup: `gns3_server.ini.bak-before-towerdesk-lab`.
- Each MikroTik node has the option `-nographic -machine accel=tcg` (no hardware acceleration inside the VM, so they boot slowly).
  The two MikroTik templates (CHR 6.49.13 and 7.20.8) carry the same option, so a NEW MikroTik dragged in from the device list
  starts too. Without it GNS3 says "KVM acceleration cannot be used (/dev/kvm doesn't exist)". Any other QEMU template you
  import needs the same option (template > Advanced > Additional settings > Options), or `enable_kvm = false` under `[Qemu]`
  in the GNS3 VM's own `gns3_server.conf` (GNS3 VM menu > Configure), which covers every template at once.
- The Cloud node is bridged to the VM's `eth0` (VMware host-only network VMnet1, 192.168.229.0/24). Never bridge a real adapter.

## Addresses
Inside the lab: 10.10.11.1 gateway, .2 master, .3 slave, .254 switch, .10/.11/.12 sectors.
Management (reachable from the PC, no admin rights needed): 192.168.229.21 gateway, .22 master, .23 slave, .24 switch,
.31/.32/.33 sectors. Login `admin` / `Lab-pass-2026` (lab only, not a real secret). SNMP community `public` on the switch.
New-MikroTik is left exactly as it boots.

## Run a second TowerDesk for the lab (own data, own port)
    $env:TOWERDESK_DATA_DIR = 'G:\New folder (7)\towerdesk-lab-data'; $env:PORT = 3001; node server.js
    node scripts/mock-sas4.js --port 8085        # pretend SAS 4 (manager / lab-pass)
    node scripts/mock-olt.js --port 1161         # pretend EPON OLT with 6 ONUs (SNMP, community public)

There is no free OLT image for GNS3 (OLT firmware only ships in the vendors' hardware), so the OLT is pretend: it runs on the PC and the lab
reaches it at 192.168.229.1:1161. Add it in TowerDesk as type OLT, method SNMP, port 1161, community public.

## Scripts here
`build-gns3-project.ps1` (project, nodes, links through GNS3's local API), `configure-routers.js` (types the settings on the consoles),
`add-management-addresses.js`, `run-on-console.js <port> "<cmd>"`.