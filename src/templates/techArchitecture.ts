import { ConversationState } from '@/types';
import { claudeClient } from '@/claude/client';
import { logger } from '@/utils/logger';

const TECH_ARCHITECTURE_TEMPLATE = `
# Technical Architecture Document: {{PROJECT_NAME}}

## Executive Summary
{{EXECUTIVE_SUMMARY}}

## 1. Technical Architecture
{{TECHNICAL_ARCHITECTURE}}

## 2. System Design
{{SYSTEM_DESIGN}}

## 3. Technical Specifications
{{TECHNICAL_SPECIFICATIONS}}

## 4. Security Architecture
{{SECURITY_ARCHITECTURE}}

## 5. Implementation Strategy
{{IMPLEMENTATION_STRATEGY}}

## Technical Notes
{{TECHNICAL_NOTES}}

---
*Document generated from conversation on {{GENERATION_DATE}}*
`;

export async function generateTechArchitecture(
  conversation: ConversationState,
  projectName?: string
): Promise<string> {
  try {
    logger.info(`Generating Technical Architecture Document for conversation ${conversation.id}`);

    // Extract conversation content
    const conversationText = conversation.messages
      .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
      .join('\n\n');

    // Generate document content using Claude
    const prompt = `Based on the following conversation with a Software Architect expert, generate a comprehensive Technical Architecture Document.

Conversation:
${conversationText}

Please extract and organize the information into these sections:
- Executive Summary: Brief overview of the technical solution and key architectural decisions
- Technical Architecture: System design, tech stack decisions, and architectural patterns discussed
- System Design: Scalability, performance, infrastructure, and deployment architecture details
- Technical Specifications: APIs, data models, integration patterns, and service contracts
- Security Architecture: Authentication, authorization, data protection, and compliance measures
- Implementation Strategy: Development phases, deployment strategy, testing approach, and rollout plan

Format each section clearly with detailed technical specifications. If any section wasn't fully discussed, note what additional information is needed.`;

    const generatedContent = await claudeClient.chat([
      {
        role: 'user',
        content: prompt
      }
    ]);

    // Parse the generated content into sections
    const sections = parseGeneratedContent(generatedContent);

    // Fill template
    let document = TECH_ARCHITECTURE_TEMPLATE
      .replace('{{PROJECT_NAME}}', projectName || 'Untitled Project')
      .replace('{{EXECUTIVE_SUMMARY}}', sections.executiveSummary || 'To be determined')
      .replace('{{TECHNICAL_ARCHITECTURE}}', sections.technicalArchitecture || 'To be determined')
      .replace('{{SYSTEM_DESIGN}}', sections.systemDesign || 'To be determined')
      .replace('{{TECHNICAL_SPECIFICATIONS}}', sections.technicalSpecifications || 'To be determined')
      .replace('{{SECURITY_ARCHITECTURE}}', sections.securityArchitecture || 'To be determined')
      .replace('{{IMPLEMENTATION_STRATEGY}}', sections.implementationStrategy || 'To be determined')
      .replace('{{TECHNICAL_NOTES}}', sections.technicalNotes || 'Additional technical considerations to be defined')
      .replace('{{GENERATION_DATE}}', new Date().toLocaleDateString());

    logger.info('Technical Architecture Document generated successfully');
    return document;

  } catch (error) {
    logger.error('Error generating Technical Architecture Document:', error);
    throw new Error(`Failed to generate Technical Architecture Document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function parseGeneratedContent(content: string) {
  // Simple parsing logic - in a real implementation, this could be more sophisticated
  const sections: Record<string, string> = {};
  
  const sectionRegexes = {
    executiveSummary: /(?:executive summary|summary)[:\-\s]*(.*?)(?=\n\n|\n(?:[0-9]+\.|##|technical architecture|system design))/gis,
    technicalArchitecture: /(?:technical architecture|architecture)[:\-\s]*(.*?)(?=\n\n|\n(?:[0-9]+\.|##|system design|technical specifications))/gis,
    systemDesign: /(?:system design|design)[:\-\s]*(.*?)(?=\n\n|\n(?:[0-9]+\.|##|technical specifications|security architecture))/gis,
    technicalSpecifications: /(?:technical specifications|specifications)[:\-\s]*(.*?)(?=\n\n|\n(?:[0-9]+\.|##|security architecture|implementation strategy))/gis,
    securityArchitecture: /(?:security architecture|security)[:\-\s]*(.*?)(?=\n\n|\n(?:[0-9]+\.|##|implementation strategy|technical notes))/gis,
    implementationStrategy: /(?:implementation strategy|implementation)[:\-\s]*(.*?)(?=\n\n|\n(?:[0-9]+\.|##|technical notes))/gis,
    technicalNotes: /(?:technical notes|notes)[:\-\s]*(.*?)$/gis
  };

  for (const [key, regex] of Object.entries(sectionRegexes)) {
    const match = regex.exec(content);
    if (match && match[1]) {
      sections[key] = match[1].trim();
    }
  }

  return sections;
}
