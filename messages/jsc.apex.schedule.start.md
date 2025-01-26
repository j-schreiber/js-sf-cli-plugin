# summary

Schedule a cron job on the target org.

# description

Provide the name of an apex class that implements the `Schedulable` interface and a cron expression to schedule a cron job (`CronTrigger`). Use the official Documentation to learn more about cron expressions: https://developer.salesforce.com/docs/atlas.en-us.apexcode.meta/apexcode/apex_scheduler.htm.

# flags.target-org.summary

Target org where the job will be scheduled.

# flags.name.summary

Unique name of the cron job.

# flags.name.description

If you leave this empty, the name of the apex class is used. Jobs must be unique by name: Use different names if you plan to schedule the same apex class multiple times.

# flags.apex-class-name.summary

Name of the Apex class to schedule.

# flags.apex-class-name.description

Must implement the System.Schedulable interface.

# flags.cron-expression.summary

The cron expression that specifies execution of the job.

# flags.cron-expression.description

Provide the expression in unix-compatible format (see Apex Documentation for more details). The basic syntax of the expression is "Seconds Minutes Hours Day_of_month Month Day_of_week Optional_year". See examples for commonly used cron expressions.

# flags.trace.summary

Log detailed debug information of command execution.

# flags.trace.description

Due to limitations of available Salesforce APIs, this command uses an anonymous apex execution under the hood. The execution may fail due to a variety of reasons, and the scheduler tries its best to extract the correct error messages. If this doesn't help, use the --trace flag to output full debug logs from the execution.

# examples

- Schedule a class to run every day at 1 am:

  <%= config.bin %> <%= command.id %> -c MyJobImplementationName -e '0 0 1 * * ?'

- Schedule a class to run on weekdays (Monday to Friday) at 10 am:

  <%= config.bin %> <%= command.id %> -c MyJobImplementationName -e '0 0 10 ? * MON-FRI'

- Schedule a job with a custom name to run every day at 5:30pm:

  <%= config.bin %> <%= command.id %> -c MyJobImplementationName -e "0 30 17 * * ?" -n "My Job Name"

# info.success

Successfully scheduled job with id: %s. First execution planned for: %s.
