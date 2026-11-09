-- S1-12 Q13: the rejection reason becomes a public comment. Copy every stored reason before the
-- next migration drops the column, so nothing is lost (§17.2, "Migrations"). S1-06 kept a reason
-- only while the ticket is rejected, so earlier reasons were never stored.
--
-- The author and the time are those of the latest event that set the reason – a status change
-- into `rejected` or a new reason – and the ID is a UUIDv7 of that time, so the comment takes its
-- place in the time-ordered timeline. A migration runs unattended during `./trybun update` and
-- never aborts: without such an event (seeded data), the author is the assignee, else the earliest
-- Administrator, else the requester, and the time is the ticket's last update. The audience is the
-- current visibility; the visibility at the time of the rejection was not recorded.
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
  t."rejection_reason",
  1,
  written.at,
  written.at
FROM "tickets" t
LEFT JOIN LATERAL (
  SELECT e."actor_id", e."created_at"
  FROM "activity_events" e
  WHERE e."ticket_id" = t."id"
    AND e."actor_id" IS NOT NULL
    AND (
      (e."type" = 'status_changed' AND e."data" ->> 'to' = 'rejected')
      OR e."type" = 'rejection_reason_changed'
    )
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
WHERE t."rejection_reason" IS NOT NULL;
