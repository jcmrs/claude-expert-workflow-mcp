import { ExpertType, ExpertOutput } from '@/types/workflow';
import { logger } from '@/utils/logger';

/**
 * Context manager for sharing information between experts in the workflow
 */

export interface ExpertContext {
  projectDescription: string;
  previousOutputs: ExpertOutput[];
  expertType: ExpertType;
}

/**
 * Build context for an expert based on previous expert outputs
 */
export function buildExpertContext(
  expertType: ExpertType,
  previousOutputs: ExpertOutput[],
  projectDescription: string
): ExpertContext {
  logger.debug(`Building context for ${expertType} with ${previousOutputs.length} previous outputs`);

  return {
    projectDescription,
    previousOutputs,
    expertType
  };
}

/**
 * Format context appropriately for each expert type
 */
export function formatContextForExpert(
  expertType: ExpertType,
  previousOutputs: ExpertOutput[],
  projectDescription: string
): string {
  if (previousOutputs.length === 0) {
    return `PROJECT: ${projectDescription}`;
  }

  let contextSections: string[] = [];
  
  // Add project description
  contextSections.push(`PROJECT DESCRIPTION:\n${projectDescription}\n`);

  // Format context based on current expert type
  switch (expertType) {
    case 'ux_designer':
      contextSections.push(formatContextForUXDesigner(previousOutputs));
      break;
    case 'software_architect':
      contextSections.push(formatContextForSoftwareArchitect(previousOutputs));
      break;
    case 'product_manager':
      // Product manager is typically first, but may need context in custom workflows
      contextSections.push(formatContextForProductManager(previousOutputs));
      break;
    default:
      contextSections.push(formatGenericContext(previousOutputs));
  }

  return contextSections.join('\n\n');
}

/**
 * Format context specifically for UX Designer
 * UX Designer needs product requirements, user personas, and business context
 */
function formatContextForUXDesigner(previousOutputs: ExpertOutput[]): string {
  const sections: string[] = [];

  // Look for Product Manager output
  const pmOutput = previousOutputs.find(output => output.expertType === 'product_manager');
  if (pmOutput) {
    sections.push(`PRODUCT REQUIREMENTS (from Product Manager):\n${pmOutput.output}`);
    
    // Extract key topics that are relevant to UX Design
    const relevantTopics = extractRelevantTopicsForUX(pmOutput);
    if (relevantTopics) {
      sections.push(`KEY PRODUCT INSIGHTS:\n${relevantTopics}`);
    }
  }

  // Add any other previous outputs
  const otherOutputs = previousOutputs.filter(output => output.expertType !== 'product_manager');
  if (otherOutputs.length > 0) {
    sections.push(formatGenericContext(otherOutputs));
  }

  return sections.join('\n\n');
}

/**
 * Format context specifically for Software Architect
 * Software Architect needs product requirements AND design specifications
 */
function formatContextForSoftwareArchitect(previousOutputs: ExpertOutput[]): string {
  const sections: string[] = [];

  // Look for Product Manager output
  const pmOutput = previousOutputs.find(output => output.expertType === 'product_manager');
  if (pmOutput) {
    sections.push(`PRODUCT REQUIREMENTS (from Product Manager):\n${pmOutput.output}`);
    
    // Extract technical requirements and constraints
    const technicalRequirements = extractTechnicalRequirements(pmOutput);
    if (technicalRequirements) {
      sections.push(`TECHNICAL REQUIREMENTS:\n${technicalRequirements}`);
    }
  }

  // Look for UX Designer output
  const uxOutput = previousOutputs.find(output => output.expertType === 'ux_designer');
  if (uxOutput) {
    sections.push(`DESIGN SPECIFICATIONS (from UX Designer):\n${uxOutput.output}`);
    
    // Extract technical implications from design
    const designImplications = extractDesignImplications(uxOutput);
    if (designImplications) {
      sections.push(`DESIGN TECHNICAL IMPLICATIONS:\n${designImplications}`);
    }
  }

  // Add any other previous outputs
  const otherOutputs = previousOutputs.filter(
    output => output.expertType !== 'product_manager' && output.expertType !== 'ux_designer'
  );
  if (otherOutputs.length > 0) {
    sections.push(formatGenericContext(otherOutputs));
  }

  return sections.join('\n\n');
}

/**
 * Format context for Product Manager (in case of custom workflows)
 */
function formatContextForProductManager(previousOutputs: ExpertOutput[]): string {
  return formatGenericContext(previousOutputs);
}

/**
 * Generic context formatting for any expert
 */
function formatGenericContext(outputs: ExpertOutput[]): string {
  if (outputs.length === 0) {
    return '';
  }

  const sections = outputs.map(output => {
    const expertTitle = getExpertTitle(output.expertType);
    return `${expertTitle} OUTPUT:\n${output.output}`;
  });

  return sections.join('\n\n');
}

/**
 * Extract UX-relevant topics from Product Manager output
 */
function extractRelevantTopicsForUX(pmOutput: ExpertOutput): string | null {
  const output = pmOutput.output.toLowerCase();
  const relevantSections: string[] = [];

  // Look for user personas, user stories, or user needs
  if (output.includes('user persona') || output.includes('target user') || output.includes('user need')) {
    relevantSections.push('- Focus on user personas and target user needs mentioned in product requirements');
  }

  // Look for feature priorities
  if (output.includes('priority') || output.includes('mvp') || output.includes('core feature')) {
    relevantSections.push('- Pay attention to feature priorities and MVP requirements');
  }

  // Look for user experience mentions
  if (output.includes('user experience') || output.includes('user journey') || output.includes('interaction')) {
    relevantSections.push('- Consider user experience goals and interaction patterns');
  }

  // Look for platform or device constraints
  if (output.includes('mobile') || output.includes('desktop') || output.includes('platform')) {
    relevantSections.push('- Consider platform-specific design requirements');
  }

  return relevantSections.length > 0 ? relevantSections.join('\n') : null;
}

/**
 * Extract technical requirements from Product Manager output
 */
function extractTechnicalRequirements(pmOutput: ExpertOutput): string | null {
  const output = pmOutput.output.toLowerCase();
  const technicalSections: string[] = [];

  // Look for performance requirements
  if (output.includes('performance') || output.includes('scalability') || output.includes('speed')) {
    technicalSections.push('- Consider performance and scalability requirements');
  }

  // Look for integration requirements
  if (output.includes('integration') || output.includes('api') || output.includes('third-party')) {
    technicalSections.push('- Plan for integration and API requirements');
  }

  // Look for security requirements
  if (output.includes('security') || output.includes('privacy') || output.includes('compliance')) {
    technicalSections.push('- Address security and compliance requirements');
  }

  // Look for data requirements
  if (output.includes('data') || output.includes('storage') || output.includes('database')) {
    technicalSections.push('- Design data architecture and storage solutions');
  }

  // Look for user volume or scale indicators
  if (output.includes('user') && (output.includes('thousand') || output.includes('million') || output.includes('concurrent'))) {
    technicalSections.push('- Plan architecture for expected user scale and concurrency');
  }

  return technicalSections.length > 0 ? technicalSections.join('\n') : null;
}

/**
 * Extract technical implications from UX Design output
 */
function extractDesignImplications(uxOutput: ExpertOutput): string | null {
  const output = uxOutput.output.toLowerCase();
  const implications: string[] = [];

  // Look for interactive elements
  if (output.includes('real-time') || output.includes('live update') || output.includes('notification')) {
    implications.push('- Implement real-time capabilities for interactive features');
  }

  // Look for responsive design requirements
  if (output.includes('responsive') || output.includes('mobile') || output.includes('tablet')) {
    implications.push('- Ensure responsive design architecture and API flexibility');
  }

  // Look for complex UI patterns
  if (output.includes('dashboard') || output.includes('drag and drop') || output.includes('complex interaction')) {
    implications.push('- Plan for complex UI state management and interaction handling');
  }

  // Look for media handling
  if (output.includes('image') || output.includes('video') || output.includes('file upload')) {
    implications.push('- Design media handling, storage, and processing capabilities');
  }

  // Look for offline capabilities
  if (output.includes('offline') || output.includes('sync') || output.includes('local storage')) {
    implications.push('- Implement offline capabilities and data synchronization');
  }

  return implications.length > 0 ? implications.join('\n') : null;
}

/**
 * Get human-readable expert title
 */
function getExpertTitle(expertType: ExpertType): string {
  switch (expertType) {
    case 'product_manager':
      return 'PRODUCT MANAGER';
    case 'ux_designer':
      return 'UX DESIGNER';
    case 'software_architect':
      return 'SOFTWARE ARCHITECT';
    default:
      return (expertType as string).toUpperCase().replace('_', ' ');
  }
}

/**
 * Validate context completeness for an expert
 */
export function validateContextCompleteness(
  expertType: ExpertType,
  previousOutputs: ExpertOutput[]
): {
  isComplete: boolean;
  missingContext: string[];
} {
  const missingContext: string[] = [];

  switch (expertType) {
    case 'ux_designer':
      // UX Designer should ideally have Product Manager context
      if (!previousOutputs.some(output => output.expertType === 'product_manager')) {
        missingContext.push('Product Manager requirements and user insights');
      }
      break;

    case 'software_architect':
      // Software Architect should ideally have both PM and UX context
      if (!previousOutputs.some(output => output.expertType === 'product_manager')) {
        missingContext.push('Product Manager technical requirements');
      }
      if (!previousOutputs.some(output => output.expertType === 'ux_designer')) {
        missingContext.push('UX Designer interface specifications');
      }
      break;

    case 'product_manager':
      // Product Manager typically doesn't need previous context (usually first)
      break;
  }

  return {
    isComplete: missingContext.length === 0,
    missingContext
  };
}

/**
 * Extract conversation summary from expert output for context sharing
 */
export function extractConversationSummary(
  expertOutput: ExpertOutput,
  maxLength: number = 500
): string {
  const output = expertOutput.output;
  
  if (output.length <= maxLength) {
    return output;
  }

  // Try to extract key points or first paragraph
  const paragraphs = output.split('\n\n');
  let summary = '';
  
  for (const paragraph of paragraphs) {
    if (summary.length + paragraph.length <= maxLength) {
      summary += (summary ? '\n\n' : '') + paragraph;
    } else {
      break;
    }
  }

  if (!summary) {
    // Fallback: truncate at word boundary
    const truncated = output.substr(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    summary = lastSpace > 0 ? truncated.substr(0, lastSpace) + '...' : truncated + '...';
  }

  return summary;
}