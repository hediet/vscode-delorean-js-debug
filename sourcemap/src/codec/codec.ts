// https://github.com/jridgewell/sourcemap-codec/blob/906c7cf13004a783dbabf313a1327d77ff192cb3/src/sourcemap-codec.ts
import {
    decodeInteger,
    encodeInteger,
    comma,
    semicolon,
    hasMoreVlq,
    posOut,
    indexOf,
    td,
    maybeWrite,
} from './vlq';

export class SourceMapSegment1 {
    constructor(
        /**
         * The zero-based starting column of the line in the generated code that the segment represents.
        */
        public readonly genColumn: number,
    ) { }

    withGenColumn(genColumn: number): SourceMapSegment1 {
        return new SourceMapSegment1(genColumn);
    }

    withDeltaColumn(delta: number): SourceMapSegment1 {
        return new SourceMapSegment1(this.genColumn + delta);
    }
}

export class SourceMapSegment4 {
    constructor(
        /**
         * The zero-based starting column of the line in the generated code that the segment represents.
        */
        public readonly genColumn: number,

        /**
         * An zero-based index into the "sources" list. 
        */
        public readonly sourceIdx: number,

        /**
         * The zero-based starting line in the original source represented.
        */
        public readonly sourceLine: number,

        /**
         * The zero-based starting column of the line in the source represented.
        */
        public readonly sourceColumn: number,
    ) { }

    withGenColumn(genColumn: number): SourceMapSegment4 {
        return new SourceMapSegment4(genColumn, this.sourceIdx, this.sourceLine, this.sourceColumn);
    }

    withDeltaColumn(delta: number): SourceMapSegment1 {
        return new SourceMapSegment4(this.genColumn + delta, this.sourceIdx, this.sourceLine, this.sourceColumn + delta);
    }
}

export class SourceMapSegment5 extends SourceMapSegment4 {
    constructor(
        genColumn: number,
        sourceIdx: number,
        sourceLine: number,
        sourceColumn: number,

        /**
         * The zero-based index into the "names" list associated with this segment. 
        */
        public readonly nameIdx: number,
    ) {
        super(genColumn, sourceIdx, sourceLine, sourceColumn);
    }

    withGenColumn(genColumn: number): SourceMapSegment5 {
        return new SourceMapSegment5(genColumn, this.sourceIdx, this.sourceLine, this.sourceColumn, this.nameIdx);
    }

    withDeltaColumn(delta: number): SourceMapSegment1 {
        return new SourceMapSegment5(this.genColumn + delta, this.sourceIdx, this.sourceLine, this.sourceColumn + delta, this.nameIdx);
    }
}

export type SourceMapSegment = SourceMapSegment1 | SourceMapSegment4 | SourceMapSegment5;

export function decodeCallback<T>(mappings: string, data: T, handleSegment: (segment: SourceMapSegment, data: T) => void, handleLineEnd: (data: T) => void): void {
    let genColumn = 0;
    let sourcesIndex = 0;
    let sourceLine = 0;
    let sourceColumn = 0;
    let namesIndex = 0;

    let index = 0;
    do {
        const semi = indexOf(mappings, ';', index);
        genColumn = 0;

        for (let i = index; i < semi; i = posOut + 1) {
            let seg: SourceMapSegment;

            genColumn = decodeInteger(mappings, i, genColumn);

            if (hasMoreVlq(mappings, posOut, semi)) {
                sourcesIndex = decodeInteger(mappings, posOut, sourcesIndex);
                sourceLine = decodeInteger(mappings, posOut, sourceLine);
                sourceColumn = decodeInteger(mappings, posOut, sourceColumn);

                if (hasMoreVlq(mappings, posOut, semi)) {
                    namesIndex = decodeInteger(mappings, posOut, namesIndex);
                    seg = new SourceMapSegment5(genColumn, sourcesIndex, sourceLine, sourceColumn, namesIndex);
                } else {
                    seg = new SourceMapSegment4(genColumn, sourcesIndex, sourceLine, sourceColumn);
                }
            } else {
                seg = new SourceMapSegment1(genColumn);
            }

            handleSegment(seg, data);
        }

        handleLineEnd(data);
        index = semi + 1;
    } while (index <= mappings.length);
}

export type SourceMapLine = SourceMapSegment[];
export type SourceMapMappings = SourceMapLine[];

export function decodeMappings(mappings: string): SourceMapMappings {
    const result: SourceMapMappings = [];
    decodeCallback(
        mappings,
        { result, line: [] as SourceMapSegment[] },
        (seg, data) => data.line.push(seg),
        (data) => {
            result.push(data.line);
            data.line = [];
        }
    );
    return result;
}

export function encode(decoded: SourceMapMappings): string;
export function encode(decoded: Readonly<SourceMapMappings>): string;
export function encode(decoded: Readonly<SourceMapMappings>): string {
    const bufLength = 1024 * 16;
    // We can push up to 5 ints, each int can take at most 7 chars, and we
    // may push a comma.
    const subLength = bufLength - (7 * 5 + 1);
    const buf = new Uint8Array(bufLength);
    const sub = buf.subarray(0, subLength);
    let pos = 0;
    let out = '';
    let genColumn = 0;
    let sourcesIndex = 0;
    let sourceLine = 0;
    let sourceColumn = 0;
    let namesIndex = 0;

    for (let i = 0; i < decoded.length; i++) {
        const line = decoded[i];
        out = maybeWrite(out, buf, pos, buf, bufLength);
        pos = posOut;
        if (i > 0) buf[pos++] = semicolon;

        if (line.length === 0) continue;

        genColumn = 0;

        for (let j = 0; j < line.length; j++, pos = posOut) {
            const segment = line[j];
            out = maybeWrite(out, sub, pos, buf, subLength);
            pos = posOut;
            if (j > 0) buf[pos++] = comma;

            if (segment instanceof SourceMapSegment1) {
                genColumn = encodeInteger(buf, pos, segment.genColumn, genColumn);
            } else if (segment instanceof SourceMapSegment4) {
                genColumn = encodeInteger(buf, pos, segment.genColumn, genColumn);
                sourcesIndex = encodeInteger(buf, posOut, segment.sourceIdx, sourcesIndex);
                sourceLine = encodeInteger(buf, posOut, segment.sourceLine, sourceLine);
                sourceColumn = encodeInteger(buf, posOut, segment.sourceColumn, sourceColumn);

                if (segment instanceof SourceMapSegment5) {
                    namesIndex = encodeInteger(buf, posOut, segment.nameIdx, namesIndex);
                }
            }
        }
    }

    return out + td.decode(buf.subarray(0, pos));
}
