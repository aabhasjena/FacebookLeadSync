-- CreateTable
CREATE TABLE `PageCredential` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pageId` VARCHAR(191) NOT NULL,
    `pageToken` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PageCredential_pageId_key`(`pageId`),
    INDEX `PageCredential_pageId_idx`(`pageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PageForm` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `formId` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `lastSeen` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PageForm_formId_key`(`formId`),
    INDEX `PageForm_pageId_idx`(`pageId`),
    INDEX `PageForm_formId_idx`(`formId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `PageForm` ADD CONSTRAINT `PageForm_pageId_fkey` FOREIGN KEY (`pageId`) REFERENCES `PageCredential`(`pageId`) ON DELETE RESTRICT ON UPDATE CASCADE;
