import { SourceMapV3 } from "./SourceMap";
import { SourceMapSegment, SourceMapSegment1, decodeMappings, encode } from "./codec/codec";
import { OffsetRange } from "./text/OffsetRange";
import { TextEdit } from "./text/TextEdit";
import { TextLength } from "./text/TextLength";
import { TextPos } from "./text/TextPos";
import { TextRange } from "./text/TextRange";
import { findLastIdxMonotonous } from "./utils";

export function sourceMapApplyEdit(sourceMap: SourceMapV3, edit: TextEdit): SourceMapV3 {
    const decoded = decodeMappings(sourceMap.mappings);
    const resultMappings = mappingsApplyEdit(decoded, edit);
    const resultMappingsStr = encode(resultMappings);
    return sourceMap.withMappings(resultMappingsStr);
}

function mappingsApplyEdit(mappings: SourceMapSegment[][], edit: TextEdit): SourceMapSegment[][] {
    edit = edit.normalize();

    let lastLineLength = 0;
    let lastLine: SourceMapSegment[] = [];
    const resultMappings: SourceMapSegment[][] = [lastLine];

    function appendExisting(range: TextRange): void {
        if (range.isSingleLine()) {
            const line = mappings[range.start.lineIdx];
            const columnOffset = lastLineLength - range.start.charIdx;

            const idx = findLastIdxMonotonous(line, s => s.genColumn < range.start.charIdx);

            if (idx !== -1) {
                // We might be in the middle of a mapping and might have to cut it
                const before = line[idx];
                lastLine.push(before.withDeltaColumn(lastLineLength - before.genColumn));
            }

            for (let i = idx + 1; i < line.length; i++) {
                const s = line[i];
                if (s.genColumn >= range.endExclusive.charIdx) {
                    break;
                }
                lastLine.push(s.withGenColumn(s.genColumn + columnOffset));
            }

            lastLineLength += range.endExclusive.charIdx - range.start.charIdx;
            lastLine.push(new SourceMapSegment1(lastLineLength));
        } else {
            // start line
            const startLine = mappings[range.start.lineIdx];
            const columnOffset = lastLineLength - range.start.charIdx;
            const idx = findLastIdxMonotonous(startLine, s => s.genColumn < range.start.charIdx);
            if (idx !== -1) {
                // We might be in the middle of a mapping and might have to cut it
                const before = startLine[idx];
                startLine.push(before.withDeltaColumn(lastLineLength - before.genColumn));
            }
            for (let i = idx + 1; i < startLine.length; i++) {
                const s = startLine[i];
                lastLine.push(s.withGenColumn(s.genColumn + columnOffset));
            }

            // full lines
            for (let i = range.start.lineIdx + 1; i < range.endExclusive.lineIdx; i++) {
                resultMappings.push(mappings[i]);
            }
            lastLine = [] as SourceMapSegment[];
            resultMappings.push(lastLine);

            // last line
            const endLine = mappings[range.endExclusive.lineIdx];
            for (let i = 0; i < endLine.length; i++) {
                const s = endLine[i];
                if (s.genColumn >= range.endExclusive.charIdx) {
                    break;
                }
                lastLine.push(s);
            }
            lastLineLength = range.endExclusive.charIdx;
        }
    }

    function insert(text: string) {
        const length = TextLength.ofText(text);
        lastLine.push(new SourceMapSegment1(lastLineLength));
        if (length.lineCount === 0) {
            lastLineLength += length.columnCount;
        } else {
            for (let i = 0; i < length.lineCount; i++) {
                const line = [] as SourceMapSegment[];
                resultMappings.push(line);
                lastLine = line;
            }
            lastLineLength = length.columnCount;
        }
    }

    constructResultWithEdit(
        edit,
        new TextPos(mappings.length - 1, Number.MAX_SAFE_INTEGER),
        appendExisting,
        insert
    );

    return resultMappings;
}

function constructResultWithEdit(edit: TextEdit, end: TextPos, appendExisting: (range: TextRange) => void, insert: (text: string) => void) {
    let lastEditEnd = TextPos.zero;
    for (const e of edit.edits) {
        const editRange = e.range;
        const editStart = editRange.getStartPosition();
        const editEnd = editRange.getEndPosition();

        const r = new TextRange(lastEditEnd, editStart);
        if (!r.isEmpty()) {
            appendExisting(r);
        }
        insert(e.text);

        lastEditEnd = editEnd;
    }
    const r = new TextRange(lastEditEnd, end);
    if (!r.isEmpty()) {
        appendExisting(r)
    }
}
