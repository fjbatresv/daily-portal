/**
 * Converts external API error response bodies into stable log text.
 */
export function stringifyIntegrationResponseData(data: unknown, integrationName: string): string {
  if (typeof data === 'string') {
    return data;
  }

  if (data === undefined) {
    return `No ${integrationName} error response body`;
  }

  try {
    return JSON.stringify(data);
  } catch {
    return `Unable to serialize ${integrationName} error response`;
  }
}
