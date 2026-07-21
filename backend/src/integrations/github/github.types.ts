export type GitHubApiPrState = 'CLOSED' | 'MERGED' | 'OPEN';
export type GitHubApiMergeableState = 'CONFLICTING' | 'MERGEABLE' | 'UNKNOWN';
export type GitHubApiCheckState = 'ERROR' | 'FAILURE' | 'PENDING' | 'SUCCESS' | null;

export interface GitHubGraphQlResponse {
  data?: {
    search: {
      nodes: GitHubPRNode[];
    };
  };
  errors?: Array<{
    message: string;
  }>;
}

export interface GitHubPRNode {
  id: string;
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  updatedAt: string;
  mergeable: GitHubApiMergeableState;
  repository: {
    nameWithOwner: string;
  };
  state: GitHubApiPrState;
  commits: {
    nodes: Array<{
      commit: {
        statusCheckRollup: {
          state: GitHubApiCheckState;
        } | null;
      };
    }>;
  };
  comments: GitHubCommentConnection;
  reviews: GitHubCommentConnection;
}

export interface GitHubCommentConnection {
  totalCount: number;
  nodes: GitHubCommentNode[];
}

export interface GitHubCommentNode {
  createdAt: string;
  author: {
    login: string;
  } | null;
}
