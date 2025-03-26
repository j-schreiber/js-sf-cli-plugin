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

# flags.concise.summary

Minimize columns displayed in output table.

# examples

- Lists all jobs on the target org

  <%= config.bin %> <%= command.id %> -o MyTargetOrg

- Lists jobs that match apex class and job name

  <%= config.bin %> <%= command.id %> -o MyTargetOrg -c MyScheduledJobClass -n "Scheduled Job Name"
