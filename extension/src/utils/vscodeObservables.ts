import { IDisposable } from "./disposables";
import { IObservable, autorun } from "./observables/observable";
import { setContextKey } from "./utils";

export function createContextKey(key: string, value: IObservable<unknown>): IDisposable {
    return autorun(reader => {
        const v = value.read(reader);
        setContextKey(key, v);
    });
}
