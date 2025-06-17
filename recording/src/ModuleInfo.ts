import { TextPos } from "./utils/TextPos";

export interface ISerializedModuleInfo {
    sourcePaths: string[];
    fnInfos: [fnLocation: (SerializedLocationRef | null), ...blockInfos: (SerializedLocationRef | null)[]][];
}

export type SerializedLocationRef = [lineIdx: number, charIdx: number, /** If not set, same as previous one */ sourcePathIdx?: number] |
    /** If charIdx and sourcePathIdx are same as previous one */ number;

export class ModuleInfo {
    public static from(info: ISerializedModuleInfo): ModuleInfo {
        const fnInfos = [] as FunctionInfo[];
        let charIdx = 0;
        let sourcePathIdx = 0;

        for (const fnInfo of info.fnInfos) {
            let isFirst = true;
            let fnLocation: LocationRef | null = null;
            const locByBlockId = [] as (LocationRef | null)[];

            for (const loc of fnInfo) {
                let processedLoc: LocationRef | null;
                if (!loc) {
                    processedLoc = null;
                } else {
                    let lineIdx = 0;
                    if (Array.isArray(loc)) {
                        lineIdx = loc[0];
                        charIdx = loc[1];
                        if (loc[2] !== undefined) {
                            sourcePathIdx = loc[2];
                        }
                    } else {
                        lineIdx = loc;
                    }
                    processedLoc = new LocationRef(lineIdx, charIdx, sourcePathIdx);
                }
                if (isFirst) {
                    fnLocation = processedLoc;
                    isFirst = false;
                } else {
                    locByBlockId.push(processedLoc);
                }
            }
            fnInfos.push(new FunctionInfo(fnLocation, locByBlockId));
        }

        return new ModuleInfo(info.sourcePaths, fnInfos);
    }

    constructor(
        public readonly sourcePaths: readonly string[],
        private readonly fnInfos: readonly FunctionInfo[],
    ) { }

    public serialize(): ISerializedModuleInfo {
        const fnInfos = [] as ISerializedModuleInfo['fnInfos'];

        let charIdx = 0;
        let sourcePathIdx = 0;

        function translateLocation(loc: LocationRef | null): SerializedLocationRef | null {
            if (!loc) { return null; }
            if (loc.sourcePathIdx !== sourcePathIdx) {
                sourcePathIdx = loc.sourcePathIdx;
                charIdx = loc.charIdx;
                return [loc.lineIdx, loc.charIdx, loc.sourcePathIdx];
            } else if (loc.charIdx !== charIdx) {
                charIdx = loc.charIdx;
                return [loc.lineIdx, loc.charIdx];
            } else {
                return loc.lineIdx;
            }
        }

        for (const fn of this.fnInfos) {
            const locationsByBlockIdPlusOne = [] as (SerializedLocationRef | null)[];
            locationsByBlockIdPlusOne.push(translateLocation(fn.location));
            for (const loc of fn.locationPerBlockId) {
                locationsByBlockIdPlusOne.push(translateLocation(loc));
            }
            fnInfos.push(locationsByBlockIdPlusOne as
                [fnLocation: (SerializedLocationRef | null), ...blockInfos: (SerializedLocationRef | null)[]]);
        }

        return {
            sourcePaths: [...this.sourcePaths],
            fnInfos: fnInfos as any,
        }
    }

    public getTextPos(functionId: number, blockId: number | undefined): ExecutionPosition {
        const fnInfo = this.fnInfos[functionId];
        const loc = fnInfo.getBlockLocationRef(blockId);
        if (!loc) {
            return new ExecutionPosition(functionId, blockId);
            //throw new Error(`Location not found for function ${functionId} block ${blockId}`);
        }
        return new ExecutionPosition(
            functionId,
            blockId,
            new SourceLocation(this.sourcePaths[loc.sourcePathIdx], new TextPos(loc.lineIdx, loc.charIdx)),
        );
    }
}

export class LocationRef {
    public constructor(
        public readonly lineIdx: number,
        public readonly charIdx: number,
        public readonly sourcePathIdx: number,
    ) { }
}

export class FunctionInfo {
    public constructor(
        public readonly location: LocationRef | null,
        public readonly locationPerBlockId: readonly (LocationRef | null)[],
    ) { }

    getBlockLocationRef(blockId: number | undefined): LocationRef | null {
        if (blockId === undefined) {
            return this.location;
        }
        return this.locationPerBlockId[blockId];
    }
}

export class ExecutionPosition {
    public constructor(
        public readonly functionId: number,
        public readonly blockId: number | undefined,
        public readonly location?: SourceLocation,
    ) { }

    public toString() {
        return `${this.location ? this.location.toString() : '?'} {${this.functionId}${this.blockId !== undefined ? `#${this.blockId}` : ''}}`;
    }
}

export class SourceLocation {
    constructor(
        public readonly sourcePath: string,
        public readonly pos: TextPos,
    ) { }

    toString() {
        // 1-based
        return `${this.sourcePath}:${this.pos.lineIdx + 1}:${this.pos.charIdx + 1}`;
    }
}
