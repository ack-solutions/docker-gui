# Nginx Site Wizard - Enhanced with Full Control

## ✅ New Features

### **4-Step User-Friendly Wizard**

#### Step 1: Domains 🌐
**What you can configure:**
- Primary domain (required)
- Alias domains (unlimited)
- Press Enter to add multiple aliases

**Features:**
- Simple, focused interface
- Add multiple domain aliases
- Visual chips for aliases
- Helpful tips

---

#### Step 2: Upstream ⚙️
**What you can configure:**
- Upstream type:
  - Docker Container (with auto-port selection)
  - Internal Service (by hostname)
  - External URL (proxy to another site)

**For Containers:**
- Visual status indicator (🟢/🔴)
- Auto-select first exposed port
- Shows container name, image, and state
- List all available ports

**For Services/External:**
- Free-form input
- Helper text with examples

---

#### Step 3: Security 🔒
**What you can configure:**
- Enable HTTP (port 80)
- Enable HTTPS (port 443)
- Force HTTPS redirect
- SSL Mode:
  - Let's Encrypt (free automated)
  - Custom Certificate
  - None (SSL handled elsewhere)
- Email for Let's Encrypt (optional)

**Features:**
- Toggle switches for easy control
- Clear descriptions
- Smart defaults (HTTPS enabled)
- Email optional

---

#### Step 4: Advanced & Review ⚡
**What you can configure:**

##### Configuration Summary
- Review all settings
- See exactly what will be created
- Visual chips for enabled features

##### Advanced Options (Expandable)
1. **Custom Nginx Directives** 📝
   - Write any nginx configuration
   - Full control over server block
   - Examples provided
   - Syntax: Raw nginx config

**Example Custom Directives:**
```nginx
# Upload size limit
client_max_body_size 100M;

# Timeouts
proxy_read_timeout 300;
proxy_connect_timeout 300;

# Custom headers
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";

# Rate limiting
limit_req_zone $binary_remote_addr zone=mylimit:10m rate=10r/s;
limit_req zone=mylimit burst=20;

# Custom locations
location /api {
    proxy_pass http://backend:3000;
    proxy_set_header X-Real-IP $remote_addr;
}

location /static {
    root /var/www;
    expires 30d;
}
```

2. **Internal Notes** 📋
   - Document your configuration
   - For team reference
   - Not visible to nginx

3. **Enable/Disable Toggle**
   - Create as draft or enabled
   - Can enable later

---

## 🎯 Full Control Features

### What Advanced Users Can Do

#### 1. **Custom Location Blocks**
```nginx
location /special {
    proxy_pass http://special-service:8080;
    proxy_buffering off;
}
```

#### 2. **Custom Headers**
```nginx
add_header Strict-Transport-Security "max-age=31536000";
add_header Content-Security-Policy "default-src 'self'";
```

#### 3. **Upload Limits**
```nginx
client_max_body_size 500M;
client_body_buffer_size 128k;
```

#### 4. **Timeouts**
```nginx
proxy_connect_timeout 600;
proxy_send_timeout 600;
proxy_read_timeout 600;
```

#### 5. **Rate Limiting**
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=100r/m;
limit_req zone=api burst=20 nodelay;
```

#### 6. **WebSocket Support**
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

#### 7. **CORS Headers**
```nginx
add_header Access-Control-Allow-Origin "*";
add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
```

#### 8. **Caching**
```nginx
proxy_cache_bypass $http_upgrade;
proxy_cache my_cache;
proxy_cache_valid 200 302 10m;
```

---

## 📊 Comparison

### Before (Old Form)
```
All fields in one dialog
No step-by-step
No custom config
Overwhelming
```

### After (New Wizard)
```
4 clear steps
Progressive disclosure
Custom directives field
User-friendly + powerful
```

---

## 🎨 User Experience

### For Beginners
1. **Simple Mode** - Just follow the steps
2. **Smart Defaults** - HTTPS enabled, auto-port
3. **Clear Labels** - No technical jargon
4. **Helpful Tips** - Guidance at each step

### For Advanced Users
1. **Custom Directives** - Full nginx control
2. **All Options** - Every setting available
3. **Examples** - Code samples provided
4. **Power** - Can configure anything

### For Everyone
1. **Step-by-Step** - Not overwhelming
2. **Validation** - Helpful error messages
3. **Review** - Summary before creating
4. **Flexible** - Simple or advanced

---

## 💡 Common Use Cases

### Case 1: Simple Container Proxy
**Steps:**
1. Enter domain: myapp.com
2. Select container + port (auto-selected)
3. Enable HTTPS ✓
4. Done!

### Case 2: Multiple Domains → Same App
**Steps:**
1. Primary: example.com
2. Add aliases: www.example.com, app.example.com
3. Select container + port
4. Enable HTTPS + Force redirect
5. Done!

### Case 3: Advanced with Custom Config
**Steps:**
1. Enter domain: api.example.com
2. Select container: api-server:3000
3. Enable HTTPS with Let's Encrypt
4. Show Advanced → Add custom directives:
```nginx
client_max_body_size 50M;
proxy_read_timeout 300;

location /upload {
    client_max_body_size 500M;
}
```
5. Create!

### Case 4: WebSocket Proxy
**Steps:**
1. Domain: ws.example.com
2. Container: websocket-server:8080
3. HTTPS enabled
4. Custom directives:
```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
proxy_read_timeout 86400;
```
5. Done!

---

## 🔧 Technical Implementation

### Wizard Structure
```
nginx-site-wizard.tsx
├── Step 0: Domains
│   ├── Primary domain input
│   └── Alias chips
├── Step 1: Upstream
│   ├── Type selector
│   ├── Container picker (with status)
│   ├── Port auto-select
│   └── Service/URL input
├── Step 2: Security
│   ├── HTTP/HTTPS toggles
│   ├── Force HTTPS
│   ├── SSL mode selector
│   └── Email input
└── Step 3: Advanced & Review
    ├── Configuration summary
    ├── Custom directives (textarea)
    ├── Notes field
    └── Enable toggle
```

### Custom Directives Field
```tsx
<TextField
  label="Custom Nginx Directives"
  multiline
  rows={8}
  value={customDirectives}
  onChange={...}
  placeholder="# Your custom nginx config here"
  sx={{ fontFamily: "monospace" }}
/>
```

### Auto-Port Selection
```tsx
onChange={(_, value) => {
  setSelectedContainer(value);
  // Auto-select first port
  if (value && value.ports.length > 0) {
    const port = extractPort(value.ports[0]);
    setContainerPort(port);
  }
}}
```

---

## ✨ Key Features

### Progressive Disclosure
- **Beginners:** Simple 3-step flow (skip advanced)
- **Advanced:** 4th step with custom config
- **Everyone:** Clear, guided experience

### Smart Defaults
- ✅ HTTPS enabled by default
- ✅ Force HTTPS recommended
- ✅ Let's Encrypt selected
- ✅ Auto-port selection
- ✅ Site enabled on creation

### Full Control
- ✅ All nginx settings available
- ✅ Custom directives textarea
- ✅ Raw nginx configuration
- ✅ Unlimited possibilities

### User-Friendly
- ✅ Step-by-step wizard
- ✅ Validation at each step
- ✅ Helpful error messages
- ✅ Info alerts
- ✅ Examples provided

---

## 📚 Examples Included

The custom directives field includes helpful placeholder examples:
- Upload size limits
- Timeouts
- Custom headers
- Location blocks
- Proxy settings

---

## 🎯 Summary

**For Simple Use:** Follow 3 steps, skip advanced  
**For Advanced Use:** Use all 4 steps, add custom config  
**For Power Users:** Full nginx configuration control  

**Everyone wins:** User-friendly wizard + full flexibility! 🎉

