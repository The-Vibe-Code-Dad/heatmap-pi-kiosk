param(
  [string]$WslDistro = "Ubuntu",
  [string]$ImageName = "",
  [string]$FirstUserName = "pi",
  [string]$FirstUserPass = "",
  [string]$HostName = "heatmap-kiosk",
  [string]$TimeZone = "America/New_York",
  [string]$Locale = "en_US.UTF-8",
  [string]$KeyboardKeymap = "us",
  [string]$WifiCountry = "",
  [string]$WifiSsid = "",
  [string]$WifiPassword = ""
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$linuxPath = (& wsl.exe -d $WslDistro wslpath -a "$scriptDir").Trim()

if (-not $linuxPath) {
  throw "Unable to resolve the WSL path for $scriptDir"
}

$envParts = @()

if ($ImageName) { $envParts += "IMG_NAME=$ImageName" }
if ($FirstUserName) { $envParts += "FIRST_USER_NAME=$FirstUserName" }
if ($FirstUserPass) { $envParts += "FIRST_USER_PASS=$FirstUserPass" }
if ($HostName) { $envParts += "TARGET_HOSTNAME=$HostName" }
if ($TimeZone) { $envParts += "TIMEZONE_DEFAULT=$TimeZone" }
if ($Locale) { $envParts += "LOCALE_DEFAULT=$Locale" }
if ($KeyboardKeymap) { $envParts += "KEYBOARD_KEYMAP=$KeyboardKeymap" }
if ($WifiCountry) { $envParts += "WPA_COUNTRY=$WifiCountry" }
if ($WifiSsid) { $envParts += "WPA_SSID=$WifiSsid" }
if ($WifiPassword) { $envParts += "WPA_PASSWORD=$WifiPassword" }

$wslArgs = @("-d", $WslDistro, "--", "env")
$wslArgs += $envParts
$wslArgs += @("bash", "-lc", 'cd "$1" && bash ./build-image.sh', "build-image", $linuxPath)

wsl.exe @wslArgs
