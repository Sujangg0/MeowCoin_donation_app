#!/bin/bash

# Generate SSL certificates using mkcert
echo "Generating SSL certificates using mkcert..."

# Create certs directory if it doesn't exist
mkdir -p nginx/certs

# Install mkcert root CA (if not already installed)
echo "Installing mkcert root CA..."
mkcert -install

# Generate certificate for localhost
echo "Generating certificate for localhost..."
mkcert -key-file nginx/certs/localhost-key.pem -cert-file nginx/certs/localhost.pem localhost

echo "SSL certificates generated successfully!"
echo "Certificates are located in: nginx/certs/"
echo ""
echo "Note: These certificates are trusted by your system thanks to mkcert."
echo "No browser warnings will appear for localhost." 