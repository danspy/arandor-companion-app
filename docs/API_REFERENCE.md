# Arandor Companion App - API Reference for Native iOS App

This document provides comprehensive API documentation for building a native iOS app that integrates with the Arandor Companion App backend. All API routes are designed to return JSON responses and follow RESTful conventions.

## Table of Contents

1. [Overview](#overview)
2. [Base URL](#base-url)
3. [Authentication](#authentication)
4. [Data Models](#data-models)
5. [API Endpoints](#api-endpoints)
   - [Authentication](#authentication-endpoints)
   - [Users](#users-endpoints)
   - [Characters](#characters-endpoints)
   - [Diary Entries](#diary-entries-endpoints)
   - [Library Entries](#library-entries-endpoints)
   - [Quests](#quests-endpoints)
   - [NPCs](#npcs-endpoints)
   - [Locations](#locations-endpoints)
   - [Factions](#factions-endpoints)
   - [Campaign Progress](#campaign-progress-endpoints)
   - [Events/Calendar](#events-calendar-endpoints)
   - [Initiative Tracker](#initiative-tracker-endpoints)
   - [DM Screen](#dm-screen-endpoints)
   - [Timeline](#timeline-endpoints)
   - [Combat State](#combat-state-endpoints)
   - [Page Settings](#page-settings-endpoints)
   - [File Upload](#file-upload-endpoints)
6. [Error Handling](#error-handling)
7. [Best Practices](#best-practices-for-ios-integration)
8. [CORS Configuration](#cors-configuration)

---

## Overview

The Arandor Companion App provides a REST API for managing D&D campaign data including characters, diary entries, quests, NPCs, locations, and more. The API uses cookie-based session authentication with role-based access control.

**Authentication Roles:**
- `admin` - Full access including user management
- `dungeonmaster` - Can edit all content except user management
- `player` - Can edit diary, library, characters, NPCs, locations, and quests

---

## Base URL

All API endpoints are relative to your server's base URL:

```
https://your-server.com/api
```

For development:
```
http://localhost:4321/api
```

---

## Authentication

The API uses **cookie-based session authentication**. After a successful login, the server sets a session cookie that must be included in all subsequent requests.

### Session Cookie Details

- **Cookie Name:** `session`
- **Properties:**
  - `httpOnly: true`
  - `secure: true` (in production)
  - `sameSite: 'strict'`
  - `maxAge: 604800` (7 days)

### iOS Implementation Notes

For iOS apps, you should:
1. Use `URLSession` with a shared `HTTPCookieStorage` to automatically handle cookies
2. Enable cookie acceptance for the API domain
3. Store authentication state based on successful API responses
4. Handle 401 (Unauthorized) responses by prompting for re-login

**Example iOS Cookie Configuration:**
```swift
let configuration = URLSessionConfiguration.default
configuration.httpCookieAcceptPolicy = .always
configuration.httpShouldSetCookies = true
configuration.httpCookieStorage = HTTPCookieStorage.shared

let session = URLSession(configuration: configuration)
```

---

## Data Models

### User

```typescript
{
  id: string;                      // UUID
  username: string;                // Unique username
  passwordHash: string;            // Hashed password (never returned in API)
  role: string;                    // 'admin' | 'dungeonmaster' | 'player'
  firstName?: string;              // Display name
  profileImageUrl?: string;        // Profile image URL
  characterIds: string[];          // Array of character IDs owned by this user
  favoritePages: string[];         // Array of favorite page IDs (max 3)
  createdAt: Date;                 // ISO 8601 timestamp
}
```

### Character

```typescript
{
  id: string;                      // UUID
  name: string;
  class: string;
  level: number;
  race: string;
  player: string;                  // Player name
  userId?: string;                 // Foreign key to User
  isActive: boolean;               // Whether character is active in campaign
  avatarUrl?: string;
  dndbeyondUrl?: string;          // Link to D&D Beyond character
  stats?: {                        // Character stats
    STR?: number;
    DEX?: number;
    CON?: number;
    INT?: number;
    WIS?: number;
    CHA?: number;
  };
  hp?: number;                     // Current HP
  maxHp?: number;                  // Maximum HP
  tempHp?: number;                 // Temporary HP
  gender?: string;
  alignment?: string;
  background?: string;
  age?: number;
  height?: string;
  weight?: number;
  eyes?: string;
  skin?: string;
  hair?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### DiaryEntry

```typescript
{
  id: string;                      // UUID
  date: string;                    // ISO 8601 date
  title: string;
  content: string;                 // Markdown content
  summary?: string;                // AI-generated summary
  podcastAudioUrl?: string;        // URL to podcast audio file
  session: number;                 // Session number
  tags: string[];                  // Array of tags
  coverImageUrl?: string;          // Cover image URL
  coverVideoUrl?: string;          // Cover video URL
  npcIds: string[];                // Array of NPC IDs referenced
  locationIds: string[];           // Array of Location IDs referenced
  characterIds: string[];          // Array of Character IDs referenced
  questIds: string[];              // Array of Quest IDs referenced
  createdAt: Date;
  updatedAt: Date;
}
```

### LibraryEntry

```typescript
{
  id: string;                      // UUID
  title: string;
  content: string;                 // Markdown content
  tags: string[];                  // Array of tags for filtering
  locationId?: string;             // Foreign key to Location
  createdAt: Date;
  updatedAt: Date;
}
```

### Quest

```typescript
{
  id: string;                      // UUID
  title: string;
  description: string;
  status: string;                  // 'active' | 'completed' | 'failed'
  priority: string;                // 'high' | 'medium' | 'low'
  createdAt: Date;
  updatedAt: Date;
}
```

### NPC

```typescript
{
  id: string;                      // UUID
  name: string;
  race: string;
  occupation?: string;
  location?: string;               // Legacy text field
  locationId?: string;             // Foreign key to Location
  description: string;
  relationship: string;            // 'ally' | 'neutral' | 'enemy'
  notes?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Location

```typescript
{
  id: string;                      // UUID
  name: string;
  type: string;                    // 'city' | 'dungeon' | 'wilderness' | 'building' | 'other'
  description: string;
  region?: string;
  visited: boolean;                // Whether party has visited
  notes?: string;
  imageUrl?: string;               // Location image
  mapX?: number;                   // X coordinate (0-100) for map pin
  mapY?: number;                   // Y coordinate (0-100) for map pin
  visibleOnMap: boolean;           // Whether pin is visible on map
  createdAt: Date;
  updatedAt: Date;
}
```

### Faction

```typescript
{
  id: string;                      // UUID
  name: string;
  status: string;                  // 'enemy' | 'suspicious' | 'neutral' | 'friendly' | 'respectful'
  progress: number;                // 0-100 independent of status
  createdAt: Date;
  updatedAt: Date;
}
```

### CampaignProgress

```typescript
{
  id: string;                      // UUID
  currentLevel: number;            // Current party level
  progressPercent: number;         // Progress to next level (0-100, steps of 10)
  heroImageUrl?: string;           // Optional hero image for dashboard
  createdAt: Date;
  updatedAt: Date;
}
```

### Event

```typescript
{
  id: string;                      // UUID
  title: string;
  description?: string;
  date: string;                    // ISO date string (YYYY-MM-DD)
  time: string;                    // Time string (HH:MM)
  duration?: number;               // Duration in minutes
  hostId?: string;                 // Foreign key to User
  createdAt: Date;
  updatedAt: Date;
}
```

### InitiativeTracker

```typescript
{
  id: string;                      // UUID
  name: string;
  initiative: number;              // Initiative roll value
  type: string;                    // 'character' | 'npc' | 'monster' | 'other'
  characterId?: string;            // Foreign key to Character
  hp?: number;                     // Current HP
  maxHp?: number;                  // Maximum HP
  tempHp?: number;                 // Temporary HP
  ac?: number;                     // Armor Class
  notes?: string;
  isActive: boolean;               // Whether entry is in current combat
  createdAt: Date;
  updatedAt: Date;
}
```

### DMScreenState

```typescript
{
  id: string;                      // UUID
  currentLocationId?: string;      // Currently displayed location
  spotlightNpcIds: string[];       // Array of NPC IDs in spotlight
  customAssets: string[];          // Array of custom asset URLs
  showInitiativeTracker: boolean;  // Whether to show initiative tracker
  screenVisible: boolean;          // Whether to show content or placeholder
  placeholderImageUrl?: string;    // Placeholder image when screen is hidden
  showTimer: boolean;              // Whether to show timer
  timerDuration: number;           // Timer duration in seconds
  timerStartedAt?: number;         // Unix timestamp when timer started
  timerPausedAt?: number;          // Unix timestamp when timer paused
  timerStatus: string;             // 'running' | 'paused' | 'stopped'
  updatedAt: Date;
}
```

### TimelineEntry

```typescript
{
  id: string;                      // UUID
  entryType: string;               // 'event' | 'label'
  year: number;                    // Numeric year (0-9999+)
  month?: number;                  // Optional month (1-12)
  label?: string;                  // Label text for dividers (type='label')
  sortOrder?: number;              // For sorting entries on timeline
  headline?: string;               // Required for events
  shortDescription?: string;
  fullDescription?: string;        // Markdown content
  imageUrl?: string;
  diaryEntryIds: string[];         // Array of DiaryEntry IDs
  libraryDocsEntryIds: string[];   // Array of LibraryEntry IDs
  npcIds: string[];                // Array of NPC IDs
  locationIds: string[];           // Array of Location IDs
  characterIds: string[];          // Array of Character IDs
  questIds: string[];              // Array of Quest IDs
  createdAt: Date;
  updatedAt: Date;
}
```

### CombatState

```typescript
{
  id: string;                      // Always "current-combat"
  currentRound: number;            // Current combat round
  currentTurnIndex: number;        // Index of current turn in initiative order
  status: string;                  // 'active' | 'paused' | 'stopped'
  updatedAt: Date;                 // ISO 8601 timestamp
}
```

### PageSettings

```typescript
{
  id: string;                      // UUID
  pageName: string;                // Unique page name (e.g., 'dashboard', 'characters')
  heroImageUrl?: string;           // Optional hero/banner image URL for the page
  createdAt: Date;                 // ISO 8601 timestamp
  updatedAt: Date;                 // ISO 8601 timestamp
}
```

---

## API Endpoints

### Authentication Endpoints

#### Login

**POST** `/api/auth/login`

Authenticate a user and establish a session.

**Request Body:**
```json
{
  "username": "string",
  "password": "string"
}
```

**Success Response (200):**
```json
{
  "success": true
}
```

**Error Responses:**
- `400 Bad Request` - Missing username or password
- `401 Unauthorized` - Invalid credentials
- `500 Internal Server Error` - Login failed

**Example:**
```json
// Request
{
  "username": "admin",
  "password": "admin"
}

// Response
{
  "success": true
}
```

#### Logout

**POST** `/api/auth/logout`

Clear the user's session.

**Success Response (200):**
```json
{
  "success": true
}
```

---

### Users Endpoints

#### List Users

**GET** `/api/users`

Get all users (admin only).

**Authentication:** Required (admin role)

**Success Response (200):**
```json
[
  {
    "id": "uuid",
    "username": "string",
    "role": "admin|dungeonmaster|player",
    "firstName": "string",
    "profileImageUrl": "string",
    "characterIds": ["uuid"],
    "favoritePages": ["string"],
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
]
```

**Note:** `passwordHash` is never included in responses.

#### Create User

**POST** `/api/users`

Create a new user (admin only).

**Authentication:** Required (admin role)

**Request Body:**
```json
{
  "username": "string",
  "password": "string",
  "role": "admin|dungeonmaster|player",
  "firstName": "string (optional)",
  "profileImageUrl": "string (optional)"
}
```

**Success Response (201):**
```json
{
  "id": "uuid",
  "username": "string",
  "role": "string",
  "firstName": "string",
  "profileImageUrl": "string",
  "characterIds": [],
  "favoritePages": [],
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### Get Current User Profile

**GET** `/api/profile`

Get the currently authenticated user's profile.

**Authentication:** Required

**Success Response (200):**
```json
{
  "id": "uuid",
  "username": "string",
  "role": "string",
  "firstName": "string",
  "profileImageUrl": "string",
  "characterIds": ["uuid"],
  "favoritePages": ["string"],
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

#### Update User

**PUT** `/api/users/[id]`

Update a user's information (admin only, or self for non-sensitive fields).

**Authentication:** Required (admin role for all fields, or authenticated user for own profile)

**Request Body:**
```json
{
  "firstName": "string (optional)",
  "profileImageUrl": "string (optional)",
  "characterIds": ["uuid"] (optional),
  "favoritePages": ["string"] (optional),
  "role": "string (admin only)"
}
```

**Success Response (200):**
```json
{
  "id": "uuid",
  "username": "string",
  "role": "string",
  "firstName": "string",
  "profileImageUrl": "string",
  "characterIds": ["uuid"],
  "favoritePages": ["string"],
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Delete User

**DELETE** `/api/users/[id]`

Delete a user (admin only).

**Authentication:** Required (admin role)

**Success Response (200):**
```json
{
  "success": true
}
```

---

### Characters Endpoints

#### List Characters

**GET** `/api/characters`

Get all characters.

**Success Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "class": "string",
    "level": 0,
    "race": "string",
    "player": "string",
    "userId": "uuid",
    "isActive": true,
    "avatarUrl": "string",
    "dndbeyondUrl": "string",
    "stats": {
      "STR": 10,
      "DEX": 10,
      "CON": 10,
      "INT": 10,
      "WIS": 10,
      "CHA": 10
    },
    "hp": 20,
    "maxHp": 20,
    "tempHp": 0,
    "gender": "string",
    "alignment": "string",
    "background": "string",
    "age": 25,
    "height": "string",
    "weight": 150,
    "eyes": "string",
    "skin": "string",
    "hair": "string",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Get Available Characters

**GET** `/api/characters/available`

Get characters that can be linked to the current user.

**Authentication:** Required

**Success Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "class": "string",
    "level": 0
  }
]
```

#### Create Character

**POST** `/api/characters`

Create a new character.

**Authentication:** Required (player role or above)

**Request Body:**
```json
{
  "name": "string",
  "class": "string",
  "level": 0,
  "race": "string",
  "player": "string",
  "assignToUser": false,
  "isActive": true,
  "avatarUrl": "string (optional)",
  "dndbeyondUrl": "string (optional)",
  "stats": {
    "STR": 10,
    "DEX": 10,
    "CON": 10,
    "INT": 10,
    "WIS": 10,
    "CHA": 10
  },
  "hp": 20,
  "maxHp": 20,
  "tempHp": 0,
  "gender": "string (optional)",
  "alignment": "string (optional)",
  "background": "string (optional)",
  "age": 25,
  "height": "string (optional)",
  "weight": 150,
  "eyes": "string (optional)",
  "skin": "string (optional)",
  "hair": "string (optional)"
}
```

**Success Response (201):**
```json
{
  "id": "uuid",
  "name": "string",
  // ... full character object
}
```

#### Get Character

**GET** `/api/characters/[id]`

Get a specific character by ID.

**Success Response (200):**
```json
{
  "id": "uuid",
  "name": "string",
  // ... full character object
}
```

**Error Response:**
- `404 Not Found` - Character not found

#### Update Character

**PUT** `/api/characters/[id]`

Update a character.

**Authentication:** Required (player role or above)

**Request Body:** Same as Create Character

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full updated character object
}
```

#### Delete Character

**DELETE** `/api/characters/[id]`

Delete a character.

**Authentication:** Required (player role or above)

**Success Response (200):**
```json
{
  "success": true
}
```

#### Sync Character HP from D&D Beyond

**POST** `/api/characters/sync-hp`

Sync character HP from D&D Beyond.

**Authentication:** Required (dungeonmaster or admin role)

**Request Body:**
```json
{
  "characterId": "uuid"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "hp": 20,
  "maxHp": 25,
  "tempHp": 5
}
```

---

### Diary Entries Endpoints

#### List Diary Entries

**GET** `/api/diary`

Get all diary entries.

**Success Response (200):**
```json
[
  {
    "id": "uuid",
    "date": "2024-01-01",
    "title": "string",
    "content": "markdown content",
    "summary": "string",
    "podcastAudioUrl": "string",
    "session": 1,
    "tags": ["tag1", "tag2"],
    "coverImageUrl": "string",
    "coverVideoUrl": "string",
    "npcIds": ["uuid"],
    "locationIds": ["uuid"],
    "characterIds": ["uuid"],
    "questIds": ["uuid"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Create Diary Entry

**POST** `/api/diary`

Create a new diary entry.

**Authentication:** Required (player role or above)

**Request Body:**
```json
{
  "date": "2024-01-01",
  "title": "string",
  "content": "markdown content",
  "summary": "string (optional)",
  "podcastAudioUrl": "string (optional)",
  "session": 1,
  "tags": ["tag1", "tag2"],
  "coverImageUrl": "string (optional)",
  "coverVideoUrl": "string (optional)",
  "npcIds": ["uuid"] (optional),
  "locationIds": ["uuid"] (optional),
  "characterIds": ["uuid"] (optional),
  "questIds": ["uuid"] (optional)
}
```

**Success Response (201):**
```json
{
  "id": "uuid",
  // ... full diary entry object
}
```

#### Get Diary Entry

**GET** `/api/diary/[id]`

Get a specific diary entry by ID.

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full diary entry object
}
```

#### Update Diary Entry

**PUT** `/api/diary/[id]`

Update a diary entry.

**Authentication:** Required (player role or above)

**Request Body:** Same as Create Diary Entry

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full updated diary entry object
}
```

#### Delete Diary Entry

**DELETE** `/api/diary/[id]`

Delete a diary entry.

**Authentication:** Required (player role or above)

**Success Response (200):**
```json
{
  "success": true
}
```

#### Generate AI Summary

**POST** `/api/diary/[id]/summary`

Generate an AI summary for a diary entry (requires OpenAI API key).

**Authentication:** Required (dungeonmaster or admin role)

**Success Response (200):**
```json
{
  "summary": "string"
}
```

#### Generate AI Image

**POST** `/api/diary/[id]/generate-image`

Generate an AI image for a diary entry (requires OpenAI API key with DALL-E).

**Authentication:** Required (dungeonmaster or admin role)

**Success Response (200):**
```json
{
  "imageUrl": "string"
}
```

#### Generate Podcast Narration

**POST** `/api/diary/[id]/podcast`

Generate podcast narration for a diary entry (requires OpenAI API key).

**Authentication:** Required (dungeonmaster or admin role)

**Success Response (200):**
```json
{
  "audioUrl": "string"
}
```

#### Diary Notes (User-specific)

**GET** `/api/diary-notes/[diaryEntryId]`

Get user-specific notes for a diary entry.

**Authentication:** Required

**Success Response (200):**
```json
{
  "id": "uuid",
  "diaryEntryId": "uuid",
  "userId": "uuid",
  "content": "string",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

---

### Library Entries Endpoints

#### List Library Entries

**GET** `/api/library`

Get all library entries.

**Success Response (200):**
```json
[
  {
    "id": "uuid",
    "title": "string",
    "content": "markdown content",
    "tags": ["tag1", "tag2"],
    "locationId": "uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Create Library Entry

**POST** `/api/library`

Create a new library entry.

**Authentication:** Required (player role or above)

**Request Body:**
```json
{
  "title": "string",
  "content": "markdown content",
  "tags": ["tag1", "tag2"],
  "locationId": "uuid (optional)"
}
```

**Success Response (201):**
```json
{
  "id": "uuid",
  // ... full library entry object
}
```

#### Get Library Entry

**GET** `/api/library/[id]`

Get a specific library entry by ID.

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full library entry object
}
```

#### Update Library Entry

**PUT** `/api/library/[id]`

Update a library entry.

**Authentication:** Required (player role or above)

**Request Body:** Same as Create Library Entry

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full updated library entry object
}
```

#### Delete Library Entry

**DELETE** `/api/library/[id]`

Delete a library entry.

**Authentication:** Required (player role or above)

**Success Response (200):**
```json
{
  "success": true
}
```

---

### Quests Endpoints

#### List Quests

**GET** `/api/quests`

Get all quests.

**Success Response (200):**
```json
[
  {
    "id": "uuid",
    "title": "string",
    "description": "string",
    "status": "active|completed|failed",
    "priority": "high|medium|low",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Create Quest

**POST** `/api/quests`

Create a new quest.

**Authentication:** Required (dungeonmaster or admin role)

**Request Body:**
```json
{
  "title": "string",
  "description": "string",
  "status": "active|completed|failed",
  "priority": "high|medium|low"
}
```

**Success Response (201):**
```json
{
  "id": "uuid",
  // ... full quest object
}
```

#### Get Quest

**GET** `/api/quests/[id]`

Get a specific quest by ID.

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full quest object
}
```

#### Update Quest

**PUT** `/api/quests/[id]`

Update a quest.

**Authentication:** Required (dungeonmaster or admin role)

**Request Body:** Same as Create Quest

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full updated quest object
}
```

#### Delete Quest

**DELETE** `/api/quests/[id]`

Delete a quest.

**Authentication:** Required (dungeonmaster or admin role)

**Success Response (200):**
```json
{
  "success": true
}
```

---

### NPCs Endpoints

#### List NPCs

**GET** `/api/npcs`

Get all NPCs.

**Success Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "race": "string",
    "occupation": "string",
    "location": "string",
    "locationId": "uuid",
    "description": "string",
    "relationship": "ally|neutral|enemy",
    "notes": "string",
    "avatarUrl": "string",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Create NPC

**POST** `/api/npcs`

Create a new NPC.

**Authentication:** Required (player role or above)

**Request Body:**
```json
{
  "name": "string",
  "race": "string",
  "occupation": "string (optional)",
  "location": "string (optional)",
  "locationId": "uuid (optional)",
  "description": "string",
  "relationship": "ally|neutral|enemy",
  "notes": "string (optional)",
  "avatarUrl": "string (optional)"
}
```

**Success Response (201):**
```json
{
  "id": "uuid",
  // ... full NPC object
}
```

#### Get NPC

**GET** `/api/npcs/[id]`

Get a specific NPC by ID.

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full NPC object
}
```

#### Update NPC

**PUT** `/api/npcs/[id]`

Update an NPC.

**Authentication:** Required (player role or above)

**Request Body:** Same as Create NPC

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full updated NPC object
}
```

#### Delete NPC

**DELETE** `/api/npcs/[id]`

Delete an NPC.

**Authentication:** Required (player role or above)

**Success Response (200):**
```json
{
  "success": true
}
```

---

### Locations Endpoints

#### List Locations

**GET** `/api/locations`

Get all locations.

**Success Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "type": "city|dungeon|wilderness|building|other",
    "description": "string",
    "region": "string",
    "visited": false,
    "notes": "string",
    "imageUrl": "string",
    "mapX": 50,
    "mapY": 50,
    "visibleOnMap": false,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Create Location

**POST** `/api/locations`

Create a new location.

**Authentication:** Required (player role or above)

**Request Body:**
```json
{
  "name": "string",
  "type": "city|dungeon|wilderness|building|other",
  "description": "string",
  "region": "string (optional)",
  "visited": false,
  "notes": "string (optional)",
  "imageUrl": "string (optional)",
  "mapX": 50,
  "mapY": 50,
  "visibleOnMap": false
}
```

**Success Response (201):**
```json
{
  "id": "uuid",
  // ... full location object
}
```

#### Get Location

**GET** `/api/locations/[id]`

Get a specific location by ID.

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full location object
}
```

#### Update Location

**PUT** `/api/locations/[id]`

Update a location.

**Authentication:** Required (player role or above)

**Request Body:** Same as Create Location

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full updated location object
}
```

#### Delete Location

**DELETE** `/api/locations/[id]`

Delete a location.

**Authentication:** Required (player role or above)

**Success Response (200):**
```json
{
  "success": true
}
```

---

### Factions Endpoints

#### List Factions

**GET** `/api/factions`

Get all factions.

**Success Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "status": "enemy|suspicious|neutral|friendly|respectful",
    "progress": 50,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Create Faction

**POST** `/api/factions`

Create a new faction.

**Authentication:** Required (dungeonmaster or admin role)

**Request Body:**
```json
{
  "name": "string",
  "status": "enemy|suspicious|neutral|friendly|respectful",
  "progress": 50
}
```

**Success Response (201):**
```json
{
  "id": "uuid",
  // ... full faction object
}
```

#### Get Faction

**GET** `/api/factions/[id]`

Get a specific faction by ID.

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full faction object
}
```

#### Update Faction

**PUT** `/api/factions/[id]`

Update a faction.

**Authentication:** Required (dungeonmaster or admin role)

**Request Body:** Same as Create Faction

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full updated faction object
}
```

#### Delete Faction

**DELETE** `/api/factions/[id]`

Delete a faction.

**Authentication:** Required (dungeonmaster or admin role)

**Success Response (200):**
```json
{
  "success": true
}
```

---

### Campaign Progress Endpoints

#### Get Campaign Progress

**GET** `/api/campaign-progress/[id]`

Get campaign progress by ID.

**Success Response (200):**
```json
{
  "id": "uuid",
  "currentLevel": 5,
  "progressPercent": 60,
  "heroImageUrl": "string",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Update Campaign Progress

**PUT** `/api/campaign-progress/[id]`

Update campaign progress.

**Authentication:** Required (dungeonmaster or admin role)

**Request Body:**
```json
{
  "currentLevel": 5,
  "progressPercent": 60,
  "heroImageUrl": "string (optional)"
}
```

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full updated campaign progress object
}
```

#### List All Campaign Progress

**GET** `/api/campaign-progress`

Get all campaign progress entries (typically only one exists).

**Success Response (200):**
```json
[
  {
    "id": "uuid",
    "currentLevel": 5,
    "progressPercent": 60,
    "heroImageUrl": "string",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

---

### Events Calendar Endpoints

#### List Events

**GET** `/api/events`

Get all events.

**Success Response (200):**
```json
[
  {
    "id": "uuid",
    "title": "string",
    "description": "string",
    "date": "2024-01-01",
    "time": "19:00",
    "duration": 180,
    "hostId": "uuid",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Create Event

**POST** `/api/events`

Create a new event.

**Authentication:** Required (player role or above)

**Request Body:**
```json
{
  "title": "string",
  "description": "string (optional)",
  "date": "2024-01-01",
  "time": "19:00",
  "duration": 180,
  "hostId": "uuid (optional)"
}
```

**Success Response (201):**
```json
{
  "id": "uuid",
  // ... full event object
}
```

#### Get Event

**GET** `/api/events/[id]`

Get a specific event by ID.

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full event object
}
```

#### Update Event

**PUT** `/api/events/[id]`

Update an event.

**Authentication:** Required (player role or above)

**Request Body:** Same as Create Event

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full updated event object
}
```

#### Delete Event

**DELETE** `/api/events/[id]`

Delete an event.

**Authentication:** Required (player role or above)

**Success Response (200):**
```json
{
  "success": true
}
```

#### Calendar iCal Feed

**GET** `/api/calendar/ics.ics`

Get calendar feed in iCal format (public, no authentication required).

**Success Response (200):**
```
Content-Type: text/calendar

BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Arandor Companion//Calendar//EN
...
END:VCALENDAR
```

---

### Initiative Tracker Endpoints

#### List Initiative Entries

**GET** `/api/initiative`

Get all initiative tracker entries.

**Success Response (200):**
```json
[
  {
    "id": "uuid",
    "name": "string",
    "initiative": 15,
    "type": "character|npc|monster|other",
    "characterId": "uuid",
    "hp": 20,
    "maxHp": 25,
    "tempHp": 5,
    "ac": 15,
    "notes": "string",
    "isActive": true,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Create Initiative Entry

**POST** `/api/initiative`

Create a new initiative entry.

**Authentication:** Required (dungeonmaster or admin role)

**Request Body:**
```json
{
  "name": "string",
  "initiative": 15,
  "type": "character|npc|monster|other",
  "characterId": "uuid (optional)",
  "hp": 20,
  "maxHp": 25,
  "tempHp": 5,
  "ac": 15,
  "notes": "string (optional)",
  "isActive": true
}
```

**Success Response (201):**
```json
{
  "id": "uuid",
  // ... full initiative entry object
}
```

#### Get Initiative Entry

**GET** `/api/initiative/[id]`

Get a specific initiative entry by ID.

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full initiative entry object
}
```

#### Update Initiative Entry

**PUT** `/api/initiative/[id]`

Update an initiative entry.

**Authentication:** Required (dungeonmaster or admin role)

**Request Body:** Same as Create Initiative Entry

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full updated initiative entry object
}
```

#### Delete Initiative Entry

**DELETE** `/api/initiative/[id]`

Delete an initiative entry.

**Authentication:** Required (dungeonmaster or admin role)

**Success Response (200):**
```json
{
  "success": true
}
```

#### Sync Initiative HP

**POST** `/api/initiative/sync-hp`

Sync initiative tracker HP with character HP from D&D Beyond.

**Authentication:** Required (dungeonmaster or admin role)

**Request Body:**
```json
{
  "initiativeEntryId": "uuid"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "hp": 20,
  "maxHp": 25,
  "tempHp": 5
}
```

#### Update Initiative HP

**POST** `/api/initiative/update-hp`

Update HP for an initiative entry.

**Authentication:** Required (dungeonmaster or admin role)

**Request Body:**
```json
{
  "initiativeEntryId": "uuid",
  "hp": 20,
  "maxHp": 25,
  "tempHp": 5
}
```

**Success Response (200):**
```json
{
  "success": true,
  "hp": 20,
  "maxHp": 25,
  "tempHp": 5
}
```

---

### DM Screen Endpoints

#### Get DM Screen State

**GET** `/api/dm-screen`

Get the current DM screen state.

**Authentication:** Required

**Success Response (200):**
```json
{
  "id": "uuid",
  "currentLocationId": "uuid",
  "spotlightNpcIds": ["uuid"],
  "customAssets": ["url"],
  "showInitiativeTracker": false,
  "screenVisible": true,
  "placeholderImageUrl": "string",
  "showTimer": false,
  "timerDuration": 0,
  "timerStartedAt": 1234567890,
  "timerPausedAt": 1234567890,
  "timerStatus": "running|paused|stopped",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

#### Update DM Screen State

**PUT** `/api/dm-screen`

Update the DM screen state.

**Authentication:** Required (dungeonmaster or admin role)

**Request Body:**
```json
{
  "currentLocationId": "uuid (optional)",
  "spotlightNpcIds": ["uuid"],
  "customAssets": ["url"],
  "showInitiativeTracker": false,
  "screenVisible": true,
  "placeholderImageUrl": "string (optional)",
  "showTimer": false,
  "timerDuration": 0,
  "timerStartedAt": 1234567890,
  "timerPausedAt": 1234567890,
  "timerStatus": "running|paused|stopped"
}
```

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full updated DM screen state object
}
```

---

### Timeline Endpoints

#### List Timeline Entries

**GET** `/api/timeline`

Get all timeline entries.

**Success Response (200):**
```json
[
  {
    "id": "uuid",
    "entryType": "event|label",
    "year": 2024,
    "month": 6,
    "label": "string",
    "sortOrder": 1,
    "headline": "string",
    "shortDescription": "string",
    "fullDescription": "markdown content",
    "imageUrl": "string",
    "diaryEntryIds": ["uuid"],
    "libraryDocsEntryIds": ["uuid"],
    "npcIds": ["uuid"],
    "locationIds": ["uuid"],
    "characterIds": ["uuid"],
    "questIds": ["uuid"],
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
]
```

#### Create Timeline Entry

**POST** `/api/timeline`

Create a new timeline entry.

**Authentication:** Required (dungeonmaster or admin role)

**Request Body:**
```json
{
  "entryType": "event|label",
  "year": 2024,
  "month": 6,
  "label": "string (optional, for labels)",
  "sortOrder": 1,
  "headline": "string (required for events)",
  "shortDescription": "string (optional)",
  "fullDescription": "markdown content (optional)",
  "imageUrl": "string (optional)",
  "diaryEntryIds": ["uuid"],
  "libraryDocsEntryIds": ["uuid"],
  "npcIds": ["uuid"],
  "locationIds": ["uuid"],
  "characterIds": ["uuid"],
  "questIds": ["uuid"]
}
```

**Success Response (201):**
```json
{
  "id": "uuid",
  // ... full timeline entry object
}
```

#### Get Timeline Entry

**GET** `/api/timeline/[id]`

Get a specific timeline entry by ID.

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full timeline entry object
}
```

#### Update Timeline Entry

**PUT** `/api/timeline/[id]`

Update a timeline entry.

**Authentication:** Required (dungeonmaster or admin role)

**Request Body:** Same as Create Timeline Entry

**Success Response (200):**
```json
{
  "id": "uuid",
  // ... full updated timeline entry object
}
```

#### Delete Timeline Entry

**DELETE** `/api/timeline/[id]`

Delete a timeline entry.

**Authentication:** Required (dungeonmaster or admin role)

**Success Response (200):**
```json
{
  "success": true
}
```

---

### Combat State Endpoints

The Combat State API manages the state of combat encounters, including the current round, turn index, and combat status.

#### Get Combat State

**GET** `/api/combat-state`

Get the current combat state (public, no authentication required).

**Success Response (200):**
```json
{
  "id": "current-combat",
  "currentRound": 1,
  "currentTurnIndex": 0,
  "status": "stopped|active|paused",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Note:** This endpoint is public because the player display page needs access. A default state is created automatically if none exists.

#### Update Combat State

**PUT** `/api/combat-state`

Update the combat state.

**Authentication:** Required (dungeonmaster or admin role)

**Request Body:**
```json
{
  "currentRound": 1,
  "currentTurnIndex": 0,
  "status": "active|paused|stopped"
}
```

**Success Response (200):**
```json
{
  "id": "current-combat",
  "currentRound": 1,
  "currentTurnIndex": 0,
  "status": "active",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Invalid currentRound, currentTurnIndex, or status
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Insufficient permissions
- `500 Internal Server Error` - Failed to update combat state

---

### Page Settings Endpoints

The Page Settings API manages hero/banner images for various pages in the app.

#### Get Page Settings

**GET** `/api/page-settings/[pageName]`

Get settings for a specific page.

**URL Parameters:**
- `pageName` - Name of the page (e.g., 'dashboard', 'characters', 'diary', 'library', 'locations', 'npcs', 'quests')

**Success Response (200):**
```json
{
  "id": "uuid",
  "pageName": "dashboard",
  "heroImageUrl": "string",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Note:** If no settings exist for the page, returns default empty settings with `heroImageUrl: null`.

#### Update Page Settings

**PUT** `/api/page-settings/[pageName]`

Update settings for a specific page (creates if doesn't exist).

**Authentication:** Required (dungeonmaster or admin role)

**URL Parameters:**
- `pageName` - Name of the page

**Request Body:**
```json
{
  "heroImageUrl": "string (optional)"
}
```

**Success Response (200):**
```json
{
  "id": "uuid",
  "pageName": "dashboard",
  "heroImageUrl": "string",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Error Responses:**
- `400 Bad Request` - Page name is required
- `401 Unauthorized` - Not authenticated
- `403 Forbidden` - Insufficient permissions
- `500 Internal Server Error` - Failed to update page settings

---

### File Upload Endpoints

#### Upload File

**POST** `/api/upload`

Upload an image or video file.

**Authentication:** Required (player role or above)

**Request Headers:**
```
Content-Type: multipart/form-data
```

**Request Body (multipart/form-data):**
- `file` - File to upload (max 5MB, accepts image/* and video/* files)

**Success Response (200):**
```json
{
  "url": "/uploads/filename.jpg"
}
```

**Error Responses:**
- `400 Bad Request` - No file provided, file too large, or invalid file type
- `401 Unauthorized` - Not authenticated
- `500 Internal Server Error` - Upload failed

**Note:** Uploaded files are stored in the `/uploads` directory (or `/srv/arandor/uploads/` in production).

---

## Error Handling

All endpoints return JSON error responses in the following format:

```json
{
  "error": "Error message description"
}
```

### Common HTTP Status Codes

| Status Code | Meaning | When Used |
|-------------|---------|-----------|
| `200 OK` | Success | GET, PUT, DELETE successful |
| `201 Created` | Resource created | POST successful |
| `400 Bad Request` | Invalid request | Missing required fields, validation errors |
| `401 Unauthorized` | Not authenticated | No valid session cookie |
| `403 Forbidden` | Insufficient permissions | User role lacks required permissions |
| `404 Not Found` | Resource not found | ID doesn't exist in database |
| `500 Internal Server Error` | Server error | Database error, unexpected error |

### Authentication Errors

When an endpoint requires authentication and the request is not authenticated:

```json
{
  "error": "Unauthorized"
}
```

When an endpoint requires specific permissions and the user lacks them:

```json
{
  "error": "Forbidden: Insufficient permissions"
}
```

### iOS Error Handling Best Practices

1. **Always check HTTP status codes** before parsing response body
2. **Handle 401 responses** by clearing local auth state and prompting for re-login
3. **Handle 403 responses** by showing appropriate permission error messages
4. **Handle 404 responses** by checking if local data is stale
5. **Handle 500 responses** with generic error messages and retry options
6. **Parse error messages** from the `error` field in the response body
7. **Implement exponential backoff** for retry logic on 500 errors

---

## Best Practices for iOS Integration

### 1. Authentication Management

**Session Cookie Handling:**
```swift
// Configure URLSession to handle cookies automatically
let configuration = URLSessionConfiguration.default
configuration.httpCookieAcceptPolicy = .always
configuration.httpShouldSetCookies = true
configuration.httpCookieStorage = HTTPCookieStorage.shared

let session = URLSession(configuration: configuration)
```

**Login Flow:**
```swift
func login(username: String, password: String, completion: @escaping (Result<Void, Error>) -> Void) {
    let loginData = ["username": username, "password": password]
    
    // POST to /api/auth/login
    // If successful, cookies are automatically stored
    // Save authentication state locally
}
```

**Session Validation:**
```swift
func validateSession(completion: @escaping (Bool) -> Void) {
    // Try fetching /api/profile
    // If 401, session is invalid - prompt for re-login
    // If 200, session is valid
}
```

### 2. Data Synchronization

**Caching Strategy:**
- Cache all GET responses locally using Core Data or Realm
- Use `createdAt` and `updatedAt` timestamps to determine freshness
- Implement pull-to-refresh for manual sync
- Consider background sync for real-time updates

**Offline Support:**
- Store all data locally for offline viewing
- Queue create/update/delete operations when offline
- Sync queued operations when connection is restored
- Handle conflicts using `updatedAt` timestamps

### 3. Image Handling

**Image URLs:**
- All image URLs are relative paths (e.g., `/uploads/image.jpg`)
- Prefix with your server's base URL: `https://your-server.com/uploads/image.jpg`
- Download and cache images locally
- Use placeholder images while loading

**Image Upload:**
```swift
func uploadImage(_ image: UIImage, completion: @escaping (Result<String, Error>) -> Void) {
    guard let imageData = image.jpegData(compressionQuality: 0.8) else { return }
    
    var request = URLRequest(url: URL(string: "https://your-server.com/api/upload")!)
    request.httpMethod = "POST"
    
    let boundary = UUID().uuidString
    request.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")
    
    var body = Data()
    body.append("--\(boundary)\r\n".data(using: .utf8)!)
    body.append("Content-Disposition: form-data; name=\"file\"; filename=\"image.jpg\"\r\n".data(using: .utf8)!)
    body.append("Content-Type: image/jpeg\r\n\r\n".data(using: .utf8)!)
    body.append(imageData)
    body.append("\r\n--\(boundary)--\r\n".data(using: .utf8)!)
    
    request.httpBody = body
    
    // Send request and parse response for URL
}
```

### 4. Real-time Updates

**Polling:**
- Use polling for real-time features like initiative tracker
- Poll every 2-5 seconds when viewing real-time content
- Stop polling when view is not active to save battery
- Use `updatedAt` timestamps to detect changes

**Future: WebSockets:**
- Consider implementing WebSocket support for true real-time updates
- Would require server-side WebSocket implementation

### 5. Markdown Rendering

**Diary and Library Content:**
- Use a Markdown rendering library like `Down` or `MarkdownView`
- Parse markdown content from `content` fields
- Support images, links, and formatting

### 6. Role-Based UI

**Show/Hide Features:**
```swift
enum UserRole: String {
    case admin, dungeonmaster, player
}

func canEdit(resource: String, userRole: UserRole) -> Bool {
    switch resource {
    case "users":
        return userRole == .admin
    case "quests", "factions", "campaignProgress":
        return userRole == .dungeonmaster || userRole == .admin
    default:
        return true // All authenticated users can edit most content
    }
}
```

### 7. Pagination

While the current API doesn't implement pagination, you should:
- Fetch all data on initial load
- Cache locally
- Filter and sort on the client side
- Consider implementing pagination if datasets grow large

### 8. Error Handling

**Retry Logic:**
```swift
func retryRequest<T>(_ request: @escaping () -> Void, maxRetries: Int = 3, delay: TimeInterval = 1.0) {
    var retries = 0
    
    func attempt() {
        request()
        // If fails with 500 error and retries < maxRetries
        // Wait delay * 2^retries seconds and retry
    }
    
    attempt()
}
```

### 9. Security Considerations

**HTTPS Only:**
- Always use HTTPS in production
- Implement certificate pinning for enhanced security

**Secure Storage:**
- Never store passwords locally
- Rely on session cookies managed by URLSession
- Store sensitive data in iOS Keychain

**API Key Storage:**
- Never hardcode server URLs or credentials in the app
- Use configuration files or remote config

---

## CORS Configuration

If you're testing from a web view or need CORS support for development, you'll need to add CORS headers to the API responses.

**Adding CORS to Astro API Routes:**

Add this middleware to your API routes:

```typescript
// src/lib/cors.ts
export function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*'); // Or specific origin
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Cookie');
  headers.set('Access-Control-Allow-Credentials', 'true');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: headers
  });
}
```

**Handle OPTIONS Requests:**

```typescript
export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cookie',
      'Access-Control-Allow-Credentials': 'true'
    }
  });
};
```

**Note:** For a native iOS app, CORS is not required since native apps are not subject to browser CORS policies. CORS is only needed if you're using a web view or developing a web app.

---

## Example iOS Implementation

### Swift Networking Layer

```swift
import Foundation

class ArandorAPIClient {
    static let shared = ArandorAPIClient()
    private let baseURL = "https://your-server.com/api"
    private let session: URLSession
    
    private init() {
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieAcceptPolicy = .always
        configuration.httpShouldSetCookies = true
        configuration.httpCookieStorage = HTTPCookieStorage.shared
        self.session = URLSession(configuration: configuration)
    }
    
    // MARK: - Authentication
    
    func login(username: String, password: String, completion: @escaping (Result<Void, Error>) -> Void) {
        let url = URL(string: "\(baseURL)/auth/login")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["username": username, "password": password]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        
        session.dataTask(with: request) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let httpResponse = response as? HTTPURLResponse else {
                completion(.failure(NSError(domain: "", code: -1)))
                return
            }
            
            if httpResponse.statusCode == 200 {
                completion(.success(()))
            } else {
                completion(.failure(NSError(domain: "", code: httpResponse.statusCode)))
            }
        }.resume()
    }
    
    // MARK: - Characters
    
    func fetchCharacters(completion: @escaping (Result<[Character], Error>) -> Void) {
        let url = URL(string: "\(baseURL)/characters")!
        
        session.dataTask(with: url) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "", code: -1)))
                return
            }
            
            do {
                let characters = try JSONDecoder().decode([Character].self, from: data)
                completion(.success(characters))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
    
    // MARK: - Diary Entries
    
    func fetchDiaryEntries(completion: @escaping (Result<[DiaryEntry], Error>) -> Void) {
        let url = URL(string: "\(baseURL)/diary")!
        
        session.dataTask(with: url) { data, response, error in
            if let error = error {
                completion(.failure(error))
                return
            }
            
            guard let data = data else {
                completion(.failure(NSError(domain: "", code: -1)))
                return
            }
            
            do {
                let entries = try JSONDecoder().decode([DiaryEntry].self, from: data)
                completion(.success(entries))
            } catch {
                completion(.failure(error))
            }
        }.resume()
    }
    
    // Add more methods for other endpoints...
}
```

### Swift Data Models

```swift
import Foundation

struct Character: Codable {
    let id: String
    let name: String
    let `class`: String
    let level: Int
    let race: String
    let player: String
    let userId: String?
    let isActive: Bool
    let avatarUrl: String?
    let dndbeyondUrl: String?
    let stats: CharacterStats?
    let hp: Int?
    let maxHp: Int?
    let tempHp: Int?
    let gender: String?
    let alignment: String?
    let background: String?
    let age: Int?
    let height: String?
    let weight: Int?
    let eyes: String?
    let skin: String?
    let hair: String?
    let createdAt: Date
    let updatedAt: Date
}

struct CharacterStats: Codable {
    let STR: Int?
    let DEX: Int?
    let CON: Int?
    let INT: Int?
    let WIS: Int?
    let CHA: Int?
}

struct DiaryEntry: Codable {
    let id: String
    let date: String
    let title: String
    let content: String
    let summary: String?
    let podcastAudioUrl: String?
    let session: Int
    let tags: [String]
    let coverImageUrl: String?
    let coverVideoUrl: String?
    let npcIds: [String]
    let locationIds: [String]
    let characterIds: [String]
    let questIds: [String]
    let createdAt: Date
    let updatedAt: Date
}

// Add more models for other data types...
```

---

## Summary

This API documentation provides everything needed to build a native iOS app that integrates with the Arandor Companion App backend. The API follows RESTful conventions with:

- **Cookie-based authentication** with role-based access control
- **Comprehensive CRUD operations** for all campaign entities
- **JSON request/response format** for easy parsing
- **Consistent error handling** with standard HTTP status codes
- **File upload support** for images and videos
- **Optional AI features** for diary entries (summaries, images, podcasts)

The API is production-ready and has been tested with the existing Astro.js web application. All endpoints are documented with request/response formats, authentication requirements, and error handling.

For questions or issues, please refer to the main project repository: https://github.com/danspy/arandor-companion-app
