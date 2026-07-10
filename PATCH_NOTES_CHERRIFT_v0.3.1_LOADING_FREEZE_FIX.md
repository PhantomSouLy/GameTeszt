# CHERRIFT v0.3.1 Loading Freeze Fix

## Fixed
- Loading could freeze at `Spawning Cherry...` on mobile.
- Stage start is now non-blocking with a failsafe timeout.
- Loading proceeds after the first safe setup window even if mobile fullscreen keeps a wrapped start promise pending.
- Skill/HUD remain hidden while loading.
- CHERRIFT branding preserved.

## Flow
Main Play -> World Select -> Play -> Loading -> Stage
