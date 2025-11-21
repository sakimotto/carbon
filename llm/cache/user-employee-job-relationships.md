# User and EmployeeJob Relationships

## Overview

The Carbon system manages employee data through interconnected tables: `user`, `employee`, and `employeeJob`. Here's how to retrieve a user's full name from their user ID and understand employee relationships.

## Table Structure

### user table
Located at: `packages/database/src/types.ts`

Primary fields for names:
```typescript
{
  id: string (UUID, matches Supabase auth.users.id)
  email: string
  firstName: string
  lastName: string
  fullName: string | null
  avatarUrl: string | null
  active: boolean | null
  // ... other fields
}
```

### employee table
Links users to companies:
```typescript
{
  id: string (FK to user.id)
  employeeTypeId: string
  companyId: string
  active: boolean
}
```

### employeeJob table
Stores job-specific information for employees:
```typescript
{
  id: string (FK to user.id, matches employee.id)
  companyId: string (FK to company.id)
  departmentId: string | null (FK to department.id)
  locationId: string | null (FK to location.id)
  managerId: string | null (FK to user.id for manager)
  shiftId: string | null (FK to shift.id)
  title: string | null
  startDate: string | null
  tags: string[] | null
  customFields: Json | null
  updatedAt: string | null
  updatedBy: string | null
}
```

## Getting User Full Name from User ID

### Direct Query (Simplest)
```typescript
import type { SupabaseClient, Database } from "@carbon/database";

// Get user by ID - will have firstName, lastName, and fullName
const { data: user, error } = await client
  .from("user")
  .select("id, email, firstName, lastName, fullName")
  .eq("id", userId)
  .single();

// fullName is the preferred field (can be null)
// Fallback pattern: user.fullName || `${user.firstName} ${user.lastName}`
```

### From Auth Context
If you have the current user session:
```typescript
import { getCarbon, requirePermissions } from "@carbon/auth";

const { user } = await requirePermissions(request, {
  view: "module",
});

// user.fullName directly available
console.log(user.fullName); // e.g., "John Doe" or null
```

## Employee Join Patterns

### employees View
A pre-built view that joins user and employee tables efficiently.

**Location**: Created in migration `20241208004151_invites.sql`

**Definition**:
```sql
SELECT
  u.id,
  u."email",
  u."firstName",
  u."lastName",
  u."fullName" AS "name",
  u."avatarUrl",
  e."employeeTypeId",
  e."companyId",
  e."active"
FROM "user" u
INNER JOIN "employee" e ON e.id = u.id
WHERE u.active = TRUE
```

**Usage**:
```typescript
// Get employees with names
const { data: employees } = await client
  .from("employees")
  .select("id, name, firstName, lastName, email, employeeTypeId, active")
  .eq("companyId", companyId);
```

### employeeSummary View (Recommended for Full Context)
A comprehensive view that includes job information.

**Location**: Created in migration `20240103010721_employee-summary.sql`

**Definition**:
```sql
SELECT
  u.id,
  u."fullName" AS "name",
  u."avatarUrl",
  e."companyId",
  ej.title,
  ej."startDate",
  d.name AS "departmentName",
  l.name AS "locationName",
  m."fullName" AS "managerName"
FROM "employee" e
INNER JOIN "user" u ON u.id = e.id
LEFT JOIN "employeeJob" ej ON e.id = ej.id AND e."companyId" = ej."companyId"
LEFT OUTER JOIN "location" l ON l.id = ej."locationId"
LEFT OUTER JOIN "user" m ON m.id = ej."managerId"
LEFT OUTER JOIN "department" d ON d.id = ej."departmentId"
```

**Usage**:
```typescript
// Get complete employee summary with job details
const { data: employeeSummary } = await client
  .from("employeeSummary")
  .select("*")
  .eq("id", employeeId)
  .eq("companyId", companyId)
  .single();

// Returns: {
//   id, name (fullName), avatarUrl, companyId,
//   title, startDate, departmentName, locationName, managerName
// }
```

### employeesAcrossCompanies View
For getting employees that exist across multiple companies.

**Definition**:
```sql
SELECT
  u.id,
  u.email,
  u."firstName",
  u."lastName",
  u."fullName" AS "name",
  u."avatarUrl",
  u.active,
  array_agg(e."companyId") as "companyId"
FROM "user" u
INNER JOIN "employee" e ON e.id = u.id
WHERE u.active = TRUE
GROUP BY u.id, u.email, u."firstName", u."lastName", u."fullName", u."avatarUrl", u.active
```

## How to Get Employee Names in Different Contexts

### From Service Patterns
Used in `apps/erp/app/modules/users/users.service.ts`:

```typescript
export async function getEmployees(
  client: SupabaseClient<Database>,
  companyId: string,
  args: GenericQueryFilters & { search: string | null }
) {
  let query = client
    .from("employees")
    .select("*", { count: "exact" })
    .eq("companyId", companyId);

  if (args.search) {
    query = query.ilike("name", `%${args.search}%`);
  }
  // ...
  return query;
}
```

### From People Service
When getting employee job information:

```typescript
import { getEmployees } from "~/modules/users/users.service";

// Get employee with job details
const { data: employeeJob } = await client
  .from("employeeJob")
  .select("*")
  .eq("id", employeeId)
  .eq("companyId", companyId)
  .single();

// To get the employee's full name:
const { data: employee } = await client
  .from("employees")
  .select("id, name, firstName, lastName")
  .eq("id", employeeId)
  .eq("companyId", companyId)
  .single();
```

## Key Foreign Key Relationships

1. **employeeJob.id** -> **user.id**: The employee's record (one-to-one per company)
2. **employeeJob.managerId** -> **user.id**: The manager's ID (can be null)
3. **employee.id** -> **user.id**: Links employee role to user
4. **user.id**: The primary identifier used across all these tables

## Performance Considerations

- **employeeSummary view** is ideal when you need employee name + job context
- Use the **employees view** for simple employee lists with names
- For just user names, query the **user table** directly with the ID
- Manager names are already joined in **employeeSummary** (use `managerName` field)

## Type Definitions

### Employee Type (from users.service.ts)
```typescript
type Employee = NonNullable<
  Awaited<ReturnType<typeof getEmployees>>["data"]
>[number];
```

### User Type (from authentication-system.md)
```typescript
{
  id: string
  email: string
  firstName: string
  lastName: string
  fullName: string | null
  about: string
  avatarUrl: string | null
  active: boolean | null
  admin: boolean | null
  developer: boolean | null
  createdAt: string
  updatedAt: string | null
}
```
