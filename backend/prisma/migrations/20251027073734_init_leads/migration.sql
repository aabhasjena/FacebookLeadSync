-- CreateTable
CREATE TABLE `fblead` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `leadId` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NULL,
    `formId` VARCHAR(191) NULL,
    `createdTime` DATETIME(3) NULL,
    `fetchedAt` DATETIME(3) NULL,
    `data` JSON NOT NULL,
    `raw` JSON NULL,
    `insertedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `fblead_leadId_key`(`leadId`),
    INDEX `fblead_pageId_idx`(`pageId`),
    INDEX `fblead_formId_idx`(`formId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
