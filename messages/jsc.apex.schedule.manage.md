# summary

Manages all cron jobs on a target org from config file.

# description

Provide the path to a config file that contains a definition of scheduled jobs. The manage command will try to start non-existing jobs and, depending on options, also stop obsolete running jobs. All options for this command are read from the config file.

# flags.target-org.summary

Target org where the job will be scheduled.

# flags.config-file.summary

Path to a valid config file that configures scheduled jobs.

# flags.dry-run.summary

Simulate a run and get information on how many jos would be started, stopped, and left untouched.

# flags.config-file.description

Specify the jobs to start, together with options how obsolete or redundant jobs should be treated. Jobs are identified by their unique job name. You can specify the same apex class multiple times, as long as job names are different. For convenience, you can also use the apex class as job name and omit class property - in that case, you can only schedule an apex class once for obvious reasons.

# flags.dry-run.description

Queries existing jobs on the target org and evaluates, which jobs would be changed. However, dry-run cannot compile the apex class and cron expression. This means, that invalid cron expressions or apex classes will not be caught and the command may still fail, when run without this flag.

# examples

- Sync all jobs on target org with config file

  <%= config.bin %> <%= command.id %> -o MyTargetOrg -f scheduled-job-definitions.yaml

# infos.dry-run-mode

Running in simulation mode. No jobs will be changed.

# infos.dry-run-cannot-compile

Dry-run cannot validate apex classes and cron expressions.
