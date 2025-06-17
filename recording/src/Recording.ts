import { Instruction, SetModuleIdInstruction, SetModuleInfoInstruction, CallFunctionInstruction, ReachedBlockInstruction, ReturnFunctionInstruction } from "./Instruction";
import { ExecutionPosition, ModuleInfo } from "./ModuleInfo";
import { IInstruction, RecordingAnalyzerApi, RecordingApi } from "./RecordingAnalyzerApi";

export class Recording {
    public static async load(data: Buffer): Promise<Recording> {
        const api = await RecordingAnalyzerApi.load();
        const r = api.parse(data);
        return new Recording(r);
    }

    private readonly _moduleInfos = new Map<number, ModuleInfo>();

    private constructor(private readonly recording: RecordingApi) {
    }

    private _getModuleInfo(moduleId: number): ModuleInfo {
        let info = this._moduleInfos.get(moduleId);
        if (!info) {
            info = ModuleInfo.from(this.recording.getModuleInfo(moduleId));
            this._moduleInfos.set(moduleId, info);
        }
        return info;
    }

    public decode(): Instruction[] {
        return this.recording.decode().map(i => instructionObjToClass(i));
    }

    public getStack(instructionIdx: number): Stack {
        const stack = this.recording.getStackAt(instructionIdx);
        return new Stack(stack.frames.map(f => {
            const info = this._getModuleInfo(f.module_id);
            const loc = info.getTextPos(f.function_id, f.block_id);
            return loc;
        }));
    }
}

function instructionObjToClass(instr: IInstruction): Instruction {
    switch (instr.type) {
        case 'SetModuleId':
            return new SetModuleIdInstruction(instr.module_id);
        case 'SetModuleInfo':
            return new SetModuleInfoInstruction(instr.module_info_json);
        case 'CallFunction':
            return new CallFunctionInstruction(instr.function_id);
        case 'ReachedBlock':
            return new ReachedBlockInstruction(instr.block_id);
        case 'ReturnFunction':
            return new ReturnFunctionInstruction();
        default:
            throw new Error(`Unknown instruction type: ${(instr as any).type}`);
    }
}

export class Stack {
    constructor(
        public readonly frames: readonly ExecutionPosition[],
    ) { }

    toString() {
        return this.frames.map(f => f?.toString()).join('\n');
    }
}
