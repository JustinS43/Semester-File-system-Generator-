/**
 * SEMESTER FILE-SYSTEM GENERATOR
 * Google Apps Script — standalone project, V8 runtime.
 *
 * NORMAL WORKFLOW
 *   1. Copy the template project.
 *   2. Move the copy directly into the correct Fall or Spring+Summer folder.
 *   3. Open the copy.
 *   4. Run testBuildLocation().
 *   5. Run previewBuildPlan().
 *   6. Run createSemesterFileSystem().
 *
 * No deployment is required.
 *
 * DRIVE SUPPORT
 *   This version uses the Advanced Drive service (Drive API v3), rather than
 *   DriveApp, so the same code can work in My Drive and Shared Drives.
 *   The Drive advanced service must be enabled in the project. The supplied
 *   appsscript.json does this for the template and its copies.
 *
 * SELF-LOCATION
 *   For a standalone Apps Script project, ScriptApp.getScriptId() identifies
 *   the script project file in Drive. The script reads that file's immediate
 *   parent, then validates the semester folder and its year-folder parent.
 *
 * LOCK LIMITATION
 *   LockService.getScriptLock() prevents overlapping executions of THIS copied
 *   script project. Different copied script projects have different script
 *   locks, so keep only one active builder copy in each semester folder.
 *
 * PARTIAL-BUILD LIMITATION
 *   Google Drive does not provide a transaction that can atomically create an
 *   entire folder tree. The script validates and plans everything before the
 *   first write and rechecks each name immediately before creation. If Drive
 *   later rejects a write, folders created earlier in that run remain and are
 *   safely reused when the script is run again.
 */

const FOLDER_MIME_TYPE_ = "application/vnd.google-apps.folder";
const SCRIPT_MIME_TYPE_ = "application/vnd.google-apps.script";

const CONFIG = Object.freeze({
  /**
   * true: createSemesterFileSystem() validates and previews only.
   * false: createSemesterFileSystem() creates missing folders.
   */
  dryRun: true,

  /** Maximum wait for another execution of this same script copy. */
  lockTimeoutMs: 30000,

  /** Exact Drive folder names. Capitalization and spacing must match. */
  allowedSemesterFolders: Object.freeze(["Fall", "Spring+Summer"]),

  /** Month numbers are interpreted in the script project's timezone. */
  semesterPeriods: Object.freeze([
    Object.freeze({
      folderName: "Spring+Summer",
      months: Object.freeze([1, 2, 3, 4, 5, 6, 7])
    }),
    Object.freeze({
      folderName: "Fall",
      months: Object.freeze([8, 9, 10, 11, 12])
    })
  ]),

  /**
   * Folder tree created inside the validated semester folder.
   *
   * Events and Collaborations are intentionally nested. A slash is not used
   * in a folder name because it looks like a path separator and can create
   * sync/export problems even though Drive itself can store the character.
   */
  folderStructures: Object.freeze({
    "Reports and Summary": Object.freeze({
      "Chapter Agenda": Object.freeze({}),
      "Gds Chapter Reports": Object.freeze({}),
      "NPHC Reports": Object.freeze({})
    }),
    "Finances": Object.freeze({}),
    "Education": Object.freeze({}),
    "Bigger and Better Business": Object.freeze({}),
    "Brotherhood": Object.freeze({
      "Conference": Object.freeze({}),
      "Event": Object.freeze({}),
      "Photos": Object.freeze({})
    }),
    "Events": Object.freeze({
      "Collaborations": Object.freeze({})
    }),
    "Social Action": Object.freeze({
      "Community Hours": Object.freeze({
        "Proof of Service": Object.freeze({})
      }),
      "Service Reports": Object.freeze({})
    })
  })
});


/* ========================================================================== *
 * PUBLIC ENTRY POINTS
 * ========================================================================== */

/**
 * Normal live entry point. Uses the real current date and CONFIG.dryRun.
 *
 * @return {Object} Build summary.
 */
function createSemesterFileSystem() {
  return runBuild_({
    date: new Date(),
    dryRun: CONFIG.dryRun,
    useLock: true,
    label: "SEMESTER FILE-SYSTEM BUILD"
  });
}

/**
 * Validates configuration and physical Drive location only. Creates nothing.
 *
 * @return {Object} Validated location summary.
 */
function testBuildLocation() {
  validateConfiguration_();
  requireAdvancedDriveService_();

  const context = getValidatedBuildContext_(new Date());
  const result = {
    success: true,
    year: context.yearFolder.name,
    semester: context.semesterFolder.name,
    storage: context.isSharedDrive ? "Shared Drive" : "My Drive",
    semesterFolderId: context.semesterFolder.id,
    semesterFolderUrl: getFolderUrl_(context.semesterFolder)
  };

  console.log([
    "========================================",
    "BUILD LOCATION TEST PASSED",
    "========================================",
    `Script: ${context.scriptFile.name}`,
    `Year: ${context.yearFolder.name}`,
    `Semester: ${context.semesterFolder.name}`,
    `Storage: ${result.storage}`,
    `Script timezone: ${context.timeZone}`,
    `Target: ${result.semesterFolderUrl}`,
    "",
    "Next: run previewBuildPlan()."
  ].join("\n"));

  return result;
}

/**
 * Always performs a dry run with the real current date. Creates nothing.
 *
 * @return {Object} Preview summary.
 */
function previewBuildPlan() {
  return runBuild_({
    date: new Date(),
    dryRun: true,
    useLock: true,
    label: "BUILD PLAN PREVIEW"
  });
}

/**
 * TEST-ONLY helper. The date string must include Z or a numeric UTC offset.
 * Never connect this function to a trigger.
 *
 * Examples:
 *   TEST_runWithSimulatedDate("2026-02-15T12:00:00Z", true);
 *   TEST_runWithSimulatedDate("2026-09-15T12:00:00-04:00", true);
 *
 * @param {string} isoDateString ISO-8601 timestamp with an explicit timezone.
 * @param {boolean} dryRun true for preview; false for real writes in a test area.
 * @return {Object} Build summary.
 */
function TEST_runWithSimulatedDate(isoDateString, dryRun) {
  const simulatedDate = parseExplicitIsoDate_(isoDateString);

  if (typeof dryRun !== "boolean") {
    throw new Error(
      "TEST_runWithSimulatedDate requires an explicit boolean dryRun argument."
    );
  }

  console.warn([
    "========================================",
    "TEST MODE — SIMULATED DATE",
    "========================================",
    `Input: ${isoDateString}`,
    `Parsed: ${simulatedDate.toISOString()}`,
    `Mode: ${dryRun ? "DRY RUN" : "LIVE TEST WRITE"}`,
    "Use live test writes only in a temporary test structure."
  ].join("\n"));

  return runBuild_({
    date: simulatedDate,
    dryRun: dryRun,
    useLock: true,
    label: "TEST BUILD WITH SIMULATED DATE"
  });
}

/** Safe no-argument test wrapper for the Apps Script function picker. */
function TEST_previewSpringSummer2026() {
  return TEST_runWithSimulatedDate("2026-02-15T12:00:00Z", true);
}

/** Safe no-argument test wrapper for the Apps Script function picker. */
function TEST_previewFall2026() {
  return TEST_runWithSimulatedDate("2026-09-15T12:00:00Z", true);
}


/* ========================================================================== *
 * BUILD ORCHESTRATION
 * ========================================================================== */

/**
 * @param {{date: Date, dryRun: boolean, useLock: boolean, label: string}} options
 * @return {Object} Build summary.
 */
function runBuild_(options) {
  validateRunOptions_(options);

  const lock = options.useLock ? LockService.getScriptLock() : null;
  let lockAcquired = false;
  const stats = { created: 0, reused: 0 };

  try {
    if (lock) {
      lock.waitLock(CONFIG.lockTimeoutMs);
      lockAcquired = true;
    }

    validateConfiguration_();
    requireAdvancedDriveService_();

    // All location checks happen before the plan and before any write.
    const context = getValidatedBuildContext_(options.date);

    console.log([
      "========================================",
      `STARTING ${options.label}`,
      "========================================",
      `Script: ${context.scriptFile.name}`,
      `Year: ${context.yearFolder.name}`,
      `Semester: ${context.semesterFolder.name}`,
      `Storage: ${context.isSharedDrive ? "Shared Drive" : "My Drive"}`,
      `Script timezone: ${context.timeZone}`,
      `Date used: ${formatDateForLog_(options.date, context.timeZone)}`,
      `Target: ${getFolderUrl_(context.semesterFolder)}`,
      `Mode: ${options.dryRun ? "DRY RUN" : "LIVE"}`,
      ""
    ].join("\n"));

    // Read-only plan. No folder is created here.
    const plan = planFolderTree_(
      context.semesterFolder,
      CONFIG.folderStructures,
      context.semesterFolder.name
    );
    const flatPlan = flattenPlan_(plan);

    logBuildPlan_(flatPlan);
    assertPlanHasNoDuplicates_(flatPlan);

    if (options.dryRun) {
      stats.created = flatPlan.filter(node => node.action === "CREATE").length;
      stats.reused = flatPlan.filter(node => node.action === "REUSE").length;
    } else {
      executePlan_(context.semesterFolder, plan, stats);
    }

    const summary = {
      success: true,
      dryRun: options.dryRun,
      year: context.yearFolder.name,
      semester: context.semesterFolder.name,
      storage: context.isSharedDrive ? "Shared Drive" : "My Drive",
      semesterFolderId: context.semesterFolder.id,
      semesterFolderUrl: getFolderUrl_(context.semesterFolder),
      foldersCreated: options.dryRun ? 0 : stats.created,
      foldersWouldBeCreated: options.dryRun ? stats.created : 0,
      foldersReused: stats.reused
    };

    console.log([
      "",
      "========================================",
      `${options.label} COMPLETE${options.dryRun ? " — NOTHING CREATED" : ""}`,
      "========================================",
      `Year: ${summary.year}`,
      `Semester: ${summary.semester}`,
      options.dryRun
        ? `Folders that would be created: ${summary.foldersWouldBeCreated}`
        : `Folders created: ${summary.foldersCreated}`,
      `Folders reused: ${summary.foldersReused}`,
      `Target: ${summary.semesterFolderUrl}`
    ].join("\n"));

    return summary;
  } catch (error) {
    const message = getErrorMessage_(error);
    const partialWriteWarning = stats.created > 0
      ? [
          "",
          `WARNING: ${stats.created} folder(s) were created before the failure.`,
          "They will be reused safely on the next run."
        ]
      : ["", "No folders were created by this run."];

    const failureMessage = [
      "========================================",
      `${options.label} FAILED`,
      "========================================",
      "",
      message,
      ...partialWriteWarning
    ].join("\n");

    console.error(failureMessage);
    throw new Error(failureMessage);
  } finally {
    if (lockAcquired) {
      lock.releaseLock();
    }
  }
}


/* ========================================================================== *
 * LOCATION VALIDATION
 * ========================================================================== */

/**
 * @param {Date} date
 * @return {Object} Validated build context.
 */
function getValidatedBuildContext_(date) {
  assertValidDate_(date, "Build date");

  const scriptId = ScriptApp.getScriptId();
  const scriptFile = getDriveItem_(scriptId, "standalone Apps Script project");

  if (scriptFile.mimeType !== SCRIPT_MIME_TYPE_) {
    throw new Error([
      "The current project was not returned as a standalone Apps Script Drive file.",
      `Returned MIME type: ${quote_(scriptFile.mimeType)}`,
      "Use a standalone project, not a script bound to Sheets, Docs, Slides, or Forms."
    ].join("\n"));
  }

  const semesterFolder = getImmediateParentFolder_(
    scriptFile,
    "Apps Script project"
  );

  // Do not trim actual Drive names. Validation must be exact.
  if (!CONFIG.allowedSemesterFolders.includes(semesterFolder.name)) {
    throw new Error([
      "The Apps Script project is not directly inside an approved semester folder.",
      `Script: ${quote_(scriptFile.name)}`,
      `Actual parent: ${quote_(semesterFolder.name)}`,
      `Approved exact names: ${CONFIG.allowedSemesterFolders.map(quote_).join(", ")}`,
      "Move the copied project directly into Fall or Spring+Summer.",
      "Leading/trailing spaces, different capitalization, and 'Spring + Summer' are rejected."
    ].join("\n"));
  }

  const expectedSemester = getExpectedSemesterFolder_(date);
  if (semesterFolder.name !== expectedSemester) {
    throw new Error([
      "The Apps Script project is inside the wrong semester folder for the date used.",
      `Date: ${formatDateForLog_(date, Session.getScriptTimeZone())}`,
      `Expected: ${quote_(expectedSemester)}`,
      `Actual: ${quote_(semesterFolder.name)}`
    ].join("\n"));
  }

  const yearFolder = getImmediateParentFolder_(
    semesterFolder,
    `${semesterFolder.name} semester folder`
  );
  const expectedYear = getExpectedYearFolder_(date);

  if (yearFolder.name !== expectedYear) {
    throw new Error([
      "The semester folder is inside the wrong year folder.",
      `Expected exact year folder: ${quote_(expectedYear)}`,
      `Actual year folder: ${quote_(yearFolder.name)}`,
      `Semester folder: ${quote_(semesterFolder.name)}`
    ].join("\n"));
  }

  const timeZone = Session.getScriptTimeZone();
  const isSharedDrive = Boolean(
    scriptFile.driveId || semesterFolder.driveId || yearFolder.driveId
  );

  console.log([
    "Location validation passed.",
    `Script ID: ${scriptId}`,
    `Year folder: ${yearFolder.name}`,
    `Semester folder: ${semesterFolder.name}`,
    `Storage: ${isSharedDrive ? "Shared Drive" : "My Drive"}`
  ].join("\n"));

  return {
    scriptId: scriptId,
    scriptFile: scriptFile,
    semesterFolder: semesterFolder,
    yearFolder: yearFolder,
    timeZone: timeZone,
    isSharedDrive: isSharedDrive
  };
}

/**
 * @param {Object} item Drive API file resource.
 * @param {string} description
 * @return {Object} Parent folder resource.
 */
function getImmediateParentFolder_(item, description) {
  const parents = Array.isArray(item.parents) ? item.parents : [];

  if (parents.length === 0) {
    throw new Error(`${description} does not have an immediate parent folder.`);
  }

  if (parents.length > 1) {
    throw new Error([
      `${description} has more than one parent.`,
      "The build location cannot be selected safely."
    ].join("\n"));
  }

  const parent = getDriveItem_(parents[0], `${description} parent`);
  if (parent.mimeType !== FOLDER_MIME_TYPE_) {
    throw new Error(`${description}'s immediate parent is not a Drive folder.`);
  }

  return parent;
}


/* ========================================================================== *
 * DATE HELPERS
 * ========================================================================== */

/**
 * @param {Date} date
 * @return {string}
 */
function getExpectedSemesterFolder_(date) {
  assertValidDate_(date, "Semester date");
  const timeZone = Session.getScriptTimeZone();
  const month = Number(Utilities.formatDate(date, timeZone, "M"));
  const match = CONFIG.semesterPeriods.find(period =>
    period.months.includes(month)
  );

  if (!match) {
    throw new Error(`No semester period is configured for month ${month}.`);
  }

  return match.folderName;
}

/**
 * @param {Date} date
 * @return {string}
 */
function getExpectedYearFolder_(date) {
  assertValidDate_(date, "Year date");
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy");
}

/**
 * Prevents ambiguous test timestamps that may shift date across timezones.
 *
 * @param {string} value
 * @return {Date}
 */
function parseExplicitIsoDate_(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("A non-empty ISO-8601 date string is required.");
  }

  const explicitZonePattern = /(Z|[+-]\d{2}:?\d{2})$/i;
  if (!explicitZonePattern.test(value)) {
    throw new Error([
      "The simulated timestamp must include an explicit timezone.",
      "Use Z or a numeric offset, for example:",
      "  2026-02-15T12:00:00Z",
      "  2026-09-15T12:00:00-04:00"
    ].join("\n"));
  }

  const date = new Date(value);
  assertValidDate_(date, "Simulated date");
  return date;
}

/**
 * @param {Date} date
 * @param {string} timeZone
 * @return {string}
 */
function formatDateForLog_(date, timeZone) {
  return Utilities.formatDate(date, timeZone, "yyyy-MM-dd HH:mm:ss z");
}


/* ========================================================================== *
 * READ-ONLY FOLDER PLANNING
 * ========================================================================== */

/**
 * @param {Object|null} parentFolder Drive folder resource, or null if planned.
 * @param {Object} folderStructure
 * @param {string} parentPath
 * @return {Array<Object>}
 */
function planFolderTree_(parentFolder, folderStructure, parentPath) {
  validateFolderStructureShape_(folderStructure, parentPath);

  return Object.keys(folderStructure).map(folderName => {
    const childStructure = folderStructure[folderName];
    const path = `${parentPath} > ${folderName}`;
    let action = "CREATE";
    let existingFolder = null;

    if (parentFolder !== null) {
      const matches = listChildFoldersByExactName_(parentFolder, folderName);
      if (matches.length === 1) {
        action = "REUSE";
        existingFolder = matches[0];
      } else if (matches.length > 1) {
        action = "DUPLICATE";
      }
    }

    const children = action === "DUPLICATE"
      ? []
      : planFolderTree_(
          action === "REUSE" ? existingFolder : null,
          childStructure,
          path
        );

    return {
      name: folderName,
      path: path,
      parentPath: parentPath,
      action: action,
      existingFolder: existingFolder,
      children: children
    };
  });
}

/**
 * @param {Array<Object>} nodes
 * @return {Array<Object>}
 */
function flattenPlan_(nodes) {
  const flat = [];
  nodes.forEach(node => {
    flat.push(node);
    flat.push(...flattenPlan_(node.children));
  });
  return flat;
}

/** @param {Array<Object>} flatPlan */
function logBuildPlan_(flatPlan) {
  const lines = ["Build plan:"];
  flatPlan.forEach(node => lines.push(`  [${node.action}] ${node.path}`));
  console.log(lines.join("\n"));
}

/** @param {Array<Object>} flatPlan */
function assertPlanHasNoDuplicates_(flatPlan) {
  const duplicates = flatPlan.filter(node => node.action === "DUPLICATE");
  if (duplicates.length === 0) {
    return;
  }

  throw new Error([
    "Duplicate same-name folders were detected. No build writes were started.",
    "",
    ...duplicates.map(node =>
      `Duplicate ${quote_(node.name)} directly under ${node.parentPath}`
    ),
    "",
    "Move, rename, or delete the duplicate folders, then preview again."
  ].join("\n"));
}


/* ========================================================================== *
 * PLAN EXECUTION
 * ========================================================================== */

/**
 * Rechecks each exact name immediately before writing. This prevents the most
 * common plan-to-execution race from producing an avoidable duplicate.
 *
 * @param {Object} parentFolder Drive folder resource.
 * @param {Array<Object>} nodes
 * @param {{created: number, reused: number}} stats
 */
function executePlan_(parentFolder, nodes, stats) {
  nodes.forEach(node => {
    const currentMatches = listChildFoldersByExactName_(parentFolder, node.name);

    if (currentMatches.length > 1) {
      throw new Error([
        `Duplicate folders appeared during execution at ${node.path}.`,
        "The run stopped before writing beneath that ambiguous folder."
      ].join("\n"));
    }

    let folder;
    if (currentMatches.length === 1) {
      folder = currentMatches[0];
      stats.reused++;
      console.log(`REUSED: ${node.path}`);
    } else {
      folder = createFolder_(parentFolder, node.name);
      stats.created++;
      console.log(`CREATED: ${node.path} (${folder.id})`);
    }

    executePlan_(folder, node.children, stats);
  });
}


/* ========================================================================== *
 * ADVANCED DRIVE SERVICE WRAPPERS
 * ========================================================================== */

/** Throws a clear setup error before any Drive call is attempted. */
function requireAdvancedDriveService_() {
  if (typeof Drive === "undefined" || !Drive.Files) {
    throw new Error([
      "The Advanced Drive service is not enabled for this Apps Script project.",
      "Enable Google Drive API v3 under Services, or use the supplied appsscript.json.",
      "No web-app deployment is required."
    ].join("\n"));
  }
}

/**
 * @param {string} itemId
 * @param {string} description
 * @return {Object}
 */
function getDriveItem_(itemId, description) {
  try {
    const item = Drive.Files.get(itemId, {
      supportsAllDrives: true,
      fields: "id,name,mimeType,parents,driveId,webViewLink,trashed"
    });

    if (item.trashed) {
      throw new Error(`${description} is in Drive trash.`);
    }

    return item;
  } catch (error) {
    throw new Error([
      `Could not access ${description}.`,
      `Drive ID: ${itemId}`,
      `Original error: ${getErrorMessage_(error)}`
    ].join("\n"));
  }
}

/**
 * @param {Object} parentFolder Drive folder resource.
 * @param {string} exactName
 * @return {Array<Object>}
 */
function listChildFoldersByExactName_(parentFolder, exactName) {
  const files = [];
  let pageToken;

  do {
    const params = {
      q: [
        `'${escapeDriveQueryValue_(parentFolder.id)}' in parents`,
        `name = '${escapeDriveQueryValue_(exactName)}'`,
        `mimeType = '${FOLDER_MIME_TYPE_}'`,
        "trashed = false"
      ].join(" and "),
      spaces: "drive",
      pageSize: 100,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      fields: "nextPageToken,files(id,name,mimeType,parents,driveId,webViewLink,trashed)"
    };

    if (pageToken) {
      params.pageToken = pageToken;
    }

    if (parentFolder.driveId) {
      params.corpora = "drive";
      params.driveId = parentFolder.driveId;
    } else {
      params.corpora = "user";
    }

    let response;
    try {
      response = Drive.Files.list(params);
    } catch (error) {
      throw new Error([
        `Could not inspect child folders under ${quote_(parentFolder.name)}.`,
        `Parent ID: ${parentFolder.id}`,
        `Original error: ${getErrorMessage_(error)}`
      ].join("\n"));
    }

    if (Array.isArray(response.files)) {
      files.push(...response.files);
    }
    pageToken = response.nextPageToken;
  } while (pageToken);

  // The API query is exact, but this defensive filter makes the policy clear.
  return files.filter(file => file.name === exactName);
}

/**
 * @param {Object} parentFolder Drive folder resource.
 * @param {string} name
 * @return {Object} Created folder resource.
 */
function createFolder_(parentFolder, name) {
  const metadata = {
    name: name,
    mimeType: FOLDER_MIME_TYPE_,
    parents: [parentFolder.id]
  };

  try {
    return Drive.Files.create(metadata, null, {
      supportsAllDrives: true,
      fields: "id,name,mimeType,parents,driveId,webViewLink,trashed"
    });
  } catch (error) {
    throw new Error([
      `Could not create folder ${quote_(name)} under ${quote_(parentFolder.name)}.`,
      `Parent ID: ${parentFolder.id}`,
      "Confirm the running user can add content to this folder.",
      `Original error: ${getErrorMessage_(error)}`
    ].join("\n"));
  }
}

/**
 * Escapes a literal used inside a Drive API query string.
 * @param {string} value
 * @return {string}
 */
function escapeDriveQueryValue_(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/**
 * @param {Object} folder
 * @return {string}
 */
function getFolderUrl_(folder) {
  return folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`;
}


/* ========================================================================== *
 * CONFIGURATION VALIDATION
 * ========================================================================== */

/** Validates all configuration before the first Drive API call. */
function validateConfiguration_() {
  if (typeof CONFIG.dryRun !== "boolean") {
    throw new Error("CONFIG.dryRun must be true or false.");
  }

  if (!Number.isInteger(CONFIG.lockTimeoutMs) || CONFIG.lockTimeoutMs < 0) {
    throw new Error("CONFIG.lockTimeoutMs must be a non-negative integer.");
  }

  if (!Array.isArray(CONFIG.allowedSemesterFolders) ||
      CONFIG.allowedSemesterFolders.length === 0) {
    throw new Error("CONFIG.allowedSemesterFolders must be a non-empty array.");
  }

  const allowedSet = new Set();
  CONFIG.allowedSemesterFolders.forEach((name, index) => {
    validateConfiguredFolderName_(name, `allowedSemesterFolders[${index}]`);
    if (allowedSet.has(name)) {
      throw new Error(`Duplicate allowed semester folder name: ${quote_(name)}`);
    }
    allowedSet.add(name);
  });

  if (!Array.isArray(CONFIG.semesterPeriods) ||
      CONFIG.semesterPeriods.length === 0) {
    throw new Error("CONFIG.semesterPeriods must be a non-empty array.");
  }

  const assignedMonths = new Set();
  const periodFolderNames = new Set();

  CONFIG.semesterPeriods.forEach((period, index) => {
    if (!period || typeof period !== "object") {
      throw new Error(`semesterPeriods[${index}] must be an object.`);
    }

    validateConfiguredFolderName_(
      period.folderName,
      `semesterPeriods[${index}].folderName`
    );

    if (!allowedSet.has(period.folderName)) {
      throw new Error(
        `Semester period uses an unapproved folder: ${quote_(period.folderName)}`
      );
    }

    if (periodFolderNames.has(period.folderName)) {
      throw new Error(
        `Semester folder has more than one period entry: ${quote_(period.folderName)}`
      );
    }
    periodFolderNames.add(period.folderName);

    if (!Array.isArray(period.months) || period.months.length === 0) {
      throw new Error(`${period.folderName} must contain at least one month.`);
    }

    period.months.forEach(month => {
      if (!Number.isInteger(month) || month < 1 || month > 12) {
        throw new Error(`Invalid month for ${period.folderName}: ${month}`);
      }
      if (assignedMonths.has(month)) {
        throw new Error(`Month ${month} is assigned more than once.`);
      }
      assignedMonths.add(month);
    });
  });

  allowedSet.forEach(name => {
    if (!periodFolderNames.has(name)) {
      throw new Error(`No semester period is configured for ${quote_(name)}.`);
    }
  });

  for (let month = 1; month <= 12; month++) {
    if (!assignedMonths.has(month)) {
      throw new Error(`Month ${month} is not assigned to a semester period.`);
    }
  }

  validateFolderTree_(CONFIG.folderStructures, "CONFIG.folderStructures");
}

/**
 * @param {Object} structure
 * @param {string} path
 */
function validateFolderTree_(structure, path) {
  validateFolderStructureShape_(structure, path);

  Object.keys(structure).forEach(name => {
    validateConfiguredFolderName_(name, `${path} > ${quote_(name)}`);
    validateFolderTree_(structure[name], `${path} > ${name}`);
  });
}

/**
 * @param {*} structure
 * @param {string} path
 */
function validateFolderStructureShape_(structure, path) {
  if (Object.prototype.toString.call(structure) !== "[object Object]") {
    throw new Error(`Folder structure at ${path} must be a plain object.`);
  }
}

/**
 * Folder-name policy: exact, non-empty, no edge whitespace, no control
 * characters, and no slash/backslash path-like names.
 *
 * @param {*} name
 * @param {string} location
 */
function validateConfiguredFolderName_(name, location) {
  if (typeof name !== "string" || name.length === 0) {
    throw new Error(`Folder name at ${location} must be a non-empty string.`);
  }

  if (name !== name.trim()) {
    throw new Error(`Folder name has leading/trailing whitespace at ${location}: ${quote_(name)}`);
  }

  if (/[\u0000-\u001F\u007F]/.test(name)) {
    throw new Error(`Folder name contains a control character at ${location}.`);
  }

  if (/[\\/]/.test(name)) {
    throw new Error([
      `Folder name contains a slash or backslash at ${location}: ${quote_(name)}`,
      "Represent nested folders with nested objects instead of path-like names."
    ].join("\n"));
  }
}

/**
 * @param {Object} options
 */
function validateRunOptions_(options) {
  if (!options || typeof options !== "object") {
    throw new Error("Build options are required.");
  }
  assertValidDate_(options.date, "Build date");
  if (typeof options.dryRun !== "boolean") {
    throw new Error("Build option dryRun must be boolean.");
  }
  if (typeof options.useLock !== "boolean") {
    throw new Error("Build option useLock must be boolean.");
  }
  if (typeof options.label !== "string" || options.label.trim().length === 0) {
    throw new Error("Build option label must be a non-empty string.");
  }
}


/* ========================================================================== *
 * GENERAL HELPERS
 * ========================================================================== */

/**
 * @param {*} value
 * @param {string} label
 */
function assertValidDate_(value, label) {
  if (!(value instanceof Date) || isNaN(value.getTime())) {
    throw new Error(`${label} must be a valid Date object.`);
  }
}

/**
 * JSON-style quoting makes invisible edge whitespace visible in errors.
 * @param {*} value
 * @return {string}
 */
function quote_(value) {
  return JSON.stringify(String(value));
}

/**
 * @param {*} error
 * @return {string}
 */
function getErrorMessage_(error) {
  if (error && typeof error.message === "string") {
    return error.message;
  }
  return String(error);
}
