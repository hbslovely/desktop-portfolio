# Multi-stage build for Angular app with ARM64 support
FROM --platform=$BUILDPLATFORM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./

# devDependencies include @angular/cli — required for `npm run build` (ng)
RUN npm ci

COPY . .

RUN npm run build

# Production stage with ARM64 support
FROM --platform=$TARGETPLATFORM nginx:alpine

# angular.json outputPath is "dist"
COPY --from=build /app/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
