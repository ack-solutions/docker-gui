# Configuration System - Complete Guide

## ✅ What's Been Done

### 1. Created Centralized Config System

All configuration is now managed through a type-safe, centralized system that:
- Loads from `config.yml` as the primary source
- Falls back to environment variables for backward compatibility
- Uses sensible defaults for all settings
- Validates configuration on load
- Provides TypeScript types for IDE autocompletion

### 2. File Structure

```
src/server/config/
├── index.ts              # Main export point
├── types.ts              # TypeScript type definitions
├── config-loader.ts      # Configuration loading logic
├── defaults.ts           # Default values
└── validator.ts          # Validation rules
```

### 3. Configuration Sections

```typescript
config.app          // Port, environment, hostname
config.admin        // Default admin credentials  
config.docker       // Docker socket/TCP settings
config.database     // SQLite/Postgres/MySQL settings
config.nginx        // Nginx integration
config.email        // SMTP configuration
config.dns          // DNS provider (PowerDNS/Cloudflare/Route53)
config.ssl          // SSL certificates (Let's Encrypt/manual)
config.proxies      // Proxy management
config.features     // Feature flags for enabling/disabling features
config.performance  // Refresh intervals, retention periods
config.backup       // Backup configuration
config.security     // JWT, bcrypt, CORS, rate limiting
```

### 4. Migration Status

**✅ Completed:**
- `src/server/database/data-source.ts` - Database configuration
- `src/server/auth/auth-service.ts` - JWT and admin credentials
- `src/server/docker/client.ts` - Docker connection settings

**⏳ Remaining (can be updated incrementally):**
- `src/server/database/seeds/user.seed.ts`
- `src/server/database/run-seeds.ts`
- `src/server/nginx/nginx-site-service.ts`
- Various other files

## 🚀 How to Use

### Basic Usage

```typescript
import { config } from '@/server/config';

// Simple access
const port = config.app.port;
const adminEmail = config.admin.email;
const jwtSecret = config.security.jwtSecret;

// Feature flags
if (config.features.nginxManagement) {
  // Initialize Nginx management
}
```

### Advanced Usage

```typescript
import { getConfigValue, isFeatureEnabled, reloadConfig } from '@/server/config';

// Get specific value by path
const smtpHost = getConfigValue<string>('email.smtp.host');

// Check feature
if (isFeatureEnabled('emailManagement')) {
  // Setup email
}

// Reload configuration (hot reload)
const newConfig = reloadConfig();
```

## 📝 Adding New Configuration

### Step-by-Step Guide

#### 1. Add Types (`src/server/config/types.ts`)

```typescript
export interface MyNewFeatureConfig {
  enabled: boolean;
  apiKey?: string;
  timeout: number;
}

export interface Config {
  // ... existing
  myNewFeature: MyNewFeatureConfig;
}
```

#### 2. Add Defaults (`src/server/config/defaults.ts`)

```typescript
export function getDefaultConfig(): Config {
  return {
    // ... existing
    myNewFeature: {
      enabled: false,
      apiKey: undefined,
      timeout: 30000,
    },
  };
}
```

#### 3. Add Env Mapping (`src/server/config/config-loader.ts`)

```typescript
private loadFromEnv(): PartialConfig {
  const env = process.env;
  return {
    // ... existing
    myNewFeature: {
      enabled: env.MY_FEATURE_ENABLED === 'true',
      apiKey: env.MY_FEATURE_API_KEY,
      timeout: env.MY_FEATURE_TIMEOUT ? parseInt(env.MY_FEATURE_TIMEOUT, 10) : undefined,
    },
  };
}
```

#### 4. Add to config.yml Template

Edit `config.example.yml`:

```yaml
# My New Feature
myNewFeature:
  enabled: false
  apiKey: ""
  timeout: 30000
```

#### 5. Add Validation (Optional)

Edit `src/server/config/validator.ts`:

```typescript
if (config.myNewFeature?.enabled && !config.myNewFeature.apiKey) {
  errors.push('myNewFeature.apiKey is required when enabled');
}
```

## 🎯 Benefits

### 1. Type Safety
- Full TypeScript support
- IDE autocompletion
- Compile-time error checking

### 2. Single Source of Truth
- All config in one place (`config.yml`)
- No scattered `process.env` calls
- Easy to see all settings

### 3. Validation
- Config validated on startup
- Clear error messages
- Prevents runtime errors

### 4. Easy to Extend
- Add new features easily
- Clear pattern to follow
- Self-documenting

### 5. Backward Compatible
- Still works with .env files
- Gradual migration possible
- No breaking changes

## 📖 Priority Order

Configuration values are loaded with this priority (highest first):

1. **config.yml** - Your main configuration file
2. **Environment Variables** - From .env or system environment
3. **Defaults** - Sensible fallback values

## 🔧 Configuration File

### config.yml Location

The config file is loaded from:
1. Path specified in `CONFIG_FILE` env var
2. `./config.yml` (project root)

### Example config.yml

```yaml
# Application Settings
app:
  port: 3000
  hostname: "0.0.0.0"
  environment: "production"

# Admin User
admin:
  email: "admin@example.com"
  password: "YourSecurePassword"
  name: "Administrator"

# Docker Connection
docker:
  host: "unix:///var/run/docker.sock"

# Database
database:
  type: "sqlite"
  path: "/app/data/docker-gui.db"

# Features
features:
  containerManagement: true
  imageManagement: true
  nginxManagement: false
  emailManagement: false

# Security
security:
  jwtSecret: "your-long-random-secret-here"
  jwtExpiresIn: "24h"
  bcryptRounds: 10
```

## 🛠️ Tools & Scripts

### Generate .env from config.yml

```bash
./scripts/config-to-env.sh
```

### Validate Configuration

```bash
./scripts/validate-config.sh
```

### Interactive Setup

```bash
./scripts/setup-interactive.sh
```

## 📚 Documentation

- **[CONFIG_USAGE.md](./docs/CONFIG_USAGE.md)** - Detailed usage guide
- **[CONFIGURATION.md](./docs/CONFIGURATION.md)** - All configuration options
- **[config.example.yml](./config.example.yml)** - Template with all options

## 🔄 Migration from process.env

### Before

```typescript
const port = parseInt(process.env.PORT || '3000', 10);
const jwtSecret = process.env.JWT_SECRET || 'default';
const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
```

### After

```typescript
import { config } from '@/server/config';

const port = config.app.port;
const jwtSecret = config.security.jwtSecret;
const adminEmail = config.admin.email;
```

## ⚡ Performance

- Config loaded once on startup
- Cached in memory
- No performance overhead
- Optional hot reload capability

## 🔒 Security

- Secrets in config.yml (gitignored)
- Environment variables still supported
- Validation prevents misconfigurations
- No secrets logged

## 🐛 Troubleshooting

### Config file not found

**Error:** `Config file not found at /path/to/config.yml, using defaults`

**Solution:**
```bash
cp config.example.yml config.yml
# Edit config.yml with your settings
```

### Validation failed

**Error:** `Configuration validation failed: admin.email must be a valid email address`

**Solution:** Fix the invalid value in `config.yml`

### Type errors

**Error:** `Type 'string | undefined' is not assignable to type 'string'`

**Solution:** Handle optional values:
```typescript
const value = config.some.optional || 'default';
```

## 📦 Dependencies

```json
{
  "yaml": "^2.8.1"  // YAML parsing
}
```

## 🎓 Examples

### Example 1: Feature Flag

```typescript
import { isFeatureEnabled } from '@/server/config';

export async function GET() {
  if (!isFeatureEnabled('nginxManagement')) {
    return new Response('Feature disabled', { status: 403 });
  }
  // ... handle request
}
```

### Example 2: Email Service

```typescript
import { config } from '@/server/config';
import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: config.email.smtp.host,
  port: config.email.smtp.port,
  secure: config.email.smtp.secure,
  auth: {
    user: config.email.smtp.user,
    pass: config.email.smtp.pass,
  },
});
```

### Example 3: Environment-Specific Behavior

```typescript
import { config } from '@/server/config';

if (config.app.environment === 'development') {
  console.log('Development mode');
} else {
  // Production setup
}
```

## ✨ Future Enhancements

Possible future improvements:
- Web UI for config editing
- Config hot-reload without restart
- Multiple environment configs
- Config encryption for secrets
- Config versioning/history

## 🤝 Contributing

When adding new features:
1. Update types in `types.ts`
2. Add defaults in `defaults.ts`
3. Add env mapping in `config-loader.ts`
4. Update `config.example.yml`
5. Add validation if needed
6. Update documentation

## 📄 License

MIT

