import { DynamicByteArray } from "./utils/DynamicByteArray";
import { ISerializedModuleInfo } from "./ModuleInfo";
import { Instruction } from "./Instruction";

export class ExecutionRecorder {
    private _lastModuleId: number = -1;

    private readonly _resolvedModules = new Set<number>();
    private readonly _writer = new InstructionWriter();

    constructor(
        private readonly resolveModuleId: (moduleId: number) => ISerializedModuleInfo
    ) { }

    public getBuffer(): Int8Array {
        return this._writer.getBuffer();
    }

    public recordFunctionEnter(moduleId: number, functionId: number): void {
        if (moduleId !== this._lastModuleId) {
            this._writer.writeSetModuleId(moduleId);
            this._lastModuleId = moduleId;
            this._writeModuleInfoIfNeeded(moduleId);
        }
        this._writer.writeFunctionEnter(functionId);
    }

    public recordBlockExecution(blockId: number): void {
        this._writer.writeBlockExecution(blockId);
    }

    public recordFunctionReturn(): void {
        this._writer.writeFunctionReturn();
    }

    private _writeModuleInfoIfNeeded(moduleId: number): void {
        if (this._resolvedModules.has(moduleId)) { return; }
        this._resolvedModules.add(moduleId);
        const moduleInfo = this.resolveModuleId(moduleId);
        this._writer.writeModuleInfo(moduleInfo);
    }
}

export class InstructionWriter {
    private readonly _buffer = new DynamicByteArray();

    public getBuffer(): Int8Array {
        return this._buffer.getBuffer();
    }

    public writeModuleInfo(moduleInfo: ISerializedModuleInfo): void {
        const modulePathBytes = new TextEncoder().encode(JSON.stringify(moduleInfo));

        this._buffer.push(InstructionOpCode.SetModuleInfo);
        this._buffer.pushU32(modulePathBytes.length);

        // write path
        for (let i = 0; i < modulePathBytes.length; i++) {
            this._buffer.push(modulePathBytes[i]);
        }
    }

    public writeFunctionEnter(functionId: number): void {
        writeInstruction(InstructionOpCode.CallFunction, functionId, this._buffer);
    }

    public writeBlockExecution(blockId: number): void {
        writeInstruction(InstructionOpCode.ReachedBlock, blockId, this._buffer);
    }

    public writeFunctionReturn(): void {
        this._buffer.push(InstructionOpCode.ReturnFunction);
    }

    public writeSetModuleId(moduleId: number): void {
        writeInstruction(InstructionOpCode.SetModuleId, moduleId, this._buffer);
    }
}

const enum InstructionOpCode {
    SetModuleId = 0,
    CallFunction = 0b01_000000,
    ReachedBlock = 0b10_000000,
    ReturnFunction = 0b11_00000_0,
    SetModuleInfo = 0b11_00000_1
}

function writeInstruction(
    instruction: InstructionOpCode,
    n: number,
    buffer: DynamicByteArray
): void {
    if (n < 0b0011_1101) {
        buffer.push(instruction | n);
    } else if (n <= 0b1111_1111) {
        buffer.push(instruction | 0b0011_1101);
        buffer.push(n);
    } else if ((n >>> 8) < 0b1111_1111) {
        buffer.push(instruction | 0b0011_1110);
        buffer.push(n & 0b1111_1111);
        buffer.push((n >>> 8) & 0b1111_1111);
    } else if ((n >>> 16) < 0b1111_1111) {
        buffer.push(instruction | 0b0011_1111);
        buffer.push(n & 0b1111_1111);
        buffer.push((n >>> 8) & 0b1111_1111);
        buffer.push((n >>> 16) & 0b1111_1111);
    } else {
        throw new Error("value is too big");
    }
}
