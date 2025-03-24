# summary

Manages all cron jobs on a target org from config file.

# description

Provide the path to a config file that contains a definition of scheduled jobs. The manage command will try to start non-existing jobs and, depending on options, also stop obsolete running jobs. All options for this command are read from the config file.

# flags.target-org.summary

Target org where the job will be scheduled.

# flags.config-file.summary

Path to a valid config file that configures scheduled jobs.

# flags.config-file.description

Specify the jobs to start, together with options how obsolete or redundant jobs should be treated. Jobs are identified by their unique job name. You can specify the same apex class multiple times, as long as job names are different. For convenience, you can also use the apex class as job name and omit class property - in that case, you can only schedule an apex class once for obvious reasons.

# examples

- Sync all jobs on target org with config file

  <%= config.bin %> <%= command.id %> -o MyTargetOrg -f scheduled-job-definitions.yaml
