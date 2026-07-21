# Semester File-System Generator

A Google Apps Script utility that creates a consistent semester folder structure in Google Drive.

The generator validates where the standalone Apps Script project is stored, previews the entire build plan, reuses folders that already exist, detects ambiguous duplicates, and creates only missing folders. Public examples use fictional folder names and do not reveal any real organization's Drive structure.

## Features

- Works from either `Fall` or `Spring+Summer`
- Works under any four-digit year folder
- Automatically identifies the script project's Drive location
- Includes a dry-run preview
- Reuses existing folders
- Stops when duplicate same-name folders are detected
- Rechecks folder names immediately before creation
- Uses `LockService` to reduce overlapping runs
- Supports My Drive and Shared Drives through Google Drive API v3
- Produces clear execution logs and errors
- Requires no deployment

## Example Drive Layout

The standalone Apps Script project must be stored directly inside an approved semester folder:

```text
Google Drive
└── 2026
    ├── Fall
    │   └── Semester File-System Generator
    └── Spring+Summer
        └── Semester File-System Generator
```

The year can be any four-digit year. Either approved semester folder can be used regardless of the current date.

Valid examples:

```text
2025/Fall
2025/Spring+Summer
2026/Fall
2026/Spring+Summer
```

Folder names are matched exactly. Names such as `fall`, `Spring + Summer`, and `Fall 2026` are rejected.

## Example Generated Folder Structure

The public repository uses placeholder names rather than the folder structure of any real organization.
