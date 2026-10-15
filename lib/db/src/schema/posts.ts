import { createInsertSchema } from "drizzle-zod";
import { index, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { z } from "zod/v4";

export const postsTable = pgTable(
  "blogspace_posts",
  {
    id: serial("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    authorId: text("author_id")
      .notNull()
      .references(() => usersTable.clerkId, { onDelete: "cascade" }),
    publishedAt: timestamp("published_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("blogspace_posts_author_idx").on(table.authorId),
    index("blogspace_posts_published_idx").on(table.publishedAt),
  ],
);

export const insertPostSchema = createInsertSchema(postsTable).omit({
  id: true,
  publishedAt: true,
  updatedAt: true,
});
export type InsertPost = z.infer<typeof insertPostSchema>;
export type Post = typeof postsTable.$inferSelect;
