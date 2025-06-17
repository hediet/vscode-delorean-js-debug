import { IDisposable, DisposableStore } from '../../disposables';

export { IDisposable, DisposableStore };

export function toDisposable(fn: () => void): IDisposable {
    return { dispose: fn };
}

export function markAsDisposed(disposable: IDisposable): void { }

export function trackDisposable(disposable: IDisposable): void { }
