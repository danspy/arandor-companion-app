# Building a Native iOS App - Quick Start Guide

This guide provides a quick overview of how to build a native iOS app that consumes the Arandor Companion App API.

## Overview

The Arandor Companion App provides a complete REST API that you can use to build a native iOS app in a separate repository. All the data and functionality available in the web app can be accessed through these API endpoints.

## Getting Started

### 1. Read the API Reference

Start by reviewing the complete API documentation:
- **[API_REFERENCE.md](./API_REFERENCE.md)** - Complete API documentation with all endpoints, data models, and examples

### 2. Set Up Your iOS Project

Create a new iOS project in Xcode:
```bash
# In a separate repository
mkdir arandor-ios-app
cd arandor-ios-app
# Create Xcode project or use Swift Package Manager
```

### 3. Configure Networking

Set up URL session with cookie support (see API_REFERENCE.md for complete example):
```swift
let configuration = URLSessionConfiguration.default
configuration.httpCookieAcceptPolicy = .always
configuration.httpShouldSetCookies = true
let session = URLSession(configuration: configuration)
```

### 4. Implement Authentication

Start with the login endpoint:
```swift
POST https://your-server.com/api/auth/login
Body: { "username": "...", "password": "..." }
```

The session cookie will be stored automatically and used for all subsequent requests.

### 5. Fetch Data

Use the documented GET endpoints to retrieve data:
- `/api/characters` - Get all characters
- `/api/diary` - Get diary entries
- `/api/quests` - Get quests
- `/api/npcs` - Get NPCs
- `/api/locations` - Get locations
- And more...

### 6. Implement CRUD Operations

Use POST/PUT/DELETE endpoints to create, update, and delete data (authentication required).

## Key Features

### Available Data

✅ Characters with stats and D&D Beyond integration
✅ Diary entries with markdown content and AI features
✅ Quests with status tracking
✅ NPCs with relationships
✅ Locations with map coordinates
✅ Library entries (campaign lore)
✅ Factions with standings
✅ Campaign progress tracking
✅ Events and calendar (with iCal feed)
✅ Initiative tracker for combat
✅ DM Screen state
✅ Timeline entries
✅ File uploads (images/videos)

### Authentication & Authorization

The API uses role-based access control:
- **Admin** - Full access including user management
- **Dungeon Master** - Can edit all content except users
- **Player** - Can edit most content (diary, characters, etc.)

### Data Models

All data models are documented with TypeScript definitions in the API Reference. Example:

```typescript
interface Character {
  id: string;
  name: string;
  class: string;
  level: number;
  race: string;
  player: string;
  // ... and more fields
}
```

## Architecture Recommendations

### Offline Support

1. Cache all GET responses locally using Core Data or Realm
2. Use `createdAt` and `updatedAt` timestamps for sync
3. Queue create/update/delete operations when offline
4. Sync when connection is restored

### Real-time Updates

For features like initiative tracker that need real-time updates:
1. Poll every 2-5 seconds when viewing real-time content
2. Stop polling when view is inactive
3. Use `updatedAt` timestamps to detect changes

### Image Handling

1. All image URLs are relative (e.g., `/uploads/image.jpg`)
2. Prefix with server base URL: `https://your-server.com/uploads/image.jpg`
3. Download and cache images locally
4. Use placeholder images while loading

### Security

1. Always use HTTPS in production
2. Never store passwords locally (rely on session cookies)
3. Store sensitive data in iOS Keychain
4. Implement certificate pinning for enhanced security

## Example Implementation

See the API_REFERENCE.md file for:
- Complete Swift networking layer example
- Swift data model definitions
- Authentication flow implementation
- Error handling patterns
- Best practices for iOS integration

## API Endpoint Categories

### Core Content
- **Characters** - Player character management
- **Diary** - Session notes and campaign journal
- **Quests** - Quest tracking
- **NPCs** - Non-player character database
- **Locations** - Place catalog with map integration
- **Library** - Campaign lore and knowledge base

### Campaign Management
- **Factions** - Faction standings and relationships
- **Campaign Progress** - Party level and progression
- **Timeline** - Historical events and labels
- **Events** - Session scheduling with calendar integration

### Game Master Tools
- **Initiative Tracker** - Combat initiative order with HP tracking
- **DM Screen** - Control panel for player display
- **Combat State** - Combat round and turn tracking

### System
- **Authentication** - Login/logout
- **Users** - User management (admin only)
- **File Upload** - Image and video uploads
- **Page Settings** - Hero images for pages

## Next Steps

1. Review the complete [API Reference](./API_REFERENCE.md)
2. Set up your iOS project
3. Implement authentication
4. Start with a single feature (e.g., character list)
5. Expand to other features incrementally
6. Implement offline support and caching
7. Add polish and iOS-specific features

## Support

For questions or issues:
- Review the API Reference documentation
- Check the main repository: https://github.com/danspy/arandor-companion-app
- Open an issue for API-related questions

## License

The API is part of the Arandor Companion App (ISC License).
