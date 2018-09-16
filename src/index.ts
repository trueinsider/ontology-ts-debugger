import { ScEnvironment } from 'ontology-ts-vm';

export class Debugger {
  private env: ScEnvironment;
  private address: Buffer;
  private lineMappings: {};
  private breakpoints: number[] = [];
  private instructionPointer: number;
  private stopAtInstructionPointer?: number;
  private resolve?: (value: boolean) => void = undefined;

  constructor(contract: Buffer, lineMappings: any = {}) {
    this.env = new ScEnvironment();
    this.address = this.env.deployContract(contract);
    this.lineMappings = lineMappings;
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

  stepOverOpcode() {
    this.stopAtInstructionPointer = this.instructionPointer + 1;
    this.continue();
  }

  stepOverLine() {
    let nextLine: number;
    let breakAtNext = false;
    const entries = Object.entries(this.lineMappings);
    for (const e of entries) {
      const line = parseInt(e[0], 10);
      // @ts-ignore
      const pointer: number = e[1];
      if (breakAtNext) {
        nextLine = line;
        this.stopAtInstructionPointer = pointer;
        break;
      }
      if (pointer >= this.instructionPointer) {
        breakAtNext = true;
      }
    }

    this.continue();
  }

  async execute(args: Buffer) {
    const call = Buffer.concat([args, new Buffer([103]), this.address]);
    return await this.env.execute(call, { inspect: async (data) => {
      this.instructionPointer = data.instructionPointer;
      if (this.breakpoints.includes(data.instructionPointer) ||
        this.stopAtInstructionPointer === data.instructionPointer) {
        this.stopAtInstructionPointer = undefined;
        return new Promise<boolean>((resolve) => {
          this.resolve = resolve;
        });
      }
      return true;
    } });
  }
}
