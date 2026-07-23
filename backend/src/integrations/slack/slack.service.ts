import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../../common/cache';
import { SlackMention } from '../../common/types/daily-digest.types';
import { AppConfiguration } from '../../config/configuration';
import { SlackApiMatch, SlackSearchResponse } from './slack.types';

interface SlackConfig {
  userId: string;
  userToken: string;
}

/**
 * Reads recent Slack mentions for the configured user through Slack search with Redis caching.
 */
@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);
  private readonly cacheKey = 'slack:mentions';
  private readonly cacheTtlSeconds = 5 * 60;
  private readonly negativeCacheTtlSeconds = 30;
  private readonly requestTimeoutMs = 10_000;

  constructor(
    private readonly config: ConfigService<AppConfiguration, true>,
    private readonly cache: CacheService,
  ) {}

  /**
   * Returns Slack mentions from the last 24 hours, or an empty list when Slack is unavailable.
   */
  async getMentions(): Promise<SlackMention[]> {
    const cachedMentions = await this.cache.get<SlackMention[]>(this.cacheKey);

    if (cachedMentions) {
      return cachedMentions;
    }

    const slackConfig = this.getSlackConfig();
    if (!slackConfig) {
      await this.cacheEmptyMentions();
      return [];
    }

    try {
      const response = await fetch(this.buildSearchUrl(slackConfig.userId), {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${slackConfig.userToken}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(this.requestTimeoutMs),
      });

      if (!response.ok) {
        this.logger.error(
          `Slack API returned ${response.status}: ${await this.readResponseText(response)}`,
        );
        await this.cacheEmptyMentions();
        return [];
      }

      const payload = (await response.json()) as SlackSearchResponse;
      if (!payload.ok) {
        this.logger.error(`Slack API error: ${payload.error ?? 'unknown_error'}`);
        await this.cacheEmptyMentions();
        return [];
      }

      const cutoffSeconds = this.getLast24HoursCutoffSeconds();
      const mentions = (payload.messages?.matches ?? [])
        .filter((match) => Number.parseFloat(match.ts) > cutoffSeconds)
        .map((match) => this.mapMatch(match));

      await this.cache.set(this.cacheKey, mentions, this.cacheTtlSeconds);
      return mentions;
    } catch (error) {
      this.logger.error(`Slack request failed: ${this.getErrorMessage(error)}`);
      await this.cacheEmptyMentions();
      return [];
    }
  }

  private getSlackConfig(): SlackConfig | null {
    const userToken = this.config.get('slack.userToken', { infer: true });
    const userId = this.config.get('slack.userId', { infer: true });

    if (!userToken || !userId) {
      this.logger.error('Slack: configuration is incomplete');
      return null;
    }

    return { userId, userToken };
  }

  private buildSearchUrl(userId: string): string {
    const searchUrl = new URL('https://slack.com/api/search.messages');
    searchUrl.searchParams.set('query', `<@${userId}> after:${this.getSearchAfterDate()}`);
    searchUrl.searchParams.set('count', '20');
    searchUrl.searchParams.set('sort', 'timestamp');
    searchUrl.searchParams.set('sort_dir', 'desc');

    return searchUrl.toString();
  }

  private getSearchAfterDate(): string {
    return new Date(this.getLast24HoursCutoffSeconds() * 1000).toISOString().slice(0, 10);
  }

  private getLast24HoursCutoffSeconds(): number {
    return Date.now() / 1000 - 24 * 60 * 60;
  }

  private mapMatch(match: SlackApiMatch): SlackMention {
    return {
      ts: match.ts,
      channelName: match.channel?.name ?? 'unknown',
      senderName: match.username ?? match.user_name ?? 'unknown',
      text: match.text,
      permalink: match.permalink,
    };
  }

  private async cacheEmptyMentions(): Promise<void> {
    await this.cache.set(this.cacheKey, [], this.negativeCacheTtlSeconds);
  }

  private async readResponseText(response: Response): Promise<string> {
    try {
      return await response.text();
    } catch {
      return 'Unable to read Slack error response';
    }
  }

  private getErrorMessage(error: unknown): string {
    if (error && typeof error === 'object' && 'message' in error) {
      return String(error.message);
    }

    return 'Unknown Slack error';
  }
}
