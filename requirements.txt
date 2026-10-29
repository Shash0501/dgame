Requirements Specification
Multiplayer Social Game Platform

Version: 1.1
Status: Initial Product Requirements
Product type: Mobile-first, browser-based multiplayer web application
Primary goal: Build a free-to-host, real-time multiplayer game platform that supports multiple players in private rooms and can be extended to support additional games in the future.

1. Project Overview
1.1 Product Vision

Build a lightweight, interactive, mobile-first website where friends can play multiplayer social games together using their own smartphones.

One player creates a game room and shares a room code or QR code with others. Players join through their mobile browsers without installing an application or creating an account.

The platform initially supports Most Likely To, a game in which players receive a prompt and vote for the participant who best fits it. Results are revealed after everyone votes or the round timer expires.

The application must be designed as a reusable platform so that additional game types can be added without rebuilding the room management, player management, real-time communication, or hosting infrastructure.

1.2 Product Objectives
Provide a simple, engaging multiplayer experience for groups of approximately 4–14 players.
Allow players to join a game using a short room code or shareable link.
Synchronize game state, voting, timers, and results across all connected devices.
Require no installation or mandatory player registration.
Work well on mobile devices, particularly smartphones.
Support the addition of multiple independent game types.
Operate using free hosting and backend service tiers during initial development and usage.
Minimize maintenance, infrastructure complexity, and operating costs.
1.3 Target Audience
Groups of friends who want to play interactive games together.
People participating in social gatherings.
Groups looking for browser-based games that require no installation.
Hosts who want to manage game sessions from their phones.
1.4 Non-Goals for the Initial Release

The first release will not include:

Public matchmaking or a global lobby.
User accounts, permanent profiles, or friend lists.
Payments, subscriptions, or advertisements.
Voice or video chat.
Native Android or iOS applications.
Public leaderboards across different rooms.
AI-generated questions.
Complex ranking or matchmaking algorithms.

These features may be considered in future versions if needed.

2. Recommended Technology and Hosting Strategy

The application must be designed around free-tier hosting and services.

2.1 Proposed Technology Stack
Component	Recommended technology	Purpose
Frontend	React with TypeScript	Build the interactive web application
Build tool	Vite	Fast development and production builds
Styling	Tailwind CSS	Responsive, mobile-first interface
Frontend hosting	Vercel Hobby or Cloudflare Pages	Host the website over HTTPS
Backend and database	Supabase	Store rooms, players, questions, votes, and game state
Real-time updates	Supabase Realtime	Synchronize players, votes, and round changes
Source control	GitHub	Store source code and support deployments
Automated testing	Vitest and Playwright	Unit, integration, and browser testing

The preferred initial combination is React + TypeScript + Vite + Supabase + Vercel.

The architecture should avoid unnecessary services, paid APIs, server infrastructure, and third-party dependencies that are not essential to the core experience.

The final hosting choice must be checked against the applicable terms and limits of each provider's free plan before launch.

2.2 Free-Tier Requirements
The frontend must be deployable to a free hosting plan.
The database and real-time features must fit within the chosen backend's free quotas.
The application must not require a paid domain; the provider's free subdomain is sufficient.
The system must not depend on a continuously running, paid server.
No paid API keys should be required for the core gameplay experience.
The application must remain usable without analytics or other optional paid services.
The application must document all free-tier limits and potential upgrade triggers.

Free hosting is a deployment target, not a guarantee of unlimited availability. Free-tier quotas, inactivity policies, and provider terms may change.

2.3 Cost-Control Requirements
Set up usage monitoring and quota alerts where available.
Avoid unnecessary database writes and frequent full-state synchronization.
Use lightweight database queries and appropriate indexes.
Avoid polling when real-time subscriptions are sufficient.
Disconnect unused real-time subscriptions.
Avoid storing unnecessary player data or historical session data.
Apply retention rules to expired rooms and abandoned sessions.
Ensure the application degrades gracefully if a service reaches its quota.
3. User Roles
3.1 Host

The host creates and controls a game room.

The host can:

Create a room.
Select a game and configure available settings.
Share the room code or QR code.
View joined participants.
Start the game when the minimum player requirement is met.
Control round progression when host-controlled progression is enabled.
Skip a question or end a session.
Restart or replay a game where supported.
Remove disruptive participants when necessary.

The host is also a participant by default, unless a future game explicitly supports a spectator-only host.

3.2 Player

A player joins a room using a room code or shareable link.

The player can:

Enter a display name.
View the room lobby and participant list.
Participate in the selected game.
Submit votes or game-specific actions.
See round results when they are revealed.
Reconnect after a temporary connection loss.
Leave the room voluntarily.

Players must not be able to modify another player's identity, votes, or permissions.

3.3 System

The system is responsible for:

Generating unique room codes.
Managing room and game states.
Synchronizing game events.
Validating player actions.
Enforcing game rules and round timers.
Calculating results.
Expiring inactive rooms.
Handling connection interruptions and invalid requests.
4. Core Functional Requirements
4.1 Room Creation and Joining

FR-001: The host must be able to create a new room.

FR-002: Each room must receive a unique, easy-to-share room code.

FR-003: Each room must have a shareable URL.

FR-004: The interface should support generating a QR code for the room URL.

FR-005: Players must be able to join using either the room code or the shared URL.

FR-006: Players must enter a display name before joining.

FR-007: The system must prevent duplicate active player identities within the same room, using a consistent comparison rule.

FR-008: The system must display a clear error for invalid codes, expired rooms, full rooms, and unavailable sessions.

FR-009: The initial target is 4–14 players per room. The maximum player count must be configurable rather than hard-coded into the game engine.

FR-010: The host must be able to start the game when the selected game's minimum player requirement is satisfied.

FR-011: The room lobby must update automatically as players join or leave.

4.2 Lobby

FR-012: The lobby must display the room code, game name, and current participants.

FR-013: The lobby must show when a player is connected or temporarily disconnected.

FR-014: The host must have a clear Start Game action.

FR-015: Players must be informed when the host starts the game.

FR-016: The system must prevent unauthorized users from starting or controlling a room.

FR-017: The host must be able to remove a player from the room.

FR-018: A removed player must not be able to continue submitting game actions to that room.

4.3 Game Session Management

FR-019: Each room must have a defined lifecycle:

Waiting for players
Starting
In progress
Round results
Game completed
Cancelled or expired

FR-020: The system must prevent invalid state transitions.

FR-021: The host must be able to end the current session.

FR-022: The host must be able to start a new session without requiring participants to reload the website manually.

FR-023: The application must synchronize round changes across all connected players.

FR-024: The system must retain enough session state to allow players to recover after a temporary disconnection.

FR-025: The system must handle a host disconnecting. The session should remain recoverable, and host permissions should transfer according to a defined host-recovery policy.

5. Initial Game: Most Likely To
5.1 Game Overview

Players are shown a question beginning with “Who is most likely to…?” Each player selects one eligible participant. After voting closes, the system reveals the results.

The game must be implemented as an independent game module using the shared platform infrastructure.

5.2 Game Configuration

The host should be able to configure:

Number of rounds.
Question categories.
Random or manually selected questions.
Round duration.
Whether custom questions are enabled.
Whether the host participates.
Whether results show vote counts only or also reveal individual votes.
Whether a player can be selected as their own answer.

Default settings should be provided so the host can start quickly without configuring every option.

5.3 Question Categories

The initial question library should include:

Funny
Flirty
Secrets
Friendship
Savage
Relationships
Hypothetical situations

Questions must be stored separately from the game engine so that the library can be expanded or edited without changing gameplay code.

5.4 Round Flow

FR-026: The system must select or load a question for each round.

FR-027: The same question must be displayed to all players in the room.

FR-028: Each connected player must be able to select one eligible participant.

FR-029: A player must not be allowed to submit more than one active vote per round.

FR-030: A player must be able to change their vote before the round closes, if enabled in the game configuration.

FR-031: The system must track which players have submitted a vote.

FR-032: Individual votes must remain hidden until the configured reveal stage.

FR-033: A round must close when the host ends voting or the server-controlled deadline is reached.

FR-034: The system must reject votes submitted after the round has closed.

FR-035: The results screen must display vote totals and highlight the participant or participants receiving the most votes.

FR-036: Ties must be handled explicitly. All participants tied for the highest vote count should be highlighted.

FR-037: Players must be able to proceed to the next round when the host starts it or automatic progression is enabled.

FR-038: The game must show a completion screen after the configured number of rounds.

5.5 Scoring

The initial game should support optional scoring.

Each vote contributes to the selected participant's round total.
The player receiving the most votes is highlighted.
If multiple participants tie, all are highlighted.
A cumulative score or leaderboard may be enabled as an optional game setting.
The game must not require a scoring system to function.

The scoring rules must be configurable by the game module, allowing future games to define their own scoring mechanisms.

5.6 Question Management

FR-039: Questions must be stored in a structured database table or equivalent content source.

FR-040: Each question must have a unique identifier, text, category, status, and optional metadata.

FR-041: The system must support adding new questions without modifying the frontend's core game logic.

FR-042: The system must prevent the same question from being repeated within a session unless the available question pool is exhausted or repetition is explicitly enabled.

FR-043: Custom questions must be validated for length and basic input safety.

FR-044: Questions must be displayed in a way that remains readable on small screens.

6. Extensible Multi-Game Architecture

This is a critical architectural requirement.

The platform must not be built as a single application containing hard-coded logic exclusively for Most Likely To.

6.1 Game Registry

The system must maintain a game registry containing metadata for each supported game.

Each game entry should define:

Unique game identifier.
Game name.
Short description.
Icon or visual identifier.
Minimum and maximum player counts.
Configuration options.
Supported game states.
Game-specific instructions.
Whether the game supports scoring.
Whether the game supports custom content.

The lobby and game selection interface must read from this registry rather than hard-code a single game.

6.2 Game Module Contract

Every game must implement a consistent interface or contract.

At minimum, a game module should define:

getMetadata() — returns game information.
getDefaultSettings() — returns default configuration.
validateSettings() — validates the host's configuration.
initializeGame() — initializes a session.
handleAction() — validates and processes player actions.
advanceState() — advances the game to its next state.
calculateResults() — calculates game-specific results.
getPlayerView() — returns the state a particular player is permitted to see.

These functions are illustrative interface names. The implementation may use an equivalent TypeScript interface or structured module contract.

Game modules must not directly depend on the implementation details of other games.

6.3 Shared Platform Services

The following functionality must be reusable across all games:

Room creation and joining.
Player identity within a room.
Lobby and presence management.
Host permissions.
Real-time communication.
Game state persistence.
Timer management.
Reconnection handling.
Error handling.
Session cleanup.
Common mobile UI components.
6.4 Adding a New Game

Adding a future game should primarily require:

Creating a new game module.
Defining its rules and configuration.
Defining its player actions and state transitions.
Adding any required question or content data.
Registering the game in the game registry.
Writing tests for the new game.

Adding a game should not require rewriting the room management system, player management, or shared real-time infrastructure.

6.5 Game State Isolation

Each session must store its selected game identifier and game-specific state.

The system must prevent a player action intended for one game module from being processed by another.

Game-specific data must be stored in a structured, versioned format so that game modules can evolve without unnecessarily breaking existing sessions.

7. Mobile-First User Interface Requirements
7.1 Design Principles
Mobile-first layout and interactions.
Minimal steps between opening the website and joining a game.
Large touch targets and readable typography.
Minimal typing during gameplay.
Fast transitions between questions and results.
Clear visual distinction between active, selected, submitted, and disabled states.
Consistent design across all supported game modules.
7.2 Required Screens
Home screen
Create room screen
Join room screen
Room lobby
Game selection screen
Game instructions screen
Active gameplay screen
Voting confirmation screen
Round results screen
Final results screen
Reconnection screen
Error and expired-room screens
7.3 Responsive Requirements

NFR-001: The website must work on common smartphone screen widths starting at approximately 320 CSS pixels.

NFR-002: The website must support portrait orientation and remain usable in landscape orientation.

NFR-003: Core actions must be accessible without horizontal scrolling.

NFR-004: Interactive elements should generally have touch targets of at least 44 × 44 CSS pixels.

NFR-005: The layout must adapt to tablets and desktop browsers.

NFR-006: Gameplay must not depend on hover interactions.

NFR-007: The website must provide visible feedback after player actions.

NFR-008: The interface should use accessible color contrast, clear labels, and keyboard-accessible controls.

7.4 Visual Direction

The visual style should be playful, modern, and expressive without sacrificing usability.

Suggested characteristics:

Dark and light theme support where practical.
Bold question cards.
Rounded buttons and cards.
Clear participant avatars or initials.
Subtle animations for voting and results.
Lightweight visual effects.
Limited use of animations that could reduce performance on older phones.

The visual design must remain functional if animations are disabled or fail to load.

8. Real-Time Multiplayer Requirements
8.1 Synchronization

NFR-009: All connected clients must receive room and game updates in near real time.

NFR-010: Under normal network conditions, state changes should appear within approximately one second for most connected players.

NFR-011: The server or trusted backend must be authoritative for room state, voting deadlines, permissions, and final results.

NFR-012: Clients must not be able to determine the official result by submitting arbitrary score values.

NFR-013: Duplicate requests must not create duplicate votes or duplicate state transitions.

8.2 Connection Recovery

NFR-014: A temporary connection loss must not automatically destroy a room.

NFR-015: A player returning to the room must be able to restore their session when their player identity and room authorization remain valid.

NFR-016: The application must distinguish a temporary disconnect from a permanent departure.

NFR-017: The interface must communicate connection status and provide a clear recovery action when required.

NFR-018: The system must handle simultaneous reconnects and repeated client events safely.

8.3 Timer Handling
Round deadlines must be determined by a trusted server-side timestamp.
Client timers should be visual representations of the official deadline.
A player must not gain extra voting time by changing their device clock.
If the host disconnects, the active round should continue according to the configured timer policy.
9. Data Model

The database should use a small set of shared tables and allow game-specific data to be stored separately.

9.1 Suggested Tables

games

id
name
description
metadata
is_enabled
created_at

rooms

id
room_code
host_player_id
selected_game_id
status
settings
created_at
expires_at

players

id
room_id
display_name
session_token_hash
connection_status
joined_at
last_seen_at

game_sessions

id
room_id
game_id
state
state_version
current_round
started_at
completed_at

questions

id
game_id
question_text
category
status
metadata

rounds

id
game_session_id
round_number
question_id
status
deadline_at
results

votes

id
round_id
voter_player_id
selected_player_id
submitted_at

The schema is a starting point, not a requirement to create every table before the first prototype. Some fields may be normalized into separate tables as the implementation evolves.

9.2 Data Integrity
Room codes must be unique while their rooms are active.
A vote must reference a valid round, voter, and selected participant.
A player must not vote in a round belonging to another room.
Unique constraints must prevent duplicate votes where applicable.
Room and player relationships must be validated by the backend.
Timestamps should use a consistent UTC representation.
Expired rooms and sessions must be cleaned up according to a defined retention policy.
10. Security and Privacy

NFR-019: All production traffic must use HTTPS.

NFR-020: Database access must follow least-privilege principles.

NFR-021: Supabase Row Level Security (RLS) must be enabled on exposed tables where applicable.

NFR-022: Secret backend credentials must never be included in frontend code.

NFR-023: The Supabase service-role key must never be exposed to the browser.

NFR-024: The backend must validate all player actions, including votes, room changes, and host commands.

NFR-025: Room codes must not be treated as sufficient authorization for sensitive operations.

NFR-026: Host privileges must be validated independently of the display name.

NFR-027: Input fields must be validated and rendered safely to prevent script injection.

NFR-028: Requests that create rooms, join sessions, or submit actions must be protected against abuse through reasonable rate limits.

NFR-029: Player information must be limited to what is needed for the game.

NFR-030: The system must not expose individual votes before the reveal stage when private voting is enabled.

NFR-031: Session credentials must be generated securely, stored appropriately, and revoked when a player is removed or their session ends.

NFR-032: Expired sessions and retained data must be deleted according to the documented retention policy.

11. Performance and Reliability

NFR-033: The initial application must be tested with at least 14 simultaneous players in a single room.

NFR-034: The system should be architected to support multiple concurrent rooms without changing the fundamental game module architecture.

NFR-035: The frontend should minimize unnecessary JavaScript, large images, and third-party dependencies.

NFR-036: The main gameplay interface should load quickly on a typical mobile connection.

NFR-037: The application must display useful error messages when the backend is unavailable.

NFR-038: A failed request must not leave a player with a false confirmation that their vote was recorded.

NFR-039: The system must handle room expiry, abandoned rooms, and duplicate client events without corrupting game state.

NFR-040: A production build must be tested on current versions of common mobile browsers.

NFR-041: The application must not require persistent client connectivity to load its initial interface, although active multiplayer gameplay requires a working connection.

12. Error Handling

The application must account for:

Invalid or expired room codes.
Rooms that have reached their capacity.
Duplicate display names.
The host disconnecting.
A player losing their connection during a round.
Votes submitted after a deadline.
A player being removed from a room.
A game being cancelled.
A database or real-time service being unavailable.
Free-tier quotas being exhausted.
Invalid game configuration.
A game module failing to initialize.

Errors must be communicated in plain language, with a recovery action wherever possible.

Sensitive technical details and credentials must never appear in user-facing error messages.

13. Testing Requirements
13.1 Unit Tests

Test:

Room code generation.
Game state transitions.
Voting validation.
Duplicate vote prevention.
Result calculation.
Tie handling.
Round timer calculations.
Question selection.
Game module configuration validation.
13.2 Integration Tests

Test:

Creating and joining rooms.
Player authorization.
Real-time room updates.
Vote submission and result synchronization.
Host controls.
Session expiration.
Reconnection.
Database security policies.
Adding and registering a second test game module.
13.3 End-to-End Tests

Using multiple browser sessions, verify:

One host creates a room.
Fourteen participants join.
The host starts the game.
All players see the same question.
Players submit votes.
Votes remain hidden until reveal.
Results are calculated correctly.
A player disconnects and reconnects.
The host ends the session.
A second game can be launched through the same platform.
13.4 Device Testing

At minimum, test:

Android Chrome.
iOS Safari.
Desktop Chrome.
Desktop Firefox or Safari.
14. Deployment and Operations
14.1 Environments

The project should have:

A local development environment.
A production environment.

A separate staging environment may be introduced if it can be maintained within the available free quotas.

14.2 Deployment Workflow
Store source code in GitHub.
Develop and test locally.
Run linting, type checking, and automated tests.
Deploy the frontend through the chosen hosting provider.
Apply database migrations to the backend.
Validate production configuration.
Test room creation, joining, voting, and reconnection using real devices.
14.3 Configuration

Environment-specific settings must be supplied through environment variables or the hosting provider's configuration.

The repository must include an example environment file containing placeholder values only.

Real credentials, service-role keys, and session secrets must not be committed to source control.

14.4 Maintenance
Document database schema and migrations.
Document how to deploy and roll back a release.
Track free-tier quota usage.
Review provider pricing and policies periodically.
Keep dependencies updated.
Remove unused services and packages.
Document how to restore the application after an accidental configuration change.
15. MVP Scope and Delivery Phases
Phase 1: Platform Foundation
Responsive home screen.
Room creation and joining.
Display names and participant lobby.
Room codes and shareable links.
Host permissions.
Database schema and basic real-time synchronization.
Phase 2: First Game
Most Likely To game module.
Question categories and question library.
Private voting.
Round timer.
Results and tie handling.
Next-round progression.
Game completion screen.
Phase 3: Multiplayer Reliability
Reconnection support.
Host disconnect handling.
Server-side vote validation.
Room expiration and cleanup.
Security policies and abuse protection.
Fourteen-player integration tests.
Phase 4: Extensibility
Game registry.
Reusable game module contract.
Shared game configuration interface.
Second sample game module to validate extensibility.
Documentation for adding future games.
Phase 5: Launch Readiness
Mobile browser testing.
Accessibility review.
Performance optimization.
Free-tier usage review.
Production deployment.
Final end-to-end testing.
16. Acceptance Criteria

The initial release is considered complete when:

A host can create a room from a mobile browser.
Fourteen players can join using a code or shareable link.
All players appear in the lobby in real time.
The host can start a Most Likely To session.
All players receive the same question for each round.
Each player can submit one valid vote per round.
Players cannot view private votes before the reveal.
Results are calculated consistently for all connected players.
Ties are handled correctly.
A disconnected player can reconnect when their session remains valid.
Invalid actions and unauthorized host commands are rejected.
The application works on common mobile browsers without installation.
The system can run within the selected providers' free quotas under the intended initial usage.
Expired rooms and old session data are cleaned up.
A second game module can be registered and launched without rewriting the core room management system.
Deployment and setup instructions are available in the repository.
17. Future Enhancements

The architecture should allow, but the initial release does not need to implement:

Additional question-based games.
Team-based games.
Trivia and quiz games.
Word and guessing games.
Custom game creation.
Additional voting and scoring modes.
Reusable question packs.
Optional spectator mode.
Session summaries and replay.
Additional themes and accessibility settings.
Progressive Web App support.
Optional player profiles, if there is a clear future need.

Each future feature must be evaluated against the platform's free-tier hosting constraints and privacy requirements.

18. Key Architectural Principles
Mobile first: Design for phones before larger screens.
Backend authoritative: Validate important game actions on the trusted backend.
Game modularity: Each game must implement a defined interface.
Shared infrastructure: Reuse room, player, authorization, and real-time services.
Free-tier aware: Keep the application within documented service limits.
Privacy by default: Collect minimal personal information and protect individual votes.
Recoverable sessions: Support temporary connection failures.
Incremental development: Deliver a functional first game before adding complexity.
Testable architecture: Game rules and platform services must be independently testable.
No unnecessary infrastructure: Avoid paid servers, external APIs, and additional services unless they provide clear value.
19. Definition of Success

The project succeeds when a group of 14 friends can open a link, join a room on their phones, play Most Likely To together with synchronized voting and results, and finish a session without requiring accounts or app installations.

The platform must also provide a clear, documented path for adding more games while keeping hosting and operational costs within the chosen free service tiers.