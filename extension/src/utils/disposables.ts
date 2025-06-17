export interface IDisposable {
    dispose(): void;
}

export class DisposableStore implements IDisposable {
    private disposables: IDisposable[] = [];
    private _isDisposed = false;

    get isDisposed(): boolean { return this._isDisposed; }

    dispose(): void {
        this.clear();
        this._isDisposed = true;
    }

    add<T extends IDisposable | undefined>(disposable: T): T {
        if (disposable) {
            this.disposables.push(disposable);
        }
        return disposable;
    }

    clear(): void {
        for (const disposable of this.disposables) {
            disposable.dispose();
        }
        this.disposables = [];
    }

    leakItems(): void {
        this.disposables = [];
    }
}

export abstract class Disposable implements IDisposable {
    protected readonly _store = new DisposableStore();

    dispose(): void {
        this._store.dispose();
    }

    protected _register<T extends IDisposable>(t: T): T {
        this._store.add(t);
        return t;
    }

    protected _registerOrDispose<T extends IDisposable | undefined>(t: T): T {
        if (t) {
            if (this._store.isDisposed) {
                t.dispose();
            } else {
                this._store.add(t);
            }
        }
        return t;
    }
}

export class RefCounted<T extends IDisposable> {
    public static of<T extends IDisposable>(value: T, additional?: IDisposable): RefCounted<T> {
        return new RefCounted(value, false, additional);
    }

    /**
     * A weak reference does not keep the value alive.
     */
    public static ofWeak<T extends IDisposable>(value: T, additional?: IDisposable): RefCounted<T> {
        return new RefCounted(value, true, additional);
    }

    private _counter: number;

    private constructor(public readonly value: T, weakRef: boolean, private readonly _additional?: IDisposable) {
        this._counter = weakRef ? 0 : 1;
    }

    dispose(): void {
        this._counter = this._counter - 1;
        if (this._counter <= 0) {
            this._additional?.dispose();
            this.value.dispose();
        }
    }

    clone(): RefCounted<T> {
        this._counter++;
        return this;
    }
}

/*
export class RefCounted<T extends IDisposable> {
    constructor(private readonly value: T) {

    }

    createReference(): IReference<T> {
    }
}

interface IReference<T> extends IDisposable {
    readonly value: T;
}*/