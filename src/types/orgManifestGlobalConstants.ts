import { z } from 'zod';

export const DeployStrategies = z.enum(['SourceDeploy', 'PackageInstall', 'CronJobSchedule']);
export const ArtifactTypes = z.enum(['UnlockedPackage', 'Unpackaged', 'CronJob']);
export const DeployStatus = z.enum(['Success', 'Pending', 'Failed']);
