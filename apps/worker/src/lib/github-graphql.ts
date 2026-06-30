import { NOTE_LABEL, parseFrontmatter, type NoteSummary } from "@odoginote/shared";

interface GraphQLIssueNode {
  number: number;
  title: string;
  body: string | null;
  state: "OPEN" | "CLOSED";
  updatedAt: string;
}

interface GraphQLResponse {
  data?: {
    repository?: {
      issues: {
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
        nodes: GraphQLIssueNode[];
      };
    };
  };
  errors?: Array<{ message: string }>;
}

export async function fetchAllNotes(
  token: string,
  owner: string,
  repo: string
): Promise<NoteSummary[]> {
  const notes: NoteSummary[] = [];
  let cursor: string | null = null;

  while (true) {
    const query = `
      query NotesIndex($owner: String!, $repo: String!, $cursor: String) {
        repository(owner: $owner, name: $repo) {
          issues(first: 50, after: $cursor, labels: ["${NOTE_LABEL}"], states: [OPEN, CLOSED]) {
            pageInfo { hasNextPage endCursor }
            nodes { number title body state updatedAt }
          }
        }
      }
    `;

    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "odoginote-app",
      },
      body: JSON.stringify({ query, variables: { owner, repo, cursor } }),
    });

    if (!res.ok) throw new Error(`GraphQL failed: ${res.status}`);
    const json = (await res.json()) as GraphQLResponse;
    if (json.errors?.length) throw new Error(json.errors[0].message);

    const issues = json.data?.repository?.issues;
    if (!issues) break;

    for (const node of issues.nodes) {
      const { meta, content } = parseFrontmatter(node.body ?? "");
      notes.push({
        number: node.number,
        title: node.title,
        folder: meta.folder,
        tags: meta.tags,
        daily: meta.daily,
        type: meta.type,
        state: node.state === "OPEN" ? "open" : "closed",
        updatedAt: node.updatedAt,
        content,
      });
    }

    if (!issues.pageInfo.hasNextPage) break;
    cursor = issues.pageInfo.endCursor;
  }

  return notes.sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
}
