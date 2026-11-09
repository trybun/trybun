-- S1-13: the sorts of the ticket list and its predefined views (§8.1, Q8, Q20). A b-tree is read
-- backwards for the default sort, priority descending, then the last update and the ID descending.

-- CreateIndex
CREATE INDEX "tickets_priority_updated_at_id_idx" ON "tickets"("priority", "updated_at", "id");

-- CreateIndex
CREATE INDEX "tickets_status_created_at_idx" ON "tickets"("status", "created_at");

-- CreateIndex
CREATE INDEX "tickets_updated_at_id_idx" ON "tickets"("updated_at", "id");
