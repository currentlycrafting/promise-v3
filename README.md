# Promise

## Overview
Promise Tracker is a commitment accountability platform that enables users to make, track, and complete promises to themselves, others, or the world. The system social accountability mechanisms to help users achieve their goals.

---

## Core Concepts

### Promise Types

#### 1. **Promise to Self**
- **Definition**: Personal commitments visible only to the user (unless made public)
- **Completion**: Self-validated with optional broadcast to public feed
- **Notifications**: App-driven reminders as deadline approaches
- **Privacy**: Can be private or public. If private the global live feed will say Annoymous created a promise otherwise it'll be Salman created a promise to Khalid
- **Example**: "Salman will exercise 3 times per week for the next month"

#### 2. **Promise to Others**
- **Definition**: Commitments made to specific individuals (2-way)
- **Completion Requirements**:
  - **2-way**: Both creator and participant must accept completion
- **Notifications**: All participants notified + app reminders
- **Privacy**: Can be private or public. If private the global live feed will say Annoymous created a promise otherwise it'll be Salman created a promise to Khalid
- **Example**: "I will complete the project report with John and Sarah by Friday"

#### 3. **Promise to World**
- **Definition**: Public commitments to the global community
- **Completion**: Self-validated with automatic goal progression
- **Auto-Escalation**: Upon completion, system suggests a larger/more ambitious promise
- **Notifications**: App-driven + public broadcast
- **Privacy**: Can be private or public. If private the global live main feed will say Annoymous created a promise otherwise it'll be Salman created a promise to Khalid
- **Example**: "Salman will donate $1000 to charity this year"

---

## Key Features

### 1. Promise Creation
**Fields Required**:
- Promise content (text)
- Promise type (self/others/world)
- Deadline/timeline
- Privacy setting (public/private)
- Participants (for "others" type)

**Validation**:
- Must have at least one participant for "others" type
- Deadline must be in the future -> Minimum promise length:
- Self; 1 hr min
- Other: 1 hr
- World: 1 day 
- Maximum revision limit set at creation (default: 3)

### 2. Multi-Party Acceptance System

#### 2-Way
```
Completion Flow:
1. Creator marks promise as complete
2. System notifies all participants
3. Status updates based on unanimous agreement:
   - All YES → Promise marked COMPLETED
   - Any NO → Promise remains PENDING with feedback
```

### 3. Live Feed System

#### Global Feed (Main Page)
**Displays**:
- All public "world" promises (real-time)
- All Private world promises: "Anonymous User made a promise", "Anonymous User completed a promise"
- Completed public promises (any type and private promises)
- His/Hers: pronouns

**Feed Entry Types**:
```
- CREATED: "Anonymous user committed to running a marathon"
- COMPLETED: "Khalid completed his promise to meditate"
- REVISED: "Khalid's promise was refined after missing deadline"
- MILESTONE: "Anonymous user reached 50% of their goal"
- TERMINATED: "Anonymous user promise was terminated after 5 revision attempts"
```

**Filtering Options**:
- ONLY FOR USER PROFILE
- By promise type
- By completion status
- By time period

#### Personal Feed
- User's own promises
- Promises they're participating in
- Private promises (visible only to user)
- Revision history(TBD)

### 4.Promise Reframing

#### Trigger Event
When a promise is marked as "MISSED" (deadline passed without completion)

#### Reframing Flow
```
Step 1: WHY Analysis
├─ System asks: "Why did you miss this promise?"
├─ User provides detailed explanation

Step 2: Categorization
├─ Systems asks user to categorizes into failure type:
│   ├─ TIME_CONSTRAINT: "Not enough time"
│   ├─ RESOURCE_LIMITATION: "Lacked money/tools/support"
│   ├─ EXTERNAL_FACTORS: "Unexpected events"
│   ├─ MOTIVATION_LOSS: "Lost interest/drive"
│   ├─ UNCLEAR_GOALS: "Goal was too vague"
│   ├─ OVERCOMMITMENT: "Took on too much"
│   └─ SKILL_GAP: "Lacked necessary skills"
└─ LLM processes response

Step 3: Solution Generation
├─ System uses category-specific prompts
├─ LLM generates 3 distinct solutions:
│   ├─ Solution 1: Conservative (smaller scope)
│   ├─ Solution 2: Moderate (adjusted timeline/resources)
│   └─ Solution 3: Creative (alternative approach)
└─ Each solution includes:
    ├─ Revised promise text
    ├─ New deadline
    ├─ Why this approach works

Step 4: Selection & Update
├─ User reviews all 3 solutions
├─ Selects one 
├─ Promise update (overrides originla promise, old is updated but not completely replaced)
├─ Revision count incremented(not needed, but will be used as data for profile)
└─ TBD: no revisions for 2-way promises, failed 2-way promises are terminated. (original idea ; Participants notified (only for 2 way promises))
```

#### Example Reframing Session
```
Original Promise: "Salman will learn Spanish fluently in 3 months"
Missed: Yes (TIME_CONSTRAINT)

User's Reason: "Salman only studied 2 hours/week because of work"

LLM Category: TIME_CONSTRAINT

Generated Solutions:

Solution 1 (Conservative):
- Promise: "Salman will complete Duolingo Spanish Level 5 in 3 months"
- Rationale: Specific, measurable, requires 30 min/day
- Timeline: 90 days

Solution 2 (Moderate):
- Promise: "Salman will achieve B1 Spanish conversational level in 6 months"
- Rationale: Realistic timeline with work schedule
- Timeline: 180 days

Solution 3 (Creative):
- Promise: "Salman will have 30-minute Spanish conversations monthly for 6 months"
- Rationale: Focus on practical use, less pressure
- Timeline: 6 months
```

### 5. Notification System (TBD)

**For Promises to Self**:
```
- 7 days before deadline: "Your promise deadline is approaching"
- 1 day before deadline: "Final reminder: promise due tomorrow"
- On deadline: "Today is your promise deadline"
- 1 day after (missed): "You missed your promise. Let's reframe?"
```

**For Promises to Others**:
```
- Same as self notifications
- PLUS participant notifications:
  - When promise is created: "You've been added to a promise"
  - When user is requested for acceptance: "Khalid has added you to a promise, would you like to accept?"
  - "Salman has just accepted a promise with Khalid"
```

**For Promises to World**:
```
- Same as self notifications
- PLUS public announcements:
  - Creation: Broadcasted to main feed
  - Milestones: Public feed updates
  - Completion: Prominent main feed feature
  - Auto-escalation suggestion: "You completed X, now try Y!"
```

#### Notification Preferences (TBD)
Users can customize:
- Notification frequency (in settings)
- In-app channel
- Quiet hours
- Type-specific settings

### 6. Timer & Deadline Management

#### Timer Features
```
Promise Timer Components:
├─ Countdown Display
│   ├─ Days/Hours/Minutes remaining
│   ├─ Visual progress bar
│   └─ Percentage complete
└─ Deadline Actions
    ├─ Auto-mark as missed if deadline passes
    ├─ Grace period option (24-48 hours)
    └─ Trigger reframing flow
```

#### Deadline Adjustment
- Participants can propose deadline extensions
- Requires acceptance from all parties (same voting rules)
- Limited to 2 extensions per promise

### 7. Revision & Termination System

#### Revision Tracking
```
Each Promise has:
- revision_count: Current number of revisions
- max_revisions_allowed: Limit (default: 3, configurable)
- original_promise_id: Link to first version
- revision_history: Chain of all versions
```

#### Termination Rules
```
A promise is terminated if:
1. revision_count >= max_revisions_allowed
2. User explicitly terminates
3. All participants vote to terminate
4. 3 consecutive missed deadlines with no reframing

Termination Flow:
├─ Promise marked as TERMINATED
├─ All participants notified
├─ Feed entry created (if public)
├─ Analytics updated
└─ Reliability score impacted
```

#### Revision Best Practices
- First revision: Free pass, learn from experience
- Second revision: Warning shown about limit
- Third+ revision: Serious intervention, consider termination

### 8. Privacy & Visibility Controls

#### Privacy Levels
```
1. PRIVATE
   - Visible only to promise creator
   - No feed entries
   - No public analytics
   - Notifications only to creator

2. PARTICIPANTS_ONLY
   - Visible to all promise participants
   - No public feed entries
   - Participants can see each other
   - Notifications to all participants

3. PUBLIC
   - Visible on global feed
   - Included in analytics
   - Anonymous or attributed (user choice)
   - Full notification suite
```

#### User Controls
- Can change privacy level before completion
- Cannot make public promise private after others engage
- Can hide personal data while keeping promise visible

### 9. Analytics & Metrics

#### Personal Analytics (User Dashboard)
```
My Promise Stats:
├─ Total Promises: 47
├─ Completed: 32 (68%)
├─ Active: 8
├─ Missed/Revised: 7 (15%)
├─ Terminated: 0
├─ Reliability Score: 82/100
├─ Average Completion Time: 21 days
└─ Streak: 14 consecutive completions
```

#### Global Analytics (Public)
```
Platform-Wide Stats:
├─ Total Promises Made: 1,234,567
├─ Promises Kept: 834,123 (67.5%)
├─ Active Users: 45,678
├─ Promises Created Today: 1,234
└─ Average Time to Completion: 28 days
```

#### Reliability Score Calculation
```
Reliability Score Formula:
= (Completed Promises × 10) 
  - (Missed Promises × 5)
  - (Terminated Promises × 15)
  + (Streak Bonus × 2)
  / Total Promises

Factors:
- Completion: +10 points each
- On-time completion: +2 bonus
- Revision needed: -2 points
- Missed deadline: -5 points
- Termination: -15 points
- Consecutive completions: +2 per streak
```

---

## Technical Implementation Details

### Database Schema Highlights

#### Promise Status State Machine
```
CREATED → ACTIVE → PENDING_ACCEPTANCE → COMPLETED
            ↓              ↓
          MISSED → REFRAMING → REVISED (back to ACTIVE)
            ↓
        TERMINATED
```

#### Reframing System Tables
```
REFRAMING_SESSIONS:
- Stores entire conversation with LLM
- Links to failure category
- Tracks session status

FAILURE_CATEGORIES:
- Predefined categories with descriptions
- Custom LLM prompts per category
- Usage analytics for improvement

REFRAMING_SOLUTIONS:
- 3 solutions per session
- Tracks which was selected
- Can create new promise from solution
```

### API Endpoints (High-Level)

#### Promise Management
```
POST   /api/promises                    # Create promise
GET    /api/promises/:id                # Get promise details
PUT    /api/promises/:id                # Update promise
DELETE /api/promises/:id                # Terminate promise
POST   /api/promises/:id/complete       # Mark as complete
GET    /api/promises/user/:userId       # Get user's promises
```

#### Reframing
```
POST   /api/reframing/start             # Start reframing session
POST   /api/reframing/:id/categorize    # Submit reason, get category
GET    /api/reframing/:id/solutions     # Get 3 solutions
POST   /api/reframing/:id/select        # Select solution, create new promise
```

#### Feed & Analytics
```
GET    /api/feed/global                 # Global live feed
GET    /api/feed/personal               # User's personal feed
GET    /api/analytics/global            # Platform stats
GET    /api/analytics/user/:userId      # User stats
```

#### Notifications
```
GET    /api/notifications               # Get user notifications
PUT    /api/notifications/:id/read      # Mark as read
POST   /api/notifications/preferences   # Update preferences
```

---

## User Flows

### Flow 1: Creating a Promise to Others
```
1. User clicks "Create Promise"
2. Selects type: "Promise to Others"
3. Enters promise details:
   - "Complete team presentation by Friday"
   - Adds participants: @jane, @mark, @sarah (3-way)
   - Sets deadline: Friday, 5 PM
   - Privacy: Participants only
4. System creates promise (status: ACTIVE)
5. Notifications sent to @jane, @mark, @sarah
6. They accept participation
7. Timer starts counting down
8. Reminders sent as deadline approaches
```

### Flow 2: Completing a Multi-Party Promise
```
1. Friday arrives, user marks promise "Complete"
2. System changes status to PENDING_ACCEPTANCE
3. Notifications sent to @jane, @mark, @sarah
4. System: Not unanimous (3 YES, 1 NO)5
5. Status remains PENDING_ACCEPTANCE
6. Discussion triggered among team
7. Team revises slides
8. @sarah changes vote to YES
10. System: Unanimous approval
11. Status → COMPLETED
12. Feed entry created (if public)
13. Reliability scores updated for all
```

### Flow 3: Missing a Promise & Reframing
```
1. Promise deadline passes, status → MISSED
2. User receives notification: "You missed: 'Run 5K'"
3. User clicks "Reframe Promise"
4. Reframing page opens
5. System asks: "Why did you miss this promise?"
6. User responds: "I injured my knee in week 2, couldn't run"
7. LLM analyzes → Category: EXTERNAL_FACTORS
8. System generates 3 solutions:

   Solution 1: "Walk 5K instead (low-impact)"
   Solution 2: "Run 5K in 8 weeks (recovery time)"
   Solution 3: "Cycle 10K (alternative cardio)"

9. User selects Solution 2
10. New promise created:
    - Content: "Run 5K in 8 weeks with proper recovery"
    - Deadline: +8 weeks from now
    - Revision count: 1
    - Linked to original promise
11. System notifies user of new promise
12. Timer starts for new deadline
```

### Flow 4: World Promise with Auto-Escalation
```
1. User creates: "Donate $500 to animal shelter"
   - Type: Promise to World
   - Privacy: Public (required)
   - Deadline: End of month
2. Promise appears on global feed
3. User completes donation, marks complete
4. Status → COMPLETED
5. Major feed celebration: "User completed $500 donation!"
6. Auto-escalation triggered:
   - System suggests: "Level up! How about $1000 next time?"
   - Or: "Organize a donation drive with 10 people?"
   - Or: "Volunteer 20 hours at the shelter?"
7. User can accept suggestion or create custom promise
8. New promise created, cycle continues
```
