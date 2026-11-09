-- S1-12 Q14: the reason of a sharing refusal becomes a public comment. Copy every stored reason
-- before the next migration drops the column (§17.2, "Migrations"). S1-11 kept only the latest
-- reason, while the request is `rejected`.
--
-- The author and the time are those of the ticket's latest `sharing_rejected` event, and the ID is
-- a UUIDv7 of that time. Without such an event (seeded data) the same fallbacks as for the
-- rejection reasons apply, so the migration never aborts: the assignee, else the earliest
-- Administrator, else the requester, and the ticket's last update. The audience is the unchanged
-- visibility, so the author sees it.
INSERT INTO "comments" (
  "id", "ticket_id", "author_id", "kind", "audience", "audience_organization_id", "body",
  "version", "created_at", "updated_at"
)
SELECT
  uuidv7(written.at - now()),
  t."id",
  written.author_id,
  'public',
  t."visibility",
  CASE WHEN t."visibility" = 'my_organization' THEN t."organization_id" END,
  t."sharing_refusal_reason",
  1,
  written.at,
  written.at
FROM "tickets" t
LEFT JOIN LATERAL (
  SELECT e."actor_id", e."created_at"
  FROM "activity_events" e
  WHERE e."ticket_id" = t."id" AND e."actor_id" IS NOT NULL AND e."type" = 'sharing_rejected'
  ORDER BY e."id" DESC
  LIMIT 1
) latest ON TRUE
CROSS JOIN LATERAL (
  SELECT
    COALESCE(
      latest."actor_id",
      t."assignee_id",
      (SELECT u."id" FROM "users" u WHERE u."kind" = 'team' AND u."is_admin" ORDER BY u."created_at", u."id" LIMIT 1),
      t."requester_id"
    ) AS author_id,
    COALESCE(latest."created_at", t."updated_at") AS at
) written
WHERE t."sharing_refusal_reason" IS NOT NULL;
