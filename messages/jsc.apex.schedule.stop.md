# summary

Stop one or more cron jobs on the target org.

# description

The command allows to stop specific jobs or multiple jobs, based on the provided inputs. You can provide the name of an apex class that implements the `Schedulable` interface, the name of a scheduled job or a list of ids (08e). For most filter-options, the command is idempotent. That means, that it succeeds, even if no job was actually stopped. The only exception is explicit input of job id.

# flags.target-org.summary

Target org where the job will stopped.

# flags.name.summary

Identify the scheduled job by its provided name.

# flags.apex-class-name.summary

Name of the apex class that will be stopped.

# flags.apex-class-name.description

The command finds all scheduled instances of this apex class and stops them.

# flags.id.summary

The CronTrigger Id of the job to stop

# flags.id.description

Provide the Id of the cron trigger that was returned by `System.schedule`. If the Id is invalid, an error is returned.

# flags.trace.summary

Log detailed debug information of command execution.

# flags.trace.description

Due to limitations of available Salesforce APIs, this command uses an anonymous apex execution under the hood. The execution may fail due to a variety of reasons, and the scheduler tries its best to extract the correct error messages. If this doesn't help, use the --trace flag to output full debug logs from the execution.

# flags.no-prompt.summary

Don't prompt before executing destructive changes.

# flags.no-prompt.description

Without this flag, the command asks for confirmation before stopping jobs. Use this flag in CI pipelines.

# examples

- Stop all scheduled jobs on a target org

  <%= config.bin %> <%= command.id %> -o MyTargetOrg

- Stop a job by its id on your default org

  <%= config.bin %> <%= command.id %> -i 08e9b00000KktvqAAB

- Stop all scheduled jobs of a particular apex class on a target org

  <%= config.bin %> <%= command.id %> -c MyCaseReminderJob -o MyTargetOrg

# allJobsStopped

Successfully stopped %s jobs.

# confirmJobDeletion

You are about to stop the following jobs. Please confirm this is what you want.

# abortCommand

Aborted by user. No jobs were stopped.
