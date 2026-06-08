-- FreshTrack initial schema
CREATE DATABASE IF NOT EXISTS `{{DB_NAME}}`;
USE `{{DB_NAME}}`;

CREATE TABLE IF NOT EXISTS stores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  shopify_domain VARCHAR(255) NOT NULL UNIQUE,
  access_token VARCHAR(255) NOT NULL,
  shop_name VARCHAR(255),
  email VARCHAR(255),
  installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS products (
  id INT AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL,
  shopify_product_id BIGINT,
  title VARCHAR(255) NOT NULL,
  category ENUM('green_tea', 'black_tea', 'oolong', 'white_tea', 'puerh', 'herbal', 'matcha', 'other') DEFAULT 'other',
  default_shelf_life_days INT DEFAULT 180,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  INDEX idx_products_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  product_id INT NOT NULL,
  lot_number VARCHAR(100) NOT NULL,
  quantity INT NOT NULL DEFAULT 0,
  quantity_sold INT NOT NULL DEFAULT 0,
  manufactured_at DATE NOT NULL,
  expires_at DATE NOT NULL,
  freshness_score DECIMAL(5,2) DEFAULT 100.00,
  status ENUM('active', 'warning', 'critical', 'expired', 'sold_out') DEFAULT 'active',
  supplier VARCHAR(255),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
  INDEX idx_batches_product (product_id),
  INDEX idx_batches_status (status),
  INDEX idx_batches_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS alert_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  threshold_score DECIMAL(5,2) NOT NULL,
  action_type ENUM('discount', 'email', 'webhook') NOT NULL,
  action_config JSON,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  INDEX idx_alert_rules_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  store_id INT NOT NULL,
  batch_id INT,
  action ENUM('batch_created', 'batch_updated', 'score_updated', 'alert_triggered', 'discount_applied', 'batch_expired', 'batch_sold_out', 'rule_created', 'rule_updated', 'rule_deleted') NOT NULL,
  description TEXT,
  metadata JSON,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
  FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE SET NULL,
  INDEX idx_logs_store (store_id),
  INDEX idx_logs_batch (batch_id),
  INDEX idx_logs_action (action),
  INDEX idx_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
