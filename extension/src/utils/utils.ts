import { TextDocumentShowOptions, Uri, ViewColumn, commands, window } from "vscode";

export class ErrorMessage {
    static showIfError(value: unknown): value is ErrorMessage {
        const isError = value instanceof ErrorMessage;
        if (isError) {
            window.showErrorMessage(value.message);
        }
        return isError;
    }

    static throwIfError<T>(value: T | ErrorMessage): asserts value is T {
        if (value instanceof ErrorMessage) {
            throw new Error(value.message);
        }
    }

    static isErr(value: unknown): value is ErrorMessage {
        return value instanceof ErrorMessage;
    }

    constructor(public readonly message: string) {
    }
}

export async function showDocument(uri: Uri, viewColumn = ViewColumn.Beside) {
    const options: TextDocumentShowOptions = { viewColumn, preserveFocus: true };
    await commands.executeCommand('vscode.open', uri, options);
}

export async function setContextKey(key: string, value: unknown) {
    await commands.executeCommand('setContext', key, value);
}

export function isDefined<T>(value: T | undefined): value is T {
    return value !== undefined;
}

export function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
