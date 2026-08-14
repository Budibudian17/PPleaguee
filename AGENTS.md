<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `ending it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# PPLG League Project Rules

## Project Overview
PPLG League is a FC 26 tournament website for community/geng using Next.js App Router, Tailwind CSS, and Firebase Firestore.

## Key Features
- Separate admin panel with PIN protection (2626)
- User registration for team ownership
- Game player management (Mbappe, etc.) per team
- Automatic standings calculation (no separate standings table)
- Round Robin schedule generation from admin panel
- Real-time player game statistics
- Full data deletion capabilities (reset tournament)

## Build Commands
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server

## Design System
- Background: #000000 (pure black)
- Card: #121212 with #262626 border
- Accent: #00FF66 (neon green)
- Typography: Bold uppercase headers, monospace for numbers
- Border radius: rounded-sm (4px) or none

## Database
- Uses Firebase Firestore with custom schema in `database/firestore-schema.md`
- Collections: users, game_players, matches, stats
- Users = team owners, game_players = actual FC 26 players
- Standings calculated on-the-fly from matches with status 'played'

## Firebase Configuration
- Firestore Database with security rules from `database/firestore-schema.md`
- Required composite indexes for optimal query performance
- Environment variables needed for Firebase config

## Important Notes
- All branding must use "PPLG League"
- Admin PIN is hardcoded as 2626 in server actions
- Environment variables needed: NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, NEXT_PUBLIC_FIREBASE_PROJECT_ID, NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET, NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID, NEXT_PUBLIC_FIREBASE_APP_ID
- No separate /standings page - redirects to homepage
- Uses Firebase SDK v9+ with modular syntax
- Admin operations separated into /admin page
- Game players must be added by admin before inputting match statistics