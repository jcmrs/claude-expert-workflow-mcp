// Optional Task Master AI Integration
// Provides automated task generation from expert consultation results

import dotenv from 'dotenv';
import { handleTaskMasterError } from '../utils/errorHandler';

dotenv.config();

// Check if Task Master AI integration is enabled and available
export function isTaskMasterEnabled(): boolean {
  return process.env.TASKMASTER_INTEGRATION_ENABLED === 'true';
}

// Check if Task Master AI package is available (optional dependency)
function isTaskMasterAvailable(): boolean {
  try {
    require.resolve('task-master-ai');
    return true;
  } catch (error) {
    return false;
  }
}

// Task Master AI client interface
interface TaskMasterClient {
  generateTasks(input: {
    projectId?: string;
    document: string;
    documentType: 'prd' | 'design-spec' | 'tech-architecture' | 'consultation';
    context?: string;
  }): Promise<{ tasks: any[]; success: boolean; error?: string }>;
}

// Lazy-loaded Task Master AI client
let taskMasterClient: TaskMasterClient | null = null;

function getTaskMasterClient(): TaskMasterClient | null {
  if (!isTaskMasterEnabled()) {
    return null;
  }

  if (!isTaskMasterAvailable()) {
    // Use console.error for compatibility with MCP logging expectations
    console.error('[TASKMASTER] Task Master AI package not installed. Install with: npm install task-master-ai');
    return null;
  }

  if (!taskMasterClient) {
    try {
      // Dynamic import of optional dependency
      const TaskMaster = require('task-master-ai');
      taskMasterClient = new TaskMaster({
        apiEndpoint: process.env.TASKMASTER_API_ENDPOINT || 'http://localhost:3001',
        autoGenerate: process.env.TASKMASTER_AUTO_GENERATE_TASKS === 'true'
      });
    } catch (error) {
      console.error('[TASKMASTER] Failed to initialize Task Master AI client:', error);
      return null;
    }
  }

  return taskMasterClient;
}

// Generate tasks from PRD
export async function generateTasksFromPRD(
  prdContent: string,
  projectId?: string
): Promise<{ tasks: any[]; success: boolean; error?: string }> {
  const client = getTaskMasterClient();

  if (!client) {
    return {
      tasks: [],
      success: false,
      error: 'Task Master AI integration not available or not enabled'
    };
  }

  try {
    console.error('[TASKMASTER] Generating tasks from PRD...');
    const result = await client.generateTasks({
      projectId: projectId || process.env.TASKMASTER_PROJECT_ID,
      document: prdContent,
      documentType: 'prd',
      context: 'Product Requirements Document from AI Expert Workflow consultation'
    });

    console.error(`[TASKMASTER] Generated ${result.tasks.length} tasks from PRD`);
    return result;
  } catch (error) {
    console.error('[TASKMASTER] Error generating tasks from PRD:', error);
    return {
      tasks: [],
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Generate tasks from UX Design Specification
export async function generateTasksFromDesignSpec(
  designSpecContent: string,
  projectId?: string
): Promise<{ tasks: any[]; success: boolean; error?: string }> {
  const client = getTaskMasterClient();

  if (!client) {
    return {
      tasks: [],
      success: false,
      error: 'Task Master AI integration not available or not enabled'
    };
  }

  try {
    console.error('[TASKMASTER] Generating tasks from Design Specification...');
    const result = await client.generateTasks({
      projectId: projectId || process.env.TASKMASTER_PROJECT_ID,
      document: designSpecContent,
      documentType: 'design-spec',
      context: 'UX Design Specification from AI Expert Workflow consultation'
    });

    console.error(`[TASKMASTER] Generated ${result.tasks.length} tasks from Design Spec`);
    return result;
  } catch (error) {
    console.error('[TASKMASTER] Error generating tasks from Design Spec:', error);
    return {
      tasks: [],
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Generate tasks from Technical Architecture
export async function generateTasksFromTechArchitecture(
  techArchContent: string,
  projectId?: string
): Promise<{ tasks: any[]; success: boolean; error?: string }> {
  const client = getTaskMasterClient();

  if (!client) {
    return {
      tasks: [],
      success: false,
      error: 'Task Master AI integration not available or not enabled'
    };
  }

  try {
    console.error('[TASKMASTER] Generating tasks from Technical Architecture...');
    const result = await client.generateTasks({
      projectId: projectId || process.env.TASKMASTER_PROJECT_ID,
      document: techArchContent,
      documentType: 'tech-architecture',
      context: 'Technical Architecture from AI Expert Workflow consultation'
    });

    console.error(`[TASKMASTER] Generated ${result.tasks.length} tasks from Technical Architecture`);
    return result;
  } catch (error) {
    console.error('[TASKMASTER] Error generating tasks from Technical Architecture:', error);
    return {
      tasks: [],
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Generate tasks from expert consultation result
export async function generateTasksFromConsultation(
  consultationContent: string,
  expertRole: string,
  projectId?: string
): Promise<{ tasks: any[]; success: boolean; error?: string }> {
  const client = getTaskMasterClient();

  if (!client) {
    return {
      tasks: [],
      success: false,
      error: 'Task Master AI integration not available or not enabled'
    };
  }

  try {
    console.error(`[TASKMASTER] Generating tasks from ${expertRole} consultation...`);
    const result = await client.generateTasks({
      projectId: projectId || process.env.TASKMASTER_PROJECT_ID,
      document: consultationContent,
      documentType: 'consultation',
      context: `Expert consultation result from ${expertRole} via AI Expert Workflow`
    });

    console.error(`[TASKMASTER] Generated ${result.tasks.length} tasks from consultation`);
    return result;
  } catch (error) {
    console.error(`[TASKMASTER] Error generating tasks from ${expertRole} consultation:`, error);
    return {
      tasks: [],
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Get Task Master AI system status
export function getTaskMasterStatus() {
  return {
    enabled: isTaskMasterEnabled(),
    available: isTaskMasterAvailable(),
    configured: !!process.env.TASKMASTER_API_ENDPOINT,
    autoGenerate: process.env.TASKMASTER_AUTO_GENERATE_TASKS === 'true',
    projectId: process.env.TASKMASTER_PROJECT_ID || 'not-configured'
  };
}