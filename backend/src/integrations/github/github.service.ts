import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/cache';
import { CheckStatus, GitHubPR, PRStatus } from '../../common/types/daily-digest.types';
import { AppConfiguration } from '../../config/configuration';
import { SEARCH_PRS_QUERY } from './github.queries';
import {
  GitHubApiCheckState,
  GitHubApiPrState,
  GitHubGraphQlResponse,
  GitHubPRNode,
} from './github.types';

interface GitHubConfig {
  token: string;
  username: string;
}

/**
 * Reads authored GitHub pull requests through the GraphQL API with Redis caching.
 */
@Injectable()
export class GitHubService {
  private readonly logger = new Logger(GitHubService.name);
  private readonly cacheKey = 'github:prs';
  private readonly fallbackCacheKey = 'github:prs:last-success';
  private readonly cacheTtlSeconds = 5 * 60;
  private readonly fallbackCacheTtlSeconds = 24 * 60 * 60;
  private readonly negativeCacheTtlSeconds = 30;
  private readonly requestTimeoutMs = 10_000;

  constructor(
    private readonly config: ConfigService<AppConfiguration, true>,
    private readonly cache: CacheService,
  ) {}

  /**
   * Returns authored open pull requests, falling back to an empty list when GitHub is unavailable.
   */
  async getPRs(): Promise<GitHubPR[]> {
    const cachedPRs = await this.cache.get<GitHubPR[]>(this.cacheKey);

    if (cachedPRs) {
      return cachedPRs;
    }

    const githubConfig = this.getGitHubConfig();
    if (!githubConfig) {
      await this.cacheEmptyPRs();
      return [];
    }

    try {
      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubConfig.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: SEARCH_PRS_QUERY,
          variables: { query: `is:pr is:open author:${githubConfig.username}` },
        }),
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });

      if (!response.ok) {
        return await this.handleHttpError(response);
      }

      const payload = (await response.json()) as GitHubGraphQlResponse;
      if (payload.errors?.length) {
        this.logger.error(
          `GitHub GraphQL error: ${payload.errors.map((error) => error.message).join('; ')}`,
        );
        await this.cacheEmptyPRs();
        return [];
      }

      const prs = (payload.data?.search.nodes ?? []).map((node) =>
        this.mapPR(node, githubConfig.username),
      );
      await this.cache.set(this.cacheKey, prs, this.cacheTtlSeconds);
      await this.cache.set(this.fallbackCacheKey, prs, this.fallbackCacheTtlSeconds);

      return prs;
    } catch (error) {
      this.logger.error(`GitHub request failed: ${this.getErrorMessage(error)}`);
      await this.cacheEmptyPRs();
      return [];
    }
  }

  private getGitHubConfig(): GitHubConfig | null {
    const token = this.config.get('github.token', { infer: true });
    const username = this.config.get('github.username', { infer: true });

    if (!token || !username) {
      this.logger.error('GitHub: configuration is incomplete');
      return null;
    }

    return { token, username };
  }

  private async handleHttpError(response: Response): Promise<GitHubPR[]> {
    if (response.status === 401) {
      this.logger.error('GitHub: token invalido o expirado');
      await this.cacheEmptyPRs();
      return [];
    }

    if (response.status === 403) {
      this.logger.error('GitHub: rate limit or forbidden response');
      const fallbackPRs = await this.cache.get<GitHubPR[]>(this.fallbackCacheKey);

      if (fallbackPRs) {
        await this.cache.set(this.cacheKey, fallbackPRs, this.negativeCacheTtlSeconds);
        return fallbackPRs;
      }

      await this.cacheEmptyPRs();
      return [];
    }

    this.logger.error(
      `GitHub API returned ${response.status}: ${await this.readResponseText(response)}`,
    );
    await this.cacheEmptyPRs();
    return [];
  }

  private async cacheEmptyPRs(): Promise<void> {
    await this.cache.set(this.cacheKey, [], this.negativeCacheTtlSeconds);
  }

  private mapPR(node: GitHubPRNode, username: string): GitHubPR {
    return {
      id: node.number,
      title: node.title,
      url: node.url,
      repo: node.repository.nameWithOwner,
      status: this.mapPRStatus(node.state, node.isDraft),
      isDraft: node.isDraft,
      hasNewComments: this.hasNewComments(node, username),
      checkStatus: this.mapCheckStatus(
        node.commits.nodes[0]?.commit.statusCheckRollup?.state ?? null,
      ),
      hasConflicts: node.mergeable === 'CONFLICTING',
      updatedAt: node.updatedAt,
    };
  }

  private mapPRStatus(state: GitHubApiPrState, isDraft: boolean): PRStatus {
    if (isDraft) {
      return 'draft';
    }

    if (state === 'MERGED') {
      return 'merged';
    }

    return state === 'CLOSED' ? 'closed' : 'open';
  }

  private mapCheckStatus(state: GitHubApiCheckState): CheckStatus {
    if (state === 'SUCCESS') {
      return 'success';
    }

    if (state === 'FAILURE') {
      return 'failure';
    }

    if (state === 'ERROR') {
      return 'error';
    }

    return 'pending';
  }

  private hasNewComments(node: GitHubPRNode, username: string): boolean {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    return [...node.comments.nodes, ...node.reviews.nodes].some((comment) => {
      const authorLogin = comment.author?.login;

      return (
        authorLogin !== undefined &&
        authorLogin !== username &&
        new Date(comment.createdAt).getTime() > cutoff
      );
    });
  }

  private async readResponseText(response: Response): Promise<string> {
    try {
      return await response.text();
    } catch {
      return 'Unable to read GitHub error response';
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }

    return 'Unknown GitHub error';
  }
}
