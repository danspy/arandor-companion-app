# Setting Up an iOS App from Scratch in Xcode

This guide provides step-by-step instructions for creating a new iOS app in Xcode that consumes the Arandor Companion App API.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Creating a New Project](#creating-a-new-project)
3. [Project Structure](#project-structure)
4. [Setting Up Networking](#setting-up-networking)
5. [Implementing Data Models](#implementing-data-models)
6. [Building the API Client](#building-the-api-client)
7. [Authentication Flow](#authentication-flow)
8. [Creating Views](#creating-views)
9. [Testing Your App](#testing-your-app)
10. [Next Steps](#next-steps)

---

## Prerequisites

Before you begin, ensure you have:

- **macOS** (Ventura 13.0 or later recommended)
- **Xcode 15.0+** (download from Mac App Store)
- **Apple Developer Account** (free account is sufficient for local testing)
- **Swift 5.9+** (included with Xcode)
- **Access to Arandor Companion App API** (server URL and credentials)

---

## Creating a New Project

### Step 1: Launch Xcode

1. Open **Xcode** from your Applications folder
2. If you see the welcome screen, click **"Create New Project"**
3. Or go to **File → New → Project...** (⌘⇧N)

### Step 2: Choose Project Template

1. Select **iOS** tab at the top
2. Choose **App** template
3. Click **Next**

![Xcode Template Selection](https://developer.apple.com/assets/elements/icons/xcode/xcode-96x96_2x.png)

### Step 3: Configure Project Options

Fill in the project details:

- **Product Name:** `ArandorCompanion` (or your preferred name)
- **Team:** Select your team (or "None" for local development)
- **Organization Identifier:** `com.yourcompany` (reverse domain notation)
- **Bundle Identifier:** Will auto-generate as `com.yourcompany.ArandorCompanion`
- **Interface:** Select **SwiftUI**
- **Language:** **Swift**
- **Storage:** Select **SwiftData** (optional, for local caching)

### Step 4: Choose Location

1. Select where to save your project
2. **Create Git repository on my Mac:** ✓ (recommended)
3. Click **Create**

---

## Project Structure

After creation, your project structure should look like:

```
ArandorCompanion/
├── ArandorCompanion.xcodeproj
├── ArandorCompanion/
│   ├── ArandorCompanionApp.swift    # App entry point
│   ├── ContentView.swift            # Main view
│   ├── Assets.xcassets/             # Images and colors
│   ├── Preview Content/             # Preview assets
│   └── Info.plist                   # App configuration
```

We'll organize our code into the following structure:

```
ArandorCompanion/
├── App/
│   └── ArandorCompanionApp.swift
├── Networking/
│   ├── APIClient.swift
│   ├── APIEndpoints.swift
│   └── NetworkError.swift
├── Models/
│   ├── Character.swift
│   ├── DiaryEntry.swift
│   ├── Quest.swift
│   ├── NPC.swift
│   └── Location.swift
├── ViewModels/
│   ├── CharacterListViewModel.swift
│   ├── DiaryViewModel.swift
│   └── AuthViewModel.swift
├── Views/
│   ├── Authentication/
│   │   └── LoginView.swift
│   ├── Characters/
│   │   ├── CharacterListView.swift
│   │   └── CharacterDetailView.swift
│   ├── Diary/
│   │   ├── DiaryListView.swift
│   │   └── DiaryDetailView.swift
│   └── ContentView.swift
└── Utilities/
    ├── Config.swift
    └── Extensions.swift
```

---

## Setting Up Networking

### Step 1: Create Config File

Create a new Swift file: **File → New → File...** (⌘N), select **Swift File**, name it `Config.swift`

```swift
//
//  Config.swift
//  ArandorCompanion
//

import Foundation

enum Config {
    // MARK: - API Configuration
    
    /// Base URL for the Arandor Companion App API
    /// Change this to your server's URL
    static let baseURL = "https://your-server.com"
    
    /// API base path
    static let apiPath = "/api"
    
    /// Full API URL
    static var apiURL: String {
        return baseURL + apiPath
    }
    
    // MARK: - App Configuration
    
    /// App version
    static let appVersion = "1.0.0"
    
    /// Enable debug logging
    #if DEBUG
    static let debugMode = true
    #else
    static let debugMode = false
    #endif
}
```

### Step 2: Create Network Error Handling

Create `NetworkError.swift`:

```swift
//
//  NetworkError.swift
//  ArandorCompanion
//

import Foundation

enum NetworkError: LocalizedError {
    case invalidURL
    case noData
    case decodingError(Error)
    case httpError(statusCode: Int, message: String?)
    case unauthorized
    case forbidden
    case notFound
    case serverError
    case unknown(Error)
    
    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case .noData:
            return "No data received from server"
        case .decodingError(let error):
            return "Failed to decode response: \(error.localizedDescription)"
        case .httpError(let statusCode, let message):
            return "HTTP \(statusCode): \(message ?? "Unknown error")"
        case .unauthorized:
            return "Unauthorized. Please log in again."
        case .forbidden:
            return "You don't have permission to perform this action."
        case .notFound:
            return "The requested resource was not found."
        case .serverError:
            return "Server error. Please try again later."
        case .unknown(let error):
            return "An unexpected error occurred: \(error.localizedDescription)"
        }
    }
}
```

### Step 3: Create API Endpoints

Create `APIEndpoints.swift`:

```swift
//
//  APIEndpoints.swift
//  ArandorCompanion
//

import Foundation

enum APIEndpoint {
    // Authentication
    case login
    case logout
    
    // Characters
    case characters
    case character(id: String)
    
    // Diary
    case diary
    case diaryEntry(id: String)
    
    // Quests
    case quests
    case quest(id: String)
    
    // NPCs
    case npcs
    case npc(id: String)
    
    // Locations
    case locations
    case location(id: String)
    
    // Library
    case library
    case libraryEntry(id: String)
    
    // Factions
    case factions
    case faction(id: String)
    
    // Campaign Progress
    case campaignProgress
    case campaignProgressDetail(id: String)
    
    // Events
    case events
    case event(id: String)
    
    // Initiative Tracker
    case initiative
    case initiativeEntry(id: String)
    
    // Profile
    case profile
    
    var path: String {
        switch self {
        case .login:
            return "/auth/login"
        case .logout:
            return "/auth/logout"
        case .characters:
            return "/characters"
        case .character(let id):
            return "/characters/\(id)"
        case .diary:
            return "/diary"
        case .diaryEntry(let id):
            return "/diary/\(id)"
        case .quests:
            return "/quests"
        case .quest(let id):
            return "/quests/\(id)"
        case .npcs:
            return "/npcs"
        case .npc(let id):
            return "/npcs/\(id)"
        case .locations:
            return "/locations"
        case .location(let id):
            return "/locations/\(id)"
        case .library:
            return "/library"
        case .libraryEntry(let id):
            return "/library/\(id)"
        case .factions:
            return "/factions"
        case .faction(let id):
            return "/factions/\(id)"
        case .campaignProgress:
            return "/campaign-progress"
        case .campaignProgressDetail(let id):
            return "/campaign-progress/\(id)"
        case .events:
            return "/events"
        case .event(let id):
            return "/events/\(id)"
        case .initiative:
            return "/initiative"
        case .initiativeEntry(let id):
            return "/initiative/\(id)"
        case .profile:
            return "/profile"
        }
    }
    
    var fullURL: String {
        return Config.apiURL + path
    }
}
```

---

## Implementing Data Models

### Step 1: Create Character Model

Create `Character.swift`:

```swift
//
//  Character.swift
//  ArandorCompanion
//

import Foundation

struct Character: Codable, Identifiable {
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
    
    // Computed property for display
    var displayName: String {
        return "\(name) - Level \(level) \(race) \(`class`)"
    }
}

struct CharacterStats: Codable {
    let STR: Int?
    let DEX: Int?
    let CON: Int?
    let INT: Int?
    let WIS: Int?
    let CHA: Int?
}
```

### Step 2: Create Diary Entry Model

Create `DiaryEntry.swift`:

```swift
//
//  DiaryEntry.swift
//  ArandorCompanion
//

import Foundation

struct DiaryEntry: Codable, Identifiable {
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
    
    // Computed property for formatted date
    var formattedDate: String {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        return formatter.string(from: Date())
    }
}
```

### Step 3: Create Quest Model

Create `Quest.swift`:

```swift
//
//  Quest.swift
//  ArandorCompanion
//

import Foundation

struct Quest: Codable, Identifiable {
    let id: String
    let title: String
    let description: String
    let status: QuestStatus
    let priority: QuestPriority
    let createdAt: Date
    let updatedAt: Date
}

enum QuestStatus: String, Codable {
    case active
    case completed
    case failed
}

enum QuestPriority: String, Codable {
    case high
    case medium
    case low
}
```

### Step 4: Create NPC Model

Create `NPC.swift`:

```swift
//
//  NPC.swift
//  ArandorCompanion
//

import Foundation

struct NPC: Codable, Identifiable {
    let id: String
    let name: String
    let race: String
    let occupation: String?
    let location: String?
    let locationId: String?
    let description: String
    let relationship: NPCRelationship
    let notes: String?
    let avatarUrl: String?
    let createdAt: Date
    let updatedAt: Date
}

enum NPCRelationship: String, Codable {
    case ally
    case neutral
    case enemy
}
```

### Step 5: Create Location Model

Create `Location.swift`:

```swift
//
//  Location.swift
//  ArandorCompanion
//

import Foundation

struct Location: Codable, Identifiable {
    let id: String
    let name: String
    let type: LocationType
    let description: String
    let region: String?
    let visited: Bool
    let notes: String?
    let imageUrl: String?
    let mapX: Double?
    let mapY: Double?
    let visibleOnMap: Bool
    let createdAt: Date
    let updatedAt: Date
}

enum LocationType: String, Codable {
    case city
    case dungeon
    case wilderness
    case building
    case other
}
```

---

## Building the API Client

### Step 1: Create API Client

Create `APIClient.swift`:

```swift
//
//  APIClient.swift
//  ArandorCompanion
//

import Foundation

class APIClient: ObservableObject {
    static let shared = APIClient()
    
    private let session: URLSession
    private let jsonDecoder: JSONDecoder
    private let jsonEncoder: JSONEncoder
    
    @Published var isAuthenticated = false
    
    private init() {
        // Configure URL session to handle cookies
        let configuration = URLSessionConfiguration.default
        configuration.httpCookieAcceptPolicy = .always
        configuration.httpShouldSetCookies = true
        configuration.httpCookieStorage = HTTPCookieStorage.shared
        
        self.session = URLSession(configuration: configuration)
        
        // Configure JSON decoder for date handling
        self.jsonDecoder = JSONDecoder()
        self.jsonDecoder.dateDecodingStrategy = .iso8601
        
        self.jsonEncoder = JSONEncoder()
        self.jsonEncoder.dateEncodingStrategy = .iso8601
        
        // Check if we have existing cookies (already authenticated)
        checkAuthenticationStatus()
    }
    
    // MARK: - Authentication
    
    func login(username: String, password: String) async throws {
        let url = URL(string: APIEndpoint.login.fullURL)!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        let body = ["username": username, "password": password]
        request.httpBody = try jsonEncoder.encode(body)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown(NSError(domain: "", code: -1))
        }
        
        switch httpResponse.statusCode {
        case 200:
            if Config.debugMode {
                print("✅ Login successful")
            }
            DispatchQueue.main.async {
                self.isAuthenticated = true
            }
        case 401:
            throw NetworkError.unauthorized
        default:
            let errorMessage = try? JSONDecoder().decode([String: String].self, from: data)
            throw NetworkError.httpError(statusCode: httpResponse.statusCode, 
                                        message: errorMessage?["error"])
        }
    }
    
    func logout() async throws {
        let url = URL(string: APIEndpoint.logout.fullURL)!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        
        let (_, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown(NSError(domain: "", code: -1))
        }
        
        if httpResponse.statusCode == 200 {
            // Clear cookies
            if let cookies = HTTPCookieStorage.shared.cookies {
                for cookie in cookies {
                    HTTPCookieStorage.shared.deleteCookie(cookie)
                }
            }
            
            DispatchQueue.main.async {
                self.isAuthenticated = false
            }
        }
    }
    
    private func checkAuthenticationStatus() {
        // Check if we have a session cookie
        if let cookies = HTTPCookieStorage.shared.cookies,
           cookies.contains(where: { $0.name == "session" }) {
            DispatchQueue.main.async {
                self.isAuthenticated = true
            }
        }
    }
    
    // MARK: - Generic Request Methods
    
    func get<T: Decodable>(_ endpoint: APIEndpoint) async throws -> T {
        let url = URL(string: endpoint.fullURL)!
        var request = URLRequest(url: url)
        request.httpMethod = "GET"
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown(NSError(domain: "", code: -1))
        }
        
        try handleHTTPResponse(httpResponse, data: data)
        
        do {
            let decoded = try jsonDecoder.decode(T.self, from: data)
            return decoded
        } catch {
            if Config.debugMode {
                print("❌ Decoding error: \(error)")
                if let jsonString = String(data: data, encoding: .utf8) {
                    print("Response: \(jsonString)")
                }
            }
            throw NetworkError.decodingError(error)
        }
    }
    
    func post<T: Encodable, R: Decodable>(_ endpoint: APIEndpoint, body: T) async throws -> R {
        let url = URL(string: endpoint.fullURL)!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        request.httpBody = try jsonEncoder.encode(body)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown(NSError(domain: "", code: -1))
        }
        
        try handleHTTPResponse(httpResponse, data: data)
        
        do {
            let decoded = try jsonDecoder.decode(R.self, from: data)
            return decoded
        } catch {
            throw NetworkError.decodingError(error)
        }
    }
    
    func put<T: Encodable, R: Decodable>(_ endpoint: APIEndpoint, body: T) async throws -> R {
        let url = URL(string: endpoint.fullURL)!
        var request = URLRequest(url: url)
        request.httpMethod = "PUT"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        
        request.httpBody = try jsonEncoder.encode(body)
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown(NSError(domain: "", code: -1))
        }
        
        try handleHTTPResponse(httpResponse, data: data)
        
        do {
            let decoded = try jsonDecoder.decode(R.self, from: data)
            return decoded
        } catch {
            throw NetworkError.decodingError(error)
        }
    }
    
    func delete(_ endpoint: APIEndpoint) async throws {
        let url = URL(string: endpoint.fullURL)!
        var request = URLRequest(url: url)
        request.httpMethod = "DELETE"
        
        let (data, response) = try await session.data(for: request)
        
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NetworkError.unknown(NSError(domain: "", code: -1))
        }
        
        try handleHTTPResponse(httpResponse, data: data)
    }
    
    private func handleHTTPResponse(_ response: HTTPURLResponse, data: Data) throws {
        switch response.statusCode {
        case 200...299:
            return
        case 401:
            DispatchQueue.main.async {
                self.isAuthenticated = false
            }
            throw NetworkError.unauthorized
        case 403:
            throw NetworkError.forbidden
        case 404:
            throw NetworkError.notFound
        case 500...599:
            throw NetworkError.serverError
        default:
            let errorMessage = try? JSONDecoder().decode([String: String].self, from: data)
            throw NetworkError.httpError(statusCode: response.statusCode, 
                                        message: errorMessage?["error"])
        }
    }
    
    // MARK: - Convenience Methods
    
    func fetchCharacters() async throws -> [Character] {
        return try await get(.characters)
    }
    
    func fetchCharacter(id: String) async throws -> Character {
        return try await get(.character(id: id))
    }
    
    func fetchDiaryEntries() async throws -> [DiaryEntry] {
        return try await get(.diary)
    }
    
    func fetchDiaryEntry(id: String) async throws -> DiaryEntry {
        return try await get(.diaryEntry(id: id))
    }
    
    func fetchQuests() async throws -> [Quest] {
        return try await get(.quests)
    }
    
    func fetchNPCs() async throws -> [NPC] {
        return try await get(.npcs)
    }
    
    func fetchLocations() async throws -> [Location] {
        return try await get(.locations)
    }
}
```

---

## Authentication Flow

### Step 1: Create Auth ViewModel

Create `AuthViewModel.swift`:

```swift
//
//  AuthViewModel.swift
//  ArandorCompanion
//

import Foundation

@MainActor
class AuthViewModel: ObservableObject {
    @Published var username = ""
    @Published var password = ""
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var isAuthenticated = false
    
    private let apiClient = APIClient.shared
    
    init() {
        // Observe authentication state from API client
        self.isAuthenticated = apiClient.isAuthenticated
    }
    
    func login() async {
        guard !username.isEmpty, !password.isEmpty else {
            errorMessage = "Please enter username and password"
            return
        }
        
        isLoading = true
        errorMessage = nil
        
        do {
            try await apiClient.login(username: username, password: password)
            isAuthenticated = true
            // Clear password for security
            password = ""
        } catch let error as NetworkError {
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = "An unexpected error occurred"
        }
        
        isLoading = false
    }
    
    func logout() async {
        isLoading = true
        
        do {
            try await apiClient.logout()
            isAuthenticated = false
            username = ""
            password = ""
        } catch {
            errorMessage = "Failed to logout"
        }
        
        isLoading = false
    }
}
```

### Step 2: Create Login View

Create `LoginView.swift`:

```swift
//
//  LoginView.swift
//  ArandorCompanion
//

import SwiftUI

struct LoginView: View {
    @StateObject private var viewModel = AuthViewModel()
    
    var body: some View {
        NavigationView {
            VStack(spacing: 20) {
                // Logo or Title
                Image(systemName: "shield.lefthalf.filled")
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .frame(width: 100, height: 100)
                    .foregroundColor(.blue)
                
                Text("Arandor Companion")
                    .font(.largeTitle)
                    .fontWeight(.bold)
                
                // Login Form
                VStack(spacing: 15) {
                    TextField("Username", text: $viewModel.username)
                        .textFieldStyle(.roundedBorder)
                        .textInputAutocapitalization(.never)
                        .autocorrectionDisabled()
                    
                    SecureField("Password", text: $viewModel.password)
                        .textFieldStyle(.roundedBorder)
                    
                    if let errorMessage = viewModel.errorMessage {
                        Text(errorMessage)
                            .foregroundColor(.red)
                            .font(.caption)
                    }
                    
                    Button(action: {
                        Task {
                            await viewModel.login()
                        }
                    }) {
                        if viewModel.isLoading {
                            ProgressView()
                                .progressViewStyle(CircularProgressViewStyle(tint: .white))
                        } else {
                            Text("Login")
                                .fontWeight(.semibold)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.blue)
                    .foregroundColor(.white)
                    .cornerRadius(10)
                    .disabled(viewModel.isLoading)
                }
                .padding(.horizontal, 40)
                
                Spacer()
            }
            .padding()
            .navigationTitle("Login")
        }
    }
}

#Preview {
    LoginView()
}
```

---

## Creating Views

### Step 1: Create Character List View

Create `CharacterListView.swift`:

```swift
//
//  CharacterListView.swift
//  ArandorCompanion
//

import SwiftUI

struct CharacterListView: View {
    @StateObject private var viewModel = CharacterListViewModel()
    
    var body: some View {
        NavigationView {
            Group {
                if viewModel.isLoading {
                    ProgressView("Loading characters...")
                } else if let errorMessage = viewModel.errorMessage {
                    VStack {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.largeTitle)
                            .foregroundColor(.orange)
                        Text(errorMessage)
                            .multilineTextAlignment(.center)
                            .padding()
                        Button("Retry") {
                            Task {
                                await viewModel.loadCharacters()
                            }
                        }
                    }
                } else {
                    List(viewModel.characters) { character in
                        NavigationLink(destination: CharacterDetailView(character: character)) {
                            CharacterRowView(character: character)
                        }
                    }
                    .refreshable {
                        await viewModel.loadCharacters()
                    }
                }
            }
            .navigationTitle("Characters")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button(action: {
                        Task {
                            await viewModel.loadCharacters()
                        }
                    }) {
                        Image(systemName: "arrow.clockwise")
                    }
                }
            }
        }
        .task {
            await viewModel.loadCharacters()
        }
    }
}

struct CharacterRowView: View {
    let character: Character
    
    var body: some View {
        HStack {
            // Avatar placeholder
            Circle()
                .fill(Color.gray.opacity(0.3))
                .frame(width: 50, height: 50)
                .overlay(
                    Text(String(character.name.prefix(1)))
                        .font(.title2)
                        .foregroundColor(.white)
                )
            
            VStack(alignment: .leading) {
                Text(character.name)
                    .font(.headline)
                Text("Level \(character.level) \(character.race) \(character.`class`)")
                    .font(.subheadline)
                    .foregroundColor(.secondary)
            }
            
            Spacer()
            
            if character.isActive {
                Image(systemName: "circle.fill")
                    .foregroundColor(.green)
                    .font(.caption)
            }
        }
        .padding(.vertical, 4)
    }
}

@MainActor
class CharacterListViewModel: ObservableObject {
    @Published var characters: [Character] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    
    private let apiClient = APIClient.shared
    
    func loadCharacters() async {
        isLoading = true
        errorMessage = nil
        
        do {
            characters = try await apiClient.fetchCharacters()
        } catch let error as NetworkError {
            errorMessage = error.localizedDescription
        } catch {
            errorMessage = "Failed to load characters"
        }
        
        isLoading = false
    }
}

#Preview {
    CharacterListView()
}
```

### Step 2: Create Character Detail View

Create `CharacterDetailView.swift`:

```swift
//
//  CharacterDetailView.swift
//  ArandorCompanion
//

import SwiftUI

struct CharacterDetailView: View {
    let character: Character
    
    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                // Header
                HStack {
                    Circle()
                        .fill(Color.gray.opacity(0.3))
                        .frame(width: 80, height: 80)
                        .overlay(
                            Text(String(character.name.prefix(1)))
                                .font(.largeTitle)
                                .foregroundColor(.white)
                        )
                    
                    VStack(alignment: .leading) {
                        Text(character.name)
                            .font(.title)
                            .fontWeight(.bold)
                        Text("Level \(character.level) \(character.race) \(character.`class`)")
                            .font(.headline)
                            .foregroundColor(.secondary)
                        if let player = character.player as String? {
                            Text("Played by \(player)")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                        }
                    }
                    
                    Spacer()
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(10)
                
                // Stats
                if let stats = character.stats {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Ability Scores")
                            .font(.headline)
                        
                        LazyVGrid(columns: [
                            GridItem(.flexible()),
                            GridItem(.flexible()),
                            GridItem(.flexible())
                        ], spacing: 10) {
                            if let str = stats.STR {
                                StatView(name: "STR", value: str)
                            }
                            if let dex = stats.DEX {
                                StatView(name: "DEX", value: dex)
                            }
                            if let con = stats.CON {
                                StatView(name: "CON", value: con)
                            }
                            if let int = stats.INT {
                                StatView(name: "INT", value: int)
                            }
                            if let wis = stats.WIS {
                                StatView(name: "WIS", value: wis)
                            }
                            if let cha = stats.CHA {
                                StatView(name: "CHA", value: cha)
                            }
                        }
                    }
                    .padding()
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(10)
                }
                
                // HP
                if let hp = character.hp, let maxHp = character.maxHp {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Hit Points")
                            .font(.headline)
                        
                        HStack {
                            Text("\(hp) / \(maxHp)")
                                .font(.title2)
                            
                            if let tempHp = character.tempHp, tempHp > 0 {
                                Text("+\(tempHp) temp")
                                    .font(.subheadline)
                                    .foregroundColor(.blue)
                            }
                            
                            Spacer()
                            
                            // HP Progress bar
                            ProgressView(value: Double(hp), total: Double(maxHp))
                                .frame(width: 100)
                        }
                    }
                    .padding()
                    .background(Color.gray.opacity(0.1))
                    .cornerRadius(10)
                }
                
                // Additional Details
                VStack(alignment: .leading, spacing: 10) {
                    Text("Details")
                        .font(.headline)
                    
                    if let alignment = character.alignment {
                        DetailRow(label: "Alignment", value: alignment)
                    }
                    if let background = character.background {
                        DetailRow(label: "Background", value: background)
                    }
                    if let age = character.age {
                        DetailRow(label: "Age", value: "\(age)")
                    }
                    if let height = character.height {
                        DetailRow(label: "Height", value: height)
                    }
                    if let weight = character.weight {
                        DetailRow(label: "Weight", value: "\(weight) lbs")
                    }
                }
                .padding()
                .background(Color.gray.opacity(0.1))
                .cornerRadius(10)
                
                // D&D Beyond Link
                if let dndbeyondUrl = character.dndbeyondUrl, let url = URL(string: dndbeyondUrl) {
                    Link(destination: url) {
                        HStack {
                            Image(systemName: "link")
                            Text("View on D&D Beyond")
                        }
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .foregroundColor(.white)
                        .cornerRadius(10)
                    }
                }
            }
            .padding()
        }
        .navigationTitle(character.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}

struct StatView: View {
    let name: String
    let value: Int
    
    var modifier: Int {
        return (value - 10) / 2
    }
    
    var body: some View {
        VStack {
            Text(name)
                .font(.caption)
                .foregroundColor(.secondary)
            Text("\(value)")
                .font(.title2)
                .fontWeight(.bold)
            Text(modifier >= 0 ? "+\(modifier)" : "\(modifier)")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity)
        .background(Color.white)
        .cornerRadius(8)
        .shadow(radius: 2)
    }
}

struct DetailRow: View {
    let label: String
    let value: String
    
    var body: some View {
        HStack {
            Text(label)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .fontWeight(.medium)
        }
    }
}

#Preview {
    NavigationView {
        CharacterDetailView(character: Character(
            id: "1",
            name: "Aragorn",
            class: "Ranger",
            level: 10,
            race: "Human",
            player: "John Doe",
            userId: nil,
            isActive: true,
            avatarUrl: nil,
            dndbeyondUrl: nil,
            stats: CharacterStats(STR: 16, DEX: 14, CON: 15, INT: 10, WIS: 13, CHA: 12),
            hp: 85,
            maxHp: 100,
            tempHp: 5,
            gender: "Male",
            alignment: "Lawful Good",
            background: "Noble",
            age: 87,
            height: "6'2\"",
            weight: 180,
            eyes: "Gray",
            skin: "Fair",
            hair: "Dark",
            createdAt: Date(),
            updatedAt: Date()
        ))
    }
}
```

### Step 3: Update Main Content View

Update `ContentView.swift`:

```swift
//
//  ContentView.swift
//  ArandorCompanion
//

import SwiftUI

struct ContentView: View {
    @StateObject private var authViewModel = AuthViewModel()
    @StateObject private var apiClient = APIClient.shared
    
    var body: some View {
        Group {
            if apiClient.isAuthenticated {
                TabView {
                    CharacterListView()
                        .tabItem {
                            Label("Characters", systemImage: "person.3.fill")
                        }
                    
                    DiaryListView()
                        .tabItem {
                            Label("Diary", systemImage: "book.fill")
                        }
                    
                    QuestListView()
                        .tabItem {
                            Label("Quests", systemImage: "list.bullet")
                        }
                    
                    SettingsView()
                        .tabItem {
                            Label("Settings", systemImage: "gear")
                        }
                }
            } else {
                LoginView()
            }
        }
    }
}

// Placeholder views - implement these following the same pattern as CharacterListView
struct DiaryListView: View {
    var body: some View {
        NavigationView {
            Text("Diary entries will appear here")
                .navigationTitle("Diary")
        }
    }
}

struct QuestListView: View {
    var body: some View {
        NavigationView {
            Text("Quests will appear here")
                .navigationTitle("Quests")
        }
    }
}

struct SettingsView: View {
    @StateObject private var authViewModel = AuthViewModel()
    
    var body: some View {
        NavigationView {
            List {
                Section {
                    Text("Version: \(Config.appVersion)")
                        .foregroundColor(.secondary)
                    Text("Server: \(Config.baseURL)")
                        .foregroundColor(.secondary)
                }
                
                Section {
                    Button("Logout", role: .destructive) {
                        Task {
                            await authViewModel.logout()
                        }
                    }
                }
            }
            .navigationTitle("Settings")
        }
    }
}

#Preview {
    ContentView()
}
```

---

## Testing Your App

### Step 1: Configure Server URL

1. Open `Config.swift`
2. Update `baseURL` to your server's URL:
   ```swift
   static let baseURL = "https://your-actual-server.com"
   ```

### Step 2: Run the App

1. Select a simulator or device from the Xcode toolbar
2. Press **⌘R** or click the Run button (▶️)
3. Wait for the app to build and launch

### Step 3: Test Authentication

1. Enter your username and password on the login screen
2. Tap **Login**
3. If successful, you should see the tab bar with Characters, Diary, Quests, and Settings

### Step 4: Test Character List

1. Navigate to the Characters tab
2. Characters should load automatically
3. Pull down to refresh
4. Tap on a character to view details

### Step 5: Debug Issues

If you encounter issues:

1. **Check Console Logs**
   - Open the debug console in Xcode (⇧⌘Y)
   - Look for error messages

2. **Verify Server Connection**
   - Ensure your server is running
   - Verify the server URL in `Config.swift`
   - Check network connectivity

3. **Cookie Issues**
   - In iOS Simulator: Device → Erase All Content and Settings
   - This clears stored cookies

4. **Enable Debug Mode**
   - Debug mode is enabled in Config.swift by default
   - Logs will show API requests and responses

---

## Next Steps

### Immediate Enhancements

1. **Implement Diary List and Detail Views**
   - Follow the same pattern as Characters
   - Add support for markdown rendering

2. **Add Quest Management**
   - Create QuestListView and QuestDetailView
   - Implement filtering by status

3. **Implement Local Caching**
   - Use SwiftData for offline support
   - Cache API responses

### Advanced Features

1. **Image Loading and Caching**
   ```swift
   // Use AsyncImage with caching
   AsyncImage(url: URL(string: character.avatarUrl ?? "")) { image in
       image.resizable()
   } placeholder: {
       ProgressView()
   }
   ```

2. **Search and Filtering**
   ```swift
   @State private var searchText = ""
   
   var filteredCharacters: [Character] {
       if searchText.isEmpty {
           return characters
       }
       return characters.filter { $0.name.localizedCaseInsensitiveContains(searchText) }
   }
   ```

3. **Create/Edit Functionality**
   - Add forms for creating new characters, quests, etc.
   - Implement validation

4. **Real-time Updates**
   - Implement polling for initiative tracker
   - Use timers to refresh data

5. **Push Notifications**
   - Set up remote notifications for events
   - Handle notification taps

### Testing

1. **Unit Tests**
   - Test your models
   - Test API client methods
   - Test view models

2. **UI Tests**
   - Test login flow
   - Test navigation
   - Test data loading

### Deployment

1. **App Icon and Launch Screen**
   - Add app icons to Assets.xcassets
   - Design a launch screen

2. **Privacy and Permissions**
   - Add privacy descriptions if needed
   - Handle sensitive data securely

3. **TestFlight**
   - Create an Apple Developer account
   - Archive and upload to App Store Connect
   - Distribute via TestFlight

---

## Additional Resources

### Apple Documentation

- [SwiftUI Tutorials](https://developer.apple.com/tutorials/swiftui)
- [URLSession Documentation](https://developer.apple.com/documentation/foundation/urlsession)
- [Codable Documentation](https://developer.apple.com/documentation/swift/codable)

### Community Resources

- [Swift Forums](https://forums.swift.org)
- [Stack Overflow - Swift](https://stackoverflow.com/questions/tagged/swift)
- [Ray Wenderlich](https://www.raywenderlich.com)

### API Documentation

- [Arandor API Reference](./API_REFERENCE.md)
- [Arandor iOS App Guide](./IOS_APP_GUIDE.md)

---

## Troubleshooting

### Common Issues

**Problem:** "Cannot connect to server"
- **Solution:** Verify server URL in Config.swift, ensure server is running

**Problem:** "Unauthorized" after login
- **Solution:** Check credentials, clear cookies and try again

**Problem:** "Decoding error"
- **Solution:** Verify model properties match API response exactly

**Problem:** App crashes on launch
- **Solution:** Check console for error messages, ensure all required files are added to target

**Problem:** Cookies not persisting
- **Solution:** Verify URLSession configuration, check HTTPCookieStorage settings

### Getting Help

If you need assistance:
1. Check the API Reference documentation
2. Review error messages in Xcode console
3. Test API endpoints using curl or Postman
4. Open an issue in the repository

---

## Summary

You now have a complete iOS app that:
- ✅ Authenticates with the Arandor Companion App API
- ✅ Displays a list of characters
- ✅ Shows detailed character information
- ✅ Handles errors gracefully
- ✅ Supports pull-to-refresh
- ✅ Uses modern SwiftUI and async/await patterns

Build on this foundation to add more features like diary entries, quests, NPCs, locations, and more!

Happy coding! 🎉
