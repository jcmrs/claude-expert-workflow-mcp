import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { ConversationState, WorkflowSession } from '@/types';
import { IPersistentStorage, PeristenceHealthStatus, BackupMetadata } from './interfaces';
import { logger } from '@/utils/logger';

export class FileBasedStorage implements IPersistentStorage {
  private readonly dataDir: string;
  private readonly conversationsDir: string;
  private readonly workflowsDir: string;
  private readonly backupsDir: string;
  private readonly lockFile: string;
  
  constructor(dataDir: string = './data') {
    this.dataDir = path.resolve(dataDir);
    this.conversationsDir = path.join(this.dataDir, 'conversations');
    this.workflowsDir = path.join(this.dataDir, 'workflows');
    this.backupsDir = path.join(this.dataDir, 'backups');
    this.lockFile = path.join(this.dataDir, '.lock');
  }

  /**
   * Initialize storage directories and ensure data integrity
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureDirectories();
      await this.verifyDataIntegrity();
      logger.info('File-based storage initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize file-based storage:', error);
      throw error;
    }
  }

  // Conversation management
  async saveConversation(conversation: ConversationState): Promise<void> {
    const filePath = path.join(this.conversationsDir, `${conversation.id}.json`);
    await this.writeJsonFile(filePath, conversation);
    logger.debug(`Saved conversation ${conversation.id}`);
  }

  async loadConversation(id: string): Promise<ConversationState | undefined> {
    const filePath = path.join(this.conversationsDir, `${id}.json`);
    try {
      return await this.readJsonFile<ConversationState>(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }

  async deleteConversation(id: string): Promise<boolean> {
    const filePath = path.join(this.conversationsDir, `${id}.json`);
    try {
      await fs.unlink(filePath);
      logger.debug(`Deleted conversation ${id}`);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      logger.error(`Failed to delete conversation ${id}:`, error);
      throw error;
    }
  }

  async listConversations(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.conversationsDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      logger.error('Failed to list conversations:', error);
      return [];
    }
  }

  // Workflow management
  async saveWorkflow(workflow: WorkflowSession): Promise<void> {
    const filePath = path.join(this.workflowsDir, `${workflow.id}.json`);
    await this.writeJsonFile(filePath, workflow);
    logger.debug(`Saved workflow ${workflow.id}`);
  }

  async loadWorkflow(id: string): Promise<WorkflowSession | undefined> {
    const filePath = path.join(this.workflowsDir, `${id}.json`);
    try {
      return await this.readJsonFile<WorkflowSession>(filePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return undefined;
      }
      throw error;
    }
  }

  async deleteWorkflow(id: string): Promise<boolean> {
    const filePath = path.join(this.workflowsDir, `${id}.json`);
    try {
      await fs.unlink(filePath);
      logger.debug(`Deleted workflow ${id}`);
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return false;
      }
      logger.error(`Failed to delete workflow ${id}:`, error);
      throw error;
    }
  }

  async listWorkflows(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.workflowsDir);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    } catch (error) {
      logger.error('Failed to list workflows:', error);
      return [];
    }
  }

  // Backup and recovery
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(this.backupsDir, `backup-${timestamp}`);
    
    try {
      await fs.mkdir(backupPath, { recursive: true });
      
      // Copy conversations
      const conversationBackupDir = path.join(backupPath, 'conversations');
      await fs.mkdir(conversationBackupDir, { recursive: true });
      await this.copyDirectory(this.conversationsDir, conversationBackupDir);
      
      // Copy workflows
      const workflowBackupDir = path.join(backupPath, 'workflows');
      await fs.mkdir(workflowBackupDir, { recursive: true });
      await this.copyDirectory(this.workflowsDir, workflowBackupDir);
      
      // Create metadata
      const metadata: BackupMetadata = {
        timestamp: new Date(),
        version: '1.0.0',
        conversationCount: (await this.listConversations()).length,
        workflowCount: (await this.listWorkflows()).length,
        checksum: await this.calculateDirectoryChecksum(backupPath)
      };
      
      await fs.writeFile(
        path.join(backupPath, 'metadata.json'),
        JSON.stringify(metadata, null, 2),
        'utf8'
      );
      
      logger.info(`Created backup at ${backupPath}`);
      return backupPath;
    } catch (error) {
      logger.error('Failed to create backup:', error);
      throw error;
    }
  }

  async restoreFromBackup(backupPath: string): Promise<boolean> {
    try {
      // Verify backup integrity
      const metadataPath = path.join(backupPath, 'metadata.json');
      const metadata = await this.readJsonFile<BackupMetadata>(metadataPath);
      
      const currentChecksum = await this.calculateDirectoryChecksum(backupPath);
      if (currentChecksum !== metadata.checksum) {
        throw new Error('Backup integrity check failed - checksums do not match');
      }
      
      // Create data directories backup before restore
      const tempBackup = await this.createBackup();
      
      try {
        // Clear current data
        await this.clearDirectory(this.conversationsDir);
        await this.clearDirectory(this.workflowsDir);
        
        // Restore data
        await this.copyDirectory(
          path.join(backupPath, 'conversations'),
          this.conversationsDir
        );
        await this.copyDirectory(
          path.join(backupPath, 'workflows'),
          this.workflowsDir
        );
        
        logger.info(`Restored data from backup ${backupPath}`);
        return true;
      } catch (error) {
        // Rollback on failure
        logger.error('Restore failed, rolling back:', error);
        await this.restoreFromBackup(tempBackup);
        throw error;
      }
    } catch (error) {
      logger.error('Failed to restore from backup:', error);
      return false;
    }
  }

  // Health and maintenance
  async checkHealth(): Promise<PeristenceHealthStatus> {
    const errors: string[] = [];
    let status: 'healthy' | 'degraded' | 'failed' = 'healthy';
    
    try {
      // Check directories exist
      await Promise.all([
        fs.access(this.conversationsDir),
        fs.access(this.workflowsDir),
        fs.access(this.backupsDir)
      ]);
    } catch (error) {
      errors.push(`Storage directories not accessible: ${error}`);
      status = 'failed';
    }
    
    // Get storage statistics
    const conversationCount = (await this.listConversations()).length;
    const workflowCount = (await this.listWorkflows()).length;
    const storageUsed = await this.calculateStorageUsage();
    
    // Find last backup
    let lastBackup: Date | null = null;
    try {
      const backups = await fs.readdir(this.backupsDir);
      if (backups.length > 0) {
        const latestBackup = backups
          .filter(name => name.startsWith('backup-'))
          .sort()
          .pop();
        
        if (latestBackup) {
          const metadataPath = path.join(this.backupsDir, latestBackup, 'metadata.json');
          const metadata = await this.readJsonFile<BackupMetadata>(metadataPath);
          lastBackup = new Date(metadata.timestamp);
        }
      }
    } catch (error) {
      errors.push(`Failed to check backup status: ${error}`);
      if (status === 'healthy') status = 'degraded';
    }
    
    return {
      status,
      lastBackup,
      totalConversations: conversationCount,
      totalWorkflows: workflowCount,
      storageUsed,
      errors
    };
  }

  async cleanup(): Promise<void> {
    try {
      // Clean up old backups (keep only last 10)
      const backups = await fs.readdir(this.backupsDir);
      const backupDirs = backups
        .filter(name => name.startsWith('backup-'))
        .sort()
        .reverse();
      
      if (backupDirs.length > 10) {
        const toDelete = backupDirs.slice(10);
        for (const backup of toDelete) {
          await this.removeDirectory(path.join(this.backupsDir, backup));
          logger.debug(`Cleaned up old backup: ${backup}`);
        }
      }
      
      logger.info('Storage cleanup completed');
    } catch (error) {
      logger.error('Failed to cleanup storage:', error);
      throw error;
    }
  }

  // Private helper methods
  private async ensureDirectories(): Promise<void> {
    const dirs = [this.dataDir, this.conversationsDir, this.workflowsDir, this.backupsDir];
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async verifyDataIntegrity(): Promise<void> {
    // Check for corrupted JSON files
    const conversationFiles = await fs.readdir(this.conversationsDir);
    const workflowFiles = await fs.readdir(this.workflowsDir);
    
    for (const file of conversationFiles.filter(f => f.endsWith('.json'))) {
      try {
        await this.readJsonFile(path.join(this.conversationsDir, file));
      } catch (error) {
        logger.warn(`Corrupted conversation file detected: ${file}`, error);
        // Move corrupted file to quarantine
        await this.quarantineFile(path.join(this.conversationsDir, file));
      }
    }
    
    for (const file of workflowFiles.filter(f => f.endsWith('.json'))) {
      try {
        await this.readJsonFile(path.join(this.workflowsDir, file));
      } catch (error) {
        logger.warn(`Corrupted workflow file detected: ${file}`, error);
        // Move corrupted file to quarantine
        await this.quarantineFile(path.join(this.workflowsDir, file));
      }
    }
  }

  private async quarantineFile(filePath: string): Promise<void> {
    const quarantineDir = path.join(this.dataDir, 'quarantine');
    await fs.mkdir(quarantineDir, { recursive: true });
    
    const fileName = path.basename(filePath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const quarantinePath = path.join(quarantineDir, `${timestamp}-${fileName}`);
    
    await fs.rename(filePath, quarantinePath);
    logger.info(`Quarantined corrupted file: ${fileName}`);
  }

  private async writeJsonFile(filePath: string, data: any): Promise<void> {
    const tempPath = `${filePath}.tmp`;
    try {
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf8');
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Cleanup temp file on error
      try {
        await fs.unlink(tempPath);
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  private async readJsonFile<T>(filePath: string): Promise<T> {
    const content = await fs.readFile(filePath, 'utf8');
    return JSON.parse(content);
  }

  private async copyDirectory(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const files = await fs.readdir(src);
    
    for (const file of files) {
      const srcPath = path.join(src, file);
      const destPath = path.join(dest, file);
      
      const stat = await fs.stat(srcPath);
      if (stat.isDirectory()) {
        await this.copyDirectory(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  private async clearDirectory(dir: string): Promise<void> {
    try {
      const files = await fs.readdir(dir);
      await Promise.all(files.map(file => fs.unlink(path.join(dir, file))));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  private async removeDirectory(dir: string): Promise<void> {
    await fs.rm(dir, { recursive: true, force: true });
  }

  private async calculateDirectoryChecksum(dir: string): Promise<string> {
    const hash = crypto.createHash('sha256');
    
    const processDir = async (currentDir: string) => {
      const files = await fs.readdir(currentDir, { withFileTypes: true });
      
      for (const file of files.sort((a, b) => a.name.localeCompare(b.name))) {
        const fullPath = path.join(currentDir, file.name);
        
        if (file.isDirectory()) {
          hash.update(file.name);
          await processDir(fullPath);
        } else {
          hash.update(file.name);
          const content = await fs.readFile(fullPath);
          hash.update(content);
        }
      }
    };
    
    await processDir(dir);
    return hash.digest('hex');
  }

  private async calculateStorageUsage(): Promise<number> {
    let totalSize = 0;
    
    const calculateDirSize = async (dir: string) => {
      try {
        const files = await fs.readdir(dir, { withFileTypes: true });
        
        for (const file of files) {
          const fullPath = path.join(dir, file.name);
          
          if (file.isDirectory()) {
            await calculateDirSize(fullPath);
          } else {
            const stat = await fs.stat(fullPath);
            totalSize += stat.size;
          }
        }
      } catch (error) {
        // Ignore errors for individual directories
      }
    };
    
    await calculateDirSize(this.dataDir);
    return totalSize;
  }
}