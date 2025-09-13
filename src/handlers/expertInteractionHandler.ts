import {
  EXPERT_WORKFLOW_STAGES,
  EXPERT_STAGE_MAPPING,
  STAGE_COMPLETION_CRITERIA,
  getStageIntroduction,
  getTopicPhrases
} from '../state/workflowState';
import { WorkflowState } from '../state/workflowState';
import { consultWithExpert, callClaudeWithThinking, ClaudeResponse } from '../utils/anthropicUtils';
import { MCPErrorHandler, ErrorType } from '../utils/errorHandler';
import { memoryManager } from '../utils/memoryManager';

// Expert definitions with proper typing
const experts: { [key: string]: any } = {
  productManager: {
    title: 'AI Product Manager',
    topics: ['product_vision', 'user_personas', 'business_requirements', 'feature_map', 'success_criteria'],
    systemPrompt: `You are an experienced AI Product Manager specializing in product strategy, user research, and requirements definition. Your role is to help users create comprehensive product specifications through structured conversation.

CORE RESPONSIBILITIES:
- Analyze user needs and market opportunities
- Define product vision and strategy
- Create user personas and user stories
- Establish business requirements and success criteria
- Guide feature prioritization and MVP definition

CONVERSATION APPROACH:
- Ask clarifying questions to understand the product concept
- Probe for business objectives and target audience
- Explore technical constraints and opportunities
- Guide users through systematic product planning
- Ensure all critical aspects are covered before moving to implementation

REQUIRED TOPICS TO COVER:
1. Product Vision - Overall concept, goals, and value proposition
2. User Personas - Target users, their needs, and pain points
3. Business Requirements - Core functionality, constraints, and priorities
4. Feature Map - Key features with priorities and dependencies
5. Success Criteria - Metrics, KPIs, and validation methods

CONVERSATION STYLE:
- Professional but approachable
- Ask follow-up questions to clarify requirements
- Provide expert insights and recommendations
- Guide users through systematic thinking
- Don't move to the next topic until the current one is well-defined`,
    outputFormat: 'Product Requirements Document'
  },

  uxDesigner: {
    title: 'AI UX Designer',
    topics: ['ui_documentation', 'feature_specifications', 'user_journeys', 'interaction_patterns', 'data_requirements'],
    systemPrompt: `You are an experienced AI UX Designer specializing in user experience design, interface design, and user research. Your role is to help users create comprehensive design specifications through structured conversation.

CORE RESPONSIBILITIES:
- Research user needs and behaviors
- Design intuitive user interfaces and experiences
- Create design systems and style guides
- Ensure accessibility and usability standards
- Validate designs through user testing and feedback

CONVERSATION APPROACH:
- Ask about target users and their goals
- Understand the context of use and constraints
- Explore interaction patterns and user flows
- Guide users through systematic design thinking
- Focus on user-centered design principles

REQUIRED TOPICS TO COVER:
1. UI Documentation - Visual design preferences and design system requirements
2. Feature Specifications - Detailed specification of each feature from UX perspective
3. User Journeys - User flows, scenarios, and task analysis
4. Interaction Patterns - How users will interact with the system
5. Data Requirements - What information architecture and data the UX needs

DESIGN PHILOSOPHY:
- User-centered design approach
- Accessibility and inclusion first
- Iterative design and validation
- Clear visual hierarchy and information architecture
- Consistent and predictable interactions`,
    outputFormat: 'UX Design Specification'
  },

  softwareArchitect: {
    title: 'AI Software Architect',
    topics: ['technical_architecture', 'api_specifications', 'implementation_tasks', 'database_schema', 'testing_strategy'],
    systemPrompt: `You are an experienced AI Software Architect specializing in system design, technical architecture, and implementation planning. Your role is to help users create comprehensive technical specifications through structured conversation.

CORE RESPONSIBILITIES:
- Design scalable and maintainable system architectures
- Define technical specifications and requirements
- Plan implementation strategies and approaches
- Ensure security, performance, and reliability
- Guide technology selection and integration

CONVERSATION APPROACH:
- Understand business requirements and constraints
- Analyze technical challenges and opportunities
- Explore scalability and performance requirements
- Consider security and compliance needs
- Plan for maintainability and future growth

REQUIRED TOPICS TO COVER:
1. Technical Architecture - High-level system design and components
2. API Specifications - Detailed API design and integration points
3. Implementation Tasks - Breaking down the work into development tasks
4. Database Schema - Data model and storage requirements
5. Testing Strategy - Quality assurance and testing approach

TECHNICAL PHILOSOPHY:
- Scalability and performance optimization
- Security and privacy by design
- Maintainable and testable code
- Technology selection based on requirements
- Continuous integration and deployment practices`,
    outputFormat: 'Technical Architecture Document'
  }
};

export interface ExpertInteractionResult {
  response: string;
  updatedState: WorkflowState;
  document?: string;
  isComplete?: boolean;
}

/**
 * Handle expert interaction based on the current workflow state
 */
export async function handleExpertInteraction(
  message: string,
  state: WorkflowState,
  useExtendedThinking?: boolean
): Promise<ExpertInteractionResult> {
  const { currentStage } = state;
  const expertName = EXPERT_STAGE_MAPPING[currentStage];

  // Get the current stage data or initialize it
  let stageData = state.stageData[currentStage] || {
    completed: false,
    completedTopics: []
  };

  // Check for stage transition requests
  if (shouldTransitionToNextStage(message, stageData)) {
    if (isStageComplete(currentStage, stageData)) {
      return transitionToNextStage(state);
    } else {
      return {
        response: `I notice we haven't completed all necessary topics for this stage. We still need to cover: ${getRemainingTopics(currentStage, stageData)}.`,
        updatedState: state
      };
    }
  }

  // Check for document generation requests
  if (shouldGenerateDocument(message)) {
    if (isStageComplete(currentStage, stageData)) {
      return generateDocument(state);
    } else {
      return {
        response: `Before generating the document, we should complete all topics. We still need to cover: ${getRemainingTopics(currentStage, stageData)}.`,
        updatedState: state
      };
    }
  }

  // Handle the current expert interaction
  const expert = experts[expertName];
  const expertPrompt = expert.systemPrompt;
  const contextData = getContextForStage(state);

  // Add context to the message if available
  const messageWithContext = contextData ? `${contextData}\n\n${message}` : message;
  // Use Enhanced Extended Thinking API for conversation continuity
  let previousThinkingBlocks: any[] = [];
  let response: ClaudeResponse;
  let aiResponse: string;

  try {
    // Safely extract previous thinking blocks with error handling
    try {
      previousThinkingBlocks = Array.isArray(stageData.thinkingBlocks) ? stageData.thinkingBlocks : [];
      if (previousThinkingBlocks.length > 0) {
        console.error(`[EXTENDED-THINKING] Loaded ${previousThinkingBlocks.length} previous thinking blocks for conversation continuity`);
      }
    } catch (error) {
      console.error('[EXTENDED-THINKING] Error loading previous thinking blocks, starting fresh:', error);
      previousThinkingBlocks = [];
    }

    // Make the Enhanced Extended Thinking API call
    response = await callClaudeWithThinking(
      expertPrompt,
      '',
      messageWithContext,
      useExtendedThinking,
      previousThinkingBlocks
    );

    aiResponse = response.text;

    // Validate response structure
    if (!response.text || typeof response.text !== 'string') {
      throw new Error('Invalid response structure from Extended Thinking API');
    }

  } catch (error) {
    // Extended Thinking API call is already wrapped, but we need to handle integration errors
    console.error('[EXTENDED-THINKING] Integration error in expert interaction:', error);

    // If this is already a structured error response (JSON), pass it through
    if (typeof error === 'string' || (error instanceof Error && error.message.startsWith('{'))) {
      const errorText = error instanceof Error ? error.message : String(error);
      try {
        JSON.parse(errorText); // Validate it's valid JSON
        return {
          response: errorText,
          updatedState: state,
          isComplete: false,
          document: undefined
        };
      } catch {
        // Not JSON, treat as regular error
      }
    }

    // Create structured error response for integration failures
    const errorResponse = MCPErrorHandler.formatResponse(
      error instanceof Error ? error : new Error(String(error)),
      {
        operation: 'Expert Interaction with Extended Thinking',
        component: 'expertInteractionHandler',
        processingMode: 'api',
        conversationId: 'unknown',
        timestamp: Date.now()
      },
      ErrorType.EXTENDED_THINKING_ERROR
    );

    return {
      response: errorResponse.content[0].text,
      updatedState: state,
      isComplete: false,
      document: undefined
    };
  }

  // Update the state with progress and preserve thinking blocks with error handling
  let updatedStageData;
  try {
    updatedStageData = updateStageProgress(currentStage, stageData, message, aiResponse);

    // Use memory manager for comprehensive thinking block validation and management
    if (response.thinkingBlocks && Array.isArray(response.thinkingBlocks)) {
      // Generate conversation ID for memory tracking
      const conversationId = `expert_${Date.now()}`;

      // Use memory manager's comprehensive validation
      const validationResult = memoryManager.validateThinkingBlocks(
        conversationId,
        response.thinkingBlocks
      );

      // Log any warnings from validation
      if (validationResult.warnings.length > 0) {
        console.error(`[EXTENDED-THINKING] Validation warnings:`, validationResult.warnings);
      }

      updatedStageData.thinkingBlocks = validationResult.validBlocks;

      if (validationResult.validBlocks.length > 0) {
        console.error(`[EXTENDED-THINKING] Preserved ${validationResult.validBlocks.length} thinking blocks for next conversation turn`);
      }
    } else {
      // Clear thinking blocks if response doesn't contain valid ones
      updatedStageData.thinkingBlocks = [];
    }

  } catch (error) {
    console.error('[EXTENDED-THINKING] Error updating state with thinking blocks:', error);
    // Fall back to basic state update without thinking blocks
    updatedStageData = updateStageProgress(currentStage, stageData, message, aiResponse);
    updatedStageData.thinkingBlocks = [];
  }

  const updatedState = {
    ...state,
    stageData: {
      ...state.stageData,
      [currentStage]: updatedStageData
    }
  };

  // Check if we should use the updated response (with document generation suggestion)
  const responseToUse = updatedStageData.suggestDocument ?
    aiResponse + "\n\nWe've covered all the necessary topics for this stage. Would you like me to generate the document now? Please confirm by saying 'Yes, generate the document'." :
    aiResponse;

  return {
    response: responseToUse,
    updatedState
  };
}

/**
 * Check if the user wants to move to the next stage
 */
function shouldTransitionToNextStage(message: string, stageData: any): boolean {
  const transitionPhrases = [
    "move to next stage",
    "continue to next stage",
    "proceed to next stage",
    "go to next stage",
    "move on to next phase",
    "continue to next phase",
    "let's move on",
    "let's continue to"
  ];

  return transitionPhrases.some(phrase =>
    message.toLowerCase().includes(phrase.toLowerCase())
  );
}

/**
 * Check if the user wants to generate a document
 */
function shouldGenerateDocument(message: string): boolean {
  const documentPhrases = [
    "generate document",
    "create document",
    "generate the document",
    "create the document",
    "generate the final document",
    "create the final document",
    "generate prd",
    "create prd",
    "generate specification",
    "create specification",
    "yes, generate the document",
    "yes, create the document",
    "please generate the document",
    "please create the document",
    "i'm ready for the document",
    "i am ready for the document",
    "let's generate the document",
    "let's create the document",
    "ok generate document",
    "ok create document",
    "ok generate the document",
    "ok create the document"
  ];

  return documentPhrases.some(phrase =>
    message.toLowerCase().includes(phrase.toLowerCase())
  );
}

/**
 * Check if all required topics for a stage are completed
 */
function isStageComplete(stage: string, stageData: any): boolean {
  const { completedTopics, completed } = stageData;
  const requiredTopics = STAGE_COMPLETION_CRITERIA[stage];

  // If already marked complete or all topics covered
  return completed ||
    (requiredTopics && requiredTopics.every(topic => completedTopics.includes(topic)));
}

/**
 * Get a list of remaining topics for a stage
 */
function getRemainingTopics(stage: string, stageData: any): string {
  const { completedTopics } = stageData;
  const requiredTopics = STAGE_COMPLETION_CRITERIA[stage];

  if (!requiredTopics) return "all topics";

  return requiredTopics
    .filter(topic => !completedTopics.includes(topic))
    .map(topic => topic.replace('_', ' '))
    .join(', ');
}

/**
 * Transition to the next stage in the workflow
 */
function transitionToNextStage(state: WorkflowState): ExpertInteractionResult {
  const currentIndex = Object.values(EXPERT_WORKFLOW_STAGES)
    .findIndex(stage => stage === state.currentStage);

  const stages = Object.values(EXPERT_WORKFLOW_STAGES);

  // If we're at the last stage
  if (currentIndex === stages.length - 1) {
    return {
      response: "Congratulations! We've completed all stages of the expert workflow. Would you like to generate the final comprehensive document that includes all three phases?",
      updatedState: {
        ...state,
        stageData: {
          ...state.stageData,
          [state.currentStage]: {
            ...state.stageData[state.currentStage],
            completed: true
          }
        }
      }
    };
  }

  // Move to next stage
  const nextStage = stages[currentIndex + 1];

  return {
    response: `Great! We've completed the ${state.currentStage.replace('_', ' ')} stage. Let's move on to the ${nextStage.replace('_', ' ')} stage.\n\n${getStageIntroduction(nextStage)}`,
    updatedState: {
      ...state,
      currentStage: nextStage,
      completedStages: [...state.completedStages, state.currentStage],
      stageData: {
        ...state.stageData,
        [state.currentStage]: {
          ...state.stageData[state.currentStage],
          completed: true
        },
        [nextStage]: {
          completed: false,
          completedTopics: []
        }
      }
    }
  };
}

/**
 * Generate a document based on the current stage
 */
function generateDocument(state: WorkflowState): ExpertInteractionResult {
  const { currentStage } = state;
  const expertName = EXPERT_STAGE_MAPPING[currentStage];
  const expert = experts[expertName];

  // Check if we have a document already or need to generate one
  if (!state.stageData[currentStage].document) {
    // We don't have a document yet, so ask for confirmation first
    return {
      response: `I'm ready to generate the ${expert.outputFormat} for your project. All required topics have been covered. Would you like me to generate the document now? Please confirm by saying "Yes, generate the document" or similar.`,
      updatedState: state
    };
  }

  // Get the document content from the stage data
  const document = state.stageData[currentStage].document;

  return {
    response: `Here's the ${expert.outputFormat} for your project:\n\n${document}`,
    updatedState: state,
    document,
    isComplete: true
  };
}

/**
 * Get context data for the current stage
 */
function getContextForStage(state: WorkflowState): string {
  let context = "";

  // Add context from previous stages
  for (const stage of state.completedStages) {
    const stageData = state.stageData[stage];
    if (stageData && stageData.document) {
      context += `${stageData.document}\n\n`;
    }
  }

  // Add context from current stage progress
  const currentStageData = state.stageData[state.currentStage];
  if (currentStageData && currentStageData.completedTopics.length > 0) {
    context += `Current progress in ${state.currentStage.replace('_', ' ')} stage:\n`;
    context += `Completed topics: ${currentStageData.completedTopics.join(', ')}\n`;
    if (currentStageData.currentTopic) {
      context += `Current topic: ${currentStageData.currentTopic}\n`;
    }
  }

  return context;
}

/**
 * Update the progress of the current stage based on the interaction
 */
function updateStageProgress(
  stage: string,
  stageData: any,
  userMessage: string,
  aiResponse: string
): any {
  const { completedTopics, currentTopic } = stageData;
  const requiredTopics = STAGE_COMPLETION_CRITERIA[stage];

  // Detect if we've completed the current topic based on AI response
  const topicCompletion = detectTopicCompletion(aiResponse, currentTopic);

  // Detect next topic if current one is complete
  const nextTopic = topicCompletion
    ? detectNextTopic(requiredTopics, completedTopics, userMessage, aiResponse)
    : currentTopic;

  // Update completed topics if we finished one
  const updatedCompletedTopics = topicCompletion && currentTopic
    ? [...completedTopics, currentTopic]
    : completedTopics;

  // Check if all topics are completed but don't automatically generate a document
  const allTopicsCompleted = requiredTopics.every(topic => updatedCompletedTopics.includes(topic));

  // Only mark as document generated if the AI response actually contains a document format
  // AND we've explicitly been asked to generate a document (handled elsewhere)
  const documentGenerated = false;

  return {
    ...stageData,
    completedTopics: updatedCompletedTopics,
    currentTopic: nextTopic,
    document: documentGenerated ? aiResponse : stageData.document,
    completed: documentGenerated,
    suggestDocument: allTopicsCompleted && !stageData.document
  };
}

/**
 * Detect if a topic has been completed based on the AI response
 */
function detectTopicCompletion(aiResponse: string, currentTopic?: string): boolean {
  if (!currentTopic) return false;

  // Check for phrases that indicate topic completion
  const completionPhrases = [
    "Great, we've covered",
    "Now that we've discussed",
    "Let's move on to",
    "Next, let's talk about",
    "We've completed",
    "We've finished discussing",
    "That covers",
    "Now we can move to"
  ];

  return completionPhrases.some(phrase => aiResponse.includes(phrase));
}

/**
 * Detect the next topic to discuss based on the interaction
 */
function detectNextTopic(
  requiredTopics: string[],
  completedTopics: string[],
  userMessage: string,
  aiResponse: string
): string | undefined {
  // Find topics not yet completed
  const remainingTopics = requiredTopics.filter(
    topic => !completedTopics.includes(topic)
  );

  if (remainingTopics.length === 0) return undefined;

  // Detect which topic is being introduced
  for (const topic of remainingTopics) {
    const topicPhrases = getTopicPhrases(topic);
    for (const phrase of topicPhrases) {
      if (aiResponse.toLowerCase().includes(`let's discuss ${phrase}`) ||
          aiResponse.toLowerCase().includes(`let's talk about ${phrase}`) ||
          aiResponse.toLowerCase().includes(`now, let's focus on ${phrase}`) ||
          aiResponse.toLowerCase().includes(`next, we'll cover ${phrase}`)) {
        return topic;
      }
    }
  }

  // Default to first remaining topic if we can't detect
  return remainingTopics[0];
}

/**
 * Prepare a comprehensive document for Task Master
 */
export function prepareDocumentForTaskMaster(state: WorkflowState): string {
  const { stageData } = state;

  const productDoc = stageData[EXPERT_WORKFLOW_STAGES.PRODUCT_DEFINITION]?.document || '';
  const uxDoc = stageData[EXPERT_WORKFLOW_STAGES.UX_DESIGN]?.document || '';
  const techDoc = stageData[EXPERT_WORKFLOW_STAGES.TECHNICAL_PLANNING]?.document || '';

  // Combine all documents with separators
  const combinedDoc = `
# COMPREHENSIVE PROJECT SPECIFICATION

${productDoc}

---

${uxDoc}

---

${techDoc}
`;

  return combinedDoc;
}