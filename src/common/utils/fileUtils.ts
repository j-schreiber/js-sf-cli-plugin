import fs from 'node:fs';
import { load } from 'js-yaml';
import { z } from 'zod';
import { Messages } from '@salesforce/core';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@j-schreiber/sf-plugin', 'fileutils');

export function pathHasNoFiles(path: string): boolean {
  const dirContent = fs.readdirSync(path, { recursive: true });
  let hasFiles = false;
  dirContent.forEach((dirContentPath) => {
    hasFiles = hasFiles || !fs.lstatSync(`${path}/${String(dirContentPath)}`).isDirectory();
  });
  return !hasFiles;
}

export function parseYaml<T extends z.ZodType>(path: string, schema: T): z.infer<typeof schema> {
  let fileContent;
  try {
    const rawContent = fs.readFileSync(path, 'utf8');
    // js-yaml 5 throws on empty documents, v4 returned undefined. Keep v4 behaviour,
    // so empty files are reported as schema violations, not as unreadable files.
    fileContent = rawContent.trim() === '' ? undefined : load(rawContent);
  } catch {
    throw messages.createError('InvalidFilePath', [path]);
  }
  const parseResult = schema.safeParse(fileContent);
  if (parseResult.success) {
    return parseResult.data;
  } else {
    const errsFlat: { formErrors: string[]; fieldErrors: Record<string, string[] | undefined> } = z.flattenError(
      parseResult.error
    );
    const formErrors = errsFlat.formErrors.join(',');
    const fieldErrors = Object.entries(errsFlat.fieldErrors)
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      .map(([errPath, errors]) => `${errPath}: ${errors?.join(', ')}`)
      .join('\n');
    const combinedMsgs = [formErrors, fieldErrors].filter(Boolean).join('\n');
    throw messages.createError('InvalidSchema', [combinedMsgs]);
  }
}
