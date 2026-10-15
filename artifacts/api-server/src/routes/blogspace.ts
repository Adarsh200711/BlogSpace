import { clerkClient, getAuth } from "@clerk/express";
import {
  CreateCommentBody,
  CreateCommentResponse,
  CreatePostBody,
  CreatePostResponse,
  DeletePostParams,
  GetCurrentUserResponse,
  GetMyDashboardSummaryResponse,
  GetPostParams,
  GetPostResponse,
  ListCommentsParams,
  ListCommentsResponse,
  ListMyPostsResponse,
  ListPostsQueryParams,
  ListPostsResponse,
  UpdatePostBody,
  UpdatePostParams,
  UpdatePostResponse,
} from "@workspace/api-zod";
import { commentsTable, db, postsTable, usersTable } from "@workspace/db";
import {
  and,
  count,
  desc,
  eq,
  ilike,
  or,
  type SQL,
} from "drizzle-orm";
import { Router, type IRouter } from "express";
import {
  getBlogspaceUser,
  requireBlogspaceUser,
  syncBlogspaceUser,
} from "../middlewares/blogspaceAuth";

const router: IRouter = Router();

async function getPostWithAuthor(postId: number) {
  const [post] = await db
    .select({
      id: postsTable.id,
      title: postsTable.title,
      content: postsTable.content,
      authorId: postsTable.authorId,
      authorName: usersTable.name,
      publishedAt: postsTable.publishedAt,
      updatedAt: postsTable.updatedAt,
    })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.authorId, usersTable.clerkId))
    .where(eq(postsTable.id, postId))
    .limit(1);
  return post;
}

async function getPostSummaries(search?: string, authorId?: string) {
  const filters: SQL[] = [];
  const normalizedSearch = search?.trim();
  if (normalizedSearch) {
    const term = `%${normalizedSearch}%`;
    filters.push(
      or(ilike(postsTable.title, term), ilike(postsTable.content, term))!,
    );
  }
  if (authorId) {
    filters.push(eq(postsTable.authorId, authorId));
  }

  const rows = await db
    .select({
      id: postsTable.id,
      title: postsTable.title,
      content: postsTable.content,
      authorId: postsTable.authorId,
      authorName: usersTable.name,
      publishedAt: postsTable.publishedAt,
      commentCount: count(commentsTable.id),
    })
    .from(postsTable)
    .innerJoin(usersTable, eq(postsTable.authorId, usersTable.clerkId))
    .leftJoin(commentsTable, eq(commentsTable.postId, postsTable.id))
    .where(and(...filters))
    .groupBy(postsTable.id, usersTable.clerkId)
    .orderBy(desc(postsTable.publishedAt));

  return rows.map(({ content, ...post }) => ({
    ...post,
    excerpt: content.replace(/\s+/g, " ").trim().slice(0, 200),
  }));
}

router.get("/auth/me", requireBlogspaceUser, async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const user = await syncBlogspaceUser(userId);
  res.json(
    GetCurrentUserResponse.parse({
      id: user.clerkId,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    }),
  );
});

router.get("/posts", async (req, res): Promise<void> => {
  const query = ListPostsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }
  res.json(ListPostsResponse.parse(await getPostSummaries(query.data.search)));
});

router.post("/posts", requireBlogspaceUser, async (req, res): Promise<void> => {
  const parsed = CreatePostBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const title = parsed.data.title.trim();
  const content = parsed.data.content.trim();
  if (title.length < 3 || !content) {
    res.status(400).json({ error: "Add a title and content before publishing." });
    return;
  }

  const userId = getAuth(req).userId!;
  const user = await getBlogspaceUser(userId);
  if (!user) {
    res.status(503).json({ error: "Your account could not be loaded. Please try again." });
    return;
  }

  const [post] = await db
    .insert(postsTable)
    .values({ title, content, authorId: userId })
    .returning();
  res.status(201).json(
    CreatePostResponse.parse({ ...post, authorName: user.name }),
  );
});

router.get("/posts/:postId", async (req, res): Promise<void> => {
  const params = GetPostParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const post = await getPostWithAuthor(params.data.postId);
  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }
  res.json(GetPostResponse.parse(post));
});

router.patch(
  "/posts/:postId",
  requireBlogspaceUser,
  async (req, res): Promise<void> => {
    const params = UpdatePostParams.safeParse(req.params);
    const parsed = UpdatePostBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const userId = getAuth(req).userId!;
    const existing = await getPostWithAuthor(params.data.postId);
    if (!existing) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    if (existing.authorId !== userId) {
      res.status(403).json({ error: "You can only edit your own posts." });
      return;
    }

    const title = parsed.data.title.trim();
    const content = parsed.data.content.trim();
    if (title.length < 3 || !content) {
      res.status(400).json({ error: "Add a title and content before saving." });
      return;
    }

    const [updated] = await db
      .update(postsTable)
      .set({ title, content, updatedAt: new Date() })
      .where(and(eq(postsTable.id, params.data.postId), eq(postsTable.authorId, userId)))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    res.json(
      UpdatePostResponse.parse({ ...updated, authorName: existing.authorName }),
    );
  },
);

router.delete(
  "/posts/:postId",
  requireBlogspaceUser,
  async (req, res): Promise<void> => {
    const params = DeletePostParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const userId = getAuth(req).userId!;
    const [existing] = await db
      .select({ authorId: postsTable.authorId })
      .from(postsTable)
      .where(eq(postsTable.id, params.data.postId))
      .limit(1);
    if (!existing) {
      res.status(404).json({ error: "Post not found" });
      return;
    }
    if (existing.authorId !== userId) {
      res.status(403).json({ error: "You can only delete your own posts." });
      return;
    }

    await db
      .delete(postsTable)
      .where(and(eq(postsTable.id, params.data.postId), eq(postsTable.authorId, userId)));
    res.sendStatus(204);
  },
);

router.get(
  "/me/posts",
  requireBlogspaceUser,
  async (req, res): Promise<void> => {
    const userId = getAuth(req).userId!;
    res.json(ListMyPostsResponse.parse(await getPostSummaries(undefined, userId)));
  },
);

router.get(
  "/posts/:postId/comments",
  async (req, res): Promise<void> => {
    const params = ListCommentsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [post] = await db
      .select({ id: postsTable.id })
      .from(postsTable)
      .where(eq(postsTable.id, params.data.postId))
      .limit(1);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const comments = await db
      .select({
        id: commentsTable.id,
        postId: commentsTable.postId,
        authorId: commentsTable.authorId,
        authorName: usersTable.name,
        content: commentsTable.content,
        createdAt: commentsTable.createdAt,
      })
      .from(commentsTable)
      .innerJoin(usersTable, eq(commentsTable.authorId, usersTable.clerkId))
      .where(eq(commentsTable.postId, params.data.postId))
      .orderBy(commentsTable.createdAt);
    res.json(ListCommentsResponse.parse(comments));
  },
);

router.post(
  "/posts/:postId/comments",
  requireBlogspaceUser,
  async (req, res): Promise<void> => {
    const params = ListCommentsParams.safeParse(req.params);
    const parsed = CreateCommentBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const content = parsed.data.content.trim();
    if (!content) {
      res.status(400).json({ error: "A comment cannot be empty." });
      return;
    }

    const [post] = await db
      .select({ id: postsTable.id })
      .from(postsTable)
      .where(eq(postsTable.id, params.data.postId))
      .limit(1);
    if (!post) {
      res.status(404).json({ error: "Post not found" });
      return;
    }

    const userId = getAuth(req).userId!;
    const user = await getBlogspaceUser(userId);
    if (!user) {
      res.status(503).json({ error: "Your account could not be loaded. Please try again." });
      return;
    }
    const [comment] = await db
      .insert(commentsTable)
      .values({ postId: params.data.postId, authorId: userId, content })
      .returning();
    res.status(201).json(
      CreateCommentResponse.parse({ ...comment, authorName: user.name }),
    );
  },
);

router.get(
  "/me/summary",
  requireBlogspaceUser,
  async (req, res): Promise<void> => {
    const userId = getAuth(req).userId!;
    const [postTotal, commentTotal, receivedTotal] = await Promise.all([
      db
        .select({ total: count() })
        .from(postsTable)
        .where(eq(postsTable.authorId, userId)),
      db
        .select({ total: count() })
        .from(commentsTable)
        .where(eq(commentsTable.authorId, userId)),
      db
        .select({ total: count() })
        .from(commentsTable)
        .innerJoin(postsTable, eq(commentsTable.postId, postsTable.id))
        .where(eq(postsTable.authorId, userId)),
    ]);
    res.json(
      GetMyDashboardSummaryResponse.parse({
        postCount: Number(postTotal[0]?.total ?? 0),
        commentCount: Number(commentTotal[0]?.total ?? 0),
        commentsReceived: Number(receivedTotal[0]?.total ?? 0),
      }),
    );
  },
);

export default router;
