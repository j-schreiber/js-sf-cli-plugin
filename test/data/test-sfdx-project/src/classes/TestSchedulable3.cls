public class TestSchedulable3 implements Schedulable {
    public void execute(SchedulableContext sc) {
        System.debug('Does nothing');
    }
}
