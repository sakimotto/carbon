-- Add period column to trainingCompletion for recurring training tracking
ALTER TABLE "trainingCompletion" ADD COLUMN "period" TEXT;

CREATE INDEX "trainingCompletion_period_idx" ON "trainingCompletion" ("period");

-- Prevent duplicate completions for same employee/assignment/period
CREATE UNIQUE INDEX "trainingCompletion_unique_period_idx"
ON "trainingCompletion" ("trainingAssignmentId", "employeeId", "period")
WHERE "period" IS NOT NULL;

-- For 'Once' trainings, only one completion per employee/assignment
CREATE UNIQUE INDEX "trainingCompletion_unique_once_idx"
ON "trainingCompletion" ("trainingAssignmentId", "employeeId")
WHERE "period" IS NULL;

-- Get current period for a frequency
CREATE OR REPLACE FUNCTION get_current_training_period(frequency "trainingFrequency")
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  CASE frequency
    WHEN 'Once' THEN RETURN NULL;
    WHEN 'Quarterly' THEN RETURN 'Q' || CEIL(EXTRACT(MONTH FROM CURRENT_DATE)::numeric / 3) || '-' || EXTRACT(YEAR FROM CURRENT_DATE);
    WHEN 'Annual' THEN RETURN EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  END CASE;
END;
$$;

-- Get period start date
CREATE OR REPLACE FUNCTION get_period_start_date(period TEXT)
RETURNS DATE LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  year_part INTEGER;
  quarter_part INTEGER;
BEGIN
  IF period IS NULL THEN RETURN NULL; END IF;
  IF position('Q' in period) > 0 THEN
    quarter_part := SUBSTRING(period FROM 2 FOR 1)::INTEGER;
    year_part := SUBSTRING(period FROM 4)::INTEGER;
    RETURN make_date(year_part, (quarter_part - 1) * 3 + 1, 1);
  ELSE
    RETURN make_date(period::INTEGER, 1, 1);
  END IF;
END;
$$;

-- Get period end date
CREATE OR REPLACE FUNCTION get_period_end_date(period TEXT)
RETURNS DATE LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  year_part INTEGER;
  quarter_part INTEGER;
BEGIN
  IF period IS NULL THEN RETURN NULL; END IF;
  IF position('Q' in period) > 0 THEN
    quarter_part := SUBSTRING(period FROM 2 FOR 1)::INTEGER;
    year_part := SUBSTRING(period FROM 4)::INTEGER;
    RETURN (make_date(year_part, quarter_part * 3, 1) + interval '1 month - 1 day')::DATE;
  ELSE
    RETURN make_date(period::INTEGER, 12, 31);
  END IF;
END;
$$;

-- Check if employee requires a period based on start date
CREATE OR REPLACE FUNCTION employee_requires_period(employee_start_date DATE, period TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  IF period IS NULL THEN RETURN TRUE; END IF;
  IF employee_start_date IS NULL THEN RETURN TRUE; END IF;
  -- Required if started before period ends
  RETURN employee_start_date <= get_period_end_date(period);
END;
$$;

-- View for training assignment status
CREATE OR REPLACE VIEW "trainingAssignmentStatus" WITH(SECURITY_INVOKER=true) AS
WITH assigned_employees AS (
  SELECT DISTINCT
    ta.id AS "trainingAssignmentId",
    ta."trainingId",
    t."name" AS "trainingName",
    t."frequency",
    t."type",
    u.id AS "employeeId",
    u."fullName" AS "employeeName",
    u."avatarUrl",
    ej."startDate" AS "employeeStartDate",
    ta."companyId"
  FROM "trainingAssignment" ta
  JOIN "training" t ON t.id = ta."trainingId" AND t."status" = 'Active'
  CROSS JOIN LATERAL (
    SELECT DISTINCT m."memberUserId" AS user_id
    FROM "membership" m
    WHERE m."groupId" = ANY(ta."groupIds") AND m."memberUserId" IS NOT NULL
  ) group_members
  JOIN "user" u ON u.id = group_members.user_id AND u.active = TRUE
  JOIN "employee" e ON e.id = u.id AND e."companyId" = ta."companyId"
  LEFT JOIN "employeeJob" ej ON ej.id = u.id AND ej."companyId" = ta."companyId"
),
with_period AS (
  SELECT *, get_current_training_period("frequency") AS "currentPeriod"
  FROM assigned_employees
)
SELECT
  wp.*,
  tc.id AS "completionId",
  tc."completedAt",
  CASE
    WHEN wp."frequency" = 'Once' THEN
      CASE WHEN tc.id IS NOT NULL THEN 'Completed' ELSE 'Pending' END
    WHEN tc.id IS NOT NULL THEN 'Completed'
    WHEN NOT employee_requires_period(wp."employeeStartDate", wp."currentPeriod") THEN 'Not Required'
    WHEN get_period_end_date(wp."currentPeriod") < CURRENT_DATE THEN 'Overdue'
    ELSE 'Pending'
  END AS "status"
FROM with_period wp
LEFT JOIN "trainingCompletion" tc ON
  tc."trainingAssignmentId" = wp."trainingAssignmentId"
  AND tc."employeeId" = wp."employeeId"
  AND ((wp."frequency" = 'Once' AND tc."period" IS NULL) OR tc."period" = wp."currentPeriod");

-- Function to get training assignment summary
CREATE OR REPLACE FUNCTION get_training_assignment_summary(company_id TEXT)
RETURNS TABLE (
  "trainingId" TEXT,
  "trainingName" TEXT,
  "frequency" "trainingFrequency",
  "currentPeriod" TEXT,
  "totalAssigned" BIGINT,
  "completed" BIGINT,
  "pending" BIGINT,
  "overdue" BIGINT,
  "completionPercent" NUMERIC
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    tas."trainingId",
    tas."trainingName",
    tas."frequency",
    tas."currentPeriod",
    COUNT(*) FILTER (WHERE tas."status" != 'Not Required'),
    COUNT(*) FILTER (WHERE tas."status" = 'Completed'),
    COUNT(*) FILTER (WHERE tas."status" = 'Pending'),
    COUNT(*) FILTER (WHERE tas."status" = 'Overdue'),
    CASE
      WHEN COUNT(*) FILTER (WHERE tas."status" != 'Not Required') = 0 THEN 100
      ELSE ROUND(COUNT(*) FILTER (WHERE tas."status" = 'Completed')::NUMERIC * 100 /
           NULLIF(COUNT(*) FILTER (WHERE tas."status" != 'Not Required'), 0), 1)
    END
  FROM "trainingAssignmentStatus" tas
  WHERE tas."companyId" = company_id
  GROUP BY tas."trainingId", tas."trainingName", tas."frequency", tas."currentPeriod";
END;
$$;
