import fs from 'node:fs';
import yaml from 'js-yaml';
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
    fileContent = yaml.load(fs.readFileSync(path, 'utf8'));
  } catch (error) {
    throw messages.createError('InvalidFilePath', [path]);
  }
  const parseResult = schema.safeParse(fileContent);
  if (parseResult.success) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return parseResult.data as z.infer<T>;
  } else {
    const errsFlat = parseResult.error.flatten();
    const formErrors = errsFlat.formErrors.join(',');
    const fieldErrors = Object.entries(errsFlat.fieldErrors)
      // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
      .map(([errPath, errors]) => `${errPath}: ${errors?.join(', ')}`)
      .join('\n');
    const combinedMsgs = [formErrors, fieldErrors].filter(Boolean).join('\n');
    throw messages.createError('InvalidSchema', [combinedMsgs]);
  }
}
