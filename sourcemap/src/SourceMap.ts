import { SourceMapMappings, SourceMapSegment1, decodeMappings } from "./codec/codec";
import { OffsetRange } from "./text/OffsetRange";
import { findLastIdxMonotonous } from "./utils";
import { join, dirname } from "path";

interface ISourceMap {
    version: 3;
    file: string | undefined;
    sourceRoot: string | undefined;
    sources: string[];
    sourcesContent: (string | null)[] | undefined;
    names: string[];
    mappings: string;
}

export class SourceMapV3 {
    public static fromJson(data: unknown): SourceMapV3 {
        const d = data as ISourceMap;
        if (d.version !== 3) {
            throw new Error('Unsupported version');
        }

        return new SourceMapV3(d.file, d.sourceRoot, d.sources, d.sourcesContent, d.names, d.mappings);
    }

    public readonly version = 3;

    private _decodedEncodings: SourceMapMappings | undefined;

    constructor(
        public readonly file: string | undefined,
        public readonly sourceRoot: string | undefined,
        public readonly sources: string[],
        public readonly sourcesContent: (string | null)[] | undefined,
        public readonly names: string[],
        public readonly mappings: string,
    ) { }

    public withMappings(mappings: string): SourceMapV3 {
        return new SourceMapV3(this.file, this.sourceRoot, this.sources, this.sourcesContent, this.names, mappings);
    }

    public getDecodedMappings(): SourceMapMappings {
        if (!this._decodedEncodings) {
            this._decodedEncodings = decodeMappings(this.mappings);
        }
        return this._decodedEncodings;
    }

    public lookup(lineIdx: number, charIdx: number): { sourceIdx: number, lineIdx: number, columnIdx: number } | undefined {
        const line = this.getDecodedMappings()[lineIdx];
        if (!line) { return undefined; }

        const idx = findLastIdxMonotonous(line, s => s.genColumn <= charIdx);
        if (idx === -1) { return undefined; }

        const segment = line[idx];
        if (segment instanceof SourceMapSegment1) {
            return undefined;
        }
        return {
            sourceIdx: segment.sourceIdx,
            lineIdx: segment.sourceLine,
            columnIdx: segment.sourceColumn
        };
    }
}

export class SourceMapV3WithPath {
    public static fromFile(filePath: string): SourceMapV3WithPath {
        const sourceMap = JSON.parse(require("fs").readFileSync(filePath, "utf8"));
        return new SourceMapV3WithPath(SourceMapV3.fromJson(sourceMap), filePath);
    }

    constructor(public readonly sourceMap: SourceMapV3, public readonly path: string) {
    }

    public getFullSourcePath(sourceIdx: number): string {
        const source = this.sourceMap.sources[sourceIdx];
        const dirName = dirname(this.path);
        return this.sourceMap.sourceRoot
            ? join(dirName, this.sourceMap.sourceRoot, source)
            : join(dirName, source);
    }
}

export class SourceMapLocation {
    public static createInline(sourceMap: SourceMapV3): SourceMapLocation {
        const base64Content = Buffer.from(JSON.stringify(sourceMap)).toString('base64');
        return new SourceMapLocation('data:application/json;charset=utf-8;base64,' + base64Content);
    }

    public static findWithRange(source: string): { location: SourceMapLocation, range: OffsetRange } | undefined {
        // find `//# sourceMappingURL=...`
        //

        const line = findLastNonEmptyLine(source);
        if (!line) { return undefined; }

        const prefix = '//# sourceMappingURL=';
        if (!line.line.startsWith(prefix)) {
            return undefined;
        }
        const url = line.line.substring(prefix.length).trim();

        return { location: new SourceMapLocation(url), range: line.range };
    }

    public static find(source: string): SourceMapLocation | undefined {
        return SourceMapLocation.findWithRange(source)?.location;
    }

    public static set(source: string, sourceMapLocation: SourceMapLocation | undefined): string {
        const existing = SourceMapLocation.findWithRange(source);
        if (existing) {
            const { range } = existing;
            return source.substring(0, range.start) + sourceMapLocation?.toString() + source.substring(range.endExclusive);
        } else {
            let str = sourceMapLocation?.toString() ?? '';
            if (!source.endsWith('\n')) {
                str = '\n' + str;
            }
            return source + str;
        }
    }

    constructor(public readonly sourceMappingUrl: string) {
    }

    public toString(): string {
        return `//# sourceMappingURL=${this.sourceMappingUrl}\n`;
    }

}

function findLastNonEmptyLine(str: string): { line: string, range: OffsetRange } | undefined {
    let lineEnd = str.length;
    let didSeeNonWsChar = false;
    for (let i = str.length; i > 0; i--) {
        const charBefore = str.charAt(i - 1);
        if (charBefore === '\n') {
            if (didSeeNonWsChar) {
                return { line: str.substring(i, lineEnd), range: new OffsetRange(i, lineEnd) };
            } else {
                lineEnd = i;
            }
        } else if (charBefore !== ' ' && charBefore !== '\t') {
            didSeeNonWsChar = true;
        }
    }
    if (didSeeNonWsChar) {
        return { line: str.substring(0, lineEnd), range: new OffsetRange(0, lineEnd) };
    }
    return undefined;
}