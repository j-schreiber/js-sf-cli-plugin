public class TestJob implements Schedulable {
    public void execute(SchedulableContext sc) {
        System.debug('Does nothing');
    }
}
