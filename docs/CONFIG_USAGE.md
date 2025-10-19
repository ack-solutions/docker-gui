# Configuration System Usage Guide

This guide explains how to use the new configuration system in Docker GUI.

## Overview

Docker GUI now uses a centralized configuration system that loads from `config.yml` with fallback to environment variables. This provides:

- **Single source of truth** for all configuration
- **Type-safe configuration** with TypeScript
- **Easy to extend** for future features
- **Backward compatible** with .env files
- **Runtime validation** to catch errors early

## Basic Usage

### Importing Configuration

```typescript
// Import the full config object
import { config } from '@/server/config';

// Use specific values
const port = config.app.port;
const dbPath = config.database.path;
const jwtSecret = config.security.jwtSecret;
```

### Getting Specific Values

```typescript
import { getConfigValue } from '@/server/config';

// Get a specific value by path
const port = getConfigValue<number>('app.port');
const smtpHost = getConfigValue<string>('email.smtp.host');
```

### Checking Feature Flags

```typescript
import { isFeatureEnabled } from '@/server/config';

// Check if a feature is enabled
if (isFeatureEnabled('nginxManagement')) {
  // Initialize Nginx management
}

if (isFeatureEnabled('emailManagement')) {
  // Setup email service
}
```

## Configuration Structure

The configuration is organized into logical sections:

```typescript
config.app          // Application settings (port, environment, etc.)
config.admin        // Default admin user credentials
config.docker       // Docker connection settings
config.database     // Database configuration
config.nginx        // Nginx integration settings
config.email        // Email/SMTP configuration
config.dns          // DNS provider settings
config.ssl          // SSL certificate settings
config.proxies      // Proxy management settings
config.features     // Feature flags
config.performance  // Performance tuning
config.backup       // Backup settings
config.security     // Security settings (JWT, bcrypt, etc.)
```

## Adding New Configuration Options

### 1. Update Types

Edit `src/server/config/types.ts`:

```typescript
export interface MyFeatureConfig {
  enabled: boolean;
  apiKey: string;
  timeout?: number;
}

export interface Config {
  // ... existing config
  myFeature: MyFeatureConfig;
}
```

### 2. Add Defaults

Edit `src/server/config/defaults.ts`:

```typescript
export function getDefaultConfig(): Config {
  return {
    // ... existing defaults
    myFeature: {
      enabled: false,
      apiKey: '',
      timeout: 30000,
    },
  };
}
```

### 3. Add Validation (Optional)

Edit `src/server/config/validator.ts`:

```typescript
export function validateConfig(config: Config): ValidationResult {
  const errors: string[] = [];
  
  // ... existing validation
  
  if (config.myFeature?.enabled) {
    if (!config.myFeature.apiKey) {
      errors.push('myFeature.apiKey is required when enabled');
    }
  }
  
  return { valid: errors.length === 0, errors };
}
```

### 4. Add to config.yml Template

Edit `config.example.yml`:

```yaml
# My Feature Configuration
myFeature:
  enabled: false
  apiKey: ""
  timeout: 30000  # milliseconds
```

### 5. Use in Your Code

```typescript
import { config } from '@/server/config';

if (config.myFeature.enabled) {
  const api = new MyFeatureAPI(config.myFeature.apiKey);
  // ...
}
```

## Environment Variable Fallback

The config system maintains backward compatibility with environment variables. Values are loaded in this priority:

1. **config.yml** (highest priority)
2. **.env / environment variables**
3. **Default values** (lowest priority)

### Adding Environment Variable Support

Edit `src/server/config/config-loader.ts` in the `loadFromEnv()` method:

```typescript
private loadFromEnv(): PartialConfig {
  const env = process.env;

  return {
    // ... existing mappings
    myFeature: {
      enabled: env.MY_FEATURE_ENABLED === 'true',
      apiKey: env.MY_FEATURE_API_KEY || '',
      timeout: env.MY_FEATURE_TIMEOUT ? parseInt(env.MY_FEATURE_TIMEOUT, 10) : undefined,
    },
  };
}
```

## Best Practices

### 1. Always Use TypeScript Types

```typescript
// Good ✓
const port: number = config.app.port;

// Also good ✓
const port = config.app.port; // Type inferred automatically

// Avoid ✗
const port = process.env.PORT; // String, needs parsing, no validation
```

### 2. Use Feature Flags

```typescript
// Good ✓
if (isFeatureEnabled('nginxManagement')) {
  setupNginx();
}

// Avoid ✗
if (config.nginx.enabled) {
  // Doesn't check the feature flag
}
```

### 3. Validate Configuration Early

The config is validated on load, but you can add runtime checks:

```typescript
import { validateConfig } from '@/server/config';

const validation = validateConfig(config);
if (!validation.valid) {
  console.error('Config errors:', validation.errors);
  process.exit(1);
}
```

### 4. Don't Mutate Config

```typescript
// Bad ✗
config.app.port = 4000;

// Good ✓
// Edit config.yml and reload
import { reloadConfig } from '@/server/config';
const newConfig = reloadConfig();
```

### 5. Use Descriptive Paths

```typescript
// Good ✓
const smtpHost = config.email.smtp.host;
const dbType = config.database.type;

// Avoid ✗
const value = getConfigValue('x'); // What is 'x'?
```

## Hot Reloading Configuration

For development or dynamic configuration updates:

```typescript
import { configLoader } from '@/server/config';

// Reload configuration from file
const newConfig = configLoader.reload();

// The global 'config' will now return new values
```

## Configuration in API Routes

```typescript
// app/api/config/route.ts
import { NextResponse } from 'next/server';
import { config } from '@/server/config';

export async function GET() {
  // Return safe config values (don't expose secrets!)
  return NextResponse.json({
    app: {
      environment: config.app.environment,
      // Don't expose port for security
    },
    features: config.features,
  });
}
```

## Testing with Custom Config

```typescript
import { ConfigLoader } from '@/server/config/config-loader';

// Create a test config loader
const testConfig = new ConfigLoader({
  app: {
    port: 3001,
    environment: 'test',
  },
  // ... other test values
});

// Use in tests
const service = new MyService(testConfig.config);
```

## Migration from process.env

### Before

```typescript
const port = parseInt(process.env.PORT || '3000', 10);
const jwtSecret = process.env.JWT_SECRET || 'secret';
const adminEmail = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com';
```

### After

```typescript
import { config } from '@/server/config';

const port = config.app.port;
const jwtSecret = config.security.jwtSecret;
const adminEmail = config.admin.email;
```

## Troubleshooting

### Config File Not Found

```
Config file not found at /path/to/config.yml, using defaults
```

**Solution:** Create `config.yml` from `config.example.yml`

```bash
cp config.example.yml config.yml
```

### Validation Errors

```
Configuration validation failed:
  - admin.email must be a valid email address
  - security.jwtSecret must be at least 32 characters long
```

**Solution:** Fix the invalid values in `config.yml`

### Type Errors

```typescript
// Error: Type 'string | undefined' is not assignable to type 'string'
const host: string = config.email.smtp.host;
```

**Solution:** Handle optional values

```typescript
const host = config.email.smtp.host || 'localhost';
// or
const host = config.email.smtp.host ?? 'localhost';
```

## Examples

### Example 1: Email Service

```typescript
import { config, isFeatureEnabled } from '@/server/config';
import nodemailer from 'nodemailer';

class EmailService {
  private transporter;

  constructor() {
    if (!isFeatureEnabled('emailManagement')) {
      throw new Error('Email management is not enabled');
    }

    this.transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
      auth: config.email.smtp.user ? {
        user: config.email.smtp.user,
        pass: config.email.smtp.pass,
      } : undefined,
    });
  }

  async send(to: string, subject: string, body: string) {
    await this.transporter.sendMail({
      from: `${config.email.from?.name} <${config.email.from?.address}>`,
      to,
      subject,
      html: body,
    });
  }
}
```

### Example 2: Feature-Gated Route

```typescript
// app/api/nginx/sites/route.ts
import { NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/server/config';

export async function GET() {
  if (!isFeatureEnabled('nginxManagement')) {
    return NextResponse.json(
      { error: 'Nginx management is not enabled' },
      { status: 403 }
    );
  }

  // ... handle request
}
```

### Example 3: Environment-Specific Behavior

```typescript
import { config } from '@/server/config';

class Logger {
  log(message: string) {
    if (config.app.environment === 'development') {
      console.log(`[DEV] ${message}`);
    } else {
      // Send to logging service
    }
  }
}
```

## See Also

- [Configuration Reference](./CONFIGURATION.md) - All configuration options
- [Type Definitions](../src/server/config/types.ts) - TypeScript types
- [Validation Rules](../src/server/config/validator.ts) - Validation logic

