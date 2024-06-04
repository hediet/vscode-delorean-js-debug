import { PositionOffsetTransformer, SingleTextEdit, SourceMapV3, SourceMapV3WithPath, TextEdit, TextRange } from "@hediet/sourcemap";
import * as ts from "typescript";

export function createInstrumentationEditsTs(content: string, sourceMap: SourceMapV3WithPath | undefined): TextEdit {
    const edits: SingleTextEdit[] = [];
    const t = new PositionOffsetTransformer(content);

    let functionCounter = 0;

    type LocationRef = [lineIdx: number, charIdx: number, /** If not set, same as previous one */ sourcePathIdx?: number] | /** If charIdx and sourcePathIdx are same as previous one */ number;

    interface ModuleSourceMap {
        sourcePaths: string[];
        fnMaps: (LocationRef | null)[];
        blockMaps: (LocationRef | null)[];
    }

    const pathToModuleId = new Map<number, number>();

    const moduleMap: ModuleSourceMap = {
        sourcePaths: [],
        fnMaps: [],
        blockMaps: [],
    };

    function lookupModuleId(sourceIdx: number): number {
        let moduleId = pathToModuleId.get(sourceIdx);
        if (moduleId === undefined) {
            moduleId = moduleMap.sourcePaths.length;
            pathToModuleId.set(sourceIdx, moduleId);

            const fullSourcePath = sourceMap!.getFullSourcePath(sourceIdx);
            moduleMap.sourcePaths.push(fullSourcePath);
        }
        return moduleId;
    }

    class LocationRefBuilder {
        private _lastColumnIdx: number = -1;
        private _lastModuleId: number = -1;

        getLocationRef(lineIdx: number, columnIdx: number, moduleId: number): LocationRef {
            if (this._lastColumnIdx !== -1) {
                if (this._lastColumnIdx === columnIdx && this._lastModuleId === moduleId) {
                    return lineIdx;
                } else if (this._lastModuleId === moduleId) {
                    this._lastColumnIdx = columnIdx;
                    return [lineIdx, columnIdx];
                }
            }

            this._lastColumnIdx = columnIdx;
            this._lastModuleId = moduleId;
            return [lineIdx, columnIdx, moduleId];

        }
    }

    const fnLocationRefBuilder = new LocationRefBuilder();

    function declareFunction(offset: number): { functionId: number } {
        const r = sf.getLineAndCharacterOfPosition(offset);
        const lineIdx = r.line;
        const columnIdx = r.character;

        const functionId = functionCounter++;
        const result = sourceMap?.sourceMap.lookup(lineIdx, columnIdx);
        let locationRef: LocationRef | null = null;
        if (result) {
            const moduleId = lookupModuleId(result.sourceIdx);
            locationRef = fnLocationRefBuilder.getLocationRef(lineIdx, columnIdx, moduleId);
        }
        moduleMap.fnMaps.push(locationRef);
        return { functionId };
    }

    const blockLocationRefBuilder = new LocationRefBuilder();

    function declareBlockId(offset: number, ctx: Context): { blockId: number } {
        const r = sf.getLineAndCharacterOfPosition(offset);
        const lineIdx = r.line;
        const columnIdx = r.character;

        const blockId = ctx.blockCount;
        ctx.blockCount++;
        const result = sourceMap?.sourceMap.lookup(lineIdx, columnIdx);
        let locationRef: LocationRef | null = null;
        if (result) {
            const moduleId = lookupModuleId(result.sourceIdx);
            locationRef = blockLocationRefBuilder.getLocationRef(lineIdx, columnIdx, moduleId);
        }
        moduleMap.blockMaps.push(locationRef);

        return { blockId };
    }

    function visitor(
        node: ts.Node,
        context: Context | undefined
    ): void {
        if (ts.isBlock(node) && context) {
            const blockId = declareBlockId(node.pos, context).blockId;
            edits.push(SingleTextEdit.insert(t.getPosition(node.statements.pos), `\n$$CI_b(${blockId});`));
        }

        if (
            ts.isMethodDeclaration(node) ||
            ts.isFunctionDeclaration(node) ||
            ts.isArrowFunction(node) ||
            ts.isFunctionExpression(node)
        ) {
            context = undefined;
        }

        if (
            (ts.isMethodDeclaration(node) ||
                ts.isFunctionDeclaration(node) ||
                ts.isArrowFunction(node) ||
                ts.isFunctionExpression(node)) &&
            node.body &&
            ts.isBlock(node.body)
        ) {
            const functionId = declareFunction(node.pos).functionId;

            context = new Context(functionId);

            edits.push(SingleTextEdit.insert(t.getPosition(node.body.statements.pos), `\ntry {\n$$CI_fl(${context.functionId});`));
            edits.push(SingleTextEdit.insert(t.getPosition(node.body.statements.end), `\n} finally { $$CI_r(); }`));
        }

        ts.forEachChild(node, node => visitor(node, context));
    }

    const sf = ts.createSourceFile('main.ts', content,
        ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);

    ts.forEachChild(sf, (node) => visitor(node, undefined));

    edits.push(SingleTextEdit.insert(t.getPosition(sf.statements.pos), `
globalThis.$$CI_f = globalThis.$$CI_f || (() => {});
globalThis.$$CI_b = globalThis.$$CI_b || (() => {});
globalThis.$$CI_r = globalThis.$$CI_r || (() => {});
globalThis.$$CI_modules = globalThis.$$CI_modules || {};
const $$CI_moduleId = Object.entries(globalThis.$$CI_modules).length;
globalThis.$$CI_modules[$$CI_moduleId] = ${JSON.stringify(JSON.stringify(moduleMap))};
const $$CI_fl = functionId => globalThis.$$CI_f($$CI_moduleId, functionId);
`));

    edits.sort((e1, e2) => TextRange.compare(e1.range, e2.range));

    console.log(JSON.stringify(moduleMap.sourcePaths, null, 2));

    return new TextEdit(edits);
}

class Context {
    public blockCount = 0;

    constructor(public readonly functionId: number) { }
}
