-- one application per student per post (service layer already checks this,
-- this just closes the race condition)

ALTER TABLE "Application"
  ADD CONSTRAINT "Application_studentId_postId_key" UNIQUE ("studentId", "postId");
