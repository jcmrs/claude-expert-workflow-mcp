# Usage Examples

## Overview

This guide provides practical examples of using the Claude Expert Workflow MCP server for various product development scenarios.

## Complete Product Development Workflow

### Scenario: Building a Task Management App

This example shows a full workflow from product planning through technical implementation.

#### Step 1: Product Manager Consultation

```
User: I want to build a task management app that helps remote teams collaborate better. Can you help me plan this product?

Tool: consultProductManager({
  "projectInfo": "Task management app for remote teams with collaboration features. Need help defining the product strategy, target users, and key features."
})

AI Product Manager: Excellent! Let's systematically work through your task management app for remote teams. I'll guide you through each critical area to ensure we have a comprehensive product plan.

Let's start with Product Vision:

1. What's your core vision for this app? What specific problem are you solving for remote teams that existing solutions don't address well?

2. What's your primary value proposition? What will make teams choose your app over Asana, Trello, or Monday.com?

3. What's your target timeframe for MVP launch?

[Continue conversation covering all 5 topics: product_vision, user_personas, business_requirements, feature_map, success_criteria]
```

#### Step 2: Generate Product Requirements Document

```
Tool: generatePRD({
  "conversationId": "conv_1234567890_taskapp",
  "projectName": "TeamSync Task Manager"
})

Result:
{
  "success": true,
  "document": {
    "title": "Product Requirements Document - TeamSync Task Manager",
    "executive_summary": "TeamSync is a task management application designed specifically for remote teams, focusing on asynchronous collaboration, time zone awareness, and context-rich communication.",
    "product_vision": {
      "mission": "Empowering remote teams to collaborate seamlessly across time zones",
      "target_market": "Remote-first companies with 10-500 employees",
      "value_proposition": "The only task manager that truly understands remote work patterns"
    },
    "user_personas": [
      {
        "name": "Remote Team Lead",
        "pain_points": ["Difficulty tracking team progress across time zones", "Context switching between tools"],
        "goals": ["Clear visibility into team workload", "Efficient status updates"]
      }
    ],
    "feature_specifications": {
      "core_features": [
        "Asynchronous status updates",
        "Time zone-aware scheduling",
        "Context-rich task comments",
        "Smart notification scheduling"
      ],
      "mvp_features": [
        "Task creation and assignment",
        "Team workspaces",
        "Basic time zone support",
        "Mobile responsiveness"
      ]
    },
    "success_metrics": {
      "user_adoption": "70% daily active users within 3 months",
      "engagement": "Average 30 tasks per user per week",
      "retention": "80% monthly retention rate"
    }
  }
}
```

#### Step 3: UX Design Consultation

```
Tool: consultUXDesigner({
  "projectInfo": "Design the user interface for TeamSync Task Manager. Focus on remote team collaboration, time zone awareness, and mobile-first design. The app needs to work seamlessly across desktop and mobile devices.",
  "conversationId": "conv_1234567890_taskapp"
})

AI UX Designer: Perfect! I'll help you design an intuitive interface for TeamSync that addresses remote collaboration challenges. Let me guide you through the UX design process.

Starting with Design Vision:

1. What visual style resonates with your target users? Should we aim for:
   - Clean, minimalist professional look?
   - Warm, approachable team-focused design?
   - Bold, productivity-focused interface?

2. How do you want users to feel when using TeamSync?

3. What are your key design principles for remote collaboration?

[Continue through all design topics: design_vision, user_journey, interface_design, design_system, accessibility_usability]
```

#### Step 4: Generate Design Specification

```
Tool: generateDesignSpec({
  "conversationId": "conv_1234567890_taskapp_ux",
  "projectName": "TeamSync Task Manager"
})

Result:
{
  "success": true,
  "document": {
    "title": "UX Design Specification - TeamSync Task Manager",
    "design_overview": {
      "visual_style": "Clean, professional interface with warm accent colors to promote team connection",
      "design_principles": ["Time zone clarity", "Asynchronous-first", "Mobile-responsive", "Accessibility-focused"]
    },
    "user_journey_maps": {
      "task_creation": [
        "User clicks 'New Task' button",
        "Quick creation form appears with smart defaults",
        "Time zone selector shows team member availability",
        "Task created with automatic assignment suggestions"
      ],
      "status_updates": [
        "Dashboard shows pending status requests",
        "One-click status updates with context",
        "Smart scheduling for non-urgent updates"
      ]
    },
    "design_system": {
      "colors": {
        "primary": "#2563eb (Blue)",
        "secondary": "#10b981 (Green)",
        "accent": "#f59e0b (Amber)",
        "neutral": "#64748b (Slate)"
      },
      "typography": {
        "headings": "Inter Bold",
        "body": "Inter Regular",
        "code": "Fira Code"
      },
      "components": [
        "Task Cards with status indicators",
        "Time zone-aware timestamps",
        "Collaborative comment threads",
        "Smart notification center"
      ]
    }
  }
}
```

#### Step 5: Software Architecture Consultation

```
Tool: consultSoftwareArchitect({
  "projectInfo": "I need technical architecture for TeamSync Task Manager. Requirements: real-time collaboration, mobile apps, web app, secure team data, scalable to 500-person teams, time zone handling, offline support.",
  "conversationId": "conv_1234567890_taskapp"
})

AI Software Architect: Excellent! I'll help design a robust, scalable architecture for TeamSync. Given your requirements for real-time collaboration, multi-platform support, and scalability, let's work through each architectural aspect systematically.

Starting with Technical Architecture:

1. For real-time collaboration across web and mobile, I recommend:
   - WebSocket connections for live updates
   - Event-driven architecture for data synchronization
   - CQRS pattern for read/write optimization

2. What's your team's preferred technology stack? Are you leaning toward:
   - JavaScript/TypeScript (Node.js, React, React Native)?
   - Python (Django/FastAPI)?
   - Other preferences?

3. Do you have any existing infrastructure or cloud provider preferences?

[Continue through technical_architecture, system_design, technical_specifications, security_architecture, implementation_strategy]
```

#### Step 6: Generate Technical Architecture Document

```
Tool: generateTechArchitecture({
  "conversationId": "conv_1234567890_taskapp_tech",
  "projectName": "TeamSync Task Manager"
})

Result:
{
  "success": true,
  "document": {
    "title": "Technical Architecture Document - TeamSync Task Manager",
    "architecture_overview": {
      "pattern": "Microservices with Event-Driven Architecture",
      "deployment": "Cloud-native with container orchestration",
      "scalability": "Horizontal scaling with load balancing"
    },
    "system_components": {
      "api_gateway": "Kong or AWS API Gateway for request routing and rate limiting",
      "authentication": "Auth0 or AWS Cognito for user management and SSO",
      "real_time": "WebSocket service using Socket.io or native WebSockets",
      "database": "PostgreSQL for primary data, Redis for caching and sessions",
      "message_queue": "RabbitMQ or AWS SQS for event processing",
      "file_storage": "AWS S3 or Google Cloud Storage for attachments"
    },
    "technology_stack": {
      "backend": "Node.js with TypeScript and Express/Fastify",
      "frontend": "React with TypeScript and Next.js",
      "mobile": "React Native for iOS and Android",
      "infrastructure": "Docker containers on Kubernetes or AWS ECS"
    },
    "security_framework": {
      "authentication": "JWT tokens with refresh rotation",
      "authorization": "Role-based access control (RBAC)",
      "data_encryption": "AES-256 for data at rest, TLS 1.3 for transport",
      "api_security": "Rate limiting, input validation, OWASP compliance"
    }
  }
}
```

## Quick Start Examples

### Simple Product Consultation

```
Tool: consultProductManager({
  "projectInfo": "Mobile app for local restaurant discovery"
})

// AI guides through product planning process
// Generate PRD when complete
```

### UX Design Quick Session

```
Tool: consultUXDesigner({
  "projectInfo": "Redesign checkout flow for e-commerce site to reduce cart abandonment"
})

// AI provides UX expertise on conversion optimization
// Generate design spec with wireframes and user flows
```

### Technical Architecture Review

```
Tool: consultSoftwareArchitect({
  "projectInfo": "Review architecture for high-traffic social media platform, need scalability recommendations"
})

// AI analyzes current architecture and provides improvement recommendations
```

## Industry-Specific Examples

### SaaS Product Development

```
Scenario: B2B Analytics Dashboard

1. Product Manager Consultation:
   - Market analysis and competitive positioning
   - Enterprise user personas and pain points
   - Feature prioritization for B2B needs
   - Pricing strategy and go-to-market planning

2. UX Design:
   - Dashboard information architecture
   - Data visualization best practices
   - Enterprise UI patterns
   - Accessibility for business users

3. Software Architecture:
   - Multi-tenant architecture design
   - Data pipeline architecture
   - Security compliance (SOC 2, GDPR)
   - API design for integrations
```

### Mobile App Development

```
Scenario: Fitness Tracking App

1. Product Planning:
   - Health and wellness market research
   - User motivation and behavior patterns
   - Gamification and engagement features
   - Integration with wearable devices

2. UX Design:
   - Mobile-first interaction patterns
   - Health data visualization
   - Onboarding for behavior change
   - Social features and privacy

3. Technical Implementation:
   - Mobile platform considerations
   - Health data APIs (HealthKit, Google Fit)
   - Real-time sync and offline support
   - Performance optimization for battery life
```

### E-commerce Platform

```
Scenario: Multi-vendor Marketplace

1. Business Strategy:
   - Marketplace business model design
   - Vendor and buyer personas
   - Commission and fee structures
   - Trust and safety requirements

2. User Experience:
   - Multi-sided marketplace UX
   - Search and discovery optimization
   - Vendor dashboard design
   - Mobile commerce patterns

3. System Architecture:
   - Payment processing integration
   - Inventory management systems
   - Search and recommendation engines
   - Fraud detection and prevention
```

## Advanced Usage Patterns

### Iterative Development

```javascript
// Start with high-level consultation
const initialConsult = await consultProductManager({
  projectInfo: "AI-powered writing assistant"
});

// Generate initial PRD
const initialPRD = await generatePRD({
  conversationId: initialConsult.conversationId,
  projectName: "WriteAI Assistant"
});

// Refine with additional consultations
const refinedConsult = await consultProductManager({
  projectInfo: "Refining WriteAI Assistant based on user research findings",
  conversationId: initialConsult.conversationId
});

// Generate updated PRD
const refinedPRD = await generatePRD({
  conversationId: refinedConsult.conversationId,
  projectName: "WriteAI Assistant v2"
});
```

### Cross-Expert Collaboration

```javascript
// Product manager defines requirements
const productConsult = await consultProductManager({
  projectInfo: "Social learning platform for professional development"
});

// UX designer builds on product requirements
const uxConsult = await consultUXDesigner({
  projectInfo: "Design user experience for social learning platform based on PRD requirements",
  conversationId: productConsult.conversationId // Link conversations
});

// Architect designs technical implementation
const techConsult = await consultSoftwareArchitect({
  projectInfo: "Technical architecture for social learning platform with real-time collaboration and mobile support",
  conversationId: productConsult.conversationId // Maintain context
});
```

### System Health Monitoring

```javascript
// Regular health checks
const status = await getSystemStatus();

if (status.status !== "operational") {
  console.warn("MCP server experiencing issues");
}

// Monitor conversation progress
const progress = await getConversationStatus({
  conversationId: "conv_1234567890_project"
});

console.log(`Consultation is ${progress.progress}% complete`);
```

## Integration Examples

### CI/CD Pipeline Integration

```yaml
# GitHub Actions workflow
name: Product Documentation Update
on:
  push:
    paths: ['product-requirements/**']

jobs:
  update-prd:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate Updated PRD
        run: |
          # Use MCP tools to regenerate documentation
          node scripts/update-prd.js
```

### API Integration

```javascript
// Custom integration with project management tools
class ProductPlanningIntegration {
  async createProjectFromPRD(prd) {
    // Extract features and create tasks
    const features = prd.document.feature_specifications.core_features;

    for (const feature of features) {
      await this.createTask({
        title: feature,
        description: `Implement ${feature} based on PRD requirements`,
        priority: 'high'
      });
    }
  }
}
```

## Best Practices

### Effective Consultation

1. **Be Specific**: Provide detailed project information
2. **Ask Follow-ups**: Engage with expert questions
3. **Complete Topics**: Cover all required areas before generating documents
4. **Iterate**: Use conversation IDs to build on previous discussions

### Document Generation

1. **Complete Consultations First**: Ensure all topics are covered
2. **Use Descriptive Names**: Clear project names improve document quality
3. **Save Conversation IDs**: For future reference and updates
4. **Review Generated Content**: Documents are starting points for refinement

### System Monitoring

1. **Regular Health Checks**: Monitor server status
2. **Track Conversation Progress**: Use status tools to monitor workflows
3. **Handle Errors Gracefully**: Implement proper error handling
4. **Performance Monitoring**: Watch for memory and resource usage