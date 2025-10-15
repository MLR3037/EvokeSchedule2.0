# SharePoint Upload Script
# Run this in PowerShell if you have PnP PowerShell installed
# Install with: Install-Module -Name "PnP.PowerShell"

param(
    [Parameter(Mandatory=$true)]
    [string]$SiteUrl = "https://evokebehavioralhealthcom.sharepoint.com/sites/Clinistrators",
    
    [Parameter(Mandatory=$false)]
    [string]$LibraryName = "EvokeSchedulerApp",
    
    [Parameter(Mandatory=$false)]
    [string]$BuildPath = ".\build"
)

# Connect to SharePoint
Write-Host "Connecting to SharePoint site: $SiteUrl" -ForegroundColor Green
Connect-PnPOnline -Url $SiteUrl -Interactive

# Create library if it doesn't exist
Write-Host "Creating document library: $LibraryName" -ForegroundColor Green
try {
    New-PnPList -Title $LibraryName -Template DocumentLibrary -ErrorAction SilentlyContinue
    Write-Host "Library created successfully" -ForegroundColor Green
} catch {
    Write-Host "Library may already exist, continuing..." -ForegroundColor Yellow
}

# Upload all files from build folder
Write-Host "Uploading files from: $BuildPath" -ForegroundColor Green

# Upload root files
Get-ChildItem -Path $BuildPath -File | ForEach-Object {
    Write-Host "Uploading: $($_.Name)" -ForegroundColor Cyan
    Add-PnPFile -Path $_.FullName -Folder $LibraryName
}

# Upload static folder recursively
$staticPath = Join-Path $BuildPath "static"
if (Test-Path $staticPath) {
    Write-Host "Uploading static folder..." -ForegroundColor Cyan
    Add-PnPFile -Path $staticPath -Folder "$LibraryName/static" -Recursive
}

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "Access your app at: $SiteUrl/$LibraryName/index.html" -ForegroundColor Yellow
Write-Host "`nNext steps:" -ForegroundColor Green
Write-Host "1. Navigate to the URL above" -ForegroundColor White
Write-Host "2. The app should automatically authenticate using your SharePoint session" -ForegroundColor White
Write-Host "3. Check the browser console for any errors" -ForegroundColor White
Write-Host "4. Verify that staff load with real roles and students show team assignments" -ForegroundColor White

Disconnect-PnPOnline