public class TestSchedulable2 implements Schedulable {
    public void execute(SchedulableContext sc) {
        System.debug('Does nothing');
    }
}
