-- Add delivery coordinates to orders table for precise delivery location tracking
-- These fields store the exact location chosen by the customer (via GPS, map pin, or search)
-- and are used by riders for navigation and by the system for vendor matching.

ALTER TABLE orders 
  ADD COLUMN delivery_lat NUMERIC(10, 7),
  ADD COLUMN delivery_lng NUMERIC(10, 7);

COMMENT ON COLUMN orders.delivery_lat IS 'Delivery latitude coordinate (customer-chosen location)';
COMMENT ON COLUMN orders.delivery_lng IS 'Delivery longitude coordinate (customer-chosen location)';

-- Add index for efficient spatial queries (e.g., finding orders near a rider)
CREATE INDEX idx_orders_delivery_coords ON orders (delivery_lat, delivery_lng);
