import { FunctionInfo, LocationRef, ModuleInfo } from "@hediet/code-insight-recording";
import { PositionOffsetTransformer, SingleTextEdit, SourceMapV3WithPath, TextEdit, TextRange } from "@hediet/sourcemap";
import * as ts from "typescript";

export function createInstrumentationEditsTs(content: string, path: string, sourceMap: SourceMapV3WithPath | undefined): TextEdit {
    const edits: SingleTextEdit[] = [];
    const t = new PositionOffsetTransformer(content);

    let functionCounter = 0;

    const pathToSourcePathIdx = new Map<number, number>();
    const sourcePaths: string[] = [];
    const fnInfos: { location: LocationRef | null, locationByBlockId: (LocationRef | null)[] }[] = [];

    function lookupSourcePathIdx(sourceIdx: number): number {
        let moduleId = pathToSourcePathIdx.get(sourceIdx);
        if (moduleId === undefined) {
            moduleId = sourcePaths.length;
            pathToSourcePathIdx.set(sourceIdx, moduleId);

            const fullSourcePath = sourceIdx === -1 ? path : sourceMap!.getFullSourcePath(sourceIdx);
            sourcePaths.push(fullSourcePath);
        }
        return moduleId;
    }

    function createLocationReference(offset: number): LocationRef | null {
        const r = sf.getLineAndCharacterOfPosition(offset);
        const lineIdx = r.line;
        const charIdx = r.character;
        const result = sourceMap?.sourceMap.lookup(lineIdx, charIdx);
        if (result) {
            const sourcePathIdx = lookupSourcePathIdx(result.sourceIdx);
            return new LocationRef(result.lineIdx, result.columnIdx, sourcePathIdx);
        }
        return new LocationRef(lineIdx, charIdx, lookupSourcePathIdx(-1));
    }

    function declareFunction(offset: number): { functionId: number } {
        const functionId = functionCounter;
        functionCounter++;
        const locationRef = createLocationReference(offset);
        fnInfos.push({ location: locationRef, locationByBlockId: [] });
        return { functionId };
    }

    function declareBlockId(offset: number, ctx: Context): { blockId: number } {
        const blockId = ctx.blockCount;
        ctx.blockCount++;
        const locationRef = createLocationReference(offset);
        fnInfos[ctx.functionId].locationByBlockId.push(locationRef);
        return { blockId };
    }

    function visitor(
        node: ts.Node,
        context: Context | undefined
    ): void {
        if (ts.isBlock(node) && context) {
            const blockId = declareBlockId(node.statements.pos, context).blockId;
            if (node.statements.length > 0) {
                edits.push(SingleTextEdit.insert(
                    t.getPosition(node.statements.pos),
                    `\n$$CI_b(${blockId});`
                ));
            }
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
            const functionId = declareFunction(node.getStart(sf)).functionId;

            context = new Context(functionId);

            edits.push(SingleTextEdit.insert(t.getPosition(node.body.statements.pos), `\ntry {\n$$CI_fl(${context.functionId});`));
            edits.push(SingleTextEdit.insert(t.getPosition(node.body.statements.end), `\n} finally { $$CI_r(); }`));
        }

        ts.forEachChild(node, node => visitor(node, context));
    }

    const sf = ts.createSourceFile('main.ts', content,
        ts.ScriptTarget.Latest, false, ts.ScriptKind.JS);

    ts.forEachChild(sf, (node) => visitor(node, undefined));

    const moduleInfo = new ModuleInfo(
        sourcePaths,
        fnInfos.map(fn => new FunctionInfo(fn.location, fn.locationByBlockId))
    ).serialize();

    edits.push(SingleTextEdit.insert(t.getPosition(sf.statements.pos), `
globalThis.$$CI_f = globalThis.$$CI_f || (() => {});
globalThis.$$CI_b = globalThis.$$CI_b || (() => {});
globalThis.$$CI_r = globalThis.$$CI_r || (() => {});
globalThis.$$CI_modules = globalThis.$$CI_modules || {};
const $$CI_moduleId = Object.entries(globalThis.$$CI_modules).length;
globalThis.$$CI_modules[$$CI_moduleId] = ${JSON.stringify(moduleInfo)};
const $$CI_fl = functionId => globalThis.$$CI_f($$CI_moduleId, functionId);
`));

    edits.sort((e1, e2) => TextRange.compare(e1.range, e2.range));

    return new TextEdit(edits);
}

class Context {
    public blockCount = 0;

    constructor(public readonly functionId: number) { }
}
