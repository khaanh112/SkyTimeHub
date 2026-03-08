-- Allow orphan attachments (uploaded before leave request is created)
ALTER TABLE leave_request_attachments
  ALTER COLUMN leave_request_id DROP NOT NULL;
