#!/usr/bin/env node
import { spawn } from 'child_process';
import { stdin, stdout } from 'process';

class MCPDebugger {
  private process: any;
  private messageId = 1;

  async testServer(command: string, args: string[]) {
    console.log(`🚀 Testing MCP server: ${command} ${args.join(' ')}`);
    
    // Spawn the server process exactly like Claude Code does
    this.process = spawn(command, args, {
      stdio: ['pipe', 'pipe', 'inherit'], // stdin, stdout, stderr
    });

    this.process.stdout.on('data', (data) => {
      console.log(`📥 Server Response: ${data.toString().trim()}`);
    });

    this.process.on('error', (error) => {
      console.error(`❌ Process Error: ${error.message}`);
    });

    this.process.on('exit', (code) => {
      console.log(`🏁 Process exited with code: ${code}`);
    });

    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      // Test 1: Initialize
      console.log('\n📤 Test 1: Initialize');
      await this.sendMessage({
        jsonrpc: "2.0",
        id: this.messageId++,
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "debug-client", version: "1.0.0" }
        }
      });

      await this.waitForResponse();

      // Test 2: List Tools
      console.log('\n📤 Test 2: List Tools');
      await this.sendMessage({
        jsonrpc: "2.0",
        id: this.messageId++,
        method: "tools/list"
      });

      await this.waitForResponse();

      // Test 3: Call Tool
      console.log('\n📤 Test 3: Call Tool');
      await this.sendMessage({
        jsonrpc: "2.0",
        id: this.messageId++,
        method: "tools/call",
        params: {
          name: "get_system_status",
          arguments: {}
        }
      });

      await this.waitForResponse();

    } catch (error) {
      console.error(`❌ Test Error: ${error}`);
    }

    this.process.kill();
  }

  private async sendMessage(message: any) {
    const msgStr = JSON.stringify(message);
    console.log(`📤 Sending: ${msgStr}`);
    this.process.stdin.write(msgStr + '\n');
  }

  private async waitForResponse() {
    return new Promise(resolve => setTimeout(resolve, 500));
  }
}

// Test our servers vs Context7
async function main() {
  const debugger = new MCPDebugger();

  console.log('='.repeat(50));
  console.log('Testing Context7 (WORKING)');
  console.log('='.repeat(50));
  await debugger.testServer('npx', ['-y', '@upstash/context7-mcp']);

  console.log('\n' + '='.repeat(50));
  console.log('Testing Our Reverse Architecture Server');
  console.log('='.repeat(50));
  await debugger.testServer('node', ['C:\\Users\\jcmei\\Documents\\PROJECTS\\claude-expert-workflow-mcp\\dist\\reverse-server.js']);
}

main().catch(console.error);