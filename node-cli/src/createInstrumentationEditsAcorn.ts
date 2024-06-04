import { PositionOffsetTransformer, SingleTextEdit, TextEdit, TextRange } from "@hediet/sourcemap";
import { parse, Node, AnyNode } from "acorn";

export function createInstrumentationEditsAcorn(content: string): TextEdit {
    const t = new PositionOffsetTransformer(content);

    const result = parse(content, { ecmaVersion: 'latest' });
    let functionId = 0;

    const edits: SingleTextEdit[] = [];

    function handleNode(node: AnyNode, context: Context | undefined) {
        if (node.type === "MethodDefinition") {
            functionId++;
            context = new Context(functionId);
        }

        if (node.type === "BlockStatement") {
            const p = t.getPosition(node.start);
            edits.push(new SingleTextEdit(
                TextRange.emptyAt(p),
                `$$CI_b(${context?.functionId})`
            ));
        }

        walkChildren(node, context, handleNode);
    }

    handleNode(result, undefined);

    return new TextEdit(edits);
}

function walkChildren<TState>(node: AnyNode, state: TState, cb: (node: AnyNode, state: TState) => void) {
    for (const [key, value] of Object.entries(node)) {
        if (value instanceof Node) {
            cb(value as AnyNode, state);
        } else if (Array.isArray(value) && value.length && value[0] instanceof Node) {
            for (var i = 0; i < value.length; i++) {
                cb(value[i], state);
            }
        }

    }
}

class Context {
    public blockCount = 0;

    constructor(public readonly functionId: number) { }
}
