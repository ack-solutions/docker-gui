# DNS Quick Setup - TL;DR

Choose your scenario and follow the steps:

---

##  Scenario 1: Self-Hosted DNS (PowerDNS)

**When to use:** You want full control, manage everything through Docker GUI.

### Steps:

1. **Get your server IP**:
   ```bash
   curl ifconfig.me
   # Example: 123.45.67.89
   ```

2. **At your domain registrar** (GoDaddy, Namecheap, etc.):
   ```
   Change Nameservers to:
   - ns1.yourdomain.com
   - ns2.yourdomain.com
   
   Create Glue Records:
   - ns1.yourdomain.com  A  123.45.67.89
   - ns2.yourdomain.com  A  123.45.67.89
   ```

3. **Wait 24-48 hours** for nameserver propagation

4. **In Docker GUI**:
   ```
   Domains  Add Domain
    Choose "Manage DNS Here"
    Create domain
    All DNS records managed in Docker GUI!
   ```

5. **Done!** DNS queries go to your PowerDNS.

---

##  Scenario 2: External Provider (Cloudflare/AWS/Azure)

**When to use:** You already use Cloudflare, AWS Route53, Azure DNS, or DigitalOcean.

### Steps:

1. **Add domain to your provider** (Cloudflare/AWS/Azure/DO)

2. **Point nameservers** (at registrar) to your provider:
   ```
   Cloudflare: alice.ns.cloudflare.com, bob.ns.cloudflare.com
   AWS: ns-123.awsdns-12.com, ns-456.awsdns-34.net
   Azure: ns1-01.azure-dns.com, ns2-01.azure-dns.net
   ```

3. **Get API credentials** from provider

4. **In config.yml**:
   ```yaml
   dns:
     cloudflare:  # or route53, azure, digitalocean
       enabled: true
       apiToken: "your-token-here"
   ```

5. **Restart Docker GUI**:
   ```bash
   docker-compose restart docker-gui-full
   ```

6. **In Docker GUI**:
   ```
   Domains  Add Domain
    Choose "External Provider"
    Select your provider
    Create domain
    DNS records created automatically via API!
   ```

7. **Done!** No manual DNS records needed.

---

##  Scenario 3: Manual DNS (Proxy Only)

**When to use:** Simple setup, you manage DNS at your registrar.

### Steps:

1. **Get your server IP**:
   ```bash
   curl ifconfig.me
   # Example: 123.45.67.89
   ```

2. **At your DNS provider** (any - GoDaddy, Cloudflare, registrar):
   ```
   Create A Record:
   Host: @
   Type: A
   Value: 123.45.67.89
   
   Create CNAME (optional, for www):
   Host: www
   Type: CNAME
   Value: yourdomain.com
   ```

3. **Wait 5-30 minutes** for DNS propagation

4. **Test DNS**:
   ```bash
   dig yourdomain.com
   # Should show: 123.45.67.89
   ```

5. **In Docker GUI**:
   ```
   Domains  Add Domain
    Choose "Proxy Only"
    Create domain
    Only nginx routing configured
   ```

6. **Done!** Traffic reaches your server.

---

##  Which Scenario Should I Use?

| Scenario | Best For | Pros | Cons |
|----------|----------|------|------|
| **Self-Hosted (PowerDNS)** | Full control | Everything in one place | Need to manage nameservers |
| **External Provider** | Cloud users | Auto-sync, provider features | Requires API setup |
| **Manual (Proxy Only)** | Simple setups | Easy, quick | Manual DNS changes |

---

##  Super Quick Example

### If using Manual/Proxy Only:

```bash
# 1. Get server IP
curl ifconfig.me
# Output: 123.45.67.89

# 2. At GoDaddy/Cloudflare/etc, create:
yourdomain.com  A  123.45.67.89

# 3. Test:
dig yourdomain.com
# Should return: 123.45.67.89

# 4. In Docker GUI:
# Add domain with "Proxy Only" mode
# Point to your container

# 5. Access:
curl http://yourdomain.com
# Should reach your container!
```

**That's it!** 

---

##  Testing Checklist

```bash
# 1. Check DNS resolves
dig yourdomain.com
#  Should show your server IP

# 2. Check HTTP works
curl -I http://yourdomain.com
#  Should return 200 OK or see your app

# 3. Check from different location
# Use: https://www.whatsmydns.net/
#  Should show your IP globally

# 4. Test with browser
# Open: http://yourdomain.com
#  Should load your app
```

---

##  Quick Troubleshooting

### Problem: Domain doesn't resolve

```bash
dig yourdomain.com
```

**If no answer:**
- DNS records not created yet
- Still propagating (wait longer)
- Wrong nameservers

**Fix:**
- Double-check DNS records
- Wait 24-48 hours if changed nameservers
- Verify: `dig NS yourdomain.com`

### Problem: Wrong IP shown

```bash
dig yourdomain.com
# Shows old/wrong IP
```

**Fix:**
```bash
# Clear DNS cache
sudo dscacheutil -flushcache  # macOS
sudo systemd-resolve --flush-caches  # Linux

# Update A record at DNS provider
```

### Problem: Works on phone but not computer

**Cause:** DNS caching

**Fix:**
```bash
# Restart browser
# Clear DNS cache
# Or wait for TTL to expire
```

---

##  Minimum Required DNS Records

For a basic setup with www support:

```
yourdomain.com     A      123.45.67.89
www.yourdomain.com CNAME  yourdomain.com
```

**That's literally all you need!** Everything else is optional.

---

##  More Info

For detailed guide with examples:
- See **DNS_RECORDS_GUIDE.md**

For multi-provider setup:
- See **MULTI_PROVIDER_DNS.md**

For general setup:
- See **START_HERE.md**

---

**Now go point your domain and start deploying!** 

