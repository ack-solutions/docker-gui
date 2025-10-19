# DNS Records Setup Guide

This guide shows you **what DNS records to create** to point your domains to this Docker GUI server.

---

##  Step 1: Find Your Server's IP Address

First, you need to know your server's public IP address.

### If Server is on Public Internet:

```bash
# Method 1: Check with external service
curl ifconfig.me

# Method 2: Check network interface
ip addr show

# Method 3: AWS/Cloud
# Check your cloud provider dashboard for public IP
```

### If Server is Local/Development:

```bash
# Local machine IP
ip addr show | grep inet

# For local testing, use:
127.0.0.1  # Localhost
```

**Write down your IP**: `___.___.___.___`

---

##  Three DNS Scenarios

Choose based on which DNS mode you're using:

### Scenario A: "Manage DNS Here" (PowerDNS)
 Delegate nameservers to your server
 Manage all records through Docker GUI

### Scenario B: "External Provider" (AWS/Cloudflare/etc.)
 Docker GUI manages records via API
 Records created automatically

### Scenario C: "Proxy Only" (Manual DNS)
 Create records manually at your registrar
 Docker GUI only handles nginx

---

##  Scenario A: Using "Manage DNS Here" (PowerDNS)

When using self-hosted PowerDNS, you need to **delegate your domain's nameservers** to your server.

### Step 1: Point Nameservers to Your Server

**At your domain registrar** (GoDaddy, Namecheap, Google Domains, etc.):

1. Log in to your domain registrar
2. Find "Nameservers" or "DNS Settings"
3. Change nameservers to point to your server:

```
Nameserver 1: ns1.yourdomain.com    123.45.67.89 (Your server IP)
Nameserver 2: ns2.yourdomain.com    123.45.67.89 (Your server IP)
```

**Important**: You need to create **glue records** for ns1 and ns2:

#### Example at GoDaddy:
```
1. Go to domain settings
2. Click "Manage DNS"
3. Under "Nameservers", click "Change"
4. Select "Custom"
5. Add:
   - ns1.yourdomain.com
   - ns2.yourdomain.com
6. Create glue records (Host Records):
   - ns1    A    123.45.67.89
   - ns2    A    123.45.67.89
```

#### Example at Namecheap:
```
1. Domain List  Manage
2. Nameservers  Custom DNS
3. Add:
   - ns1.yourdomain.com
   - ns2.yourdomain.com
4. Advanced DNS tab
5. Add Host Records:
   - ns1    A Record    123.45.67.89
   - ns2    A Record    123.45.67.89
```

### Step 2: Wait for DNS Propagation

After changing nameservers, wait **24-48 hours** for full propagation.

### Step 3: Create Domain in Docker GUI

1. Open Docker GUI  **Domains**
2. Click **"Add Domain"**
3. Select **"Manage DNS Here"**
4. Add DNS records through the interface
5. PowerDNS handles all DNS queries

### What Happens:

```
User types: yourdomain.com
     
Internet DNS asks: Where are nameservers?  ns1.yourdomain.com (your server)
     
Queries your PowerDNS (port 15353)
     
PowerDNS returns: IP address
     
Browser connects to your server
     
Nginx routes to your container
```

### Testing:

```bash
# Test nameserver delegation
dig NS yourdomain.com

# Should show:
# yourdomain.com.  IN NS ns1.yourdomain.com.
# yourdomain.com.  IN NS ns2.yourdomain.com.

# Query your PowerDNS directly
dig @YOUR_SERVER_IP -p 15353 yourdomain.com

# Test full resolution
dig yourdomain.com
```

---

##  Scenario B: Using "External Provider" (AWS/Cloudflare/etc.)

When using external providers, Docker GUI automatically creates DNS records via API.

### You Don't Need to Set Records Manually!

Docker GUI handles everything when you create a domain with "External Provider" mode.

### What You DO Need:

1. **Domain must be in your DNS provider** (AWS Route53, Cloudflare, etc.)
2. **API credentials configured** in `config.yml`
3. **That's it!**

### Example: Cloudflare

#### Before Setup:
```
1. Add domain to Cloudflare
2. Point domain nameservers to Cloudflare:
   - bob.ns.cloudflare.com
   - may.ns.cloudflare.com
3. Get Cloudflare API token
4. Add to config.yml
```

#### Creating Domain:
```
1. Docker GUI  Domains  Add Domain
2. Choose "External Provider"  Cloudflare
3. Enter domain: myapp.com
4. Configure routing
5. Click Create
    Docker GUI automatically creates DNS records in Cloudflare!
```

### What Docker GUI Creates Automatically:

For domain `myapp.com` pointing to container on `123.45.67.89`:

```
myapp.com        A      123.45.67.89
www.myapp.com    CNAME  myapp.com
```

### Testing:

```bash
# Check DNS resolution
dig myapp.com

# Should return your server IP
```

---

##  Scenario C: Using "Proxy Only" (Manual DNS)

When using manual DNS, you create records yourself at your DNS provider.

### Required DNS Records:

#### For Domain: `myapp.com`

**At your DNS provider** (GoDaddy, Cloudflare, Route53, registrar):

```
Record Type: A
Host: @
Value: 123.45.67.89  (Your server IP)
TTL: 3600
```

**For www subdomain:**
```
Record Type: CNAME
Host: www
Value: myapp.com
TTL: 3600
```

**For subdomain (e.g., api.myapp.com):**
```
Record Type: A
Host: api
Value: 123.45.67.89  (Your server IP)
TTL: 3600
```

### Step-by-Step:

#### 1. At Your DNS Provider:

**GoDaddy Example:**
```
1. Log in to GoDaddy
2. My Products  DNS
3. Click "Add" under Records
4. Type: A
5. Name: @ (for root domain)
6. Value: 123.45.67.89
7. Click Save
```

**Cloudflare Example:**
```
1. Log in to Cloudflare
2. Select domain
3. DNS tab
4. Add record:
   - Type: A
   - Name: @ (or subdomain)
   - IPv4 address: 123.45.67.89
   - Proxy status: DNS only (turn off orange cloud)
5. Save
```

**AWS Route53 Example:**
```
1. Route53 console
2. Hosted zones  Your domain
3. Create record
4. Record name: (blank for root)
5. Record type: A
6. Value: 123.45.67.89
7. Create records
```

#### 2. In Docker GUI:

```
1. Docker GUI  Domains  Add Domain
2. Choose "Proxy Only"
3. Enter domain: myapp.com
4. Configure routing (container/URL)
5. Click Create
    Only creates nginx config (no DNS records)
```

### Testing:

```bash
# Test DNS resolution
dig myapp.com

# Should return: 123.45.67.89

# Test connection
curl http://myapp.com
```

---

##  DNS Record Types Explained

### A Record (Address)
Points domain to IPv4 address.

```
Example:
myapp.com    123.45.67.89
```

**Use for:**
- Root domain (myapp.com)
- Subdomains (api.myapp.com, app.myapp.com)

### CNAME Record (Canonical Name)
Points domain to another domain.

```
Example:
www.myapp.com    myapp.com
```

**Use for:**
- www subdomain
- Aliases

**Cannot use for:**
- Root domain (use A record instead)

### MX Record (Mail Exchange)
Points to mail server.

```
Example:
myapp.com  MX  10  mail.myapp.com
```

**Use for:**
- Email routing
- If using email features

### TXT Record
Stores text data.

```
Example:
myapp.com  TXT  "v=spf1 include:_spf.google.com ~all"
```

**Use for:**
- SPF records (email)
- Domain verification
- DKIM keys

---

##  Common Setups

### Setup 1: Single Domain with www

**DNS Records:**
```
myapp.com      A      123.45.67.89
www.myapp.com  CNAME  myapp.com
```

**Docker GUI:**
```
Domain: myapp.com
Aliases: www.myapp.com
```

---

### Setup 2: Multiple Subdomains

**DNS Records:**
```
myapp.com      A  123.45.67.89
api.myapp.com  A  123.45.67.89
app.myapp.com  A  123.45.67.89
www.myapp.com  CNAME  myapp.com
```

**Docker GUI:**
```
Domain 1: myapp.com      Container: website
Domain 2: api.myapp.com  Container: api-server
Domain 3: app.myapp.com  Container: frontend
```

---

### Setup 3: Wildcard Subdomain

**DNS Record:**
```
*.myapp.com  A  123.45.67.89
```

**Matches:**
- anything.myapp.com
- test.myapp.com
- dev.myapp.com

---

### Setup 4: Multiple Servers (Load Balancing)

**DNS Records:**
```
myapp.com  A  123.45.67.89
myapp.com  A  123.45.67.90
myapp.com  A  123.45.67.91
```

Browsers will use round-robin DNS for basic load distribution.

---

##  Testing DNS Setup

### Check Nameservers:

```bash
dig NS myapp.com

# Should show your nameservers
```

### Check A Record:

```bash
dig A myapp.com

# Should show your server IP
```

### Check CNAME:

```bash
dig CNAME www.myapp.com

# Should show: www.myapp.com. IN CNAME myapp.com.
```

### Query Specific Nameserver:

```bash
# Query your PowerDNS directly
dig @YOUR_SERVER_IP -p 15353 myapp.com

# Query external provider
dig @8.8.8.8 myapp.com  # Google DNS
dig @1.1.1.1 myapp.com  # Cloudflare DNS
```

### Full Chain Test:

```bash
# Check DNS propagation
nslookup myapp.com

# Test HTTP connection
curl -I http://myapp.com

# Test HTTPS (if SSL enabled)
curl -I https://myapp.com
```

---

##  DNS Propagation Time

| Change Type | Typical Time |
|------------|--------------|
| A/CNAME record update | 5 minutes - 2 hours |
| Nameserver change | 24-48 hours |
| TTL expiration | Based on TTL value |

### Check Propagation Globally:

**Online Tools:**
- https://www.whatsmydns.net/
- https://dnschecker.org/
- https://www.gdnspc.com/

**Command Line:**
```bash
# Check from multiple DNS servers
dig @8.8.8.8 myapp.com      # Google
dig @1.1.1.1 myapp.com      # Cloudflare
dig @208.67.222.222 myapp.com  # OpenDNS
```

---

##  Common Issues

### Issue 1: Domain Not Resolving

**Check:**
```bash
dig myapp.com
```

**If no answer:**
- DNS records not created
- DNS propagation not complete
- Wrong nameservers

**Solution:**
- Double-check DNS records at provider
- Wait for propagation (24-48 hours)
- Verify nameservers: `dig NS myapp.com`

---

### Issue 2: Resolves to Wrong IP

**Check:**
```bash
dig myapp.com
```

**If wrong IP shown:**
- Old cached DNS
- Wrong A record value

**Solution:**
```bash
# Clear local DNS cache
sudo dscacheutil -flushcache  # macOS
sudo systemd-resolve --flush-caches  # Linux

# Update A record at DNS provider
```

---

### Issue 3: www Works But Root Domain Doesn't

**Check records:**
```bash
dig myapp.com      # Check root
dig www.myapp.com  # Check www
```

**Likely cause:** Missing A record for root domain

**Solution:**
```
Add A record:
@    A    123.45.67.89
```

---

### Issue 4: NXDOMAIN Error

```
;; ->>HEADER<<- opcode: QUERY, status: NXDOMAIN
```

**Means:** Domain doesn't exist in DNS

**Causes:**
- Domain not registered
- Wrong nameservers
- DNS zone not created

**Solution:**
- Verify domain registration
- Check nameservers
- Create zone in DNS provider

---

##  Quick Reference

### For "Manage DNS Here" (PowerDNS):

```
At Registrar:
  Nameservers  ns1.yourdomain.com, ns2.yourdomain.com
  Glue Records  ns1/ns2  Your Server IP

In Docker GUI:
  Add Domain  "Manage DNS Here"
   Records managed automatically
```

### For "External Provider":

```
At Provider:
  Domain added to Cloudflare/AWS/Azure
  API credentials in config.yml

In Docker GUI:
  Add Domain  "External Provider"  Select Provider
   Records created automatically via API
```

### For "Proxy Only":

```
At DNS Provider:
  Create A record: yourdomain.com  Your Server IP
  Create CNAME: www  yourdomain.com

In Docker GUI:
  Add Domain  "Proxy Only"
   Only nginx config created
```

---

##  Summary

| DNS Mode | Nameservers | DNS Records | Where Created |
|----------|-------------|-------------|---------------|
| **Manage DNS Here** | Point to your server | All types | Docker GUI  PowerDNS |
| **External Provider** | Point to provider | All types | Docker GUI  Provider API |
| **Proxy Only** | Any | Manual | You create manually |

### Required for All Modes:

 Server public IP address  
 Domain registered  
 Ability to change DNS settings

### Minimum DNS Records:

```
myapp.com      A  123.45.67.89
www.myapp.com  CNAME  myapp.com
```

**That's it!** Now traffic reaches your server and nginx routes it to containers! 

