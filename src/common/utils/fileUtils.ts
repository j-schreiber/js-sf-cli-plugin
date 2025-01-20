import fs from 'node:fs';

export function pathHasNoFiles(path: string): boolean {
  const dirContent = fs.readdirSync(path, { recursive: true });
  let hasFiles = false;
  dirContent.forEach((dirContentPath) => {
    hasFiles = hasFiles || !fs.lstatSync(`${path}/${String(dirContentPath)}`).isDirectory();
  });
  return !hasFiles;
}
