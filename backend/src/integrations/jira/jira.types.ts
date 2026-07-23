/**
 * Minimal Jira issue shape requested from the REST search endpoint.
 */
export interface JiraApiIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: {
      name: string;
    };
    priority?: {
      name: string;
    } | null;
  };
}

/**
 * Minimal Jira search response used by JiraService.
 */
export interface JiraSearchResponse {
  issues: JiraApiIssue[];
}
