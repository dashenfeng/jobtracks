-- AlterTable
ALTER TABLE "Snapshot" ADD COLUMN     "contentLength" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "Snapshot_userId_project_idx" ON "Snapshot"("userId", "project");
