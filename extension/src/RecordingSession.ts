import { Recording } from "@hediet/code-insight-recording";
import { Uri, workspace } from "vscode";
import { Disposable } from "./utils/disposables";
import { IObservable, derived, observableValue } from "./utils/observables/observable";

export class RecordingSession extends Disposable {
    public static async load(uri: Uri): Promise<RecordingSession> {
        const buffer = await workspace.fs.readFile(uri);
        const recording = await Recording.load(Buffer.from(buffer));
        return new RecordingSession(uri, recording);
    }

    private readonly _currentInstructionIdx = observableValue<number>(this, 100000);

    public readonly currentInstructionIdx: IObservable<number> = this._currentInstructionIdx;

    public readonly stack = derived(this, reader => {
        const stack = this.recording.getStack(this._currentInstructionIdx.read(reader));
        return stack;
    });

    constructor(
        public readonly uri: Uri,
        public readonly recording: Recording
    ) {
        super();
    }

    public forwards(): void {
        this._currentInstructionIdx.set(this._currentInstructionIdx.get() + 1, undefined);
    }

    public backwards(): void {
        this._currentInstructionIdx.set(Math.max(0, this._currentInstructionIdx.get() - 1), undefined);
    }
}
