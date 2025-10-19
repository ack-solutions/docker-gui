# Docker GUI Documentation

Complete documentation for Docker GUI installation, configuration, and usage.

## Getting Started

**New users start here:**

1. [Quick Start Guide](./QUICK_START.md) - Get running in 5 minutes
   - 4 different installation paths
   - Fastest way to try the app
   - Step-by-step for beginners

## Installation

**Detailed installation instructions:**

2. [Installation Guide](./INSTALLATION.md) - Complete installation reference
   - Docker installation (all compose files)
   - Native installation (Linux/macOS/Windows)
   - Prerequisites and requirements
   - Troubleshooting installation issues
   - System requirements
   - Uninstallation guide

## Configuration

**How to configure the application:**

3. [Configuration Reference](./CONFIGURATION.md) - Complete config.yml documentation
   - All configuration options explained
   - How to change settings
   - Common configuration examples
   - Validation and troubleshooting
   - Best practices

4. **[Config Usage Guide](./CONFIG_USAGE.md)** - How to use config in code ⭐ NEW
   - Import and use configuration
   - Add new config options
   - Type-safe configuration
   - Feature flags
   - Best practices

5. **[Config System Summary](./CONFIG_SYSTEM_SUMMARY.md)** - Complete technical guide ⭐ NEW
   - Architecture overview
   - Migration guide from process.env
   - Adding new features
   - Examples and patterns

## Docker Services

**For users running full stack:**

6. [Docker Setup Guide](./DOCKER_SETUP.md) - Docker services explained
   - Nginx reverse proxy setup
   - Email server configuration (MailHog/Postfix)
   - DNS server setup (PowerDNS)
   - SSL certificates (Let's Encrypt)
   - Service management
   - Backup and restore

## Command Reference

**Quick command lookup:**

7. [Command Reference](./COMMANDS.md) - All commands in one place
   - Setup commands
   - Docker commands  
   - Service management
   - Configuration commands
   - Maintenance commands
   - Troubleshooting commands

## Quick Links

### Setup
- Interactive setup: Run `./scripts/setup-interactive.sh`
- Quick Docker: Run `docker-compose up -d`
- Full stack: Run `docker-compose -f docker-compose.full.yml up -d`
- Native install: Run `sudo ./scripts/install.sh`

### Configuration Files
- [config.example.yml](../config.example.yml) - Template with all options
- `config.yml` - Your active configuration (create from example)
- `.env` - Auto-generated from config.yml (don't edit directly)

### Scripts
- See [../scripts/README.md](../scripts/README.md) for all utility scripts

## Documentation Structure

```
docs/
├── README.md                   (this file)
├── QUICK_START.md              Start here - 5 minute guide
├── INSTALLATION.md             Full installation instructions
├── CONFIGURATION.md            Configuration reference
├── CONFIG_USAGE.md             ⭐ How to use config in code
├── CONFIG_SYSTEM_SUMMARY.md    ⭐ Complete config system guide
├── DOCKER_SETUP.md             Docker services guide
└── COMMANDS.md                 Command reference
```

## Support

- Check [Configuration Reference](./CONFIGURATION.md) for settings
- Check [Command Reference](./COMMANDS.md) for commands
- Check [Installation Guide](./INSTALLATION.md) for install issues
- Check [Config Usage Guide](./CONFIG_USAGE.md) for development
- Check main [README](../README.md) for project overview

## Contributing

When updating documentation:
1. Keep it clear and concise
2. Provide working examples
3. Update this README if adding new docs
4. No emojis in documentation
5. Test all commands before documenting
