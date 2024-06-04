import { OffsetRange } from "./OffsetRange";
import { TextLength } from "./TextLength";
import { TextRange } from "./TextRange";
import { TextPos } from "./TextPos";
import { findLastIdxMonotonous } from "../utils";

export class PositionOffsetTransformer {
    private readonly lineStartOffsetByLineIdx: number[];

    constructor(public readonly text: string) {
        this.lineStartOffsetByLineIdx = [];
        this.lineStartOffsetByLineIdx.push(0);
        for (let i = 0; i < text.length; i++) {
            if (text.charAt(i) === '\n') {
                this.lineStartOffsetByLineIdx.push(i + 1);
            }
        }
    }

    getOffset(position: TextPos): number {
        return this.lineStartOffsetByLineIdx[position.lineIdx] + position.charIdx;
    }

    getOffsetRange(range: TextRange): OffsetRange {
        return new OffsetRange(
            this.getOffset(range.getStartPosition()),
            this.getOffset(range.getEndPosition())
        );
    }

    getPosition(offset: number): TextPos {
        const idx = findLastIdxMonotonous(this.lineStartOffsetByLineIdx, i => i <= offset);
        const lineNumber = idx;
        const column = offset - this.lineStartOffsetByLineIdx[idx];
        return new TextPos(lineNumber, column);
    }

    getRange(offsetRange: OffsetRange): TextRange {
        return new TextRange(
            this.getPosition(offsetRange.start),
            this.getPosition(offsetRange.endExclusive)
        );
    }

    getTextLength(offsetRange: OffsetRange): TextLength {
        return TextLength.ofRange(this.getRange(offsetRange));
    }

    get textLength(): TextLength {
        const lineIdx = this.lineStartOffsetByLineIdx.length - 1;
        return new TextLength(lineIdx, this.text.length - this.lineStartOffsetByLineIdx[lineIdx]);
    }
}
