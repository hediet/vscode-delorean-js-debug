import { InstructionWriter } from "./ExecutionRecorder";

abstract class BaseInstruction {
    equals(other: Instruction): boolean {
        return this.toString() === other.toString();
    }

    public writeInstruction(this: Instruction, writer: InstructionWriter): void {
        switch (this.type) {
            case 'callFunction':
                writer.writeFunctionEnter(this.functionId);
                break;
            case 'reachedBlock':
                writer.writeBlockExecution(this.blockId);
                break;
            case 'returnFunction':
                writer.writeFunctionReturn();
                break;
            case 'setModuleId':
                writer.writeSetModuleId(this.moduleId);
                break;
            case 'setModuleInfo':
                writer.writeModuleInfo(JSON.parse(this.moduleInfoJson));
                break;
            default:
                throw new Error(`Unknown instruction type: ${(this as any).type}`);
        }
    }
}

export class SetModuleIdInstruction extends BaseInstruction {
    public readonly type = 'setModuleId';
    constructor(public readonly moduleId: number) { super(); }

    public toString() {
        return `setModuleId(${this.moduleId})`;
    }
}

export class SetModuleInfoInstruction extends BaseInstruction {
    public readonly type = 'setModuleInfo';
    constructor(public readonly moduleInfoJson: string) { super(); }

    public toString() {
        return `setModuleInfo(${this.moduleInfoJson})`;
    }
}

export class CallFunctionInstruction extends BaseInstruction {
    public readonly type = 'callFunction';
    constructor(public readonly functionId: number) { super(); }

    public toString() {
        return `callFunction(${this.functionId})`;
    }
}

export class ReachedBlockInstruction extends BaseInstruction {
    public readonly type = 'reachedBlock';
    constructor(public readonly blockId: number) { super(); }

    public toString() {
        return `reachedBlock(${this.blockId})`;
    }
}

export class ReturnFunctionInstruction extends BaseInstruction {
    public readonly type = 'returnFunction';

    public toString() {
        return `returnFunction`;
    }
}

export type Instruction = SetModuleIdInstruction | SetModuleInfoInstruction | CallFunctionInstruction | ReachedBlockInstruction | ReturnFunctionInstruction;
