# Solution Design: `sf jsc maintain garbage dispose`

Deletes deprecated package components (as found by `sf jsc maintain garbage collect`) from the target org. The command first validates the deletion with a check-only deploy and drops components that can't be deleted. It then deploys the remaining garbage as destructive changes. Everything runs in-process with `@salesforce/source-deploy-retrieve` (SDR).

## Modules

| Module                                         | Change                            | Purpose                                                                                                                                                                                                                                                                                         |
| ---------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/commands/jsc/maintain/garbage/dispose.ts` | new                               | The command. It collects the garbage, maps it to registry components, runs the validation loop, prints tables, confirms, deploys (quick deploy or regular deploy) and maps the result. The deploy logic stays in the command for now; we'll decide later whether it becomes a separate utility. |
| `src/types/garbageDisposeTypes.ts`             | new                               | `GarbageDisposeResult`, `GarbageDisposeStatus`, `GarbageDisposeFailure`.                                                                                                                                                                                                                        |
| `src/common/ux/garbageCollectionUx.ts`         | new                               | Reusable console output: `printTable(garbage, title?)` and `printFailures(failures, title?)`. Used by `collect` and `dispose`.                                                                                                                                                                  |
| `src/common/utils/garbageFilterResolver.ts`    | new (extracted from `collect.ts`) | `resolvePackageIds`, `resolveDevhub`.                                                                                                                                                                                                                                                           |
| `src/commands/jsc/maintain/garbage/collect.ts` | modify                            | Uses the extracted ux and resolvers. No behaviour change.                                                                                                                                                                                                                                       |
| `messages/jsc.maintain.garbage.dispose.md`     | new                               | Messages.                                                                                                                                                                                                                                                                                       |
| `src/garbage-collection/**`                    | unchanged                         | The collector is reused as-is.                                                                                                                                                                                                                                                                  |

## Key Architectural Decisions

### 1. In-process SDR, no shell-out

- Each garbage component becomes a `SourceComponent({ name, type })`. The type comes from `RegistryAccess.getTypeByName(container.metadataType)`.
- Components are added to a `ComponentSet` with `DestructiveChangesType.POST`, and the set is deployed with `ComponentSet.deploy()`.
- The API version is pinned on the `ComponentSet`, so SDR never falls back to `sfdx-project.json`.

### 2. Validate, drop what fails, validate again, then deploy

The problem: a destructive deploy is atomic. A single component the org won't delete rolls back everything. Typical causes are an active approval process, an activated Lightning page, or an email template still used by another component.

The approach:

1. **Validate** the full set with a check-only deploy (`apiOptions: { checkOnly: true }`). Nothing changes in the org.
2. If it fails:
   - Remove every component listed in `componentFailures` from the set and record it with its `problem`.
   - Validate the remaining set again.
   - Stop when a validation succeeds, when nothing is left, or after at most `MAX_VALIDATION_ROUNDS` (3).
   - Each round removes at least one component. If a validation fails and none of its errors can be matched to a component (e.g. the org is locked), all remaining components are reported as failed with the error message.
3. **Show both lists before the prompt:** a table of garbage that will be deleted, and a table of garbage that can't be deleted, with reasons.
4. **Deploy what validated:**
   - If the validation ran Apex tests (`runTestsEnabled`, e.g. when deleting Apex in production), use quick deploy (`deployRecentValidation()`) so tests don't run twice.
   - Otherwise, deploy the validated set normally.
   - The final deploy is still atomic. If it fails anyway (the org changed in the meantime), the result is `Failed`.

Why not `rollbackOnError: false`: production ignores it, so behaviour would differ between production and sandboxes.

Why not exclude whole metadata types: whether a component can be deleted depends on the component and its state in the org, not on its type. Failed components show up again on the next `collect`/`dispose` run. Once someone fixes the cause (e.g. deactivates the approval process), the next run deletes them.

Components are matched to failures by `<metadataType>#<fullName>`, case-insensitive.

### 3. Result

`GarbageDisposeResult` = `PackageGarbageResult` (everything that was found) plus:

- `status`, which is one of:
  - `Success`: everything was deleted.
  - `PartialSuccess`: some components were deleted, the rest are listed in `failed`.
  - `Failed`: nothing was deleted.
  - `Skipped`: no garbage was found, or you declined.
- `deployId` (the final deploy, or the quick deploy).
- `disposed`: what was actually deleted, organised like `deprecatedMembers`.
- `failed`: a list of `{ metadataType, fullName, subjectId, problem }`.

Exit codes:

- `Failed` exits with 1.
- `PartialSuccess` exits with 0 and prints a warning, so a release step doesn't fail because of an active component.
- A `--fail-on-partial` flag can be added if CI needs to be strict.

### 4. Safety

- The command asks for confirmation after both tables are printed. `--no-prompt` skips only the question.
- If nothing can be deleted, the command fails without prompting.
- Unsupported types (`RecordType`, `ListView`, unknown key prefixes) are never deleted:
  - `TrashBin` already keeps them out of the result.
  - Types the registry doesn't know are moved to `unsupported` before validation.

## Command Syntax

```
sf jsc maintain garbage dispose -o <org> [-v <devhub>] [-m <type>]... [-p <package>]... [--no-prompt] [--api-version] [--json]
```

## Tests

- **Unit** (`dispose.test.ts`), with `ComponentSet.prototype.deploy` stubbed to return a queue of responses:
  - full success;
  - partial success: a component that fails the first round is removed and validated again;
  - every component fails validation;
  - validation fails without failures that can be matched to a component;
  - you decline the prompt;
  - `--no-prompt`;
  - no garbage found;
  - the final deploy fails;
  - quick deploy after a validation that ran tests;
  - a type the registry doesn't know.
- **NUT** (`collect.nut.ts`, runs in sequence on one scratch org; `test:nuts*` compile `lib/` first via wireit). The assertions don't depend on the package contents or on how many validation rounds run:
  - dispose only `ExternalString`: everything is deleted;
  - dispose everything: `Success` or `PartialSuccess`, every component found is either disposed or failed (never both, never missing), every failure has a problem, and `collect` afterwards only finds components that failed;
  - dispose again: only the leftovers are processed, the same consistency checks hold, and the exit code matches the status;
  - dispose with a filter that matches nothing: `Skipped`.
  - Locally, the NUTs need `SF_TEMP_SHOW_SECRETS=true` when you reuse a hub with `TESTKIT_HUB_USERNAME`, because sf CLI 2.155+ redacts `sfdxAuthUrl`.

Failures are always assigned to a garbage component:

- by `type#fullName`;
- if the org reports the failure against `destructiveChanges.xml`, to the components of that type whose name appears in the problem text, or to all components of that type if none is named.

`failed` therefore only ever lists components the command tried to delete, each one once.

## Out of Scope

- **Org Manifest integration** (a `GarbageDisposal` artifact). See [[Garbage collection after package install (deprecated components)]].
- **Fixing blockers automatically** (deactivating approval processes or Lightning pages). That changes active configuration, which is a different risk level from deleting deprecated components.
- **Children of soft-deleted objects:** after a custom object is deleted, its approval processes (and possibly other child components) stay in `Package2Member`. The collector then reports them with the object Id instead of its name (`01I….Placeholder_Approval_Process`), and they fail in `dispose`. This needs fixing in the collector.
- **`Folder` (00l) garbage:** the collector has no handler for it yet (it would need a mapping to `EmailFolder`, `ReportFolder` and so on). It is reported as `unsupported`.
- **A `--dry-run` flag:** the validation loop already does most of it. A flag would just stop after printing the tables.
