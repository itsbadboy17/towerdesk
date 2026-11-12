' TowerDesk portable launcher with no console window (optional alternative to TowerDesk.cmd).
' Double-click to run TowerDesk in the background and open the dashboard in your browser.
Option Explicit
Dim sh, fso, root
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
root = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = root

' Apply a staged self-update first (the server is not running yet, so files are free).
If fso.FileExists(root & "\app\data\updates\staged\package.json") Then
    sh.Run "cmd /c robocopy ""app\data\updates\staged"" ""app"" /E /XD ""app\data"" /NFL /NDL /NJH /NJS /NC /NS /NP & rmdir /S /Q ""app\data\updates\staged"" & if exist ""app\data\updates\pending.json"" del /Q ""app\data\updates\pending.json""", 0, True
End If

If Not fso.FileExists(root & "\node\node.exe") Then
    MsgBox "node\node.exe is missing next to this launcher. The portable build is incomplete.", vbCritical, "TowerDesk"
    WScript.Quit 1
End If

' Start the server hidden (0 = no window), do not wait.
sh.Run """node\node.exe"" ""app\server.js""", 0, False
WScript.Sleep 2000
sh.Run "http://localhost:3000"
