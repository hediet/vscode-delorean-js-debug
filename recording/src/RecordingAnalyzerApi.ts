import init, { Recording, parse_recording } from '../../recording-analyzer-rust/pkg/recording_analyzer_rust';
import { ISerializedModuleInfo } from './ModuleInfo';

export class RecordingAnalyzerApi {
    private static instancePromise: Promise<RecordingAnalyzerApi> | null = null;

    public static async load(): Promise<RecordingAnalyzerApi> {
        if (RecordingAnalyzerApi.instancePromise) {
            return RecordingAnalyzerApi.instancePromise;
        }
        RecordingAnalyzerApi.instancePromise = (async () => {
            let buffer: ArrayBuffer;
            if (typeof process !== 'undefined') {
                const fs = require('fs').promises as typeof import('fs').promises;
                const path = require('path') as typeof import('path');
                buffer = await fs.readFile(path.join(__dirname, '../../recording-analyzer-rust/pkg/recording_analyzer_rust_bg.wasm'));
            } else {
                const response = await fetch(new URL('../../recording-analyzer-rust/pkg/recording_analyzer_rust_bg.wasm', import.meta.url));
                buffer = await response.arrayBuffer();
            }

            await init(buffer);
            return new RecordingAnalyzerApi();
        })();
        return RecordingAnalyzerApi.instancePromise;
    }

    public parse(data: Buffer): RecordingApi {
        return new RecordingApi(parse_recording(data));
    }
}

export class RecordingApi {
    constructor(private readonly recording: Recording) {
        console.log(recording.get_len());
    }

    getStackAt(instruction: number): Stack {
        return this.recording.stack_at(instruction) as Stack;
    }

    getModuleInfo(moduleId: number): ISerializedModuleInfo {
        const info = this.recording.get_module_info(moduleId);
        if (!info) {
            throw new Error(`Module info not found for module ${moduleId}`);
        }
        return JSON.parse(info) as ISerializedModuleInfo;
    }

    decode(): IInstruction[] {
        const result = this.recording.decode() as IInstruction[];
        return result;
    }
}

export interface ISetModuleIdInstruction {
    type: 'SetModuleId';
    module_id: number;
}

export interface ISetModuleInfoInstruction {
    type: 'SetModuleInfo';
    module_info_json: string;
}

export interface ICallFunctionInstruction {
    type: 'CallFunction';
    function_id: number;
}

export interface IReachedBlockInstruction {
    type: 'ReachedBlock';
    block_id: number;
}

export interface IReturnFunctionInstruction {
    type: 'ReturnFunction';
}

export type IInstruction = ISetModuleIdInstruction | ISetModuleInfoInstruction | ICallFunctionInstruction | IReachedBlockInstruction | IReturnFunctionInstruction;

export interface Stack {
    frames: StackFrame[];
}

export interface StackFrame {
    module_id: number;
    function_id: number;
    block_id: number | undefined;
}
