import 'babel-polyfill';
import { readFileSync } from 'fs';
import { Debugger, LineMapping } from '../src';
import { map as debugMap } from '../test/helloWorld.json';

function loadContract(path: string) {
  const codeBuffer = readFileSync(path);
  const codeString = codeBuffer.toString();
  return new Buffer(codeString, 'hex');
}

class LineMapping {
  start: number;
  file_line_no: number;
}

describe('Hello world test', () => {
  test('Hello', async () => {
    const contract = loadContract('./test/helloWorld.avm');

    const lineMappings: any = {};
    debugMap.forEach((m: LineMapping) => {
      lineMappings[m.file_line_no] = m.start;
    });

    const debug = new Debugger(contract, lineMappings);

    debug.addLineBreakpoint(5);
    setTimeout(() => {
      expect(debug.instructionPointer).toBe(26);
      debug.runToLine(6);
    }, 1000);
    setTimeout(() => {
      expect(debug.instructionPointer).toBe(36);
      debug.continue();
    }, 2000);

    const { result, notifications } = await debug.execute([new Buffer('05576f726c6451c10548656c6c6f', 'hex')]);

    expect(debug.instructionPointer).toBe(44);

    expect(result.getBoolean()).toBeTruthy();
    expect(notifications).toHaveLength(1);
    expect(notifications[0].states).toHaveLength(1);
    expect(notifications[0].states[0]).toBe(new Buffer('World').toString('hex'));
  });
});
