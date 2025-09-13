import { ExpertOutput, ExpertType, WorkflowSession } from '@/types/workflow';
import { ConversationState } from '@/types';
import { conversationManager } from '@/state/conversationManager';
import { claudeClient } from '@/claude/client';
import { logger } from '@/utils/logger';

/**
 * Represents a cross-reference between expert documents
 */
export interface CrossReference {
  id: string;
  sourceExpert: ExpertType;
  targetExpert: ExpertType;
  sourceSection: string;
  targetSection: string;
  relationship: CrossReferenceType;
  description: string;
  confidence: number; // 0-1 score of reference relevance
}

/**
 * Types of cross-reference relationships between expert outputs
 */
export type CrossReferenceType = 
  | 'builds_on'      // Target builds on source concept
  | 'implements'     // Target implements source requirement
  | 'supports'       // Target supports source decision
  | 'conflicts'      // Target conflicts with source
  | 'elaborates'     // Target elaborates on source
  | 'depends_on';    // Target depends on source

/**
 * Document relationship mapping between expert outputs
 */
export interface DocumentRelationship {
  workflowId: string;
  relationships: Map<string, CrossReference[]>; // key: expertType_to_expertType
  lastUpdated: Date;
}

/**
 * Cross-reference annotation for injection into documents
 */
export interface CrossReferenceAnnotation {
  position: 'inline' | 'footnote' | 'sidebar';
  content: string;
  references: CrossReference[];
}

/**
 * Manages cross-references and document relationships in multi-expert workflows
 */
export class CrossReferenceManager {
  private documentRelationships: Map<string, DocumentRelationship> = new Map();

  /**
   * Analyze expert outputs and generate cross-references
   */
  async generateCrossReferences(
    workflowId: string,
    expertOutputs: ExpertOutput[]
  ): Promise<CrossReference[]> {
    try {
      logger.info(`Generating cross-references for workflow ${workflowId}`);

      if (expertOutputs.length < 2) {
        logger.debug('Need at least 2 expert outputs to generate cross-references');
        return [];
      }

      const allReferences: CrossReference[] = [];

      // Generate pairwise cross-references between all expert outputs
      for (let i = 0; i < expertOutputs.length; i++) {
        for (let j = i + 1; j < expertOutputs.length; j++) {
          const sourceOutput = expertOutputs[i];
          const targetOutput = expertOutputs[j];

          // Generate references in both directions
          const forwardRefs = await this._analyzeCrossReferences(
            sourceOutput, 
            targetOutput
          );
          const backwardRefs = await this._analyzeCrossReferences(
            targetOutput, 
            sourceOutput
          );

          allReferences.push(...forwardRefs, ...backwardRefs);
        }
      }

      // Store the relationships
      await this._storeDocumentRelationships(workflowId, allReferences);

      logger.info(`Generated ${allReferences.length} cross-references for workflow ${workflowId}`);
      return allReferences;

    } catch (error) {
      logger.error(`Error generating cross-references for workflow ${workflowId}:`, error);
      throw error;
    }
  }

  /**
   * Get cross-references for a specific workflow
   */
  getCrossReferences(workflowId: string): CrossReference[] {
    const relationships = this.documentRelationships.get(workflowId);
    if (!relationships) {
      return [];
    }

    const allReferences: CrossReference[] = [];
    for (const refs of relationships.relationships.values()) {
      allReferences.push(...refs);
    }

    return allReferences;
  }

  /**
   * Get cross-references between two specific experts
   */
  getCrossReferencesBetweenExperts(
    workflowId: string,
    expertA: ExpertType,
    expertB: ExpertType
  ): CrossReference[] {
    const relationships = this.documentRelationships.get(workflowId);
    if (!relationships) {
      return [];
    }

    const keyAB = `${expertA}_to_${expertB}`;
    const keyBA = `${expertB}_to_${expertA}`;

    const referencesAB = relationships.relationships.get(keyAB) || [];
    const referencesBA = relationships.relationships.get(keyBA) || [];

    return [...referencesAB, ...referencesBA];
  }

  /**
   * Generate cross-reference annotations for document injection
   */
  generateCrossReferenceAnnotations(
    workflowId: string,
    targetExpert: ExpertType,
    content: string
  ): CrossReferenceAnnotation[] {
    const allReferences = this.getCrossReferences(workflowId);
    const targetReferences = allReferences.filter(
      ref => ref.targetExpert === targetExpert || ref.sourceExpert === targetExpert
    );

    if (targetReferences.length === 0) {
      return [];
    }

    // Group references by section/topic
    const sectionReferences = this._groupReferencesBySection(
      targetReferences, 
      content
    );

    const annotations: CrossReferenceAnnotation[] = [];

    for (const [section, references] of sectionReferences) {
      if (references.length === 0) continue;

      const annotation: CrossReferenceAnnotation = {
        position: 'inline',
        content: this._formatReferenceAnnotation(references),
        references: references
      };

      annotations.push(annotation);
    }

    return annotations;
  }

  /**
   * Inject cross-reference annotations into document content
   */
  injectCrossReferences(
    content: string,
    annotations: CrossReferenceAnnotation[]
  ): string {
    let annotatedContent = content;

    for (const annotation of annotations) {
      // Find appropriate insertion points based on section headers
      const sectionMatches = this._findSectionInsertionPoints(
        annotatedContent,
        annotation.references
      );

      for (const match of sectionMatches) {
        if (match.index !== undefined) {
          const insertionPoint = match.index + match.length;
          const annotationText = `\n\n*${annotation.content}*\n`;
          
          annotatedContent = 
            annotatedContent.slice(0, insertionPoint) +
            annotationText +
            annotatedContent.slice(insertionPoint);
        }
      }
    }

    return annotatedContent;
  }

  /**
   * Validate cross-reference accuracy
   */
  async validateCrossReferences(
    workflowId: string
  ): Promise<{ valid: CrossReference[], invalid: CrossReference[] }> {
    const references = this.getCrossReferences(workflowId);
    const valid: CrossReference[] = [];
    const invalid: CrossReference[] = [];

    for (const ref of references) {
      const isValid = await this._validateSingleReference(ref);
      if (isValid) {
        valid.push(ref);
      } else {
        invalid.push(ref);
      }
    }

    logger.info(`Validation complete: ${valid.length} valid, ${invalid.length} invalid references`);
    return { valid, invalid };
  }

  // Private helper methods

  /**
   * Analyze cross-references between two expert outputs
   */
  private async _analyzeCrossReferences(
    sourceOutput: ExpertOutput,
    targetOutput: ExpertOutput
  ): Promise<CrossReference[]> {
    try {
      const analysisPrompt = this._buildCrossReferenceAnalysisPrompt(
        sourceOutput,
        targetOutput
      );

      const analysis = await claudeClient.chat([
        {
          role: 'user',
          content: analysisPrompt
        }
      ]);

      return this._parseCrossReferenceAnalysis(
        analysis,
        sourceOutput.expertType,
        targetOutput.expertType
      );

    } catch (error) {
      logger.error('Error analyzing cross-references:', error);
      return [];
    }
  }

  /**
   * Build prompt for cross-reference analysis
   */
  private _buildCrossReferenceAnalysisPrompt(
    sourceOutput: ExpertOutput,
    targetOutput: ExpertOutput
  ): string {
    return `Analyze the following expert outputs and identify cross-references, relationships, and connections between them.

SOURCE EXPERT (${sourceOutput.expertType.toUpperCase()}):
${sourceOutput.output}

TARGET EXPERT (${targetOutput.expertType.toUpperCase()}):
${targetOutput.output}

Identify specific relationships where the target expert's work:
- Builds on concepts from the source expert
- Implements requirements specified by the source expert
- Supports or conflicts with source expert decisions
- Elaborates on source expert points
- Depends on source expert deliverables

For each relationship found, provide:
1. Source section/concept (be specific)
2. Target section/concept (be specific)
3. Relationship type (builds_on, implements, supports, conflicts, elaborates, depends_on)
4. Description of the relationship
5. Confidence score (0.0-1.0)

Format as JSON array of objects with fields: sourceSection, targetSection, relationship, description, confidence.
Only include relationships with confidence >= 0.6.`;
  }

  /**
   * Parse cross-reference analysis response
   */
  private _parseCrossReferenceAnalysis(
    analysis: string,
    sourceExpert: ExpertType,
    targetExpert: ExpertType
  ): CrossReference[] {
    try {
      const parsed = JSON.parse(analysis);
      const references: CrossReference[] = [];

      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item.confidence >= 0.6) {
            references.push({
              id: `${sourceExpert}_${targetExpert}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
              sourceExpert,
              targetExpert,
              sourceSection: item.sourceSection,
              targetSection: item.targetSection,
              relationship: item.relationship as CrossReferenceType,
              description: item.description,
              confidence: item.confidence
            });
          }
        }
      }

      return references;

    } catch (error) {
      logger.warn('Failed to parse cross-reference analysis as JSON');
      return [];
    }
  }

  /**
   * Store document relationships for a workflow
   */
  private async _storeDocumentRelationships(
    workflowId: string,
    references: CrossReference[]
  ): Promise<void> {
    const relationships = new Map<string, CrossReference[]>();

    // Group references by expert pair
    for (const ref of references) {
      const key = `${ref.sourceExpert}_to_${ref.targetExpert}`;
      if (!relationships.has(key)) {
        relationships.set(key, []);
      }
      relationships.get(key)!.push(ref);
    }

    const documentRelationship: DocumentRelationship = {
      workflowId,
      relationships,
      lastUpdated: new Date()
    };

    this.documentRelationships.set(workflowId, documentRelationship);
    logger.debug(`Stored ${references.length} cross-references for workflow ${workflowId}`);
  }

  /**
   * Group references by section for annotation
   */
  private _groupReferencesBySection(
    references: CrossReference[],
    content: string
  ): Map<string, CrossReference[]> {
    const sectionMap = new Map<string, CrossReference[]>();

    for (const ref of references) {
      const section = ref.targetSection || 'General';
      if (!sectionMap.has(section)) {
        sectionMap.set(section, []);
      }
      sectionMap.get(section)!.push(ref);
    }

    return sectionMap;
  }

  /**
   * Format reference annotation text
   */
  private _formatReferenceAnnotation(references: CrossReference[]): string {
    if (references.length === 1) {
      const ref = references[0];
      return `Cross-reference: This ${ref.relationship.replace('_', ' ')} the ${ref.sourceExpert.replace('_', ' ')} recommendation regarding "${ref.sourceSection}". ${ref.description}`;
    }

    const expertCounts = new Map<ExpertType, number>();
    for (const ref of references) {
      const count = expertCounts.get(ref.sourceExpert) || 0;
      expertCounts.set(ref.sourceExpert, count + 1);
    }

    const expertList = Array.from(expertCounts.entries())
      .map(([expert, count]) => `${expert.replace('_', ' ')} (${count})`)
      .join(', ');

    return `Cross-references: This section relates to recommendations from: ${expertList}. See integrated analysis for detailed relationships.`;
  }

  /**
   * Find section insertion points for annotations
   */
  private _findSectionInsertionPoints(
    content: string,
    references: CrossReference[]
  ): RegExpMatchArray[] {
    const matches: RegExpMatchArray[] = [];
    
    for (const ref of references) {
      // Look for section headers that match the target section
      const sectionRegex = new RegExp(
        `##?\\s*[0-9]*\\.?\\s*${ref.targetSection.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
        'gi'
      );
      
      const match = sectionRegex.exec(content);
      if (match) {
        matches.push(match);
      }
    }

    return matches;
  }

  /**
   * Validate a single cross-reference
   */
  private async _validateSingleReference(reference: CrossReference): Promise<boolean> {
    // Simple validation - in production, this could be more sophisticated
    return (
      reference.confidence >= 0.6 &&
      reference.sourceSection.length > 0 &&
      reference.targetSection.length > 0 &&
      reference.description.length > 0
    );
  }
}

export const crossReferenceManager = new CrossReferenceManager();