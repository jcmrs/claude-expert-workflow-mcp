# Security Policy

## Supported Versions

We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security vulnerability, please report it to us responsibly.

### How to Report

1. **DO NOT** open a public GitHub issue for security vulnerabilities
2. Send an email to: [your-email@example.com] with the subject "SECURITY VULNERABILITY"
3. Include the following information:
   - Description of the vulnerability
   - Steps to reproduce the issue
   - Potential impact assessment
   - Suggested fix (if you have one)

### What to Expect

- **Response Time**: We aim to respond within 48 hours of receiving your report
- **Investigation**: We will investigate and validate the reported vulnerability
- **Resolution**: We will work to fix the issue as quickly as possible
- **Credit**: We will acknowledge your responsible disclosure (unless you prefer to remain anonymous)

### Security Best Practices

When using this MCP server:

1. **API Keys**: Never commit API keys or sensitive configuration to version control
2. **Environment Variables**: Use environment variables for sensitive configuration
3. **Network Security**: Run the server in a secure environment with appropriate network controls
4. **Updates**: Keep the server updated to the latest version
5. **Monitoring**: Monitor server logs for unusual activity

### Scope

This security policy covers:
- The claude-expert-workflow-mcp server code
- Configuration and deployment recommendations
- Integration security with Claude Code

### Out of Scope

- Third-party dependencies (report directly to their maintainers)
- Issues with the underlying Node.js runtime
- Claude Code client security (report to Anthropic)

## Security Features

This MCP server includes:

- **Memory Management**: Automatic cleanup and resource limits
- **Input Validation**: Comprehensive validation of all inputs
- **Error Handling**: Secure error handling that doesn't leak sensitive information
- **Rate Limiting**: Built-in protection against abuse
- **Configuration Validation**: Runtime validation of all configuration settings

## Security Updates

Security updates will be:
- Released as patch versions (e.g., 1.0.1, 1.0.2)
- Announced in release notes with "SECURITY" label
- Documented in this security policy

## Contact

For security-related questions or concerns:
- Email: [your-email@example.com]
- GitHub: [@jcmrs](https://github.com/jcmrs)

Thank you for helping keep our project secure!