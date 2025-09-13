# MCP Tools API Reference

## Overview

The Claude Expert Workflow MCP server provides 8 specialized tools for AI-powered product development consultation and document generation.

## Expert Consultation Tools

### `consultProductManager`

Consult with an AI Product Manager expert for product planning and requirements.

**Parameters:**
- `projectInfo` (string, required): Detailed project information or question
- `conversationId` (string, optional): Conversation ID for context tracking

**Returns:**
```json
{
  "expert": "AI Product Manager",
  "systemPrompt": "Product Manager expertise...",
  "topics": ["product_vision", "user_personas", "business_requirements", "feature_map", "success_criteria"],
  "userInput": "Your project description",
  "conversationId": "conv_1234567890_abc123",
  "completedTopics": [],
  "guidance": "Apply Product Manager expertise...",
  "nextSteps": ["Analyze requirements", "Use generatePRD when complete"]
}
```

**Topics Covered:**
- **Product Vision**: Overall concept, goals, and value proposition
- **User Personas**: Target users, their needs, and pain points
- **Business Requirements**: Core functionality, constraints, and priorities
- **Feature Map**: Key features with priorities and dependencies
- **Success Criteria**: Metrics, KPIs, and validation methods

---

### `consultUXDesigner`

Consult with an AI UX Designer expert for user experience and interface design.

**Parameters:**
- `projectInfo` (string, required): Detailed project information or question
- `conversationId` (string, optional): Conversation ID for context tracking

**Returns:**
```json
{
  "expert": "AI UX Designer",
  "systemPrompt": "UX Designer expertise...",
  "topics": ["design_vision", "user_journey", "interface_design", "design_system", "accessibility_usability"],
  "userInput": "Your design question",
  "conversationId": "conv_1234567890_def456",
  "completedTopics": [],
  "guidance": "Apply UX Designer expertise...",
  "nextSteps": ["Design user flows", "Use generateDesignSpec when complete"]
}
```

**Topics Covered:**
- **Design Vision**: Overall design concept and aesthetic direction
- **User Journey**: User flows, interaction patterns, and experience mapping
- **Interface Design**: UI components, layouts, and visual hierarchy
- **Design System**: Component library, style guides, and design tokens
- **Accessibility & Usability**: Inclusive design and user testing considerations

---

### `consultSoftwareArchitect`

Consult with an AI Software Architect expert for technical architecture and system design.

**Parameters:**
- `projectInfo` (string, required): Detailed project information or question
- `conversationId` (string, optional): Conversation ID for context tracking

**Returns:**
```json
{
  "expert": "AI Software Architect",
  "systemPrompt": "Software Architect expertise...",
  "topics": ["technical_architecture", "system_design", "technical_specifications", "security_architecture", "implementation_strategy"],
  "userInput": "Your technical question",
  "conversationId": "conv_1234567890_ghi789",
  "completedTopics": [],
  "guidance": "Apply Software Architect expertise...",
  "nextSteps": ["Design architecture", "Use generateTechArchitecture when complete"]
}
```

**Topics Covered:**
- **Technical Architecture**: High-level system design and components
- **System Design**: Detailed design patterns and structures
- **Technical Specifications**: APIs, databases, and integrations
- **Security Architecture**: Authentication, authorization, and data protection
- **Implementation Strategy**: Development approach, deployment, and operations

## Document Generation Tools

### `generatePRD`

Generate a Product Requirements Document from Product Manager consultation.

**Parameters:**
- `conversationId` (string, required): Conversation ID from product manager consultation
- `projectName` (string, required): Name of the project

**Returns:**
```json
{
  "success": true,
  "document": {
    "title": "Product Requirements Document",
    "project": "Project Name",
    "sections": {
      "executive_summary": "...",
      "product_vision": "...",
      "user_personas": "...",
      "business_requirements": "...",
      "feature_specifications": "...",
      "success_metrics": "..."
    }
  },
  "conversationId": "conv_1234567890_abc123",
  "projectName": "Your Project"
}
```

---

### `generateDesignSpec`

Generate a UX Design Specification from UX Designer consultation.

**Parameters:**
- `conversationId` (string, required): Conversation ID from UX designer consultation
- `projectName` (string, required): Name of the project

**Returns:**
```json
{
  "success": true,
  "document": {
    "title": "UX Design Specification",
    "project": "Project Name",
    "sections": {
      "design_overview": "...",
      "user_journey_maps": "...",
      "wireframes": "...",
      "design_system": "...",
      "accessibility_guidelines": "..."
    }
  },
  "conversationId": "conv_1234567890_def456",
  "projectName": "Your Project"
}
```

---

### `generateTechArchitecture`

Generate a Technical Architecture Document from Software Architect consultation.

**Parameters:**
- `conversationId` (string, required): Conversation ID from software architect consultation
- `projectName` (string, required): Name of the project

**Returns:**
```json
{
  "success": true,
  "document": {
    "title": "Technical Architecture Document",
    "project": "Project Name",
    "sections": {
      "architecture_overview": "...",
      "system_components": "...",
      "api_specifications": "...",
      "security_framework": "...",
      "deployment_strategy": "..."
    }
  },
  "conversationId": "conv_1234567890_ghi789",
  "projectName": "Your Project"
}
```

## System Monitoring Tools

### `getSystemStatus`

Check system status and available functionality.

**Parameters:** None

**Returns:**
```json
{
  "status": "operational",
  "server": "Claude Expert Workflow MCP (Complete)",
  "version": "1.0.0",
  "uptime": 254.32,
  "memory": {
    "rss": 57479168,
    "heapTotal": 9240576,
    "heapUsed": 8075144,
    "external": 1783183,
    "arrayBuffers": 27396
  },
  "nodeVersion": "v20.0.0",
  "experts": [
    {"name": "Product Manager", "topics": [...]},
    {"name": "UX Designer", "topics": [...]},
    {"name": "Software Architect", "topics": [...]}
  ],
  "tools": ["consultProductManager", "consultUXDesigner", ...],
  "timestamp": "2024-12-13T19:41:19.211Z"
}
```

---

### `getConversationStatus`

Get status and progress of an expert consultation conversation.

**Parameters:**
- `conversationId` (string, required): Conversation ID to check

**Returns:**
```json
{
  "success": true,
  "conversation": {
    "id": "conv_1234567890_abc123",
    "expert": "Product Manager",
    "status": "in_progress",
    "completedTopics": ["product_vision", "user_personas"],
    "remainingTopics": ["business_requirements", "feature_map", "success_criteria"],
    "progress": 40,
    "messages": 8,
    "createdAt": "2024-12-13T19:30:00.000Z",
    "updatedAt": "2024-12-13T19:40:00.000Z"
  }
}
```

## Error Responses

All tools return error responses in this format when something goes wrong:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": "Additional error details"
}
```

Common error codes:
- `CONVERSATION_NOT_FOUND`: The specified conversation ID doesn't exist
- `INVALID_INPUT`: Required parameters are missing or invalid
- `SERVER_ERROR`: Internal server error
- `CONSULTATION_INCOMPLETE`: Trying to generate document before consultation is complete

## Usage Examples

### Complete Workflow Example

```javascript
// 1. Start product consultation
const productConsult = await consultProductManager({
  projectInfo: "Mobile app for fitness tracking with social features"
});

// 2. Continue consultation through Claude Code conversation
// ... (expert guides through all topics)

// 3. Generate PRD when consultation is complete
const prd = await generatePRD({
  conversationId: productConsult.conversationId,
  projectName: "FitSocial App"
});

// 4. Start UX consultation
const uxConsult = await consultUXDesigner({
  projectInfo: "Design mobile interface for FitSocial fitness tracking app",
  conversationId: productConsult.conversationId // Link conversations
});

// 5. Generate design specification
const designSpec = await generateDesignSpec({
  conversationId: uxConsult.conversationId,
  projectName: "FitSocial App"
});
```

### System Health Check

```javascript
// Check if MCP server is running properly
const status = await getSystemStatus();
console.log(`Server status: ${status.status}`);
console.log(`Available tools: ${status.tools.length}`);
```