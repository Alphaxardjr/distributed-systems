# Chatly

React + Vite + TypeScript messaging UI, using Firebase Authentication/Firestore and private Supabase Storage/Edge Functions. Shared shadcn/ui components live in `packages/ui`.

## Run locally

Use Node >=20.19 and the repository's npm workspaces. From the repository root:

```sh
npm ci
npm run dev
```

Create `apps/web/.env.local` with the existing project's client configuration (do not commit it):

```dotenv
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

Use only Firebase client configuration and the Supabase publishable key. Never put a service-role key in a `VITE_` variable. Existing Firebase email/password authentication, Firestore rules/indexes, and the `chat-attachments` and `profile-avatar` Edge Functions must already be deployed. Storage stays private. This repository does not contain deployment rules/functions to verify their permissions locally.

Open Vite's printed URL. Login and signup use `#/login` and `#/signup`. The authenticated application is guarded by the existing auth provider; its conversation selection and drafts stay in memory for the signed-in session.

## Phase 1 UI

- Login, signup, session restoration, logout, and authentication errors.
- Realtime conversation list, last-message previews, unread counts, direct and group chats.
- Public display-name prefix search (two characters minimum), duplicate-safe direct conversation creation, group naming/member selection.
- Realtime text and image messages, per-conversation drafts, timestamps, typing, read receipts, own-message editing/soft deletion, emoji reaction changes/removal.
- Private attachment loading, refresh/retry, and authorized download. Upload supports JPEG, PNG, WebP and GIF up to 10 MB, matching the existing service. Other file types are unavailable.
- Public/private profile updates through the existing service; display names up to 50 characters, bios up to 200, avatar upload/removal, temporary signed avatar URL renewal.
- Mobile navigation between the sidebar and conversation/profile/search screens.

There is no cursor pagination API: the UI explicitly shows the latest 30 messages. Group administration is not exposed because no management service is present. Existing manual backend test modules remain in `apps/web/src/tests`; they are no longer mounted as the application UI and are not an automated test suite.

## Checks

```sh
npm run typecheck
npm run lint
npm run build
```

The build runs `tsc -b` against the referenced app configurations as well as Vite. The web workspace's original `typecheck` command uses a solution config with no direct files, so the production build is also required for complete application type verification.

## Manual backend acceptance checklist

Use two test accounts in separate browser profiles, against your intended Firebase/Supabase environment:

1. Sign up both users, reload to verify restored sessions, log out/in. Confirm each has a public searchable profile. Existing users need to sign in once to initialize one.
2. Search by display-name prefix, start a direct chat, then search/start again and confirm the same conversation reopens. **Verify deployed rules allow the existing conversation service's recipient lookup in `users/{uid}`.** It still uses the original service behavior; a permission failure is displayed rather than bypassed.
3. Exchange messages both ways. Check list previews/unread counts, own/received styling, timestamps, draft retention while switching chats, and failures while offline. Failed sends retain the draft. Drafts are not persisted across a reload/logout.
4. With the receiving tab focused and at the newest messages, confirm receipts advance. Scroll up or background the tab and confirm new messages are not marked read until viewed. Confirm typing clears after idle/blur/navigation.
5. Edit/delete only your own supported messages; add/change/remove reactions and verify both accounts update.
6. Upload each supported image type, download from the other account, refresh an unavailable image link, and reject oversized/unsupported uploads. Verify a nonparticipant cannot obtain an attachment link.
7. Save display name/bio, upload/change/remove an avatar, and verify public search and the other account see changes. Test failed uploads and avatar URL refresh after expiry.
8. Create a group with selected users, confirm participant/sender names, and exchange messages/reactions/attachments in both sessions.
9. Repeat chat, search and profile navigation at phone width. Check long text, image loading, error messages, and keyboard access.

No authenticated Firebase/Supabase end-to-end test has been performed as part of this implementation. Browser checks covered the signed-out login/signup navigation and the signup layout at 390 × 844 (no horizontal overflow). The production bundle may emit Vite's size advisory because Firebase/Supabase are bundled together; this is not a build failure.

## Phase 2 interface

The UI uses teal/neutral theme tokens in `chat.css`, responsive conversation navigation, avatars, grouped bubbles, reaction badges, skeletons, and refined search/profile panels. Light/dark controls reuse the theme provider. No backend services or dependencies changed.

Desktop hover/focus exposes quick actions. An always-visible ellipsis opens a native dialog on every device. Touch/pen long-press opens it after 450 ms; movement over 10 px, pointer cancellation, or leaving the bubble cancels the timer. Escape and outside clicks dismiss it. Reactions use existing services with submission guards. Reply uses the existing `replyTo` parameter; older references show a fallback.

The composer expands to 160 px, offers attachments/text emojis, and preserves drafts and reply targets between chats. Desktop Enter sends except during IME composition; Shift+Enter inserts a newline. Touch keyboards retain newline behavior. Safe-area padding and VisualViewport resizing accommodate mobile keyboards. Reduced-motion preferences are respected. Presence status is not fabricated.

Phase 2 checks: TypeScript, ESLint, production build and whitespace checks passed. Authenticated browser verification at 375, 430, 768, 1024 and 1440 px, hover/long-press behavior, theme contrast, and real-device keyboard behavior remain manual checks. Earlier Phase 1 browser results do not establish Phase 2 behavior. Verify menus near chat edges, touch-scroll cancellation, reactions, replies, profile edits and draft retention with two accounts.

## Phase 2.1 refinements

Message spacing no longer reserves a toolbar-sized gap. Actions float in a viewport-clamped portal, with a short hover handoff delay and keyboard access. Touch long-press cancels on movement, scrolling, and pointer cancellation; active text selections are preserved. Copy text uses the browser clipboard and reports failures.

Images reserve a stable 4:3 preview area (the image itself is contained without distortion), open in an accessible larger-preview dialog, and retain authorized download/refresh controls. Non-image attachments remain file cards. Sidebar rows, headers, composer spacing, and reaction badges are more compact.

Conversation updates preserve the first visible message while reading older content. New incoming messages show a count without pulling the view down; initial opening and successful sends go to the latest messages. Older-history pagination is still unsupported by the existing service.

Validation: project TypeScript, lint, build, and whitespace checks passed during this phase. No authenticated browser or real-device tests were performed. Manually verify desktop hover handoff, mobile long-press/text selection, inline image/preview/download behavior, expired-link retry, and scroll anchoring using real conversations. Vite still reports its non-blocking bundle-size advisory.

## Phase 2.2 refinements

Reply actions, reply draft controls, and permanent composer shortcut hints have been removed from the UI. The existing hover toolbar, reactions, copy/edit/delete actions, real-time listeners, and inline attachment preview/download behavior are retained. Backend services and schemas are unchanged.

New conversation and group creation now use an integrated screen with a clear search field, public-profile rows, selected-member chips, and selectable group members. Profile settings feature a larger avatar, a Change Photo button with hidden file input, operation-specific feedback, and clear Save/Cancel actions. Authentication uses the existing Chatly branding with consistent dark inputs and teal actions; authenticated screens retain light-theme support.

Validation uses the existing typecheck, lint, and build scripts. Authenticated Firebase/Supabase operations and physical-device behavior still require manual verification; no new end-to-end claims are made by these UI changes.
