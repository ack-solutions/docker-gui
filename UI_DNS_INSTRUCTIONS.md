# UI DNS Instructions

This document shows what instructions should be displayed **IN THE UI DIALOG** when users are setting up DNS.

---

##  When to Show DNS Instructions

Show appropriate instructions based on the DNS mode the user selects:

1. **"Manage DNS Here"**  Show nameserver delegation instructions
2. **"External Provider"**  Show provider setup + API credential form
3. **"Proxy Only"**  Show manual DNS record instructions

---

##  Instructions for UI Dialogs

### 1ƒ£ "Manage DNS Here" (PowerDNS) Selected

**Display in UI Dialog:**

```

‚ DNS Setup Required                                          ‚
¤
‚                                                             ‚
‚ To use "Manage DNS Here", you need to point your domain's  ‚
‚ nameservers to this server.                                ‚
‚                                                             ‚
‚ Steps:                                                      ‚
‚                                                             ‚
‚ 1. Go to your domain registrar (GoDaddy, Namecheap, etc.) ‚
‚                                                             ‚
‚ 2. Change nameservers to:                                  ‚
‚     ns1.yourdomain.com                                    ‚
‚     ns2.yourdomain.com                                    ‚
‚                                                             ‚
‚ 3. Create glue records:                                    ‚
‚     ns1.yourdomain.com  A  [Your Server IP]            ‚
‚     ns2.yourdomain.com  A  [Your Server IP]            ‚
‚                                                             ‚
‚   DNS propagation takes 24-48 hours                      ‚
‚                                                             ‚
‚  [View Detailed Guide]                                   ‚
‚                                                             ‚
‚  I have configured nameservers                           ‚
‚                                                             ‚
‚ [Cancel]  [Continue Anyway]  [Next]                       ‚

```

**Auto-fill values:**
- Replace `[Your Server IP]` with actual server public IP
- Replace `yourdomain.com` with the domain they entered

**"View Detailed Guide" button:**
- Opens modal with step-by-step instructions for common registrars
- Or link to DNS_RECORDS_GUIDE.md section

---

### 2ƒ£ "External Provider" Selected

#### Step A: Choose Provider

```

‚ Choose DNS Provider                                         ‚
¤
‚                                                             ‚
‚ Select which DNS provider manages this domain:             ‚
‚                                                             ‚
‚ — AWS Route53                                              ‚
‚ — Cloudflare                                               ‚
‚ — Azure DNS                                                ‚
‚ — DigitalOcean                                             ‚
‚                                                             ‚
‚ [Cancel]  [Next]                                           ‚

```

#### Step B: Enter API Credentials (Per Provider)

**For Cloudflare:**

```

‚ Cloudflare API Setup                                        ‚
¤
‚                                                             ‚
‚ Enter your Cloudflare API credentials:                     ‚
‚                                                             ‚
‚ API Token: *                                               ‚
‚    ‚
‚ ‚ [Enter API token here]                              ‚   ‚
‚    ‚
‚                                                             ‚
‚ Email: (optional)                                          ‚
‚    ‚
‚ ‚ [your-email@example.com]                            ‚   ‚
‚    ‚
‚                                                             ‚
‚   How to get API token:                                  ‚
‚ 1. Log in to Cloudflare Dashboard                         ‚
‚ 2. My Profile  API Tokens                                ‚
‚ 3. Create Token  "Edit zone DNS" template                ‚
‚ 4. Select zones  Create Token                            ‚
‚                                                             ‚
‚  Credentials are encrypted and stored securely          ‚
‚                                                             ‚
‚ [Test Connection]  [Back]  [Next]                         ‚

```

**For AWS Route53:**

```

‚ AWS Route53 API Setup                                       ‚
¤
‚                                                             ‚
‚ Enter your AWS IAM credentials:                            ‚
‚                                                             ‚
‚ Access Key ID: *                                           ‚
‚    ‚
‚ ‚ [AKIAIOSFODNN7EXAMPLE]                              ‚   ‚
‚    ‚
‚                                                             ‚
‚ Secret Access Key: *                                       ‚
‚    ‚
‚ ‚ []        ‚   ‚
‚    ‚
‚                                                             ‚
‚ Region:                                                    ‚
‚    ‚
‚ ‚ [us-east-1         ¼]                               ‚   ‚
‚    ‚
‚                                                             ‚
‚   Required IAM Permissions:                              ‚
‚  route53:ListHostedZones                                 ‚
‚  route53:GetHostedZone                                   ‚
‚  route53:ChangeResourceRecordSets                        ‚
‚  route53:ListResourceRecordSets                          ‚
‚                                                             ‚
‚  [View AWS Setup Guide]                                 ‚
‚                                                             ‚
‚  Credentials are encrypted and stored securely          ‚
‚                                                             ‚
‚ [Test Connection]  [Back]  [Next]                         ‚

```

**For Azure DNS:**

```

‚ Azure DNS API Setup                                         ‚
¤
‚                                                             ‚
‚ Enter your Azure App Registration credentials:             ‚
‚                                                             ‚
‚ Client ID: *                                               ‚
‚    ‚
‚ ‚ [00000000-0000-0000-0000-000000000000]              ‚   ‚
‚    ‚
‚                                                             ‚
‚ Client Secret: *                                           ‚
‚    ‚
‚ ‚ []        ‚   ‚
‚    ‚
‚                                                             ‚
‚ Tenant ID: *                                               ‚
‚    ‚
‚ ‚ [00000000-0000-0000-0000-000000000000]              ‚   ‚
‚    ‚
‚                                                             ‚
‚ Subscription ID: *                                         ‚
‚    ‚
‚ ‚ [00000000-0000-0000-0000-000000000000]              ‚   ‚
‚    ‚
‚                                                             ‚
‚ Resource Group: (optional)                                 ‚
‚    ‚
‚ ‚ [my-resource-group]                                 ‚   ‚
‚    ‚
‚                                                             ‚
‚  [View Azure Setup Guide]                                ‚
‚                                                             ‚
‚  Credentials are encrypted and stored securely          ‚
‚                                                             ‚
‚ [Test Connection]  [Back]  [Next]                         ‚

```

**For DigitalOcean:**

```

‚ DigitalOcean DNS API Setup                                  ‚
¤
‚                                                             ‚
‚ Enter your DigitalOcean API token:                         ‚
‚                                                             ‚
‚ API Token: *                                               ‚
‚    ‚
‚ ‚ [Enter API token here]                              ‚   ‚
‚    ‚
‚                                                             ‚
‚   How to get API token:                                  ‚
‚ 1. Log in to DigitalOcean                                 ‚
‚ 2. API section in control panel                           ‚
‚ 3. Generate New Token                                     ‚
‚ 4. Select Read & Write permissions                        ‚
‚                                                             ‚
‚  Token is encrypted and stored securely                 ‚
‚                                                             ‚
‚ [Test Connection]  [Back]  [Next]                         ‚

```

#### Step C: DNS Configuration

After credentials are entered:

```

‚ DNS Configuration                                           ‚
¤
‚                                                             ‚
‚  Connected to Cloudflare successfully                    ‚
‚                                                             ‚
‚ The following DNS records will be created automatically:   ‚
‚                                                             ‚
‚    ‚
‚ ‚ Record  Type   Value                                ‚   ‚
‚ ¤   ‚
‚ ‚ @       A      123.45.67.89                         ‚   ‚
‚ ‚ www     CNAME  yourdomain.com                       ‚   ‚
‚    ‚
‚                                                             ‚
‚   Records will be created when you save this domain     ‚
‚                                                             ‚
‚ [Back]  [Continue]                                         ‚

```

---

### 3ƒ£ "Proxy Only" Selected

**Display in UI Dialog:**

```

‚ Manual DNS Setup Required                                   ‚
¤
‚                                                             ‚
‚ You need to create DNS records manually at your DNS        ‚
‚ provider (GoDaddy, Cloudflare, your registrar, etc.)      ‚
‚                                                             ‚
‚ Required DNS Records:                                      ‚
‚                                                             ‚
‚    ‚
‚ ‚ Record Type: A                                      ‚   ‚
‚ ‚ Host: @                                             ‚   ‚
‚ ‚ Value: 123.45.67.89                                 ‚   ‚
‚ ‚ TTL: 3600                                           ‚   ‚
‚    ‚
‚                                                             ‚
‚ For www subdomain (optional):                              ‚
‚    ‚
‚ ‚ Record Type: CNAME                                  ‚   ‚
‚ ‚ Host: www                                           ‚   ‚
‚ ‚ Value: yourdomain.com                               ‚   ‚
‚ ‚ TTL: 3600                                           ‚   ‚
‚    ‚
‚                                                             ‚
‚ [Copy DNS Records]   [Detailed Guide]                   ‚
‚                                                             ‚
‚  I have configured DNS records                           ‚
‚                                                             ‚
‚ [Cancel]  [Continue Anyway]  [Next]                       ‚

```

**"Copy DNS Records" button:**
- Copies formatted DNS records to clipboard for easy pasting

**"Detailed Guide" button:**
- Shows step-by-step for common DNS providers
- GoDaddy, Namecheap, Cloudflare UI, Route53, etc.

---

##  DNS Status Indicators

After domain is created, show DNS status in domain list:

```

‚ Domain: myapp.com                                            ‚
¤
‚ DNS Mode: Manage DNS Here                                    ‚
‚ Status:  Waiting for nameserver delegation                ‚
‚                                                              ‚
‚ [Check DNS]  [View Instructions]                            ‚



‚ Domain: api.com                                              ‚
¤
‚ DNS Mode: External Provider (Cloudflare)                     ‚
‚ Status:  DNS records synced                                ‚
‚                                                              ‚
‚ [Sync Now]  [View Records]                                  ‚



‚ Domain: old-site.com                                         ‚
¤
‚ DNS Mode: Proxy Only (Manual)                                ‚
‚ Status:  DNS not verified                                  ‚
‚                                                              ‚
‚ [Test DNS]  [View Required Records]                         ‚

```

---

##  Per-Domain Credential Storage

**Database Schema (Example):**

```typescript
interface Domain {
  id: string;
  name: string;
  dnsMode: 'managed' | 'external' | 'proxy-only';
  
  // For external providers - store encrypted per domain
  dnsProvider?: {
    type: 'cloudflare' | 'route53' | 'azure' | 'digitalocean';
    credentials: {
      // Encrypted JSON blob containing:
      // - Cloudflare: { apiToken, email }
      // - AWS: { accessKeyId, secretAccessKey, region }
      // - Azure: { clientId, clientSecret, tenantId, subscriptionId }
      // - DO: { token }
    };
  };
  
  // Other domain fields...
}
```

**Important:**
-  Credentials stored per-domain
-  Encrypted in database
-  Never exposed in API responses
-  Only used for DNS operations

---

##  UI Flow Summary

### Creating Domain with External Provider:

```
1. User clicks "Add Domain"
   
2. Enters domain name: myapp.com
   
3. Selects DNS Mode: "External Provider"
   
4. Dialog shows provider options
   
5. User selects "Cloudflare"
   
6. Dialog shows credential form
   
7. User enters API token
   
8. Clicks "Test Connection"
   
9. System validates credentials
   
10. Shows success + preview of DNS records
   
11. User clicks "Create Domain"
   
12. System:
    - Saves domain
    - Stores encrypted credentials
    - Creates DNS records via API
    - Configures nginx
   
13. Success! Domain is ready
```

### Editing Domain Credentials:

```
Domain List  Click domain  Settings tab


‚ DNS Provider Settings                               ‚
¤
‚ Provider: Cloudflare                                ‚
‚                                                     ‚
‚ [Update Credentials]  [Test Connection]            ‚
‚ [Switch Provider]     [Remove Provider]            ‚

```

---

##  Config File Simplification

**config.yml** should only have:

```yaml
dns:
  enabled: true
  
  # PowerDNS (global - runs on server)
  powerdns:
    enabled: true
    apiUrl: "http://powerdns:8081"
    apiKey: "pdns-secret-key"
  
  # External providers - just enable/disable UI options
  providers:
    cloudflare: true    # Show Cloudflare option in wizard
    route53: true       # Show AWS option in wizard
    azure: true         # Show Azure option in wizard
    digitalocean: true  # Show DO option in wizard
```

**NO API credentials in config** - all entered per-domain in UI!

---

##  Summary

### Key Points:

1. **Show DNS instructions IN the dialog** when users create domains
2. **API credentials are per-domain** (stored in database, encrypted)
3. **Config only controls** which provider options appear in UI
4. **Different users** can use different Cloudflare/AWS/Azure accounts
5. **Help text/guides** shown contextually based on selected mode

### Benefits:

 Multi-tenant friendly (each domain has own credentials)  
 More secure (credentials encrypted per-domain)  
 Flexible (Domain A uses one Cloudflare account, Domain B uses another)  
 Better UX (instructions shown in context when needed)  
 No config changes needed per domain  

This is the correct architecture! 

