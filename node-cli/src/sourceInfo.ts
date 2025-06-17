import { LocationRef } from "@hediet/code-insight-recording";
import { TextRange } from "@hediet/sourcemap";

export class AnnotatedModuleInfo {
    constructor(
        public readonly sourcePaths: readonly string[],
        public readonly fnInfos: readonly AnnotatedFunctionInfo[],
        public readonly symbols: readonly Symbol[],
    ) {
    }

    public getContainer(symbol: Symbol): Symbol | null {
        if (symbol.containerSymbolIdx === null) {
            return null;
        }
        return this.symbols[symbol.containerSymbolIdx];
    }
}

export class Symbol {
    constructor(
        public readonly name: string,
        public readonly kind: 'function' | 'class' | 'namespace' | string,
        public readonly location: LocationRange | null,
        public readonly containerSymbolIdx: number | null,
    ) { }
}

export class AnnotatedFunctionInfo {
    constructor(
        public readonly symbolIdx: number,
        public readonly locationPerBlockId: readonly (LocationRef | null)[],
    ) { }
}

export class LocationRange {
    public constructor(
        public readonly range: TextRange,
        public readonly sourcePathIdx: number,
    ) { }
}


interface ISerializedAnnotatedModuleInfo {
    sourcePaths: string[];
    fnInfos: ISerializedAnnotatedFunctionInfo[];
    symbols: ISerializedSymbol[];
}

interface ISerializedAnnotatedFunctionInfo {
    symbolIdx: number;
    locationPerBlockId: (ISerializedLocationRef | null)[];
}

interface ISerializedSymbol {
    name: string;
    kind: string;
    location: ISerializedLocationRange | null;
    containerSymbolIdx: number | null;
}