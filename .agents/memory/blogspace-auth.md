---
name: BlogSpace authentication boundary
description: The responsibility split between managed identity and BlogSpace's relational user profile.
---

Use Replit-managed Clerk as the source of truth for BlogSpace sign-up, sign-in, browser sessions, and logout. PostgreSQL stores the app's user profile mirror keyed by Clerk's user ID, plus posts and comments; it must not store passwords or recreate Clerk's session lifecycle.

**Why:** The platform-managed Clerk tenant provides the actual account and secure browser session, while the app still needs relational user records for authorship and foreign-key ownership checks.

**How to apply:** Keep login and logout in Clerk's browser SDK. Protect write endpoints with Clerk-verified request identity, provision the local profile on first authenticated use, and use that identity as the author for post and comment writes.
