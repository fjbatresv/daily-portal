/**
 * GraphQL query that finds open pull requests authored by the configured user.
 */
export const SEARCH_PRS_QUERY = `
  query SearchAssignedPRs($query: String!) {
    search(
      query: $query
      type: ISSUE
      first: 20
    ) {
      nodes {
        ... on PullRequest {
          id
          number
          title
          url
          isDraft
          updatedAt
          mergeable
          repository {
            nameWithOwner
          }
          state
          commits(last: 1) {
            nodes {
              commit {
                statusCheckRollup {
                  state
                }
              }
            }
          }
          comments(last: 5) {
            totalCount
            nodes {
              createdAt
              author {
                login
              }
            }
          }
          reviews(last: 5, states: [COMMENTED, CHANGES_REQUESTED]) {
            totalCount
            nodes {
              createdAt
              author {
                login
              }
            }
          }
        }
      }
    }
  }
`;
