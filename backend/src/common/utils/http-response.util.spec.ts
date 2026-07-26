import { stringifyIntegrationResponseData } from './http-response.util';

describe('stringifyIntegrationResponseData', () => {
  it('passes string response bodies through unchanged', () => {
    expect(stringifyIntegrationResponseData('Internal error', 'Jira')).toBe('Internal error');
  });

  it('uses an integration-specific fallback when the body is undefined', () => {
    expect(stringifyIntegrationResponseData(undefined, 'GitHub')).toBe(
      'No GitHub error response body',
    );
  });

  it('serializes object response bodies as JSON', () => {
    expect(stringifyIntegrationResponseData({ error: 'missing_scope' }, 'Slack')).toBe(
      '{"error":"missing_scope"}',
    );
  });

  it('uses an integration-specific fallback when serialization fails', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    expect(stringifyIntegrationResponseData(circular, 'Slack')).toBe(
      'Unable to serialize Slack error response',
    );
  });
});
