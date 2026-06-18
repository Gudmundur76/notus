ALTER TABLE `file_snapshots` MODIFY COLUMN `r2_key` varchar(512) NOT NULL;--> statement-breakpoint
ALTER TABLE `files` MODIFY COLUMN `path` varchar(1024) NOT NULL;--> statement-breakpoint
ALTER TABLE `workspaces` MODIFY COLUMN `root_path` varchar(512) NOT NULL DEFAULT '/';