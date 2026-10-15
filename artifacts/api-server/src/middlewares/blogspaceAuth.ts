import { clerkClient, getAuth } from "@clerk/express";
import { eq } from "drizzle-orm";
import type { RequestHandler } from "express";
import { db, usersTable } from "@workspace/db";

export async function syncBlogspaceUser(clerkId: string) {
  const externalUser = await clerkClient.users.getUser(clerkId);
  const primaryEmail =
    externalUser.emailAddresses.find(
      (address) => address.id === externalUser.primaryEmailAddressId,
    )?.emailAddress ?? externalUser.emailAddresses[0]?.emailAddress;

  if (!primaryEmail) {
    throw new Error("The authenticated account does not have an email address.");
  }

  const fullName = [externalUser.firstName, externalUser.lastName]
    .filter(Boolean)
    .join(" ");
  const name =
    fullName || externalUser.username || primaryEmail.split("@")[0] || "Writer";

  const [user] = await db
    .insert(usersTable)
    .values({ clerkId, email: primaryEmail, name })
    .onConflictDoUpdate({
      target: usersTable.clerkId,
      set: { email: primaryEmail, name, updatedAt: new Date() },
    })
    .returning();

  return user;
}

export async function getBlogspaceUser(clerkId: string) {
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.clerkId, clerkId))
    .limit(1);
  return user;
}

export const requireBlogspaceUser: RequestHandler = async (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const user = await getBlogspaceUser(userId);
    if (!user) {
      await syncBlogspaceUser(userId);
    }
    next();
  } catch (error) {
    req.log.error({ err: error, clerkUserId: userId }, "Could not provision BlogSpace user");
    res.status(503).json({ error: "Your account could not be loaded. Please try again." });
  }
};
