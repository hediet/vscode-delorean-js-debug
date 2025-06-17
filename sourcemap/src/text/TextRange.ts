import { TextPos } from "./TextPos";

export class TextRange {
    public static emptyAt(pos: TextPos): TextRange {
        return new TextRange(pos, pos);
    }

    public static compare(a: TextRange, b: TextRange): number {
        const startCompare = TextPos.compare(a.start, b.start);
        if (startCompare !== 0) {
            return startCompare;
        }

        return TextPos.compare(a.endExclusive, b.endExclusive);
    }

    constructor(
        public readonly start: TextPos,
        public readonly endExclusive: TextPos
    ) {
    }

    isSingleLine(): boolean {
        return this.start.lineIdx === this.endExclusive.lineIdx;
    }

    getEndPosition(): TextPos {
        return this.endExclusive;
    }

    getStartPosition(): TextPos {
        return this.start;
    }

    plusRange(range: TextRange): TextRange {
        const start = TextPos.min2(this.start, range.start);
        const end = TextPos.max2(this.endExclusive, range.endExclusive);
        return new TextRange(start, end);
    }

    isEmpty(): boolean {
        return this.start.equals(this.endExclusive);
    }

    equals(other: TextRange): boolean {
        return this.start.equals(other.start) && this.endExclusive.equals(other.endExclusive);
    }

    toString() {
        return `[${this.start.toString()}, ${this.endExclusive.toString()})`;
    }
}
