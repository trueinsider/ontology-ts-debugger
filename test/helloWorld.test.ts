import 'babel-polyfill';
import { readFileSync } from 'fs';
import * as rp from 'request-promise-native';
import { Debugger } from '../src';

function loadCode(path: string) {
  const codeBuffer = readFileSync(path);
  return codeBuffer.toString();
}

class LineMapping {
  start: number;
  file_line_no: number;
}

describe('Hello world test', () => {
  test('Hello', async () => {
    const response = await rp({
      method: 'POST',
      url: 'https://smartxcompiler.ont.io/api/beta/python/compile',
      strictSSL: false,
      body: {
        code: loadCode('./test/helloWorld.py')
      },
      json: true
    });

    const avm = response.avm;
    const contract = new Buffer(avm.substring(2, avm.length - 1), 'hex');

    const lineMappings: any = {};
    const debugMap = JSON.parse(response.debug).map;
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
