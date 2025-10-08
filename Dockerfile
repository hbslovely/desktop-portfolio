# Multi-stage build for Angular app with ARM64 support
FROM --platform=$BUILDPLATFORM node:18-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the Angular app
RUN npm run build

# Production stage with ARM64 support
FROM --platform=$TARGETPLATFORM nginx:alpine

# Copy built app to nginx
COPY --from=build /app/dist/desktop-portfolio /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/nginx.conf

# Expose port
EXPOSE 80

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
