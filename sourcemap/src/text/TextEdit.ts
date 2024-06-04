import { TextLength } from "./TextLength";
import { TextPos } from "./TextPos";
import { TextRange } from "./TextRange";
import { PositionOffsetTransformer } from "./PositionOffsetTransformer";
import { BugIndicatingError } from "../utils";

export class TextEdit {
    public static readonly empty = new TextEdit([]);

    public static single(originalRange: TextRange, newText: string): TextEdit {
        return new TextEdit([new SingleTextEdit(originalRange, newText)]);
    }

    constructor(public readonly edits: readonly SingleTextEdit[]) {
        //assertFn(() => checkAdjacentItems(edits, (a, b) => a.range.getEndPosition().isBeforeOrEqual(b.range.getStartPosition())));
    }

    /**
     * Joins touching edits and removes empty edits.
     */
    normalize(): TextEdit {
        const edits: SingleTextEdit[] = [];
        for (const edit of this.edits) {
            if (edits.length > 0 && edits[edits.length - 1].range.getEndPosition().equals(edit.range.getStartPosition())) {
                const last = edits[edits.length - 1];
                edits[edits.length - 1] = new SingleTextEdit(last.range.plusRange(edit.range), last.text + edit.text);
            } else if (!edit.isEmpty) {
                edits.push(edit);
            }
        }
        return new TextEdit(edits);
    }

    /*
    mapPosition(position: Position): Position | Range {
        let lineDelta = 0;
        let curLine = 0;
        let columnDeltaInCurLine = 0;

        for (const edit of this.edits) {
            const start = edit.range.getStartPosition();
            const end = edit.range.getEndPosition();

            if (position.isBeforeOrEqual(start)) {
                break;
            }

            const len = TextLength.ofText(edit.text);
            if (position.isBefore(end)) {
                const startPos = new Position(start.lineNumber + lineDelta, start.column + (start.lineNumber + lineDelta === curLine ? columnDeltaInCurLine : 0));
                const endPos = len.addToPosition(startPos);
                return rangeFromPositions(startPos, endPos);
            }

            lineDelta += len.lineCount - (edit.range.endLineNumber - edit.range.startLineNumber);

            if (len.lineCount === 0) {
                if (end.lineNumber !== start.lineNumber) {
                    columnDeltaInCurLine += len.columnCount - (end.column - 1);
                } else {
                    columnDeltaInCurLine += len.columnCount - (end.column - start.column);
                }
            } else {
                columnDeltaInCurLine = len.columnCount;
            }
            curLine = end.lineNumber + lineDelta;
        }

        return new Position(position.lineNumber + lineDelta, position.column + (position.lineNumber + lineDelta === curLine ? columnDeltaInCurLine : 0));
    }*/

    /*
    mapRange(range: Range): Range {
        function getStart(p: Position | Range) {
            return p instanceof Position ? p : p.getStartPosition();
        }

        function getEnd(p: Position | Range) {
            return p instanceof Position ? p : p.getEndPosition();
        }

        const start = getStart(this.mapPosition(range.getStartPosition()));
        const end = getEnd(this.mapPosition(range.getEndPosition()));

        return rangeFromPositions(start, end);
    }*/


    apply(text: AbstractText): string {
        let result = '';
        let lastEditEnd = new TextPos(0, 0);
        for (const edit of this.edits) {
            const editRange = edit.range;
            const editStart = editRange.getStartPosition();
            const editEnd = editRange.getEndPosition();

            const r = rangeFromPositions(lastEditEnd, editStart);
            if (!r.isEmpty()) {
                result += text.getValueOfRange(r);
            }
            result += edit.text;
            lastEditEnd = editEnd;
        }
        const r = rangeFromPositions(lastEditEnd, text.endPositionExclusive);
        if (!r.isEmpty()) {
            result += text.getValueOfRange(r);
        }
        return result;
    }

    applyToString(str: string): string {
        const strText = new StringText(str);
        return this.apply(strText);
    }

    /*
    inverse(doc: AbstractText): TextEdit {
        const ranges = this.getNewRanges();
        return new TextEdit(this.edits.map((e, idx) => new SingleTextEdit(ranges[idx], doc.getValueOfRange(e.range))));
    }
    */

    /*
    getNewRanges(): Range[] {
        const newRanges: Range[] = [];
        let previousEditEndLineNumber = 0;
        let lineOffset = 0;
        let columnOffset = 0;
        for (const edit of this.edits) {
            const textLength = TextLength.ofText(edit.text);
            const newRangeStart = Position.lift({
                lineNumber: edit.range.startLineNumber + lineOffset,
                column: edit.range.startColumn + (edit.range.startLineNumber === previousEditEndLineNumber ? columnOffset : 0)
            });
            const newRange = textLength.createRange(newRangeStart);
            newRanges.push(newRange);
            lineOffset = newRange.endLineNumber - edit.range.endLineNumber;
            columnOffset = newRange.endColumn - edit.range.endColumn;
            previousEditEndLineNumber = edit.range.endLineNumber;
        }
        return newRanges;
    }
    */
}

export class SingleTextEdit {
    public static insert(at: TextPos, text: string): SingleTextEdit {
        return new SingleTextEdit(TextRange.emptyAt(at), text);
    }

    constructor(
        public readonly range: TextRange,
        public readonly text: string,
    ) {
    }

    get isEmpty(): boolean {
        return this.range.isEmpty() && this.text.length === 0;
    }

    static equals(first: SingleTextEdit, second: SingleTextEdit) {
        return first.range.equals(second.range) && first.text === second.text;
    }
}

function rangeFromPositions(start: TextPos, end: TextPos): TextRange {
    if (start.lineIdx === end.lineIdx && start.charIdx === Number.MAX_SAFE_INTEGER) {
        return new TextRange(end, end);
    } else if (!start.isBeforeOrEqual(end)) {
        throw new BugIndicatingError('start must be before end');
    }
    return new TextRange(start, end);
}

export abstract class AbstractText {
    abstract getValueOfRange(range: TextRange): string;
    abstract readonly length: TextLength;

    get endPositionExclusive(): TextPos {
        return this.length.addToPosition(new TextPos(0, 0));
    }

    getValue() {
        return this.getValueOfRange(this.length.toRange());
    }
}

/*export class LineBasedText extends AbstractText {
    constructor(
        private readonly _getLineContent: (lineNumber: number) => string,
        private readonly _lineCount: number,
    ) {
        //assert(_lineCount >= 1);

        super();
    }

    getValueOfRange(range: Range): string {
        if (range.startLineNumber === range.endLineNumber) {
            return this._getLineContent(range.startLineNumber).substring(range.startColumn - 1, range.endColumn - 1);
        }
        let result = this._getLineContent(range.startLineNumber).substring(range.startColumn - 1);
        for (let i = range.startLineNumber + 1; i < range.endLineNumber; i++) {
            result += '\n' + this._getLineContent(i);
        }
        result += '\n' + this._getLineContent(range.endLineNumber).substring(0, range.endColumn - 1);
        return result;
    }

    get length(): TextLength {
        const lastLine = this._getLineContent(this._lineCount);
        return new TextLength(this._lineCount - 1, lastLine.length);
    }
}*/

export class StringText extends AbstractText {
    private readonly _t = new PositionOffsetTransformer(this.value);

    constructor(public readonly value: string) {
        super();
    }

    getValueOfRange(range: TextRange): string {
        return this._t.getOffsetRange(range).substring(this.value);
    }

    get length(): TextLength {
        return this._t.textLength;
    }
}
