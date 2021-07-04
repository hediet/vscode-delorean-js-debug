import * as tts from "typescript";

let globalId = 0;

const varGlobalLevel = "$$DLRN_l";
const varLocalLevel = "$$DLRN_k";
const varElements = "$$DLRN_e";
const varInstructionCounts = "$$DLRN_i";
const varCanRestart = "$$DLRN_r";
const varInitializeNew = "$$DLRN_new";

class Context {
	constructor(public readonly id: string) {}

	public get levelVarName(): string {
		return varLocalLevel;
	}
}

export default function (program: tts.Program, pluginOptions: {}, ts: typeof tts = tts) {
	if (typeof ts !== "object" || ts.isArrowFunction === undefined) {
		ts = tts;
	}

	function getAllLeadingComments(
		node: tts.Node
	): ReadonlyArray<Readonly<tts.CommentRange & { text: string }>> {
		const allRanges: Array<Readonly<tts.CommentRange & { text: string }>> = [];
		const nodeText = node.getFullText();
		const cr = ts.getLeadingCommentRanges(nodeText, 0);
		if (cr)
			allRanges.push(
				...cr.map((c) => ({ ...c, text: nodeText.substring(c.pos, c.end) }))
			);
		const synthetic = ts.getSyntheticLeadingComments(node);
		if (synthetic) allRanges.push(...synthetic);
		return allRanges;
	}

	function createExpressionStmt(expr: string) {
		return ts.factory.createExpressionStatement(ts.factory.createIdentifier(expr));
	}

	return (ctx: tts.TransformationContext) => {
		return (sourceFile: tts.SourceFile) => {
			let hasStepBack = false;

			function visitor(node: tts.Node, context: Context | undefined): tts.Node {
				/*if (ts.isNewExpression(node) && context) {
					return ts.factory.createCallExpression(
						ts.factory.createIdentifier(varInitializeNew),
						[],
						[
							ts.factory.createNewExpression(
								node.expression,
								node.typeArguments,
								node.arguments
							),
						]
					);
				}*/

				if (ts.isBlock(node) && context) {
					const stmt = `${varInstructionCounts}[${context.levelVarName}]++`;
					const stmts = new Array<tts.Statement>();
					for (const s of node.statements) {
						stmts.push(createExpressionStmt(stmt));
						stmts.push(visitor(s, context) as tts.Statement);
					}
					return ts.factory.createBlock(stmts, true);
				}

				if (
					(ts.isMethodDeclaration(node) ||
						ts.isFunctionDeclaration(node) ||
						ts.isArrowFunction(node) ||
						ts.isFunctionExpression(node)) &&
					node.body &&
					ts.isBlock(node.body) &&
					!node.asteriskToken &&
					(!node.modifiers ||
						!node.modifiers.some(
							(m) => m.kind === ts.SyntaxKind.AsyncKeyword
						))
				) {
					const c = new Context(`${globalId++}`);
					hasStepBack = true;
					const extraStmts = [
						createExpressionStmt(
							`const ${c.levelVarName} = ${varGlobalLevel}++`
						),
						createExpressionStmt(
							`${varElements}[${c.levelVarName}] = "${c.id}"`
						),
						createExpressionStmt(
							`${varInstructionCounts}[${c.levelVarName}] = 0`
						),
					];

					const isPure = getAllLeadingComments(node).some(
						(c) =>
							c.text.indexOf("@nosideeffects") !== -1 ||
							c.text.indexOf("@pure") !== -1
					);
					if (isPure) {
						extraStmts.push(
							createExpressionStmt(`const ${varCanRestart} = true`)
						);
					}

					const oldBody = visitor(node.body, c) as tts.Block;
					const stmt = ts.factory.createTryStatement(
						oldBody,
						undefined,
						ts.factory.createBlock([
							createExpressionStmt(
								`${varInstructionCounts}[${c.levelVarName}] = -1`
							),
							createExpressionStmt(`${varGlobalLevel}--`),
						])
					);

					if (ts.isMethodDeclaration(node)) {
						return ts.factory.createMethodDeclaration(
							node.decorators,
							node.modifiers,
							node.asteriskToken,
							node.name,
							node.questionToken,
							node.typeParameters,
							node.parameters,
							node.type,
							ts.factory.createBlock([...extraStmts, stmt], true)
						);
					} else if (ts.isFunctionDeclaration(node)) {
						return ts.factory.createFunctionDeclaration(
							node.decorators,
							node.modifiers,
							node.asteriskToken,
							node.name,
							node.typeParameters,
							node.parameters,
							node.type,
							ts.factory.createBlock([...extraStmts, stmt], true)
						);
					} else if (ts.isArrowFunction(node)) {
						return ts.factory.createArrowFunction(
							node.modifiers,
							node.typeParameters,
							node.parameters,
							node.type,
							node.equalsGreaterThanToken,
							ts.factory.createBlock([...extraStmts, stmt], true)
						);
					} else if (ts.isFunctionExpression(node)) {
						return ts.factory.createFunctionExpression(
							node.modifiers,
							node.asteriskToken,
							node.name,
							node.typeParameters,
							node.parameters,
							node.type,
							ts.factory.createBlock([...extraStmts, stmt], true)
						);
					}
				}

				if (
					ts.isMethodDeclaration(node) ||
					ts.isFunctionDeclaration(node) ||
					ts.isArrowFunction(node) ||
					ts.isFunctionExpression(node)
				) {
					return ts.visitEachChild(
						node,
						(node) => visitor(node, undefined),
						ctx
					);
				}

				return ts.visitEachChild(node, (node) => visitor(node, context), ctx);
			}

			const newSf = ts.visitEachChild(
				sourceFile,
				(node) => visitor(node, undefined),
				ctx
			);

			if (hasStepBack) {
				return ts.factory.updateSourceFile(newSf, [
					createExpressionStmt(
						`globalThis.${varGlobalLevel} = globalThis.${varGlobalLevel} || 0`
					),
					createExpressionStmt(
						`globalThis.${varElements} = globalThis.${varElements} || []`
					),
					createExpressionStmt(
						`globalThis.${varInstructionCounts} = globalThis.${varInstructionCounts} || []`
					),
					/*createExpressionStmt(
						`globalThis.${varInitializeNew} = globalThis.${varInitializeNew} || (function (arg) {
	for (let i = 0; i < ${varGlobalLevel}; i++) {
		arg["${varInstructionCounts}" + i] = ${varInstructionCounts}[i];
	}
	return arg;
})`
					),*/
					...newSf.statements,
				]);
			} else {
				return newSf;
			}
		};
	};
}
