# Linear Integration

## Overview

The Linear integration allows Carbon to sync Quality Management issues (non-conformances) with Linear issues. It provides two-way synchronization between Carbon action tasks and Linear issues.

## Architecture

### Integration Setup

**Database:**
- Integration registered in `integration` table with ID `"linear"`
- Configuration stored in `companyIntegration` table per company
- Required metadata: `{ apiKey: string }`

**Configuration File:** `/packages/ee/src/linear/config.tsx`
- Integration name: "Linear"
- Category: "Project Management"
- Settings: API Key (required)
- Setup includes webhook URL generation for webhooks

**Migration:** `/packages/database/supabase/migrations/20251127091215_add_linear_integration.sql`

### Key Components

#### 1. Linear Client (`/packages/ee/src/linear/lib/client.ts`)

GraphQL API client for Linear that provides:
- `listTeams()` - Get all Linear teams
- `listIssues(input)` - Search issues by title
- `getIssueById(issueId)` - Fetch specific issue with full details
- `createIssue(data)` - Create new Linear issue
- `updateIssue(data)` - Update issue title, description, assignee, state
- `listTeamMembers(teamId)` - Get team member list
- `getUsers(filter)` - Search users by email or ID
- `createAttachmentLink(input)` - Add attachment/link to issue
- `getWorkflowState(type)` - Get workflow state by type

**Authentication:**
- Uses API key from `companyIntegration.metadata.apiKey`
- Retrieved via `getLinearIntegration()` service function

#### 2. Service Layer (`/packages/ee/src/linear/lib/service.ts`)

**Data Types:**
```typescript
LinearIssueSchema = {
  id: string,
  title: string,
  description: string,
  url: string,
  state: {
    name: string,
    color: string,
    type: LinearWorkStateType
  },
  identifier: string,
  dueDate: string | null,
  assignee: { email: string } | null
}
```

**Functions:**
- `linkActionToLinearIssue()` - Links Carbon action task to Linear issue
  - Stores Linear issue data in `externalId.linear` JSON field
  - Updates assignee if Linear assignee matches Carbon employee
  - Syncs status and due date
  - Returns `nonConformanceId` for creating backlink

- `unlinkActionFromLinearIssue()` - Removes link by clearing `externalId.linear`

- `getLinearIssueFromExternalId()` - Retrieves Linear issue data from action task

- `getCompanyEmployees()` - Finds Carbon employees by email addresses

#### 3. Status Mapping (`/packages/ee/src/linear/lib/utils.ts`)

**Linear State Types:**
- `triage`, `backlog`, `todo`, `unstarted` → Carbon "Pending"
- `started` → Carbon "In Progress"
- `completed` → Carbon "Completed"
- `canceled` → Carbon "Skipped"

**Reverse Mapping (Carbon → Linear):**
- "Pending" → `unstarted`
- "In Progress" → `started`
- "Completed" → `completed`
- "Skipped" → `canceled`

### Integration Points

#### A. Carbon to Linear (Outbound)

**1. Link Existing Issue**
Route: `/api/integrations.linear.issue.link`
- POST: Links Carbon action task to existing Linear issue
  - Fetches Linear issue by ID
  - Maps Linear assignee to Carbon user (by email)
  - Stores issue data in `nonConformanceActionTask.externalId.linear`
  - Creates attachment link back to Carbon issue
- DELETE: Unlinks by clearing `externalId.linear`
- GET: Search Linear issues by title query

**2. Create New Issue**
Route: `/api/integrations.linear.issue.create`
- POST: Creates new Linear issue and links to Carbon action
  - Requires: teamId, title, description, assigneeId (optional)
  - Creates issue in Linear
  - Links to Carbon action task
  - Creates attachment link back to Carbon
- GET: Lists Linear teams, optionally filters team members by Carbon employees

**3. Notification Service** (`/packages/ee/src/notifications/services/linear.ts`)

Listens for Carbon events and updates Linear:

**Event: `task.status.changed`**
- Only processes action/investigation tasks
- Gets linked Linear issue from `externalId`
- Maps Carbon status to Linear workflow state
- Updates Linear issue state via API

**Event: `task.assigned`**
- Only processes `nonConformanceActionTask` table
- Gets linked Linear issue
- Finds Linear user by Carbon employee email
- Updates Linear issue assignee

#### B. Linear to Carbon (Inbound)

**Webhook Route:** `/api/webhook/linear/:companyId`
- Receives Linear webhook events
- Validates company and integration are active
- Parses event using `syncIssueFromLinearSchema`
- Triggers Trigger.dev task for async processing

**Trigger.dev Task:** `/packages/jobs/trigger/linear.ts`

`syncIssueFromLinear` task:
- Accepts event type: `Issue` with action: `update`
- Finds linked Carbon action by `externalId->linear->>id`
- Maps Linear assignee to Carbon employee (by email)
- Updates Carbon action task with:
  - Latest Linear issue state (title, description, state, url)
  - Mapped status from Linear state type
  - Assignee from Linear (if employee exists)
  - Due date from Linear
- Returns success/failure message

**Event Schema:**
```typescript
{
  companyId: string,
  event: {
    type: "Issue",
    action: "update",
    data: {
      id: string,
      title: string,
      description: string,
      url: string,
      state: { name, color, type },
      identifier: string,
      assigneeId?: string
    }
  }
}
```

### Data Flow

#### Linking Flow (Carbon → Linear)
1. User selects Linear issue or creates new one in Carbon UI
2. Carbon fetches issue details from Linear API
3. Carbon stores issue in `nonConformanceActionTask.externalId.linear`
4. Carbon syncs assignee (if Linear assignee email matches Carbon employee)
5. Carbon creates attachment link in Linear pointing back to Carbon issue

#### Webhook Flow (Linear → Carbon)
1. User updates issue in Linear (status, assignee, title, etc.)
2. Linear sends webhook to `/api/webhook/linear/:companyId`
3. Carbon validates and triggers Trigger.dev task
4. Task finds linked Carbon action by Linear issue ID
5. Task updates Carbon action with Linear changes
6. Assignee synced if Linear user email matches Carbon employee

#### Notification Flow (Carbon → Linear)
1. User changes task status or assignee in Carbon
2. Carbon notification pipeline detects change
3. If Linear integration is active, notification service triggers
4. Service finds linked Linear issue from `externalId`
5. Service updates Linear issue via API

### Database Schema

**Storage of Link:**
```sql
-- nonConformanceActionTask table
externalId JSONB
  Contains: {
    linear: {
      id: string,
      title: string,
      description: string,
      url: string,
      state: { name, color, type },
      identifier: string,
      dueDate: string | null,
      assignee: { email: string } | null
    }
  }
```

**Querying Linked Issues:**
```typescript
// Find action by Linear issue ID
.eq("externalId->linear->>id", linearIssueId)

// Check if action has Linear link
.not("externalId->linear", "is", null)
```

### UI Components

Located in `/apps/erp/app/modules/quality/ui/Issue/Linear/`:
- `LinkIssue.tsx` - Component to search and link existing Linear issues
- `CreateIssue.tsx` - Form to create new Linear issue
- `IssueDialog.tsx` - Modal containing link/create options

Display in `/apps/erp/app/modules/quality/ui/Issue/IssueTask.tsx`:
- Shows Linear badge with issue identifier
- Links to Linear issue URL
- Displays on action tasks with `externalId.linear` data

### Notification Pipeline

**Registry:** `/packages/ee/src/notifications/index.ts`
- Registers `LinearNotificationService` on initialization
- Service ID: `"linear"`

**Pipeline:** `/packages/ee/src/notifications/pipeline.ts`
- `NotificationPipeline` class sends events to active integrations
- Filters integrations by `active: true` and notification service type
- Sends events in parallel to all active services

**Supported Events:**
1. `issue.created` - (Slack only currently)
2. `issue.status.changed` - (Slack only currently)
3. `task.status.changed` - Slack + **Linear** (updates issue state)
4. `task.assigned` - Slack + **Linear** (updates issue assignee)

### Setup Instructions (for users)

1. Login to Linear account
2. Navigate to Settings → Webhooks
3. Create new webhook with URL: `https://app.carbon.ms/api/webhook/linear/{companyId}`
4. Go to Settings → Security and access → API
5. Generate new API key
6. In Carbon, go to Settings → Integrations → Linear
7. Paste API key
8. Save integration

### Important Notes

- Only **action tasks** can be linked to Linear issues (not investigation or approval tasks)
- Assignee sync requires matching email between Linear user and Carbon employee
- Two-way sync means changes in either system update the other
- Linear issue data is cached in Carbon's `externalId` field as JSON
- Attachment links in Linear point back to Carbon issue details page
- Webhook processes updates asynchronously via Trigger.dev
- Integration must be active (`companyIntegration.active = true`) for notifications to flow

### Key Files Reference

**Packages:**
- `/packages/ee/src/linear/config.tsx` - Integration config
- `/packages/ee/src/linear/lib/client.ts` - GraphQL API client
- `/packages/ee/src/linear/lib/service.ts` - Business logic
- `/packages/ee/src/linear/lib/utils.ts` - Status mapping
- `/packages/ee/src/notifications/services/linear.ts` - Notification handler
- `/packages/jobs/trigger/linear.ts` - Webhook handler task

**Routes:**
- `/apps/erp/app/routes/api+/webhook.linear.$companyId.ts` - Webhook endpoint
- `/apps/erp/app/routes/api+/integrations.linear.issue.link.ts` - Link/unlink API
- `/apps/erp/app/routes/api+/integrations.linear.issue.create.ts` - Create issue API

**UI:**
- `/apps/erp/app/modules/quality/ui/Issue/Linear/*.tsx` - Integration UI components
- `/apps/erp/app/modules/quality/ui/Issue/IssueTask.tsx` - Task display with Linear badge

**Database:**
- `/packages/database/supabase/migrations/20251127091215_add_linear_integration.sql` - Integration setup
