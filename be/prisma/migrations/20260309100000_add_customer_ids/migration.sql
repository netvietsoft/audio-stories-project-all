-- Add stripe_customer_id and paypal_customer_id
ALTER TABLE `users` 
ADD COLUMN `stripe_customer_id` VARCHAR(255) NULL,
ADD COLUMN `paypal_customer_id` VARCHAR(255) NULL;

-- Add unique indexes
CREATE UNIQUE INDEX `users_stripe_customer_id_key` ON `users`(`stripe_customer_id`);
CREATE UNIQUE INDEX `users_paypal_customer_id_key` ON `users`(`paypal_customer_id`);
