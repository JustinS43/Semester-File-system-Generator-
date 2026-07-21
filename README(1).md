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

```text
Administration
├── Meeting Notes
├── Periodic Reports
└── Reference Documents

Finance

Training

Programs

Team Resources
├── Conferences
├── Events
└── Media

Partnerships
└── Collaborations

Community Projects
├── Volunteer Records
│   └── Verification
└── Project Reports
```

Replace these examples with your own hierarchy in `CONFIG.folderStructures`.

## Repository Structure

```text
semester-file-system-generator/
├── Code.gs
├── appsscript.json
├── README.md
└── LICENSE
```

## Requirements

- A Google account with access to the target Drive folder
- A standalone Google Apps Script project
- Apps Script V8 runtime
- Google Drive API v3 enabled as an Advanced Google service
- Permission to view and create folders in the target location

For Shared Drives, the account running the script must have permission to add content.

## Installation

### 1. Create a standalone Apps Script project

Create a new standalone Google Apps Script project. Do not create the script from inside a Google Sheet, Doc, Form, or Slide.

### 2. Add `Code.gs`

Replace the starter code in `Code.gs` with the complete generator script.

Keep the public version in safe mode:

```javascript
dryRun: true,
```

### 3. Make `appsscript.json` visible

In Apps Script:

1. Open **Project Settings**.
2. Enable **Show "appsscript.json" manifest file in editor**.
3. Return to the editor.
4. Open the existing `appsscript.json` file.

Do not create a second manifest file.

### 4. Configure the manifest

```json
{
  "timeZone": "America/New_York",
  "dependencies": {
    "enabledAdvancedServices": [
      {
        "userSymbol": "Drive",
        "version": "v3",
        "serviceId": "drive"
      }
    ]
  },
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/drive"
  ]
}
```

Change the timezone when another timezone is more appropriate.

### 5. Move the project into the target folder

Place the standalone Apps Script project directly inside:

```text
<four-digit year>/Fall
```

or:

```text
<four-digit year>/Spring+Summer
```

Correct:

```text
2026/Fall/Semester File-System Generator
```

Incorrect:

```text
2026/Fall/Templates/Semester File-System Generator
```

## Usage

Run the following functions from the Apps Script editor.

### 1. Validate the location

```javascript
testBuildLocation()
```

This confirms that:

- The project is a standalone Apps Script file
- Its immediate parent is exactly `Fall` or `Spring+Summer`
- The semester folder is directly inside a four-digit year folder
- The Drive service can access the location

This function creates nothing.

### 2. Preview the build

```javascript
previewBuildPlan()
```

The execution log shows planned actions such as:

```text
[CREATE] Fall > Finances
[REUSE] Fall > Team Resources
```

This function always performs a dry run and creates nothing.

### 3. Run the live build

After reviewing the preview, change:

```javascript
dryRun: true,
```

to:

```javascript
dryRun: false,
```

Save the project and run:

```javascript
createSemesterFileSystem()
```

After the build, change `dryRun` back to `true` so the project remains in a safer default state.

## Main Functions

| Function | Purpose | Creates folders? |
|---|---|---:|
| `testBuildLocation()` | Validates the Drive location and access | No |
| `previewBuildPlan()` | Logs the complete create/reuse plan | No |
| `createSemesterFileSystem()` | Runs the configured build | Only when `dryRun` is `false` |
| `TEST_runWithSimulatedDate()` | Controlled testing helper | Depends on its argument |

## Configuration

### Dry-run mode

```javascript
dryRun: true
```

- `true`: validate and preview only
- `false`: create missing folders

### Approved semester folders

```javascript
allowedSemesterFolders: Object.freeze([
  "Fall",
  "Spring+Summer"
])
```

The match is case-sensitive and whitespace-sensitive.

### Folder hierarchy

```javascript
folderStructures: Object.freeze({
  "Example Folder": Object.freeze({
    "Example Subfolder": Object.freeze({})
  })
})
```

An empty object represents a folder with no configured subfolders.

## Google Drive API Integration

The project uses Apps Script's Advanced Drive service, which exposes Google Drive API v3 through the global `Drive` object:

```javascript
Drive.Files.get(...)
Drive.Files.list(...)
Drive.Files.create(...)
```

The Drive API is used to:

- Retrieve the standalone script project's Drive metadata
- Identify its immediate parent folder
- Detect My Drive or Shared Drive storage
- Search for exact-name child folders
- Reuse existing folders
- Detect duplicate same-name folders
- Create missing folders in the validated target location

The script uses options such as `supportsAllDrives` and `includeItemsFromAllDrives` for Shared Drive compatibility.

## Safety Design

### Validation before writes

Configuration and location checks happen before folder creation begins.

### Dry-run preview

The complete plan can be inspected without modifying Drive.

### Duplicate detection

If more than one same-name folder exists beneath one parent, the build stops instead of selecting a folder unpredictably.

### Execution-time recheck

Each exact folder name is checked again immediately before creation.

### Locking

`LockService.getScriptLock()` prevents overlapping executions of the same script project.

Different project copies use different locks, so keep only one active builder copy in each semester folder.

### Partial-build recovery

Google Drive cannot create an entire folder tree as one atomic transaction. If a later write fails, previously created folders remain. Running the generator again safely reuses them and continues with missing folders.

## Deployment

Deployment is **not required**.

This is a manually executed standalone Apps Script utility. It does not need to be published as a web app, API executable, add-on, or library.

## Troubleshooting

### Advanced Drive service is not enabled

Confirm that `appsscript.json` includes the Drive v3 dependency shown above.

### The project cannot access itself

Confirm that the project is standalone and that it was opened with the Google account that owns it or has access.

A separate browser profile can prevent issues when multiple Google accounts are signed in.

### Invalid semester folder

The immediate parent must be exactly:

```text
Fall
```

or:

```text
Spring+Summer
```

### Invalid year folder

The semester folder must be directly inside a folder named with exactly four digits, such as `2026`.

### Duplicate folders detected

Move, rename, or delete the duplicate same-name folders, then run `previewBuildPlan()` again.

### Shared Drive permission error

Confirm that the account running the script can add content to the target Shared Drive folder.

## Privacy and Security

Before publishing a customized version:

- Remove private email addresses
- Remove Drive folder IDs, script IDs, and private links
- Replace internal folder names with fictional placeholders
- Remove organization-only terminology
- Check screenshots for private account or folder information
- Keep `dryRun: true` in the public version

This repository should not contain credentials or API keys. Google Apps Script handles authorization through the OAuth scopes declared in the manifest.

## Possible Future Improvements

- Add a custom menu or sidebar
- Allow users to select a target folder
- Support multiple folder presets
- Add automated configuration tests
- Add optional Docs or Sheets template creation

## Author

**Justin Suriel**

Built as a practical automation project using JavaScript, Google Apps Script, and Google Drive API v3. All public folder examples are fictional.

## License

This project can be released under the [MIT License](LICENSE).
