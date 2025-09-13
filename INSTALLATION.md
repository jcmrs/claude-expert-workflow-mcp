# Claude Expert Workflow MCP - Installation Guide

## Overview

Claude Expert Workflow MCP is a production-ready MCP server that provides structured AI-powered product development consultation through specialized expert roles. This guide covers multiple installation methods for different use cases.

## Prerequisites

- **Node.js**: 18.0.0 or higher
- **npm**: 9.0.0 or higher
- **Claude Code**: Latest version with MCP support

## Installation Methods

### Method 1: NPM Global Installation (Recommended)

```bash
# Install globally from npm (coming soon)
npm install -g claude-expert-workflow-mcp

# Or install from GitHub releases
npm install -g https://github.com/jcmrs/claude-expert-workflow-mcp/releases/latest/download/claude-expert-workflow-mcp.tgz
```

**Configuration:**
```json
// Add to your global .mcp.json file
{
  "mcpServers": {
    "claude-expert-workflow": {
      "command": "claude-expert-workflow-mcp",
      "args": [],
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### Method 2: Local Directory Installation

**Step 1: Create MCP Directory**
```bash
mkdir C:\MCP-Servers
cd C:\MCP-Servers
```

**Step 2: Download and Extract**
```bash
# Download release
curl -L https://github.com/jcmrs/claude-expert-workflow-mcp/releases/latest/download/claude-expert-workflow-mcp.zip -o mcp.zip
unzip mcp.zip
mv claude-expert-workflow-mcp-* claude-expert-workflow
cd claude-expert-workflow
```

**Step 3: Install Dependencies**
```bash
npm install --production
```

**Step 4: Configuration**
```json
// Add to your global .mcp.json (usually in C:\Users\{username}\.claude\.mcp.json)
{
  "mcpServers": {
    "claude-expert-workflow": {
      "command": "node",
      "args": ["dist/complete-server.js"],
      "cwd": "C:\\MCP-Servers\\claude-expert-workflow",
      "env": {
        "NODE_ENV": "production",
        "ANTHROPIC_API_KEY": ""
      }
    }
  }
}
```

### Method 3: Development Installation

For contributors or those wanting to modify the server:

```bash
# Clone the repository
git clone https://github.com/jcmrs/claude-expert-workflow-mcp.git
cd claude-expert-workflow-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

## Verification

**Step 1: Restart Claude Code**
- Close Claude Code completely
- Restart Claude Code

**Step 2: Test Connection**
```
/mcp
```
You should see "claude-expert-workflow" listed as connected.

**Step 3: Test Functionality**
Try using one of the expert consultation tools:
- `consultProductManager`
- `consultUXDesigner`
- `consultSoftwareArchitect`
- `getSystemStatus`

## Available Tools

### Expert Consultation
- **consultProductManager** - Product vision, user personas, business requirements
- **consultUXDesigner** - Design vision, user journey, interface design
- **consultSoftwareArchitect** - Technical architecture, system design, security

### Document Generation
- **generatePRD** - Product Requirements Documents
- **generateDesignSpec** - UX Design Specifications
- **generateTechArchitecture** - Technical Architecture Documents

### System Monitoring
- **getSystemStatus** - Server health and functionality status
- **getConversationStatus** - Expert consultation progress tracking

## Configuration Options

### Environment Variables
- `NODE_ENV` - Set to "production" for production use
- `ANTHROPIC_API_KEY` - Leave empty to use Claude Code subscription
- `LOG_LEVEL` - Set logging level (info, debug, error)
- `MCP_SERVER_TIMEOUT` - Server timeout in milliseconds (default: 30000)

### MCP Server Configuration
The server runs in "Hybrid Orchestration mode" by default, using your Claude Code subscription rather than requiring a separate API key.

## Troubleshooting

### Connection Issues
1. Verify Claude Code is completely restarted
2. Check .mcp.json syntax is valid JSON
3. Ensure file paths are correct and use double backslashes on Windows
4. Verify Node.js and npm versions meet requirements

### Server Startup Issues
1. Check that all dependencies are installed: `npm install`
2. Verify the built files exist: `ls dist/`
3. Test server manually: `node dist/complete-server.js`
4. Check logs for specific error messages

### Permission Issues
- Ensure the MCP server directory is readable
- On Windows, verify antivirus isn't blocking the Node.js process
- Check that the working directory (`cwd`) in .mcp.json exists and is accessible

## Support

- **Documentation**: [GitHub Repository](https://github.com/jcmrs/claude-expert-workflow-mcp)
- **Issues**: [Report bugs or request features](https://github.com/jcmrs/claude-expert-workflow-mcp/issues)
- **Discussions**: [Community discussions](https://github.com/jcmrs/claude-expert-workflow-mcp/discussions)

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.