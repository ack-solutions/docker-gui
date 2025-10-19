# Docker GUI - Windows Installation Script
# Run as Administrator: powershell -ExecutionPolicy Bypass -File install-windows.ps1

param(
    [string]$InstallPath = "C:\Program Files\DockerGUI",
    [string]$DataPath = "C:\ProgramData\DockerGUI",
    [switch]$SkipNodeInstall
)

$ErrorActionPreference = "Stop"

# Check if running as Administrator
function Test-Administrator {
    $currentUser = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
    return $currentUser.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-Administrator)) {
    Write-Host "ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    exit 1
}

Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Blue
Write-Host "║                                                    ║" -ForegroundColor Blue
Write-Host "║        Docker GUI - Windows Installation           ║" -ForegroundColor Blue
Write-Host "║                                                    ║" -ForegroundColor Blue
Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Blue
Write-Host ""

# Install Node.js
function Install-NodeJS {
    if (-not $SkipNodeInstall) {
        Write-Host "Checking Node.js installation..." -ForegroundColor Blue
        
        try {
            $nodeVersion = node -v
            Write-Host "✓ Node.js $nodeVersion is installed" -ForegroundColor Green
        }
        catch {
            Write-Host "Installing Node.js..." -ForegroundColor Yellow
            
            # Download Node.js installer
            $nodeInstaller = "$env:TEMP\node-installer.msi"
            Invoke-WebRequest -Uri "https://nodejs.org/dist/v22.0.0/node-v22.0.0-x64.msi" -OutFile $nodeInstaller
            
            # Install silently
            Start-Process msiexec.exe -ArgumentList "/i `"$nodeInstaller`" /quiet /norestart" -Wait
            
            # Refresh PATH
            $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
            
            Write-Host "✓ Node.js installed" -ForegroundColor Green
        }
    }
}

# Install dependencies
function Install-Dependencies {
    Write-Host "Installing build tools..." -ForegroundColor Blue
    
    # Install windows-build-tools (required for native modules)
    npm install -g windows-build-tools 2>$null || Write-Host "Build tools already installed" -ForegroundColor Yellow
    
    # Install yarn
    npm install -g yarn
    
    Write-Host "✓ Dependencies installed" -ForegroundColor Green
}

# Create directories
function Create-Directories {
    Write-Host "Creating directories..." -ForegroundColor Blue
    
    New-Item -ItemType Directory -Force -Path $InstallPath | Out-Null
    New-Item -ItemType Directory -Force -Path $DataPath | Out-Null
    New-Item -ItemType Directory -Force -Path "$DataPath\logs" | Out-Null
    New-Item -ItemType Directory -Force -Path "$DataPath\nginx" | Out-Null
    New-Item -ItemType Directory -Force -Path "$DataPath\ssl" | Out-Null
    
    Write-Host "✓ Directories created" -ForegroundColor Green
}

# Install application
function Install-Application {
    Write-Host "Installing Docker GUI application..." -ForegroundColor Blue
    
    # Copy files
    Write-Host "Copying application files..."
    Copy-Item -Path ".\*" -Destination $InstallPath -Recurse -Force -Exclude @("node_modules", ".next", ".git", "backups")
    
    # Install dependencies
    Write-Host "Installing npm packages..."
    Push-Location $InstallPath
    yarn install --frozen-lockfile
    
    # Build application
    Write-Host "Building application..."
    yarn build
    
    # Setup environment
    if (-not (Test-Path "$InstallPath\.env")) {
        Copy-Item "$InstallPath\.env.example" "$InstallPath\.env"
        
        # Generate secrets
        $jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object {[char]$_})
        $dnsKey = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 16 | ForEach-Object {[char]$_})
        
        # Update .env
        (Get-Content "$InstallPath\.env") `
            -replace 'JWT_SECRET=.*', "JWT_SECRET=$jwtSecret" `
            -replace 'DNS_API_KEY=.*', "DNS_API_KEY=$dnsKey" `
            -replace 'NODE_ENV=.*', 'NODE_ENV=production' `
            -replace 'DATABASE_URL=.*', "DATABASE_URL=file:$DataPath\docker-gui.db" |
            Set-Content "$InstallPath\.env"
    }
    
    # Run migrations
    Write-Host "Running database migrations..."
    $env:DATABASE_URL = "file:$DataPath\docker-gui.db"
    yarn db:migrate
    yarn db:seed
    
    Pop-Location
    
    Write-Host "✓ Application installed" -ForegroundColor Green
}

# Create Windows Service
function Create-WindowsService {
    Write-Host "Creating Windows Service..." -ForegroundColor Blue
    
    # Install NSSM (Non-Sucking Service Manager)
    $nssmPath = "$InstallPath\nssm.exe"
    if (-not (Test-Path $nssmPath)) {
        Write-Host "Downloading NSSM..."
        $nssmZip = "$env:TEMP\nssm.zip"
        Invoke-WebRequest -Uri "https://nssm.cc/release/nssm-2.24.zip" -OutFile $nssmZip
        Expand-Archive -Path $nssmZip -DestinationPath $env:TEMP -Force
        Copy-Item "$env:TEMP\nssm-2.24\win64\nssm.exe" $nssmPath
    }
    
    # Remove existing service if any
    & $nssmPath stop DockerGUI 2>$null
    & $nssmPath remove DockerGUI confirm 2>$null
    
    # Create service
    $nodePath = (Get-Command node).Source
    & $nssmPath install DockerGUI "$nodePath" "$InstallPath\server.js"
    & $nssmPath set DockerGUI AppDirectory $InstallPath
    & $nssmPath set DockerGUI AppEnvironmentExtra "NODE_ENV=production"
    & $nssmPath set DockerGUI DisplayName "Docker GUI"
    & $nssmPath set DockerGUI Description "Web interface for Docker management"
    & $nssmPath set DockerGUI Start SERVICE_AUTO_START
    & $nssmPath set DockerGUI AppStdout "$DataPath\logs\docker-gui.log"
    & $nssmPath set DockerGUI AppStderr "$DataPath\logs\docker-gui-error.log"
    & $nssmPath set DockerGUI AppRotateFiles 1
    & $nssmPath set DockerGUI AppRotateSeconds 86400
    
    Write-Host "✓ Windows Service created" -ForegroundColor Green
}

# Configure firewall
function Configure-Firewall {
    Write-Host "Configuring Windows Firewall..." -ForegroundColor Blue
    
    # Allow port 3000
    New-NetFirewallRule -DisplayName "Docker GUI" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow -ErrorAction SilentlyContinue
    
    Write-Host "✓ Firewall configured" -ForegroundColor Green
}

# Main execution
try {
    Install-NodeJS
    Install-Dependencies
    Create-Directories
    Install-Application
    Create-WindowsService
    Configure-Firewall
    
    Write-Host ""
    Write-Host "╔════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║                                                    ║" -ForegroundColor Green
    Write-Host "║     🎉 Docker GUI Installation Complete! 🎉       ║" -ForegroundColor Green
    Write-Host "║                                                    ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
    Write-Host "📍 Installation Details:" -ForegroundColor Blue
    Write-Host "   Application: $InstallPath"
    Write-Host "   Data: $DataPath"
    Write-Host "   Logs: $DataPath\logs"
    Write-Host ""
    Write-Host "🌐 Access:" -ForegroundColor Blue
    Write-Host "   http://localhost:3000"
    Write-Host ""
    Write-Host "📝 Service Management:" -ForegroundColor Blue
    Write-Host "   Start:   Start-Service DockerGUI"
    Write-Host "   Stop:    Stop-Service DockerGUI"
    Write-Host "   Restart: Restart-Service DockerGUI"
    Write-Host "   Status:  Get-Service DockerGUI"
    Write-Host ""
    
    $startService = Read-Host "Start service now? (Y/n)"
    if ($startService -ne "n") {
        Start-Service DockerGUI
        Write-Host "✓ Service started" -ForegroundColor Green
        Start-Sleep -Seconds 2
        Get-Service DockerGUI
    }
    
    Write-Host ""
    Write-Host "Happy managing! 🐳" -ForegroundColor Green
}
catch {
    Write-Host ""
    Write-Host "ERROR: Installation failed" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

