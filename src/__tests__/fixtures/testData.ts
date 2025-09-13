import { ConversationState, WorkflowSession, ExpertOutput } from '@/types';

export const mockConversationState: ConversationState = {
  id: 'conv_123',
  messages: [
    {
      role: 'user',
      content: 'I need help with a new mobile app project',
      timestamp: new Date('2024-01-01T10:00:00Z'),
    },
    {
      role: 'assistant',
      content: 'I\'d be happy to help you with your mobile app project. Can you tell me more about the app idea?',
      timestamp: new Date('2024-01-01T10:01:00Z'),
    },
  ],
  currentTopic: 'project_planning',
  completedTopics: [],
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:01:00Z'),
};

export const mockExpertOutput: ExpertOutput = {
  expertType: 'product_manager',
  conversationId: 'conv_123',
  output: 'Based on our discussion, here are the key requirements for your mobile app...',
  completedAt: new Date('2024-01-01T10:30:00Z'),
  topics: ['user_requirements', 'market_analysis', 'feature_prioritization'],
};

export const mockWorkflowSession: WorkflowSession = {
  id: 'workflow_123',
  projectDescription: 'A mobile app for food delivery with real-time tracking',
  workflowType: 'linear',
  expertQueue: ['product_manager', 'ux_designer', 'software_architect'],
  currentExpert: 'product_manager',
  state: 'expert_consultation',
  outputs: [],
  createdAt: new Date('2024-01-01T10:00:00Z'),
  updatedAt: new Date('2024-01-01T10:00:00Z'),
};

export const mockProjectInfo = {
  name: 'FoodieDelivery',
  description: 'A comprehensive food delivery platform with real-time tracking, multiple restaurant partnerships, and user-friendly interface',
  industry: 'Food & Beverage',
  targetAudience: 'Urban professionals aged 25-40',
};

export const mockPRDContent = `# Product Requirements Document: FoodieDelivery

## Executive Summary
FoodieDelivery is a comprehensive food delivery platform designed for urban professionals...

## Product Goals
- Provide seamless food ordering experience
- Enable real-time order tracking
- Support multiple payment methods
- Maintain high customer satisfaction ratings

## User Stories
### As a Customer:
- I want to browse restaurants by cuisine type
- I want to track my order in real-time
- I want to save my favorite orders for quick reordering

### As a Restaurant Partner:
- I want to manage my menu and pricing
- I want to track order volumes and revenue
- I want to communicate with delivery drivers

## Technical Requirements
- Native mobile apps for iOS and Android
- Web-based admin panel for restaurants
- Real-time GPS tracking integration
- Secure payment processing
`;

export const mockDesignSpecContent = `# Design Specification: FoodieDelivery

## Design System Overview
The FoodieDelivery design system emphasizes simplicity, accessibility, and visual appeal...

## Color Palette
- Primary: #FF6B35 (Orange)
- Secondary: #2E86AB (Blue)
- Neutral: #F5F5F5 (Light Gray)
- Success: #28A745 (Green)
- Error: #DC3545 (Red)

## Typography
- Primary: Roboto (headings and body text)
- Secondary: Open Sans (captions and metadata)

## User Interface Components
### Navigation
- Bottom tab navigation for main sections
- Top navigation with search and location
- Floating action button for cart access

### Cards and Lists
- Restaurant cards with ratings and delivery time
- Food item cards with images and descriptions
- Order history list with status indicators
`;

export const mockTechArchitectureContent = `# Technical Architecture: FoodieDelivery

## System Architecture Overview
FoodieDelivery follows a microservices architecture pattern with API-first design...

## Technology Stack
### Frontend
- React Native for mobile applications
- Next.js for web admin panel
- Redux Toolkit for state management

### Backend
- Node.js with Express.js framework
- PostgreSQL for primary data storage
- Redis for caching and session management
- MongoDB for analytics and logging

### Infrastructure
- AWS ECS for container orchestration
- Amazon RDS for managed PostgreSQL
- Amazon ElastiCache for Redis
- CloudFront CDN for static asset delivery

## API Design
### Core Services
- User Service: Authentication, profile management
- Restaurant Service: Menu management, availability
- Order Service: Order processing, status tracking
- Payment Service: Payment processing, refunds
- Notification Service: Push notifications, SMS alerts

## Data Models
### User
- id, email, phone, preferences, addresses
### Restaurant
- id, name, cuisine_type, location, menu_items
### Order
- id, user_id, restaurant_id, items, status, delivery_info
`;

export const mockClaudeResponses = {
  productManager: 'As a Product Manager, I\'ve analyzed your project requirements...',
  uxDesigner: 'From a UX perspective, the user journey should prioritize...',
  softwareArchitect: 'The technical architecture should be designed with scalability...',
};

export const createMockConversation = (overrides: Partial<ConversationState> = {}): ConversationState => ({
  ...mockConversationState,
  ...overrides,
});

export const createMockWorkflowSession = (overrides: Partial<WorkflowSession> = {}): WorkflowSession => ({
  ...mockWorkflowSession,
  ...overrides,
});

export const createMockExpertOutput = (overrides: Partial<ExpertOutput> = {}): ExpertOutput => ({
  ...mockExpertOutput,
  ...overrides,
});