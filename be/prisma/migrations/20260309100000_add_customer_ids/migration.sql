-- Add stripe_customer_id and paypal_customer_id if not exists
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `stripe_customer_id` VARCHAR(255) NULL,
ADD COLUMN IF NOT EXISTS `paypal_customer_id` VARCHAR(255) NULL;

-- Add unique indexes if not exists
CREATE UNIQUE INDEX IF NOT EXISTS `users_stripe_customer_id_key` ON `users`(`stripe_customer_id`);
CREATE UNIQUE INDEX IF NOT EXISTS `users_paypal_customer_id_key` ON `users`(`paypal_customer_id`);
