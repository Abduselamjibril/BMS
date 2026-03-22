-- Update contractor rating from existing feedback
UPDATE contractors c
SET rating = sub.avg_rating
FROM (
  SELECT wo."contractorId", AVG(mf.rating) as avg_rating
  FROM work_orders wo
  JOIN maintenance_feedback mf ON mf."requestId" = wo."requestId"
  GROUP BY wo."contractorId"
) sub
WHERE c.id = sub."contractorId";

-- Verify
SELECT id, name, rating FROM contractors;
