#!/bin/bash
# Request SSL certificate from Let's Encrypt

set -e

if [ -z "$1" ]; then
    echo "Usage: ./scripts/ssl-request.sh <domain> [additional-domains...]"
    echo "Example: ./scripts/ssl-request.sh example.com www.example.com"
    exit 1
fi

DOMAIN=$1
shift
EXTRA_DOMAINS="$@"

EMAIL=${LETSENCRYPT_EMAIL:-admin@$DOMAIN}

echo "Requesting SSL certificate for $DOMAIN"
if [ -n "$EXTRA_DOMAINS" ]; then
    echo "Additional domains: $EXTRA_DOMAINS"
fi

# Build domain arguments
DOMAIN_ARGS="-d $DOMAIN"
for d in $EXTRA_DOMAINS; do
    DOMAIN_ARGS="$DOMAIN_ARGS -d $d"
done

# Request certificate
docker-compose -f docker-compose.production.yml run --rm certbot certonly \
  --webroot \
  --webroot-path=/var/www/certbot \
  --email "$EMAIL" \
  --agree-tos \
  --no-eff-email \
  $DOMAIN_ARGS

echo ""
echo "SUCCESS: Certificate requested successfully!"
echo "Certificates are stored in the ssl-certificates volume"
echo "Path: /etc/letsencrypt/live/$DOMAIN/"
echo ""
echo "Next steps:"
echo "  1. Update your Nginx configuration to use the new certificates"
echo "  2. Reload Nginx: ./scripts/nginx-reload.sh"

