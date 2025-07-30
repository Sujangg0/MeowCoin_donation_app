FROM nginx:alpine

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Create SSL certs directory
RUN mkdir -p /etc/ssl/certs

# Copy SSL certificates
COPY certs/localhost.pem /etc/ssl/certs/localhost.pem
COPY certs/localhost-key.pem /etc/ssl/certs/localhost-key.pem

# Set proper permissions for certificates
RUN chmod 644 /etc/ssl/certs/localhost.pem && \
    chmod 600 /etc/ssl/certs/localhost-key.pem

# Expose ports
EXPOSE 80 443

# Start nginx
CMD ["nginx", "-g", "daemon off;"] 