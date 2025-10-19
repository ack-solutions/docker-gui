# Troubleshooting: Nginx Deployment 500 Error

## Error
```
POST /api/nginx/sites/{id}/deploy 500 in 774ms
```

## Common Causes

### 1. **Missing or Invalid Container**
If routing to a Docker container that doesn't exist or isn't running:
- **Error:** Container ID not found
- **Solution:** Ensure the container is running before deploying

### 2. **Invalid Proxy Target**
If the upstream target can't be resolved:
- **Error:** Cannot resolve proxy target
- **Solution:** Check the target configuration (container port, external URL)

### 3. **Nginx Configuration Test Failed**
If the generated nginx config has syntax errors:
- **Error:** nginx -t failed
- **Solution:** Check nginx logs and configuration syntax

### 4. **SSL Certificate Issues**
If Let's Encrypt certificate request fails:
- **Error:** Certbot failed / Email required
- **Solution:** Ensure domain DNS is pointing correctly and email is provided

### 5. **File Permission Issues**
If the system can't write nginx config files:
- **Error:** EACCES / EPERM
- **Solution:** Check file permissions on nginx config directories

---

## How to Debug

### Step 1: Check Nginx Provision Logs
```bash
# View recent logs for a specific site
GET /api/nginx/sites/{siteId}/logs
```

The logs will show exactly where the deployment failed:
- "Resolved upstream target to..."
- "Wrote configuration to..."
- "nginx -t completed successfully"
- "Reloading nginx..."

### Step 2: Check Console Errors
Open browser dev tools → Console tab to see the full error message

### Step 3: Check Server Logs
```bash
# If running with Docker
docker logs docker-gui-app

# If running with Node
npm run dev  # watch console output
```

### Step 4: Verify Domain Configuration
Make sure the domain has valid target settings:
- Container ID exists and container is running
- Container port is correct
- External URL is accessible (if using external target)
- Email is provided if using Let's Encrypt SSL

---

## Quick Fixes

### Fix 1: For Container Routing Issues
```typescript
// Make sure container is running first
const containers = await fetch('/api/docker/containers');
// Verify your container ID is in the list and state is "running"

// Then create domain with correct container port
{
  target: {
    type: "container",
    containerId: "abc123...",  // ✓ Must match running container
    containerPort: 3000,        // ✓ Must be a port the container exposes
    enableHttps: true,
    sslMode: "lets-encrypt",
    letsEncryptEmail: "admin@example.com"  // ✓ Must be valid
  }
}
```

### Fix 2: For External URL Issues
```typescript
{
  target: {
    type: "external",
    externalUrl: "https://example.com",  // ✓ Must include http:// or https://
    enableHttps: true,
    sslMode: "lets-encrypt",
    letsEncryptEmail: "admin@example.com"
  }
}
```

### Fix 3: For DNS-Only Setup
```typescript
{
  target: {
    type: "none",
    enableHttp: true,
    enableHttps: true,
    sslMode: "none"  // ✓ No SSL for DNS-only
  }
}
```

---

## Validation Checklist

Before deploying an nginx site, verify:

- [ ] **Domain name** is valid format (e.g., example.com)
- [ ] **DNS** is pointing to your server (if using SSL)
- [ ] **Container** is running (if using container target)
- [ ] **Container port** matches exposed port
- [ ] **External URL** is accessible (if using external target)
- [ ] **Email** is provided (if using Let's Encrypt)
- [ ] **Nginx** is installed and accessible
- [ ] **Certbot** is installed (if using Let's Encrypt)
- [ ] **File permissions** allow writing to nginx config directory

---

## Environment Variables

Make sure these are properly configured:

```bash
# Nginx settings
NGINX_BINARY=nginx                    # Path to nginx binary
NGINX_CONFIG_ROOT=.data/nginx         # Where to store configs
NGINX_RELOAD_COMMAND=nginx -s reload  # How to reload nginx

# SSL/Certbot settings  
CERTBOT_BINARY=certbot                # Path to certbot
CERTBOT_ARGS=                         # Additional certbot args

# Testing
NGINX_APPLY_DRY_RUN=false            # Set to 'true' for testing without actual deployment
```

---

## API Error Responses

The API returns specific error messages:

| Status | Error | Meaning |
|--------|-------|---------|
| 404 | Nginx site not found | The site ID doesn't exist |
| 500 | Container not found | Docker container doesn't exist |
| 500 | nginx -t failed | Configuration syntax error |
| 500 | Certbot failed | SSL certificate request failed |
| 500 | Permission denied | File system permission issue |

---

## Common Error Messages & Solutions

### "Container {id} not found or not running"
**Solution:** Start the container first
```bash
docker start {container-id}
```

### "Let's Encrypt email is required"
**Solution:** Provide email in target configuration
```typescript
target: {
  sslMode: "lets-encrypt",
  letsEncryptEmail: "admin@example.com"  // ← Add this
}
```

### "nginx: configuration file /etc/nginx/nginx.conf test failed"
**Solution:** Check nginx config syntax
```bash
nginx -t
# Review the error message
```

### "Domain not pointing to this server"
**Solution:** Update DNS records
```bash
# Check current DNS
dig example.com

# Should return your server's IP
# If not, update A record at your DNS provider
```

---

## Testing Without Real Deployment

For development/testing:

```bash
# Set environment variable
export NGINX_APPLY_DRY_RUN=true

# Now deployments will simulate without actually:
# - Writing nginx configs
# - Running nginx -t
# - Reloading nginx
# - Requesting SSL certificates
```

---

## Manual Deployment Steps

If automatic deployment fails, you can manually:

1. **Check the generated config:**
```bash
cat .data/nginx/sites-available/site-{id}.conf
```

2. **Test nginx configuration:**
```bash
nginx -t
```

3. **Reload nginx:**
```bash
nginx -s reload
# or
systemctl reload nginx
```

4. **Request SSL certificate:**
```bash
certbot certonly --nginx \
  --agree-tos \
  --non-interactive \
  -m admin@example.com \
  -d example.com
```

---

## Still Having Issues?

1. Check the nginx provision logs via API
2. Enable dry-run mode to test without affecting nginx
3. Verify all prerequisites are installed
4. Check server logs for detailed error messages
5. Ensure DNS propagation is complete (can take up to 48 hours)

---

## Prevention Tips

- **Always** verify containers are running before creating domains
- **Always** provide valid email for Let's Encrypt
- **Test** DNS configuration before deploying
- **Use** dry-run mode in development
- **Check** logs after each deployment

