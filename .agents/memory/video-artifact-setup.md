---
name: Video artifact setup
description: Environment-specific setup lessons for generated video artifacts in this workspace.
---

Generated video artifacts may start with template dependencies that reference an unavailable shared TypeScript config or catalog. Keep the artifact self-contained, remove unused template plugins, and install its dependencies in the artifact directory rather than resolving the whole root app.

**Why:** The root app's existing PDF dependency was blocked by the package firewall during a workspace-wide install, while the video artifact did not need that dependency.

**How to apply:** For future video artifacts, verify the generated package metadata before restarting its workflow and keep video-only dependency changes isolated from the root application.