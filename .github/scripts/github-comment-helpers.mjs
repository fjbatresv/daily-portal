export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
  }

  return response.json();
}

export function githubHeaders(token) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

export async function fetchAllPages(url, githubToken) {
  const results = [];
  let nextUrl = url;

  while (nextUrl) {
    const response = await fetch(nextUrl, {
      headers: githubHeaders(githubToken),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${response.status} ${response.statusText}: ${body}`);
    }

    results.push(...(await response.json()));
    nextUrl = parseNextLink(response.headers.get('link'));
  }

  return results;
}

export function parseNextLink(linkHeader) {
  if (!linkHeader) {
    return undefined;
  }

  const nextLink = linkHeader.split(',').find((entry) => entry.includes('rel="next"'));
  return nextLink?.match(/<([^>]+)>/)?.[1];
}

export async function upsertIssueComment({ body, githubToken, marker, owner, repo, pullRequestNumber }) {
  const commentsUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${pullRequestNumber}/comments?per_page=100`;
  const comments = await fetchAllPages(commentsUrl, githubToken);
  const existing = comments.find((comment) => comment.body?.includes(marker));

  if (existing) {
    await fetchJson(existing.url, {
      method: 'PATCH',
      headers: githubHeaders(githubToken),
      body: JSON.stringify({ body }),
    });
    return;
  }

  await fetchJson(commentsUrl, {
    method: 'POST',
    headers: githubHeaders(githubToken),
    body: JSON.stringify({ body }),
  });
}
