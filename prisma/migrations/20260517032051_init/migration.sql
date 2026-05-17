-- CreateTable
CREATE TABLE "music_libraries" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "coverPath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "tracks" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "libraryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "artist" TEXT,
    "album" TEXT,
    "duration" REAL,
    "path" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 0,
    "modified" REAL,
    "isEncrypted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "tracks_libraryId_fkey" FOREIGN KEY ("libraryId") REFERENCES "music_libraries" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "music_libraries_name_key" ON "music_libraries"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tracks_path_key" ON "tracks"("path");

-- CreateIndex
CREATE INDEX "tracks_libraryId_idx" ON "tracks"("libraryId");
