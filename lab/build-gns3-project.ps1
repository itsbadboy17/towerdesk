$ErrorActionPreference = 'Stop'
$ini = Get-Content "$env:APPDATA\GNS3\2.2\gns3_server.ini"
$u = (($ini | Where-Object { $_ -match '^user\s*=' }) -split '=',2)[1].Trim()
$p = (($ini | Where-Object { $_ -match '^password\s*=' }) -split '=',2)[1].Trim()
$h = @{ Authorization = 'Basic ' + [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("${u}:${p}")) }
$base = 'http://127.0.0.1:3080/v2'
function Api($method, $path, $body) {
  $a = @{ Method = $method; Uri = "$base$path"; Headers = $h; TimeoutSec = 120 }
  if ($null -ne $body) { $a.Body = ($body | ConvertTo-Json -Depth 10); $a.ContentType = 'application/json' }
  Invoke-RestMethod @a
}
$pid_ = '8659b8d3-b97e-4ac9-900b-07f0af8ee2c1'
$tpl = Api 'GET' '/templates' $null
$tChr = ($tpl | Where-Object { $_.name -eq 'MikroTik CHR 6.49.13' }).template_id
$tIou = ($tpl | Where-Object { $_.name -eq 'Cisco IOU L2 15.1g' }).template_id
$tCl  = ($tpl | Where-Object { $_.name -eq 'Cloud' }).template_id
if ((Api 'GET' "/projects/$pid_/nodes" $null).Count -gt 0) { 'nodes already present'; return }

function AddChr($label, $x, $y) {
  $n = Api 'POST' "/projects/$pid_/templates/$tChr" @{ x = [int]$x; y = [int]$y; compute_id = 'vm' }
  Api 'PUT' "/projects/$pid_/nodes/$($n.node_id)" @{ name = $label; properties = @{ ram = 160; adapters = 2 } }
}
$gw   = AddChr 'Gateway'      0    300
$mas  = AddChr 'Master'       250  300
$sla  = AddChr 'Slave'        500  300
$s1   = AddChr 'Sector1'      1050 100
$s2   = AddChr 'Sector2'      1050 250
$s3   = AddChr 'Sector3'      1050 400
$newr = AddChr 'New-MikroTik' 1050 550
foreach ($x in @($s1, $s2, $s3, $newr)) { }  # (one adapter is enough for these; the template default of 2 is kept)
$sw = Api 'POST' "/projects/$pid_/templates/$tIou" @{ x = 750; y = 300; compute_id = 'vm' }
$sw = Api 'PUT' "/projects/$pid_/nodes/$($sw.node_id)" @{ name = 'Cisco-SW' }
$cl = Api 'POST' "/projects/$pid_/templates/$tCl" @{ x = 750; y = 600; compute_id = 'vm' }
$cl = Api 'PUT' "/projects/$pid_/nodes/$($cl.node_id)" @{ name = 'TowerDesk-PC'; properties = @{ ports_mapping = @(@{ interface = 'eth0'; name = 'eth0'; port_number = 0; type = 'ethernet' }) } }

function Link($a, $ap, $apt, $b, $bp, $bpt) {
  Api 'POST' "/projects/$pid_/links" @{ nodes = @( @{ node_id = $a.node_id; adapter_number = [int]$ap; port_number = [int]$apt }, @{ node_id = $b.node_id; adapter_number = [int]$bp; port_number = [int]$bpt } ) } | Out-Null
}
Link $gw 0 0 $mas 0 0      # Gateway ether1 - Master ether1
Link $mas 1 0 $sla 0 0     # Master ether2  - Slave ether1   (a cable standing in for the wireless link)
Link $sla 1 0 $sw 0 0      # Slave ether2   - Cisco-SW e0/0
Link $sw 0 1 $s1 0 0       # Cisco-SW e0/1 - Sector1
Link $sw 0 2 $s2 0 0       # Cisco-SW e0/2 - Sector2
Link $sw 0 3 $s3 0 0       # Cisco-SW e0/3 - Sector3
Link $sw 1 0 $newr 0 0     # Cisco-SW e1/0 - the new, untouched MikroTik
Link $sw 1 1 $cl 0 0       # Cisco-SW e1/1 - the cloud (your PC, host-only network)
'links created'
$all = Api 'GET' "/projects/$pid_/nodes" $null
$all | ConvertTo-Json -Depth 6 | Out-File "$PSScriptRoot\lab3-nodes.json" -Encoding utf8
$all | ForEach-Object { $_.name + '  type=' + $_.node_type + '  compute=' + $_.compute_id + '  console=' + $_.console_host + ':' + $_.console }
