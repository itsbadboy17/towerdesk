TowerDesk — portable ISP dashboard
==================================

HOW TO RUN
----------
1. Unzip this whole folder anywhere (a USB stick, Desktop, C:\TowerDesk — all fine).
2. Double-click  TowerDesk.cmd
   (or  TowerDesk-no-window.vbs  to run it without a black console window).
3. Your browser opens at  http://localhost:3000

That's it. No installation, no Node.js, no internet connection required.
Everything runs on this computer. To stop TowerDesk, close the console window
(or, if you used the .vbs, open Task Manager and end "node.exe").

WHAT'S IN HERE
--------------
  TowerDesk.cmd            Click this to start.
  TowerDesk-no-window.vbs  Same, but no console window.
  node\node.exe            The bundled runtime (so you don't install anything).
  app\                     The application itself.
  app\data\                YOUR data — saved devices, history, settings. See below.

YOUR DATA
---------
Everything you add lives in  app\data\  (devices, encrypted passwords, monitoring
history, RADIUS/update settings). Back up that one folder and you've backed up
everything. Updates never touch it.

UPDATING
--------
Open Settings inside TowerDesk, enter your GitHub repository (owner/name), and click
"Check for updates". If a newer version exists, click "Download & install" — it is
downloaded and staged. Restart TowerDesk (close it and run it again) and the update
is applied automatically before it starts. Your data folder is left alone.

Note: updates deliver the application code. If a release note says the dependencies
changed, download the full portable zip again instead of the in-app update.

OFFLINE
-------
TowerDesk never calls the internet on its own. The only time it reaches out is when
you click "Check for updates" or "Download & install" in Settings.
