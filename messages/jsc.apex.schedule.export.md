# summary

List all scheduled jobs on the target org.

# description

Export all jobs currently scheduled on the target org or specify additional filters to narrow down search results.

# flags.target-org.summary

Target org to check.

# flags.apex-class-name.summary

Only list jobs from a specific apex class.

# flags.job-name.summary

Only list jobs with a specific job name. Supports partial matches.

# flags.output-dir.summary

Writes exported jobs to a config file that can be used with "manage" command.

# flags.concise.summary

Minimize columns displayed in output table.

# examples

- List all jobs on the target org

  <%= config.bin %> <%= command.id %> -o MyTargetOrg

- List jobs that match apex class and job name

  <%= config.bin %> <%= command.id %> -o MyTargetOrg -c MyScheduledJobClass -n "Scheduled Job Name"

- List jobs that start with "Auto" and export them to tmp/dev/jobs.yaml

  <%= config.bin %> <%= command.id %> -j "Auto" -d tmp/dev

# info.wrote-output-to-file

Successfully wrote export to config file: %s

# info.no-scheduled-jobs-found

No scheduled jobs found on org. Nothing to show.
