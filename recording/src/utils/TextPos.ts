/**
 * Zero based position.
*/

export class TextPos {
    public static zero = new TextPos(0, 0);

    public static min2(a: TextPos, b: TextPos): TextPos {
        if (a.isBefore(b)) {
            return a;
        }
        return b;
    }

    public static max2(a: TextPos, b: TextPos): TextPos {
        if (a.isBefore(b)) {
            return b;
        }
        return a;
    }

    public static compare(a: TextPos, b: TextPos): number {
        if (a.lineIdx < b.lineIdx) {
            return -1;
        }
        if (a.lineIdx > b.lineIdx) {
            return 1;
        }
        if (a.charIdx < b.charIdx) {
            return -1;
        }
        if (a.charIdx > b.charIdx) {
            return 1;
        }
        return 0;
    }

    constructor(
        public readonly lineIdx: number,
        public readonly charIdx: number
    ) {
    }

    equals(other: TextPos): boolean {
        return this.lineIdx === other.lineIdx && this.charIdx === other.charIdx;
    }

    isBefore(other: TextPos): boolean {
        return this.lineIdx < other.lineIdx || (this.lineIdx === other.lineIdx && this.charIdx < other.charIdx);
    }

    isBeforeOrEqual(other: TextPos): boolean {
        return this.lineIdx < other.lineIdx || (this.lineIdx === other.lineIdx && this.charIdx <= other.charIdx);
    }
}
