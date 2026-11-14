-- AlterTable
ALTER TABLE `notifications` ADD COLUMN `personnelRequestId` INTEGER NULL,
    MODIFY `type` ENUM('TASK_ASSIGNED', 'TASK_UPDATED', 'TASK_SUBMITTED', 'TASK_CHANGES_REQUESTED', 'TASK_APPROVED', 'TASK_CANCELLED', 'TASK_COMMENTED', 'TASK_DUE_SOON', 'TASK_OVERDUE', 'SYSTEM', 'PERSONNEL_REQUEST_CREATED', 'PERSONNEL_REQUEST_REPLIED') NOT NULL;

-- CreateTable
CREATE TABLE `personnel_requests` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `senderId` INTEGER NOT NULL,
    `senderRole` ENUM('USER', 'ADMIN', 'SUPER_ADMIN') NOT NULL,
    `body` TEXT NOT NULL,
    `submissionKey` VARCHAR(64) NOT NULL,

    UNIQUE INDEX `personnel_requests_submissionKey_key`(`submissionKey`),
    INDEX `personnel_requests_senderId_createdAt_id_idx`(`senderId`, `createdAt`, `id`),
    INDEX `personnel_requests_createdAt_id_idx`(`createdAt`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `personnel_request_recipients` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `requestId` INTEGER NOT NULL,
    `recipientId` INTEGER NOT NULL,
    `readAt` DATETIME(3) NULL,

    INDEX `personnel_request_recipients_recipientId_createdAt_id_idx`(`recipientId`, `createdAt`, `id`),
    INDEX `personnel_request_recipients_recipientId_readAt_createdAt_idx`(`recipientId`, `readAt`, `createdAt`),
    UNIQUE INDEX `personnel_request_recipients_requestId_recipientId_key`(`requestId`, `recipientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `personnel_request_replies` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `requestId` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `body` TEXT NOT NULL,
    `submissionKey` VARCHAR(64) NOT NULL,

    UNIQUE INDEX `personnel_request_replies_submissionKey_key`(`submissionKey`),
    INDEX `personnel_request_replies_requestId_createdAt_id_idx`(`requestId`, `createdAt`, `id`),
    INDEX `personnel_request_replies_authorId_createdAt_idx`(`authorId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `notifications_personnelRequestId_idx` ON `notifications`(`personnelRequestId`);

-- AddForeignKey
ALTER TABLE `notifications` ADD CONSTRAINT `notifications_personnelRequestId_fkey` FOREIGN KEY (`personnelRequestId`) REFERENCES `personnel_requests`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `personnel_requests` ADD CONSTRAINT `personnel_requests_senderId_fkey` FOREIGN KEY (`senderId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `personnel_request_recipients` ADD CONSTRAINT `personnel_request_recipients_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `personnel_requests`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `personnel_request_recipients` ADD CONSTRAINT `personnel_request_recipients_recipientId_fkey` FOREIGN KEY (`recipientId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `personnel_request_replies` ADD CONSTRAINT `personnel_request_replies_requestId_fkey` FOREIGN KEY (`requestId`) REFERENCES `personnel_requests`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE `personnel_request_replies` ADD CONSTRAINT `personnel_request_replies_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;
