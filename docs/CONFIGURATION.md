# Configuration Guide

## Overview

The Claude Expert Workflow MCP server can be configured for different environments and use cases. This guide covers all configuration options and deployment scenarios.

## Basic Configuration

### MCP Server Configuration

Add the server to your `.mcp.json` configuration file:

```json
{
  "mcpServers": {
    "claude-expert-workflow": {
      "command": "claude-expert-workflow-mcp",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Alternative Configurations

#### Local Development
```json
{
  "mcpServers": {
    "claude-expert-workflow": {
      "command": "node",
      "args": ["dist/complete-server.js"],
      "cwd": "/path/to/claude-expert-workflow-mcp",
      "env": {
        "NODE_ENV": "development",
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

#### Docker Container
```json
{
  "mcpServers": {
    "claude-expert-workflow": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "claude-expert-workflow-mcp:latest"
      ],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

## Environment Variables

### Core Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment mode (`development`, `production`, `test`) |
| `LOG_LEVEL` | `info` | Logging level (`error`, `warn`, `info`, `debug`) |
| `MCP_SERVER_TIMEOUT` | `30000` | Server timeout in milliseconds |
| `ANTHROPIC_API_KEY` | `""` | Leave empty to use Claude Code subscription |

### Memory Management

| Variable | Default | Description |
|----------|---------|-------------|
| `MEMORY_MAX_TOTAL_MB` | `512` | Maximum total memory usage |
| `MEMORY_MAX_CONVERSATIONS` | `100` | Maximum concurrent conversations |
| `MEMORY_TTL_MINUTES` | `60` | Time-to-live for conversation data |
| `MEMORY_CLEANUP_INTERVAL` | `300000` | Cleanup interval in milliseconds |

### Resource Monitoring

| Variable | Default | Description |
|----------|---------|-------------|
| `RESOURCE_MONITOR_ENABLED` | `true` | Enable resource monitoring |
| `RESOURCE_MAX_HEAP_MB` | `256` | Maximum heap size in MB |
| `RESOURCE_MAX_HANDLES` | `1000` | Maximum active handles |
| `RESOURCE_CHECK_INTERVAL` | `30000` | Check interval in milliseconds |

### Performance Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `PERFORMANCE_CACHE_ENABLED` | `true` | Enable performance caching |
| `PERFORMANCE_CACHE_TTL` | `3600` | Cache TTL in seconds |
| `PERFORMANCE_MAX_CONCURRENT` | `10` | Maximum concurrent requests |

## Configuration Files

### Environment File (.env)

Create a `.env` file in your installation directory:

```env
# Core Settings
NODE_ENV=production
LOG_LEVEL=info
MCP_SERVER_TIMEOUT=30000

# Memory Management
MEMORY_MAX_TOTAL_MB=512
MEMORY_MAX_CONVERSATIONS=100
MEMORY_TTL_MINUTES=60

# Resource Monitoring
RESOURCE_MONITOR_ENABLED=true
RESOURCE_MAX_HEAP_MB=256
RESOURCE_MAX_HANDLES=1000

# Performance
PERFORMANCE_CACHE_ENABLED=true
PERFORMANCE_CACHE_TTL=3600
PERFORMANCE_MAX_CONCURRENT=10

# Optional: Direct API Mode (leave empty for Claude Code integration)
ANTHROPIC_API_KEY=
```

### System Configuration

For advanced users, create a `config.json` file:

```json
{
  "server": {
    "name": "claude-expert-workflow",
    "version": "1.0.0",
    "timeout": 30000,
    "maxConnections": 100
  },
  "memory": {
    "maxTotalMemoryMB": 512,
    "maxConversations": 100,
    "ttlMinutes": 60,
    "cleanupIntervalMs": 300000
  },
  "resources": {
    "monitoringEnabled": true,
    "maxHeapUsageMB": 256,
    "maxActiveHandles": 1000,
    "checkIntervalMs": 30000
  },
  "logging": {
    "level": "info",
    "format": "json",
    "outputFile": "logs/mcp-server.log",
    "rotationSize": "10MB",
    "rotationFiles": 5
  },
  "experts": {
    "productManager": {
      "enabled": true,
      "maxTopics": 5,
      "timeoutMinutes": 30
    },
    "uxDesigner": {
      "enabled": true,
      "maxTopics": 5,
      "timeoutMinutes": 30
    },
    "softwareArchitect": {
      "enabled": true,
      "maxTopics": 5,
      "timeoutMinutes": 30
    }
  }
}
```

## Deployment Configurations

### Development Environment

```bash
# Install in development mode
git clone https://github.com/jcmrs/claude-expert-workflow-mcp.git
cd claude-expert-workflow-mcp
npm install
npm run build

# Configure for development
export NODE_ENV=development
export LOG_LEVEL=debug
npm start
```

### Production Environment

```bash
# Install globally
npm install -g claude-expert-workflow-mcp

# Set production environment
export NODE_ENV=production
export LOG_LEVEL=info
export MEMORY_MAX_TOTAL_MB=1024
export RESOURCE_MAX_HEAP_MB=512
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY .env.example ./.env

EXPOSE 3000
CMD ["node", "dist/complete-server.js"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  mcp-server:
    build: .
    environment:
      - NODE_ENV=production
      - MEMORY_MAX_TOTAL_MB=1024
      - RESOURCE_MAX_HEAP_MB=512
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped
```

## Performance Tuning

### Memory Optimization

For high-traffic environments:

```env
# Increase memory limits
MEMORY_MAX_TOTAL_MB=2048
MEMORY_MAX_CONVERSATIONS=500
MEMORY_TTL_MINUTES=30

# More aggressive cleanup
MEMORY_CLEANUP_INTERVAL=180000
```

### Resource Monitoring

For resource-constrained environments:

```env
# Conservative resource limits
RESOURCE_MAX_HEAP_MB=128
RESOURCE_MAX_HANDLES=500
RESOURCE_CHECK_INTERVAL=15000

# Enable monitoring
RESOURCE_MONITOR_ENABLED=true
```

### Caching Configuration

For improved performance:

```env
# Enable aggressive caching
PERFORMANCE_CACHE_ENABLED=true
PERFORMANCE_CACHE_TTL=7200
PERFORMANCE_MAX_CONCURRENT=20
```

## Security Configuration

### Basic Security

```env
# Disable debug logging in production
LOG_LEVEL=warn

# Set reasonable timeouts
MCP_SERVER_TIMEOUT=15000

# Limit resource usage
MEMORY_MAX_TOTAL_MB=256
RESOURCE_MAX_HEAP_MB=128
```

### Network Security

For network deployments:

```json
{
  "security": {
    "enableRateLimit": true,
    "rateLimitWindowMs": 900000,
    "rateLimitMaxRequests": 100,
    "enableCors": false,
    "allowedOrigins": [],
    "trustProxy": false
  }
}
```

## Monitoring and Logging

### Log Configuration

```env
# Structured logging
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE=logs/mcp-server.log

# Log rotation
LOG_ROTATION_SIZE=50MB
LOG_ROTATION_FILES=10
LOG_ROTATION_INTERVAL=daily
```

### Health Monitoring

The server provides health endpoints when configured:

```env
# Enable health checks
HEALTH_CHECK_ENABLED=true
HEALTH_CHECK_PORT=3001
HEALTH_CHECK_PATH=/health
```

Access health information:
```bash
curl http://localhost:3001/health
```

## Troubleshooting

### Common Configuration Issues

1. **Server won't start**: Check file permissions and Node.js version
2. **High memory usage**: Reduce `MEMORY_MAX_CONVERSATIONS` and `MEMORY_TTL_MINUTES`
3. **Connection timeouts**: Increase `MCP_SERVER_TIMEOUT`
4. **Performance issues**: Enable caching and increase resource limits

### Debug Mode

Enable verbose logging for troubleshooting:

```env
NODE_ENV=development
LOG_LEVEL=debug
```

### Configuration Validation

Test your configuration:

```bash
# Validate configuration
node -e "console.log('Configuration valid')" && claude-expert-workflow-mcp --validate

# Test server startup
timeout 10s claude-expert-workflow-mcp
```

## Environment Templates

### `.env.development`
```env
NODE_ENV=development
LOG_LEVEL=debug
MEMORY_MAX_TOTAL_MB=256
RESOURCE_MONITOR_ENABLED=true
PERFORMANCE_CACHE_ENABLED=false
```

### `.env.production`
```env
NODE_ENV=production
LOG_LEVEL=info
MEMORY_MAX_TOTAL_MB=1024
RESOURCE_MONITOR_ENABLED=true
PERFORMANCE_CACHE_ENABLED=true
PERFORMANCE_CACHE_TTL=3600
```

### `.env.testing`
```env
NODE_ENV=test
LOG_LEVEL=warn
MEMORY_MAX_TOTAL_MB=128
MEMORY_TTL_MINUTES=5
RESOURCE_CHECK_INTERVAL=5000
```