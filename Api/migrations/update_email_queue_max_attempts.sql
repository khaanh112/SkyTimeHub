-- Update email_queue max_attempts default value from 3 to 5
-- This provides more retry opportunities for transient errors like timeouts

-- Update the default value for future records
ALTER TABLE email_queue 
ALTER COLUMN max_attempts SET DEFAULT 5;

-- Optionally update existing PENDING/PROCESSING emails that haven't reached max attempts yet
-- This gives existing pending emails more retry chances
UPDATE email_queue 
SET max_attempts = 5 
WHERE status IN ('pending', 'processing') 
  AND max_attempts < 5;

-- Report the changes
SELECT 
  status,
  max_attempts,
  COUNT(*) as count
FROM email_queue
GROUP BY status, max_attempts
ORDER BY status, max_attempts;
