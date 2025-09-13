import { ConversationState } from '@/types';
import { claudeClient } from '@/claude/client';
import { logger } from '@/utils/logger';

const PRD_TEMPLATE = `
# Product Requirements Document: {{PROJECT_NAME}}

## Executive Summary
{{EXECUTIVE_SUMMARY}}

## 1. Product Vision
{{PRODUCT_VISION}}

## 2. User Personas
{{USER_PERSONAS}}

## 3. Business Requirements
{{BUSINESS_REQUIREMENTS}}

## 4. Feature Map
{{FEATURE_MAP}}

## 5. Success Criteria
{{SUCCESS_CRITERIA}}

## Implementation Notes
{{IMPLEMENTATION_NOTES}}

---
*Document generated from conversation on {{GENERATION_DATE}}*
`;

const EXTRACTION_PROMPT = `Based on the following conversation between a user and an AI Product Manager, extract and organize the information into the specified PRD sections. 

CONVERSATION HISTORY:
{{CONVERSATION_CONTENT}}

Please extract and format the information for each section. If a section wasn't fully discussed, note what information is missing. Format your response as a JSON object with these keys:
- executiveSummary
- productVision 
- userPersonas
- businessRequirements
- featureMap
- successCriteria
- implementationNotes

Focus on concrete, actionable information that was discussed during the conversation.`;

export async function generatePRD(conversation: ConversationState, projectName?: string): Promise<string> {
  try {
    logger.info(`Generating PRD for conversation ${conversation.id}`);
    
    // Format conversation content
    const conversationContent = conversation.messages
      .map(msg => `**${msg.role.toUpperCase()}**: ${msg.content}`)
      .join('\n\n');

    // Extract structured information using Claude
    const extractionPrompt = EXTRACTION_PROMPT.replace('{{CONVERSATION_CONTENT}}', conversationContent);
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
      logger.warn('Failed to parse extracted information as JSON, using raw response');
      parsedInfo = {
        executiveSummary: 'Information extraction in progress',
        productVision: extractedInfo,
        userPersonas: 'See conversation details above',
        businessRequirements: 'To be refined based on discussion',
        featureMap: 'Feature prioritization pending',
        successCriteria: 'Metrics to be defined',
        implementationNotes: 'Technical specifications needed'
      };
    }

    // Generate the final PRD
    const finalProjectName = projectName || 'Unnamed Project';
    const generationDate = new Date().toLocaleString();

    let prd = PRD_TEMPLATE
      .replace('{{PROJECT_NAME}}', finalProjectName)
      .replace('{{EXECUTIVE_SUMMARY}}', parsedInfo.executiveSummary || 'Executive summary to be completed')
      .replace('{{PRODUCT_VISION}}', parsedInfo.productVision || 'Product vision needs further definition')
      .replace('{{USER_PERSONAS}}', parsedInfo.userPersonas || 'User personas require additional research')
      .replace('{{BUSINESS_REQUIREMENTS}}', parsedInfo.businessRequirements || 'Business requirements to be specified')
      .replace('{{FEATURE_MAP}}', parsedInfo.featureMap || 'Feature mapping in progress')
      .replace('{{SUCCESS_CRITERIA}}', parsedInfo.successCriteria || 'Success metrics need definition')
      .replace('{{IMPLEMENTATION_NOTES}}', parsedInfo.implementationNotes || 'Implementation details pending')
      .replace('{{GENERATION_DATE}}', generationDate);

    logger.info(`PRD generated successfully for ${finalProjectName}`);
    return prd;

  } catch (error) {
    logger.error('Error generating PRD:', error);
    throw new Error(`Failed to generate PRD: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}