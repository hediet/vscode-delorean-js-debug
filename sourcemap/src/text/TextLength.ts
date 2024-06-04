import { TextPos } from "./TextPos";
import { TextRange } from "./TextRange";

/**
 * Represents a non-negative length of text in terms of line and column count.
*/

export class TextLength {
    public static zero = new TextLength(0, 0);

    public static lengthDiffNonNegative(start: TextLength, end: TextLength): TextLength {
        if (end.isLessThan(start)) {
            return TextLength.zero;
        }
        if (start.lineCount === end.lineCount) {
            return new TextLength(0, end.columnCount - start.columnCount);
        } else {
            return new TextLength(end.lineCount - start.lineCount, end.columnCount);
        }
    }

    public static betweenPositions(position1: TextPos, position2: TextPos): TextLength {
        if (position1.lineIdx === position2.lineIdx) {
            return new TextLength(0, position2.charIdx - position1.charIdx);
        } else {
            return new TextLength(position2.lineIdx - position1.lineIdx, position2.charIdx);
        }
    }

    public static ofRange(range: TextRange) {
        return TextLength.betweenPositions(range.getStartPosition(), range.getEndPosition());
    }

    public static ofText(text: string): TextLength {
        let line = 0;
        let column = 0;
        for (const c of text) {
            if (c === '\n') {
                line++;
                column = 0;
            } else {
                column++;
            }
        }
        return new TextLength(line, column);
    }

    constructor(
        public readonly lineCount: number,
        public readonly columnCount: number
    ) { }

    public isZero() {
        return this.lineCount === 0 && this.columnCount === 0;
    }

    public isLessThan(other: TextLength): boolean {
        if (this.lineCount !== other.lineCount) {
            return this.lineCount < other.lineCount;
        }
        return this.columnCount < other.columnCount;
    }

    public isGreaterThan(other: TextLength): boolean {
        if (this.lineCount !== other.lineCount) {
            return this.lineCount > other.lineCount;
        }
        return this.columnCount > other.columnCount;
    }

    public isGreaterThanOrEqualTo(other: TextLength): boolean {
        if (this.lineCount !== other.lineCount) {
            return this.lineCount > other.lineCount;
        }
        return this.columnCount >= other.columnCount;
    }

    public equals(other: TextLength): boolean {
        return this.lineCount === other.lineCount && this.columnCount === other.columnCount;
    }

    public compare(other: TextLength): number {
        if (this.lineCount !== other.lineCount) {
            return this.lineCount - other.lineCount;
        }
        return this.columnCount - other.columnCount;
    }

    public add(other: TextLength): TextLength {
        if (other.lineCount === 0) {
            return new TextLength(this.lineCount, this.columnCount + other.columnCount);
        } else {
            return new TextLength(this.lineCount + other.lineCount, other.columnCount);
        }
    }

    public createRange(startPosition: TextPos): TextRange {
        const endPosition = this.addToPosition(startPosition);
        return new TextRange(startPosition, endPosition);
    }

    public toRange(): TextRange {
        return this.createRange(new TextPos(0, 0));
    }

    public addToPosition(position: TextPos): TextPos {
        if (this.lineCount === 0) {
            return new TextPos(position.lineIdx, position.charIdx + this.columnCount);
        } else {
            return new TextPos(position.lineIdx + this.lineCount, this.columnCount);
        }
    }

    toString() {
        return `${this.lineCount},${this.columnCount}`;
    }
}
