-- Nullable: existing products have an unknown price, not a zero price.
ALTER TABLE `products` ADD COLUMN `price` DECIMAL(12, 0) NULL;
