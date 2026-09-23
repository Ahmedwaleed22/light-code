# light-code: VS Code-style web editor, identity, and VPS installation

## Summary

This document is for review. No editor or server implementation changes are part of creating it.

The product goal is **immediate editing and reliable recovery**, including after a laptop sleeps or a browser discards a tab. The product is a VS Code-style editor controlled from the browser and running on the server, with a combined memory target under 100 MB (20–50 MB expected). All workspace operations use one WebSocket per browser tab; the server pushes changes made elsewhere. A connection cannot remain open through sleep, so the editor restores local drafts first, reconnects immediately on wake, and synchronizes afterward. Success means edits never wait for a server response, unsynced work is visible and recoverable, and conflicts never silently overwrite either copy.

Implementation will proceed on `qa` with signed commits; `main` remains the reviewed release branch.

## Status

Done on `qa`: VS Code-style shell (activity bar, lazy virtualized explorer, tabs, breadcrumbs, CodeMirror 6 editor, quick open, command palette, text search, status bar, mobile layout); WebSocket transport with heartbeat, wake detection, and queued requests; server push of saves, creates, renames, and deletes through the event bus; IndexedDB drafts; 750 ms auto save with a browser-local toggle; conflict resolution. Steps 1–3 are complete. Step 4 is partial: the auto-save setting is browser-local until identity exists. Steps 5–8 have not started.

Resource follow-up: bounded search caching, cancellation of superseded queries, bounded request concurrency and response queues, reduced file-read allocations, and unchanged-save suppression are implemented. The test instance serves the built frontend from Go alone on port 5173. Reproducible workload results and measurement limits are recorded in [infra/resource-results.md](infra/resource-results.md).

## Implementation steps

1. **Protect and restore drafts.** Add IndexedDB storage for open documents, the cached file tree, active tab, server version, and unsynced content. Namespace records by installation ID and user identity. Restore cached tabs before making network requests. Persist edits on a short schedule and flush when the page becomes hidden; show a persistent warning if browser storage fails.

2. **Add background synchronization.** Auto-save will default to **on**, saving after 750 ms without edits. Ctrl/Cmd+S saves immediately. Only one save per file may be in flight; newer edits are coalesced and sent afterward. Retry transient failures when connectivity or page visibility returns, with bounded backoff. Keep editing available while offline. The UI will distinguish **Saved**, **Saved locally**, **Syncing**, and **Conflict**.

3. **Handle conflicts without data loss.** Saves carry the version they were based on; the socket `save` operation rejects stale versions, and replaying an identical save is treated as success. On HTTP 409, retain the local draft and fetch the server copy. Present both versions with explicit choices to keep the server copy or save the local copy against the latest server version. Never resolve a conflict automatically.

4. **Add user settings.** Provide a Settings control for auto-save on/off. When off, drafts still persist locally, while server writes require Save. Built-in and signed-identity users will have settings stored as JSON in the system store. In **no authentication** mode, the preference is per browser because there is no user identity.

5. **Build identity and the system store.** On Debian/Ubuntu, use `/var/lib/light-code` for accounts, sessions, and settings; `/etc/light-code` for operator configuration and keys; and a separately selected project directory for editable files. Run the service as a dedicated `light-code` user with restrictive directory and file permissions. Passwords use salted Argon2id **hashes**, not reversible encryption. Encrypt email with AES-GCM and use a separately derived keyed HMAC of normalized email for lookup. Keep encryption keys outside `/var/lib/light-code`; atomic writes and backups must preserve both data and keys. [OWASP password guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html), [cryptographic storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html).

6. **Support three operator-controlled authentication modes.**

   - `builtin` is the fresh-install default. File APIs remain locked until the first owner signs up using a one-time, expiring CLI token link. Signup collects display name, email, and password; there is no public signup. The owner can issue invitation links for additional users. Password hashing occurs at login, not on every file request.
   - `signed_identity` accepts short-lived, Ed25519-signed identity tokens from a configured reverse proxy. The stable subject identifies the user's settings; light-code shows no login page.
   - `none` performs no authentication and uses browser-local settings.

   The server operator changes the mode in `/etc/light-code/config.json` and restarts the service. Ordinary users cannot turn authentication off. Built-in sessions use secure HTTP-only cookies, request-origin checks, expiration, and login rate limits. Two-factor authentication is reserved for a later milestone; it is not part of this release.

7. **Create the Debian/Ubuntu installer.** The installer builds and installs the Go binary and frontend, creates the service user and systemd unit, asks for the editable project path, and selects the first free loopback port starting at `17890` unless the operator chooses one. On an existing installation it offers **Keep Data** by default or an explicitly confirmed **Factory Reset**. Before the first account exists, it can replace a lost setup token and invalidate the old one; afterward it cannot reopen owner signup.

8. **Configure public access safely.** A domain is the normal installation path. If ports 80/443 are free, install or reuse Caddy for HTTPS. If an active Caddy, Nginx, or Apache owns them, add an isolated site configuration, validate it, and reload that server; leave unrelated sites intact. An unknown web server is not modified: print a specific integration documentation link. An explicit no-domain installation remains loopback-only and prints an SSH-tunnel setup link. Caddy's ordinary public certificate validation requires standard challenge traffic on 80/443 unless DNS validation or upstream forwarding is configured. [Caddy documentation](https://caddyserver.com/docs/automatic-https).

## Interfaces and acceptance tests

- Add a small bootstrap API returning installation ID, authentication mode, and current identity; add settings and authentication endpoints. Authenticate the WebSocket upgrade with the session cookie and close sockets when their session expires.
- Test reload, browser discard, offline editing, laptop-style hide/resume, retry after server restart, concurrent saves, and conflicts. Test that manual mode never sends an automatic server save while still preserving drafts.
- Test setup-token expiry and replacement, account creation, email lookup without plaintext email storage, session expiry, all three authentication modes, proxy signature rejection, and reinstall choices.
- Test installer behavior with free ports, existing Caddy/Nginx/Apache, unknown listeners, invalid proxy configuration, and rollback after failed validation.
- Measure Preact JavaScript heap plus Go resident memory against the **100 MB target** with five open 1 MiB files; report full browser and reverse-proxy memory separately. Measure typing and switching among open tabs without network access. No claim of zero latency or an unbreakable connection will be made.

## Assumptions

A fresh Debian/Ubuntu VPS with systemd is the deployment target; this development container is not an installation target. `/var/lib/light-code` is persistent on the VPS's persistent disk and must be backed up along with the separate key material. Filesystem permissions isolate the store from unprivileged agents; an agent with root access to that VPS can still read it, so root agents require a separate trust boundary. The existing 2 MiB UTF-8 file limit remains for this phase.
