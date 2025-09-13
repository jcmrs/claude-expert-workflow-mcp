import { ConversationState } from '@/types';
import { claudeClient } from '@/claude/client';
import { logger } from '@/utils/logger';

const DESIGN_SPEC_TEMPLATE = `
# Design Specification Document: {{PROJECT_NAME}}

## Executive Summary
{{EXECUTIVE_SUMMARY}}

## 1. Design Vision
{{DESIGN_VISION}}

## 2. User Journey
{{USER_JOURNEY}}

## 3. Interface Design
{{INTERFACE_DESIGN}}

## 4. Design System
{{DESIGN_SYSTEM}}

## 5. Accessibility & Usability
{{ACCESSIBILITY_USABILITY}}

## Implementation Notes
{{IMPLEMENTATION_NOTES}}

---
*Document generated from UX Designer consultation on {{GENERATION_DATE}}*
`;

const DESIGN_EXTRACTION_PROMPT = `Based on the following conversation between a user and an AI UX Designer, extract and organize the design information into the specified Design Specification sections. 

CONVERSATION HISTORY:
{{CONVERSATION_CONTENT}}

Please extract and format the information for each section. If a section wasn't fully discussed, note what design information is missing. Format your response as a JSON object with these keys:
- executiveSummary
- designVision 
- userJourney
- interfaceDesign
- designSystem
- accessibilityUsability
- implementationNotes

Focus on concrete, actionable design specifications that were discussed during the conversation.`;

export async function generateDesignSpec(conversation: ConversationState, projectName?: string): Promise<string> {
  try {
    logger.info(`Generating Design Specification for conversation ${conversation.id}`);
    
    // Format conversation content
    const conversationContent = conversation.messages
      .map(msg => `**${msg.role.toUpperCase()}**: ${msg.content}`)
      .join('\n\n');

    // Extract structured design information using Claude
    const extractionPrompt = DESIGN_EXTRACTION_PROMPT.replace('{{CONVERSATION_CONTENT}}', conversationContent);
    const extractedInfo = await claudeClient.chat([
      {
        role: 'user',
        content: extractionPrompt
      }
    ]);

    // Parse the extracted information
    let parsedInfo: any;
    try {
      parsedInfo = JSON.parse(extractedInfo);
    } catch (parseError) {
      logger.warn('Failed to parse extracted design information as JSON, using raw response');
      parsedInfo = {
        executiveSummary: 'Design specification extraction in progress',
        designVision: extractedInfo,
        userJourney: 'See conversation details above',
        interfaceDesign: 'To be refined based on discussion',
        designSystem: 'Component specifications pending',
        accessibilityUsability: 'Compliance guidelines to be defined',
        implementationNotes: 'Design specifications needed'
      };
    }

    // Generate the final Design Specification
    const finalProjectName = projectName || 'Unnamed Project';
    const generationDate = new Date().toLocaleString();

    let designSpec = DESIGN_SPEC_TEMPLATE
      .replace('{{PROJECT_NAME}}', finalProjectName)
      .replace('{{EXECUTIVE_SUMMARY}}', parsedInfo.executiveSummary || 'Executive summary to be completed')
      .replace('{{DESIGN_VISION}}', parsedInfo.designVision || 'Design vision needs further definition')
      .replace('{{USER_JOURNEY}}', parsedInfo.userJourney || 'User journey mapping required')
      .replace('{{INTERFACE_DESIGN}}', parsedInfo.interfaceDesign || 'Interface specifications to be defined')
      .replace('{{DESIGN_SYSTEM}}', parsedInfo.designSystem || 'Design system components in progress')
      .replace('{{ACCESSIBILITY_USABILITY}}', parsedInfo.accessibilityUsability || 'Accessibility guidelines need definition')
      .replace('{{IMPLEMENTATION_NOTES}}', parsedInfo.implementationNotes || 'Implementation details pending')
      .replace('{{GENERATION_DATE}}', generationDate);

    logger.info(`Design Specification generated successfully for ${finalProjectName}`);
    return designSpec;

  } catch (error) {
    logger.error('Error generating Design Specification:', error);
    throw new Error(`Failed to generate Design Specification: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}