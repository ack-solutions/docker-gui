# DNS Management Guide

## Overview

The Domains system now supports **three different ways** to manage DNS and route traffic to your applications. Choose the approach that best fits your needs.

---

## 🎯 Three DNS Management Modes

### 1. **Manage DNS Here** (Recommended for Beginners)

**Best for:** Users who want everything in one place

This platform will host and manage ALL your DNS records directly.

#### Features:
- ✅ Full DNS control on this platform
- ✅ Add/edit/delete DNS records through the UI
- ✅ Automatic SSL certificate setup
- ✅ Support for subdomains
- ✅ Built-in DNS propagation
- ✅ No external dependencies

#### How it works:
1. Add your domain in the wizard
2. Select "Manage DNS Here"
3. Add DNS records (A, CNAME, MX, TXT, etc.)
4. Point your domain registrar's nameservers to this platform
5. Done! Everything is managed here

#### Setup Steps:
```
1. Add domain → example.com
2. Choose "Manage DNS Here"
3. Add records:
   - @ → A → 123.45.67.89
   - www → CNAME → example.com
   - mail → MX → mail.example.com
4. Update nameservers at your registrar:
   - ns1.yourplatform.com
   - ns2.yourplatform.com
```

---

### 2. **Use External DNS Provider** (AWS, Cloudflare, Azure, etc.)

**Best for:** Users already using cloud DNS providers

Connect to your existing DNS provider and sync records automatically via API.

#### Supported Providers:
- **AWS Route53** - Amazon's DNS service
- **Cloudflare** - Fast global DNS with DDoS protection
- **Azure DNS** - Microsoft's DNS service
- **DigitalOcean DNS** - Simple cloud DNS

#### Features:
- ✅ Sync with your existing DNS provider
- ✅ Auto-update DNS via provider's API
- ✅ Keep your current DNS setup
- ✅ Centralized management
- ⚠️ Requires API credentials (stored securely)

#### How it works:
1. Add your domain in the wizard
2. Select "Use External DNS Provider"
3. Choose provider (AWS/Azure/Cloudflare/DigitalOcean)
4. Enter API credentials
5. Records are synced automatically

#### Setup Example (AWS Route53):
```
1. Create IAM user with Route53 permissions:
   - AmazonRoute53FullAccess (or custom policy)
2. Generate Access Key + Secret Key
3. In wizard:
   - Provider: AWS Route53
   - Access Key: AKIAIOSFODNN7EXAMPLE
   - Secret Key: wJalrXUtnFEMI/K7MDENG/...
   - Region: us-east-1
4. Platform will manage records via AWS API
```

#### Security:
- 🔒 Credentials are **encrypted** before storage
- 🔒 Use minimal permissions (DNS only)
- 🔒 Consider using IAM roles instead of keys
- 🔒 Rotate credentials regularly

---

### 3. **Proxy Only (No DNS)** (Simplest)

**Best for:** Users who manage DNS elsewhere manually

Just setup the reverse proxy and SSL. DNS stays at your registrar or provider.

#### Features:
- ✅ No DNS management needed
- ✅ Point your domain here manually
- ✅ Nginx/SSL configuration only
- ✅ Fastest setup
- ✅ Full control over your DNS

#### How it works:
1. Add your domain in the wizard
2. Select "Proxy Only (No DNS)"
3. Configure routing (container/external URL)
4. Manually add A/CNAME record at your DNS provider
5. SSL and proxy work automatically

#### Setup Steps:
```
1. Add domain → example.com
2. Choose "Proxy Only"
3. Configure routing (e.g., to Docker container on port 3000)
4. At your DNS provider (registrar/Cloudflare/etc):
   - Add A record: @ → 123.45.67.89
   - Add CNAME: www → example.com
5. Done! Traffic will be proxied
```

---

## 🌐 SubDomains

All three modes support subdomains!

### Examples:
- **Main domain:** example.com
- **API subdomain:** api.example.com
- **Blog subdomain:** blog.example.com
- **Admin subdomain:** admin.example.com

### How to add subdomains:

#### Mode 1 (Manage DNS Here):
```
Add DNS record:
- Type: A or CNAME
- Host: api (will become api.example.com)
- Value: 123.45.67.89 or target.example.com
```

#### Mode 2 (External Provider):
```
System will sync subdomain records via API automatically
Or manually add in provider's dashboard
```

#### Mode 3 (Proxy Only):
```
Add A/CNAME for subdomain at your DNS provider:
- api.example.com → A → 123.45.67.89
Then add routing in this platform
```

---

## 📋 DNS Record Types Supported

| Type | Purpose | Example |
|------|---------|---------|
| **A** | IPv4 address | `@ → 123.45.67.89` |
| **AAAA** | IPv6 address | `@ → 2001:0db8::1` |
| **CNAME** | Alias/redirect | `www → example.com` |
| **MX** | Mail server | `@ → mail.example.com` (priority 10) |
| **TXT** | Text/verification | `@ → "v=spf1 include:_spf.google.com ~all"` |
| **SRV** | Service records | `_service._tcp → target:port` |
| **CAA** | Certificate authority | `@ → 0 issue "letsencrypt.org"` |
| **NS** | Nameserver | `@ → ns1.example.com` |

---

## 🔄 Comparison Table

| Feature | Manage DNS Here | External Provider | Proxy Only |
|---------|----------------|-------------------|------------|
| **DNS Hosting** | ✅ This platform | ☁️ Cloud provider | ❌ External |
| **Record Management** | ✅ Full UI | ✅ Via API sync | ❌ Manual |
| **SSL Certificates** | ✅ Automatic | ✅ Automatic | ✅ Automatic |
| **Subdomains** | ✅ Yes | ✅ Yes | ✅ Yes |
| **API Required** | ❌ No | ✅ Yes | ❌ No |
| **Setup Complexity** | ⭐⭐ Medium | ⭐⭐⭐ Advanced | ⭐ Simple |
| **Best For** | Beginners | Cloud users | Quick setup |

---

## 🚀 Quick Start Recommendations

### For beginners:
**→ Use "Manage DNS Here"**
- Everything in one place
- Easy to learn
- No external dependencies

### For teams using AWS/Azure/Cloudflare:
**→ Use "External DNS Provider"**
- Integrate with existing infrastructure
- Centralized cloud management
- Automatic synchronization

### For quick testing or existing DNS setup:
**→ Use "Proxy Only"**
- Fastest setup
- Keep existing DNS
- Just add one A record

---

## 🔧 Advanced Features

### Wildcard Subdomains
```
Add DNS record:
- Host: *
- Type: A
- Value: 123.45.67.89

Now ALL subdomains work:
- api.example.com ✅
- test.example.com ✅
- anything.example.com ✅
```

### Multiple DNS Records
You can add multiple records for redundancy:
```
@ → A → 123.45.67.89
@ → A → 98.76.54.32
```

### Email Records
Setup email with MX records:
```
@ → MX → mail.example.com (priority 10)
@ → MX → mail2.example.com (priority 20)
@ → TXT → "v=spf1 include:_spf.google.com ~all"
```

---

## 🛠️ Troubleshooting

### DNS not working?
1. Check DNS propagation (can take up to 48 hours)
2. Verify A/CNAME records are correct
3. Use `dig example.com` or `nslookup example.com`
4. Clear DNS cache

### SSL certificate failed?
1. Ensure domain is accessible via HTTP first
2. Check email address is valid
3. Verify DNS records point to correct IP
4. Wait for DNS propagation

### External provider sync issues?
1. Verify API credentials are correct
2. Check API permissions (need DNS write access)
3. Test connection in provider setup
4. Review error logs

---

## 📚 Additional Resources

- [AWS Route53 Documentation](https://aws.amazon.com/route53/)
- [Cloudflare DNS Docs](https://developers.cloudflare.com/dns/)
- [Azure DNS Documentation](https://docs.microsoft.com/en-us/azure/dns/)
- [DigitalOcean DNS Guide](https://docs.digitalocean.com/products/networking/dns/)
- [Let's Encrypt Documentation](https://letsencrypt.org/docs/)

---

## 💡 Pro Tips

1. **Start simple**: Use "Proxy Only" for testing, upgrade to full DNS management later
2. **Use subdomains**: Separate services (api.domain.com, admin.domain.com)
3. **Enable HTTPS**: Always use SSL certificates (free with Let's Encrypt)
4. **Set low TTL**: When testing, use TTL=300 (5 minutes) for faster changes
5. **Document everything**: Keep track of which domains use which mode

---

## Support

Need help? Check the platform documentation or contact your administrator.

