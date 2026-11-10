<#
.SYNOPSIS
  Version 1.2 - Creates the four SharePoint lists used by AOG Watcher.

.DESCRIPTION
  Creates AOG_Groups, AOG_Settings, AOG_Shifts and AOG_Log on one SharePoint site,
  with the columns AOG Watcher reads and writes.
  Safe to run again: it only adds lists and columns that are missing.
  It never deletes or renames anything.

  Requires PowerShell 7 and the PnP.PowerShell module.

.EXAMPLE
  ./tools/Setup-AogSharePoint.ps1 -ClientId "<your Entra app client id>"

.EXAMPLE
  # Already connected with Connect-PnPOnline in this window:
  ./tools/Setup-AogSharePoint.ps1
#>
[CmdletBinding()]
param(
  [string]$SiteUrl = "https://trustanavn.sharepoint.com/sites/aog",
  [string]$ClientId = "",
  [int]$LogKeepDays = 90
)

$ErrorActionPreference = "Stop"

# ---------- what to create ----------
# Type: Text | Note | Number | Boolean | Choice
$Lists = [ordered]@{
  # People edit this list. One row per WhatsApp chat to watch.
  "AOG_Groups" = @(
    @{ Name = "Customer";  Type = "Text" }
    @{ Name = "ChatType";  Type = "Choice";  Choices = @("Customer", "Flyer"); Default = "Customer" }
    @{ Name = "Active";    Type = "Boolean"; Default = "1" }
    @{ Name = "AddedBy";   Type = "Text" }
    @{ Name = "AddedAt";   Type = "Text" }
    @{ Name = "Note";      Type = "Note" }
  )
  # Shared settings. Title = setting name, Value = JSON value.
  "AOG_Settings" = @(
    @{ Name = "Value";     Type = "Note" }
    @{ Name = "UpdatedBy"; Type = "Text" }
  )
  # One row per person per night. The shift lead fills the first five columns to schedule;
  # the extension fills the rest. Used for payroll.
  "AOG_Shifts" = @(
    @{ Name = "ShiftDate";     Type = "Text" }
    @{ Name = "OperatorName";  Type = "Text" }
    @{ Name = "Email";         Type = "Text" }
    @{ Name = "Slot1Role";     Type = "Choice"; Choices = @("Primary", "Backup", "Off") }
    @{ Name = "Slot2Role";     Type = "Choice"; Choices = @("Primary", "Backup", "Off") }
    @{ Name = "CheckIn";       Type = "Text" }
    @{ Name = "CheckOut";      Type = "Text" }
    @{ Name = "Hours";         Type = "Number" }
    @{ Name = "Ready";         Type = "Text" }
    @{ Name = "AlertCount";    Type = "Number" }
    @{ Name = "AcceptedCount"; Type = "Number" }
    @{ Name = "MissCount";     Type = "Number" }
    @{ Name = "AcceptLog";     Type = "Note" }
    @{ Name = "Notes";         Type = "Note" }
  )
  # Machine-written. RecordType = Event | Signal | Machine. Old rows are removed by the extension.
  "AOG_Log" = @(
    @{ Name = "RecordType";      Type = "Text"; Indexed = $true }
    @{ Name = "EventType";       Type = "Text" }
    @{ Name = "At";              Type = "Text" }
    @{ Name = "ShiftId";         Type = "Text" }
    @{ Name = "AlertId";         Type = "Text" }
    @{ Name = "Source";          Type = "Text" }
    @{ Name = "GroupOrSubject";  Type = "Text" }
    @{ Name = "Sender";          Type = "Text" }
    @{ Name = "Role";            Type = "Text" }
    @{ Name = "OperatorName";    Type = "Text" }
    @{ Name = "Email";           Type = "Text" }
    @{ Name = "MachineId";       Type = "Text" }
    @{ Name = "ResponseSeconds"; Type = "Text" }
    @{ Name = "MissCause";       Type = "Text" }
    @{ Name = "Ready";           Type = "Text" }
    @{ Name = "Version";         Type = "Text" }
    @{ Name = "Detail";          Type = "Note" }
  )
}

# ---------- connect ----------
Import-Module PnP.PowerShell
$connection = $null
try { $connection = Get-PnPConnection } catch { $connection = $null }
if ($null -eq $connection -or $connection.Url.TrimEnd("/") -ne $SiteUrl.TrimEnd("/")) {
  if ($ClientId) {
    Connect-PnPOnline -Url $SiteUrl -Interactive -ClientId $ClientId
  } else {
    Connect-PnPOnline -Url $SiteUrl -Interactive
  }
}
Write-Host "Connected to $SiteUrl" -ForegroundColor Cyan

# ---------- create ----------
$report = New-Object System.Collections.Generic.List[string]

foreach ($listName in $Lists.Keys) {
  $list = $null
  try { $list = Get-PnPList -Identity $listName } catch { $list = $null }
  if ($null -eq $list) {
    New-PnPList -Title $listName -Template GenericList | Out-Null
    $report.Add("Created list   $listName")
  }

  $existing = @(Get-PnPField -List $listName | ForEach-Object { $_.InternalName })

  foreach ($column in $Lists[$listName]) {
    $name = $column.Name
    if ($existing -contains $name) { continue }

    if ($column.Type -eq "Choice") {
      Add-PnPField -List $listName -DisplayName $name -InternalName $name -Type Choice -Choices $column.Choices -AddToDefaultView | Out-Null
    } else {
      Add-PnPField -List $listName -DisplayName $name -InternalName $name -Type $column.Type -AddToDefaultView | Out-Null
    }
    if ($column.ContainsKey("Default")) {
      Set-PnPField -List $listName -Identity $name -Values @{ DefaultValue = $column.Default } | Out-Null
    }
    if ($column.ContainsKey("Indexed") -and $column.Indexed) {
      Set-PnPField -List $listName -Identity $name -Values @{ Indexed = $true } | Out-Null
    }
    $report.Add("Added column   $listName.$name ($($column.Type))")
  }
}

# ---------- seed one shared setting ----------
$settingKey = "log_keep_days"
$rows = @(Get-PnPListItem -List "AOG_Settings" -PageSize 200)
$hasKey = $rows | Where-Object { $_.FieldValues["Title"] -eq $settingKey }
if (-not $hasKey) {
  Add-PnPListItem -List "AOG_Settings" -Values @{ Title = $settingKey; Value = "$LogKeepDays"; UpdatedBy = "Setup-AogSharePoint.ps1" } | Out-Null
  $report.Add("Added setting  $settingKey = $LogKeepDays")
}

# ---------- result ----------
Write-Host ""
if ($report.Count -eq 0) {
  Write-Host "Nothing to do: all lists and columns already exist." -ForegroundColor Green
} else {
  $report | ForEach-Object { Write-Host $_ }
  Write-Host ""
  Write-Host "Done: $($report.Count) change(s)." -ForegroundColor Green
}

Write-Host ""
Write-Host "Lists on this site:" -ForegroundColor Cyan
foreach ($listName in $Lists.Keys) {
  $count = @(Get-PnPField -List $listName | Where-Object { $Lists[$listName].Name -contains $_.InternalName }).Count
  Write-Host ("  {0,-14} {1}/{2} columns present" -f $listName, $count, $Lists[$listName].Count)
}
