import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/cache';
import { JiraTask } from '../../common/types/daily-digest.types';
import { AppConfiguration } from '../../config/configuration';
import { JiraApiIssue, JiraSearchResponse } from './jira.types';

interface JiraConfig {
  apiToken: string;
  baseUrl: string;
  email: string;
  projectKey: string;
}

/**
 * Reads assigned Jira work items through the Jira REST API with Redis caching.
 */
@Injectable()
export class JiraService {
  private readonly logger = new Logger(JiraService.name);
  private readonly cacheKey = 'jira:tasks';
  private readonly cacheTtlSeconds = 15 * 60;
  private readonly requestTimeoutMs = 10_000;

  constructor(
    private readonly config: ConfigService<AppConfiguration, true>,
    private readonly cache: CacheService,
  ) {}

  /**
   * Returns assigned Jira tasks, falling back to an empty list when Jira is unavailable.
   */
  async getTasks(): Promise<JiraTask[]> {
    const cachedTasks = await this.cache.get<JiraTask[]>(this.cacheKey);

    if (cachedTasks) {
      return cachedTasks;
    }

    const jiraConfig = this.getJiraConfig();
    if (!jiraConfig) {
      return [];
    }

    try {
      const response = await fetch(this.buildSearchUrl(jiraConfig), {
        method: 'GET',
        headers: {
          Authorization: `Basic ${this.encodeBasicAuth(jiraConfig.email, jiraConfig.apiToken)}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });

      if (!response.ok) {
        return await this.handleHttpError(response);
      }

      const payload = (await response.json()) as JiraSearchResponse;
      const tasks = payload.issues.map((issue) => this.mapIssue(issue, jiraConfig.baseUrl));
      await this.cache.set(this.cacheKey, tasks, this.cacheTtlSeconds);

      return tasks;
    } catch (error) {
      this.logger.error(`Jira request failed: ${this.getErrorMessage(error)}`);
      return [];
    }
  }

  private getJiraConfig(): JiraConfig | null {
    const apiToken = this.config.get('jira.apiToken', { infer: true });
    const baseUrl = this.config.get('jira.baseUrl', { infer: true });
    const email = this.config.get('jira.email', { infer: true });
    const projectKey = this.config.get('jira.projectKey', { infer: true });

    if (!apiToken || !baseUrl || !email || !projectKey) {
      this.logger.error('Jira: configuration is incomplete');
      return null;
    }

    return {
      apiToken,
      baseUrl,
      email,
      projectKey,
    };
  }

  private buildSearchUrl(jiraConfig: JiraConfig): string {
    const baseUrl = jiraConfig.baseUrl.replace(/\/$/, '');
    const searchUrl = new URL(`${baseUrl}/rest/api/3/search`);
    const filters = [
      `project=${jiraConfig.projectKey}`,
      'assignee=currentUser()',
      'statusCategory in ("In Progress","To Do")',
    ].join(' AND ');
    const jql = `${filters} ORDER BY updated DESC`;

    searchUrl.searchParams.set('jql', jql);
    searchUrl.searchParams.set('fields', 'summary,status,priority,assignee');
    searchUrl.searchParams.set('maxResults', '20');

    return searchUrl.toString();
  }

  private async handleHttpError(response: Response): Promise<JiraTask[]> {
    if (response.status === 401) {
      this.logger.error('Jira: credenciales inválidas');
      return [];
    }

    if (response.status === 429) {
      this.logger.error('Jira: rate limit');
      return (await this.cache.get<JiraTask[]>(this.cacheKey)) ?? [];
    }

    this.logger.error(
      `Jira API returned ${response.status}: ${await this.readResponseText(response)}`,
    );
    return [];
  }

  private mapIssue(issue: JiraApiIssue, baseUrl: string): JiraTask {
    return {
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary,
      status: issue.fields.status.name,
      priority: issue.fields.priority?.name ?? 'Unprioritized',
      url: `${baseUrl.replace(/\/$/, '')}/browse/${issue.key}`,
    };
  }

  private encodeBasicAuth(email: string, apiToken: string): string {
    return Buffer.from(`${email}:${apiToken}`).toString('base64');
  }

  private async readResponseText(response: Response): Promise<string> {
    try {
      return await response.text();
    } catch {
      return 'Unable to read Jira error response';
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }

    return 'Unknown Jira error';
  }
}
