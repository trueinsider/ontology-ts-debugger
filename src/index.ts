import { Address, ScEnvironment } from 'ontology-ts-vm';

export class Debugger {
  instructionPointer: number;
  private env: ScEnvironment;
  private addressBuffer: Buffer;
  private address: Address;
  private lineMappings: {};
  private onStop?: (data: any) => void = undefined;
  private breakpoints: number[] = [];
  private stopAtInstructionPointer?: number;
  private resolve?: (value: boolean) => void = undefined;
  private history: any[] = [];

  constructor(contract: Buffer, lineMappings: any = {}, onStop?: (data: any) => void) {
    this.env = new ScEnvironment();
    this.addressBuffer = this.env.deployContract(contract);
    this.address = Address.parseFromBytes(this.addressBuffer);
    this.lineMappings = lineMappings;
    this.onStop = onStop;
  }

  addOpcodeBreakpoint(pointer: number) {
    if (!this.breakpoints.includes(pointer)) {
      this.breakpoints.push(pointer);
    }
  }

  addLineBreakpoint(line: number) {
    // @ts-ignore
    const pointer: number = this.lineMappings[line];
    if (pointer !== undefined) {
      this.addOpcodeBreakpoint(pointer);
    }
  }

  removeOpcodeBreakpoint(pointer: number) {
    const index = this.breakpoints.indexOf(pointer);
    if (index > -1) {
      this.breakpoints.splice(index, 1);
    }
  }

  removeLineBreakpoint(line: number) {
    // @ts-ignore
    const pointer: number = this.lineMappings[line];
    if (pointer !== undefined) {
      this.removeOpcodeBreakpoint(pointer);
    }
  }

  continue() {
    if (this.resolve !== undefined) {
      const resolve = this.resolve;
      this.resolve = undefined;
      resolve(true);
    }
  }

  stop() {
    if (this.resolve !== undefined) {
      const resolve = this.resolve;
      this.resolve = undefined;
      resolve(false);
    }
  }

  stepOverOpcode() {
    this.stopAtInstructionPointer = this.instructionPointer + 1;
    this.continue();
  }

  stepOverLine() {
    let breakAtNext = false;
    const values: number[] = Object.values(this.lineMappings);
    for (const pointer of values) {
      if (breakAtNext) {
        this.stopAtInstructionPointer = pointer;
        this.continue();
        break;
      }
      if (pointer >= this.instructionPointer) {
        breakAtNext = true;
      }
    }
  }

  runToLine(line: number) {
    // @ts-ignore
    const pointer: number = this.lineMappings[line];
    if (pointer !== undefined) {
      this.stopAtInstructionPointer = pointer;
      this.continue();
    }
  }

  async execute(args: Buffer[]) {
    const call = Buffer.concat([...args, new Buffer([103]), this.addressBuffer]);
    return await this.env.execute(call, { inspect: async (data) => {
      if (!data.contractAddress.equals(this.address)) {
        return true;
      }
      this.instructionPointer = data.instructionPointer;
      const evaluationStack = [];
      for (let i = 0; i < data.evaluationStack.count(); i++) {
        evaluationStack.push(data.evaluationStack.peek(i)!.toString());
      }
      this.history.push({instructionPointer: data.instructionPointer, opName: data.opName, evaluationStack});
      // console.log({opName: data.opName, instructionPointer: data.instructionPointer});
      if (this.breakpoints.includes(data.instructionPointer) ||
        this.stopAtInstructionPointer === data.instructionPointer) {
        this.stopAtInstructionPointer = undefined;
        if (this.onStop !== undefined) {
          const currentLine = this.getCurrentLine();
          this.onStop({ instructionPointer: this.instructionPointer, line: currentLine, evaluationStack: data.evaluationStack, altStack: data.altStack, history: this.history });
        }
        return new Promise<boolean>((resolve) => {
          this.resolve = resolve;
        });
      }
      return true;
    } });
  }

  private getCurrentLine() {
    const entries: Array<[string, number]> = Object.entries(this.lineMappings);
    let result;
    for (const [line, pointer] of entries) {
      if (this.instructionPointer < pointer) {
        break;
      }
      result = line;
    }
    return result;
  }
}
