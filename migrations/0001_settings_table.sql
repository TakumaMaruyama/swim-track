-- Create settings table
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR PRIMARY KEY,
  value VARCHAR NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert initial general password
INSERT INTO settings (key, value) VALUES ('general_password', 'swimtrack2024')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
