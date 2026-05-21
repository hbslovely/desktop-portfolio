# ARM64 Docker Solutions

## Option 1: Force x86_64 platform (Quick Fix)
export DOCKER_DEFAULT_PLATFORM=linux/amd64
docker-compose -f ./dev/docker-compose.yml up

## Option 2: Use platform flag
docker-compose -f ./dev/docker-compose.yml up --platform linux/amd64

## Option 3: Enable Docker BuildKit with multi-platform
export DOCKER_BUILDKIT=1
export COMPOSE_DOCKER_CLI_BUILD=1
docker-compose -f ./dev/docker-compose.yml up

## Option 4: Use our new ARM64-compatible docker-compose
docker-compose up

## Option 5: Development mode with ARM64 support
docker-compose --profile dev up desktop-portfolio-dev

