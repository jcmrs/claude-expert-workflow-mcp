import { WorkflowSession, ExpertOutput, ExpertType } from '@/types/workflow';
import { ConversationState } from '@/types';
import { conversationManager } from '@/state/conversationManager';
import { crossReferenceManager, CrossReference, CrossReferenceAnnotation } from './crossReferenceManager';
import { claudeClient } from '@/claude/client';
import { logger } from '@/utils/logger';
import { generatePRD } from '@/templates/prd';
import { generateDesignSpec } from '@/templates/designSpec';
import { generateTechArchitecture } from '@/templates/techArchitecture';

/**
 * Configuration for integrated document generation
 */
export interface IntegratedDocumentOptions {
  includeCrossReferences: boolean;
  includeExecutiveSummary: boolean;
  includeDetailedSections: boolean;
  annotationStyle: 'inline' | 'footnote' | 'sidebar';
  synthesisDepth: 'brief' | 'detailed' | 'comprehensive';
}

/**
 * Integrated project document structure
 */
export interface IntegratedProjectDocument {
  projectName: string;
  executiveSummary: string;
  crossReferenceSummary: string;
  productSection: string;
  designSection: string;
  technicalSection: string;
  integratedRecommendations: string;
  implementationRoadmap: string;
  riskAssessment: string;
  generatedAt: Date;
  workflowId: string;
  crossReferences: CrossReference[];
}

/**
 * Expert document synthesis for integration
 */
interface ExpertDocumentSynthesis {
  expertType: ExpertType;
  keyInsights: string[];
  criticalDecisions: string[];
  dependencies: string[];
  recommendations: string[];
  risks: string[];
}

/**
 * Master document generator that combines all expert outputs with cross-references
 */
export class IntegratedDocumentGenerator {
  private readonly INTEGRATED_DOCUMENT_TEMPLATE = `
# {{PROJECT_NAME}}: Integrated Project Analysis

## Executive Summary
{{EXECUTIVE_SUMMARY}}

## Cross-Reference Analysis
{{CROSS_REFERENCE_SUMMARY}}

## Product Management Analysis
{{PRODUCT_SECTION}}

## UX Design Analysis  
{{DESIGN_SECTION}}

## Technical Architecture Analysis
{{TECHNICAL_SECTION}}

## Integrated Recommendations
{{INTEGRATED_RECOMMENDATIONS}}

## Implementation Roadmap
{{IMPLEMENTATION_ROADMAP}}

## Risk Assessment & Mitigation
{{RISK_ASSESSMENT}}

---
*Integrated document generated from multi-expert workflow on {{GENERATION_DATE}}*
*Workflow ID: {{WORKFLOW_ID}}*
*Cross-references: {{CROSS_REFERENCE_COUNT}}*
`;

  /**
   * Generate integrated project document combining all expert outputs
   */
  async generateIntegratedProjectDocument(
    workflowSession: WorkflowSession,
    options: Partial<IntegratedDocumentOptions> = {}
  ): Promise<IntegratedProjectDocument> {
    try {
      logger.info(`Generating integrated document for workflow ${workflowSession.id}`);

      const defaultOptions: IntegratedDocumentOptions = {
        includeCrossReferences: true,
        includeExecutiveSummary: true,
        includeDetailedSections: true,
        annotationStyle: 'inline',
        synthesisDepth: 'detailed'
      };

      const finalOptions = { ...defaultOptions, ...options };

      // Validate workflow is complete
      if (workflowSession.state !== 'completed') {
        throw new Error(`Workflow ${workflowSession.id} is not completed (state: ${workflowSession.state})`);
      }

      if (workflowSession.outputs.length === 0) {
        throw new Error(`No expert outputs found for workflow ${workflowSession.id}`);
      }

      // Generate cross-references if requested
      let crossReferences: CrossReference[] = [];
      if (finalOptions.includeCrossReferences) {
        crossReferences = await crossReferenceManager.generateCrossReferences(
          workflowSession.id,
          workflowSession.outputs
        );
      }

      // Generate individual expert documents
      const expertDocuments = await this._generateExpertDocuments(workflowSession.outputs);

      // Create expert synthesis
      const expertSyntheses = await this._synthesizeExpertOutputs(workflowSession.outputs);

      // Generate integrated sections
      const executiveSummary = await this._generateExecutiveSummary(
        workflowSession,
        expertSyntheses,
        crossReferences
      );

      const crossReferenceSummary = this._generateCrossReferenceSummary(crossReferences);

      const integratedRecommendations = await this._generateIntegratedRecommendations(
        expertSyntheses,
        crossReferences
      );

      const implementationRoadmap = await this._generateImplementationRoadmap(
        expertSyntheses,
        crossReferences
      );

      const riskAssessment = await this._generateRiskAssessment(
        expertSyntheses,
        crossReferences
      );

      // Apply cross-reference annotations to sections
      let productSection = expertDocuments.product || 'Product analysis not available';
      let designSection = expertDocuments.design || 'Design analysis not available';  
      let technicalSection = expertDocuments.technical || 'Technical analysis not available';

      if (finalOptions.includeCrossReferences) {
        productSection = this._applyCrossReferenceAnnotations(
          productSection, 'product_manager', workflowSession.id
        );
        designSection = this._applyCrossReferenceAnnotations(
          designSection, 'ux_designer', workflowSession.id
        );
        technicalSection = this._applyCrossReferenceAnnotations(
          technicalSection, 'software_architect', workflowSession.id
        );
      }

      // Create integrated document
      const integratedDocument: IntegratedProjectDocument = {
        projectName: this._extractProjectName(workflowSession.projectDescription),
        executiveSummary,
        crossReferenceSummary,
        productSection,
        designSection,
        technicalSection,
        integratedRecommendations,
        implementationRoadmap,
        riskAssessment,
        generatedAt: new Date(),
        workflowId: workflowSession.id,
        crossReferences
      };

      logger.info(`Generated integrated document with ${crossReferences.length} cross-references`);
      return integratedDocument;

    } catch (error) {
      logger.error(`Error generating integrated document for workflow ${workflowSession.id}:`, error);
      throw error;
    }
  }

  /**
   * Render integrated document as formatted string
   */
  renderIntegratedDocument(document: IntegratedProjectDocument): string {
    return this.INTEGRATED_DOCUMENT_TEMPLATE
      .replace('{{PROJECT_NAME}}', document.projectName)
      .replace('{{EXECUTIVE_SUMMARY}}', document.executiveSummary)
      .replace('{{CROSS_REFERENCE_SUMMARY}}', document.crossReferenceSummary)
      .replace('{{PRODUCT_SECTION}}', document.productSection)
      .replace('{{DESIGN_SECTION}}', document.designSection)
      .replace('{{TECHNICAL_SECTION}}', document.technicalSection)
      .replace('{{INTEGRATED_RECOMMENDATIONS}}', document.integratedRecommendations)
      .replace('{{IMPLEMENTATION_ROADMAP}}', document.implementationRoadmap)
      .replace('{{RISK_ASSESSMENT}}', document.riskAssessment)
      .replace('{{GENERATION_DATE}}', document.generatedAt.toLocaleString())
      .replace('{{WORKFLOW_ID}}', document.workflowId)
      .replace('{{CROSS_REFERENCE_COUNT}}', document.crossReferences.length.toString());
  }

  /**
   * Generate master document with cross-reference annotations
   */
  async generateMasterDocument(
    workflowSession: WorkflowSession,
    options: Partial<IntegratedDocumentOptions> = {}
  ): Promise<string> {
    const integratedDocument = await this.generateIntegratedProjectDocument(
      workflowSession,
      options
    );

    return this.renderIntegratedDocument(integratedDocument);
  }

  // Private helper methods

  /**
   * Generate individual expert documents
   */
  private async _generateExpertDocuments(
    outputs: ExpertOutput[]
  ): Promise<Record<string, string>> {
    const documents: Record<string, string> = {};

    for (const output of outputs) {
      try {
        const conversation = conversationManager.getConversation(output.conversationId);
        if (!conversation) {
          logger.warn(`Conversation ${output.conversationId} not found for ${output.expertType}`);
          continue;
        }

        switch (output.expertType) {
          case 'product_manager':
            documents.product = await generatePRD(conversation);
            break;
          case 'ux_designer':
            documents.design = await generateDesignSpec(conversation);
            break;
          case 'software_architect':
            documents.technical = await generateTechArchitecture(conversation);
            break;
        }
      } catch (error) {
        logger.error(`Error generating document for ${output.expertType}:`, error);
      }
    }

    return documents;
  }

  /**
   * Synthesize expert outputs into key insights
   */
  private async _synthesizeExpertOutputs(
    outputs: ExpertOutput[]
  ): Promise<ExpertDocumentSynthesis[]> {
    const syntheses: ExpertDocumentSynthesis[] = [];

    for (const output of outputs) {
      try {
        const synthesis = await this._synthesizeSingleExpertOutput(output);
        syntheses.push(synthesis);
      } catch (error) {
        logger.error(`Error synthesizing output for ${output.expertType}:`, error);
      }
    }

    return syntheses;
  }

  /**
   * Synthesize single expert output
   */
  private async _synthesizeSingleExpertOutput(
    output: ExpertOutput
  ): Promise<ExpertDocumentSynthesis> {
    const synthesisPrompt = `Analyze the following expert output and extract key information for integration:

EXPERT: ${output.expertType.toUpperCase().replace('_', ' ')}
OUTPUT:
${output.output}

Extract and categorize the following:
1. Key Insights: Main discoveries, observations, or conclusions
2. Critical Decisions: Important choices or recommendations made
3. Dependencies: What this expert's work depends on from other experts
4. Recommendations: Actionable recommendations for the project
5. Risks: Potential risks or challenges identified

Format as JSON with fields: keyInsights, criticalDecisions, dependencies, recommendations, risks (all arrays of strings).`;

    const synthesis = await claudeClient.chat([
      {
        role: 'user',
        content: synthesisPrompt
      }
    ]);

    try {
      const parsed = JSON.parse(synthesis);
      return {
        expertType: output.expertType,
        keyInsights: parsed.keyInsights || [],
        criticalDecisions: parsed.criticalDecisions || [],
        dependencies: parsed.dependencies || [],
        recommendations: parsed.recommendations || [],
        risks: parsed.risks || []
      };
    } catch (error) {
      logger.warn(`Failed to parse synthesis for ${output.expertType}, using defaults`);
      return {
        expertType: output.expertType,
        keyInsights: ['Analysis pending'],
        criticalDecisions: ['Decisions pending'],
        dependencies: ['Dependencies to be identified'],
        recommendations: ['Recommendations pending'],
        risks: ['Risk assessment pending']
      };
    }
  }

  /**
   * Generate executive summary
   */
  private async _generateExecutiveSummary(
    workflowSession: WorkflowSession,
    syntheses: ExpertDocumentSynthesis[],
    crossReferences: CrossReference[]
  ): Promise<string> {
    const summaryPrompt = `Generate an executive summary for the following project analysis:

PROJECT: ${workflowSession.projectDescription}

EXPERT ANALYSES:
${syntheses.map(s => `
${s.expertType.toUpperCase().replace('_', ' ')}:
- Key Insights: ${s.keyInsights.join(', ')}
- Critical Decisions: ${s.criticalDecisions.join(', ')}
- Recommendations: ${s.recommendations.join(', ')}
- Risks: ${s.risks.join(', ')}
`).join('\n')}

CROSS-REFERENCES: ${crossReferences.length} relationships identified between expert analyses

Create a compelling executive summary (2-3 paragraphs) that:
1. Summarizes the project scope and objectives
2. Highlights key findings and recommendations from all experts
3. Notes important cross-expert relationships and dependencies
4. Identifies critical success factors and risks
5. Provides clear next steps for implementation`;

    return await claudeClient.chat([
      {
        role: 'user',
        content: summaryPrompt
      }
    ]);
  }

  /**
   * Generate cross-reference summary
   */
  private _generateCrossReferenceSummary(crossReferences: CrossReference[]): string {
    if (crossReferences.length === 0) {
      return 'No cross-references identified between expert analyses.';
    }

    const relationshipCounts = new Map<string, number>();
    const expertConnections = new Map<string, Set<string>>();

    for (const ref of crossReferences) {
      // Count relationship types
      const count = relationshipCounts.get(ref.relationship) || 0;
      relationshipCounts.set(ref.relationship, count + 1);

      // Track expert connections
      const key = `${ref.sourceExpert}_${ref.targetExpert}`;
      if (!expertConnections.has(key)) {
        expertConnections.set(key, new Set());
      }
      expertConnections.get(key)!.add(ref.relationship);
    }

    const relationshipSummary = Array.from(relationshipCounts.entries())
      .map(([type, count]) => `${count} ${type.replace('_', ' ')} relationships`)
      .join(', ');

    const connectionSummary = Array.from(expertConnections.entries())
      .map(([connection, types]) => {
        const [source, target] = connection.split('_');
        return `${source.replace('_', ' ')} ↔ ${target.replace('_', ' ')}: ${Array.from(types).join(', ')}`;
      })
      .join('\n- ');

    return `**Cross-Reference Analysis**: ${crossReferences.length} relationships identified between expert analyses.

**Relationship Types**: ${relationshipSummary}

**Expert Connections**:
- ${connectionSummary}

These cross-references highlight how the expert analyses complement and build upon each other to form a cohesive project strategy.`;
  }

  /**
   * Generate integrated recommendations
   */
  private async _generateIntegratedRecommendations(
    syntheses: ExpertDocumentSynthesis[],
    crossReferences: CrossReference[]
  ): Promise<string> {
    const recommendationsPrompt = `Based on the following expert analyses and their cross-references, generate integrated project recommendations:

EXPERT RECOMMENDATIONS:
${syntheses.map(s => `
${s.expertType.toUpperCase().replace('_', ' ')}:
${s.recommendations.join('\n')}
`).join('\n')}

CROSS-REFERENCE RELATIONSHIPS:
${crossReferences.map(r => `- ${r.sourceExpert} → ${r.targetExpert}: ${r.relationship} (${r.description})`).join('\n')}

Generate integrated recommendations that:
1. Synthesize recommendations from all experts
2. Account for cross-expert dependencies and relationships  
3. Prioritize recommendations by impact and feasibility
4. Address conflicts or contradictions between expert views
5. Provide actionable next steps

Format as numbered list with priority levels (Critical, High, Medium, Low).`;

    return await claudeClient.chat([
      {
        role: 'user',
        content: recommendationsPrompt
      }
    ]);
  }

  /**
   * Generate implementation roadmap
   */
  private async _generateImplementationRoadmap(
    syntheses: ExpertDocumentSynthesis[],
    crossReferences: CrossReference[]
  ): Promise<string> {
    const roadmapPrompt = `Create an implementation roadmap based on expert analyses and cross-references:

EXPERT INSIGHTS:
${syntheses.map(s => `
${s.expertType.toUpperCase().replace('_', ' ')}:
- Dependencies: ${s.dependencies.join(', ')}
- Critical Decisions: ${s.criticalDecisions.join(', ')}
`).join('\n')}

DEPENDENCIES FROM CROSS-REFERENCES:
${crossReferences.filter(r => r.relationship === 'depends_on').map(r => 
  `- ${r.targetExpert} depends on ${r.sourceExpert}: ${r.description}`
).join('\n')}

Create a phased implementation roadmap with:
1. Phase definitions (Discovery, Planning, Development, Launch)
2. Dependencies between phases and expert deliverables
3. Timeline estimates and milestones
4. Resource requirements by phase
5. Risk mitigation strategies for each phase

Format as structured roadmap with phases, timelines, and deliverables.`;

    return await claudeClient.chat([
      {
        role: 'user',
        content: roadmapPrompt
      }
    ]);
  }

  /**
   * Generate risk assessment
   */
  private async _generateRiskAssessment(
    syntheses: ExpertDocumentSynthesis[],
    crossReferences: CrossReference[]
  ): Promise<string> {
    const riskPrompt = `Generate comprehensive risk assessment from expert analyses:

IDENTIFIED RISKS BY EXPERT:
${syntheses.map(s => `
${s.expertType.toUpperCase().replace('_', ' ')} RISKS:
${s.risks.join('\n')}
`).join('\n')}

CONFLICT RELATIONSHIPS:
${crossReferences.filter(r => r.relationship === 'conflicts').map(r => 
  `- CONFLICT: ${r.sourceExpert} vs ${r.targetExpert}: ${r.description}`
).join('\n')}

Create risk assessment covering:
1. Technical risks (architecture, scalability, security)
2. Product risks (market fit, user adoption, competition)  
3. Design risks (usability, accessibility, consistency)
4. Cross-functional risks (integration, communication, dependencies)
5. Mitigation strategies for each risk category

Format with risk level (Critical/High/Medium/Low), impact, likelihood, and mitigation approach.`;

    return await claudeClient.chat([
      {
        role: 'user',
        content: riskPrompt
      }
    ]);
  }

  /**
   * Apply cross-reference annotations to expert document sections
   */
  private _applyCrossReferenceAnnotations(
    content: string,
    expertType: ExpertType,
    workflowId: string
  ): string {
    const annotations = crossReferenceManager.generateCrossReferenceAnnotations(
      workflowId,
      expertType,
      content
    );

    return crossReferenceManager.injectCrossReferences(content, annotations);
  }

  /**
   * Extract project name from description
   */
  private _extractProjectName(description: string): string {
    // Simple extraction - take first sentence or first 50 characters
    const firstSentence = description.split('.')[0];
    if (firstSentence.length <= 50) {
      return firstSentence.trim();
    }
    
    return description.substring(0, 47).trim() + '...';
  }
}

export const integratedDocumentGenerator = new IntegratedDocumentGenerator();