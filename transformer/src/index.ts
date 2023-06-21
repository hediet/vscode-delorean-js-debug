import * as tts from "typescript";

class Context {
	public blockCount = 0;

	constructor(public readonly functionId: number) {}
}

export default function (
	program: tts.Program,
	pluginOptions: {},
	ts: typeof tts = tts
) {
	if (typeof ts !== "object" || ts.isArrowFunction === undefined) {
		ts = tts;
	}

	function createExpressionStmt(expr: string) {
		return ts.factory.createExpressionStatement(
			ts.factory.createIdentifier(expr)
		);
	}

	return (ctx: tts.TransformationContext) => {
		return (sourceFile: tts.SourceFile) => {
			let functionCounter = 0;

			function visitor(
				node: tts.Node,
				context: Context | undefined
			): tts.Node {
				if (ts.isBlock(node) && context) {
					const stmts = new Array<tts.Statement>();
					if (context.blockCount > 0) {
						stmts.push(
							createExpressionStmt(
								`$$CI_b(${context.blockCount})`
							)
						);
					}

					context.blockCount++;

					for (const s of node.statements) {
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
					ts.isBlock(node.body)
				) {
					const functionId = functionCounter++;

					const c = new Context(functionId);

					const newBody = visitor(node.body, c) as tts.Block;
					const stmt = ts.factory.createTryStatement(
						newBody,
						undefined,
						ts.factory.createBlock([
							createExpressionStmt(`$$CI_r()`),
						])
					);

					const additionalStatement = createExpressionStmt(
						`$$CI_fl(${c.functionId})`
					);

					if (ts.isMethodDeclaration(node)) {
						return ts.factory.createMethodDeclaration(
							node.modifiers,
							node.asteriskToken,
							node.name,
							node.questionToken,
							node.typeParameters,
							node.parameters,
							node.type,
							ts.factory.createBlock(
								[additionalStatement, stmt],
								true
							)
						);
					} else if (ts.isFunctionDeclaration(node)) {
						return ts.factory.createFunctionDeclaration(
							node.modifiers,
							node.asteriskToken,
							node.name,
							node.typeParameters,
							node.parameters,
							node.type,
							ts.factory.createBlock(
								[additionalStatement, stmt],
								true
							)
						);
					} else if (ts.isArrowFunction(node)) {
						return ts.factory.createArrowFunction(
							node.modifiers,
							node.typeParameters,
							node.parameters,
							node.type,
							node.equalsGreaterThanToken,
							ts.factory.createBlock(
								[additionalStatement, stmt],
								true
							)
						);
					} else if (ts.isFunctionExpression(node)) {
						return ts.factory.createFunctionExpression(
							node.modifiers,
							node.asteriskToken,
							node.name,
							node.typeParameters,
							node.parameters,
							node.type,
							ts.factory.createBlock(
								[additionalStatement, stmt],
								true
							)
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

				return ts.visitEachChild(
					node,
					(node) => visitor(node, context),
					ctx
				);
			}

			const newSf = ts.visitEachChild(
				sourceFile,
				(node) => visitor(node, undefined),
				ctx
			);

			return ts.factory.updateSourceFile(newSf, [
				createExpressionStmt(
					`globalThis.$$CI_f = globalThis.$$CI_f || (() => {})`
				),
				createExpressionStmt(
					`globalThis.$$CI_b = globalThis.$$CI_b || (() => {})`
				),
				createExpressionStmt(
					`globalThis.$$CI_r = globalThis.$$CI_r || (() => {})`
				),

				createExpressionStmt(
					`globalThis.$$CI_modules = globalThis.$$CI_modules || {}`
				),
				createExpressionStmt(
					`const $$CI_moduleId = Object.entries(globalThis.$$CI_modules).length`
				),
				createExpressionStmt(
					`globalThis.$$CI_modules[$$CI_moduleId] = ${JSON.stringify(
						newSf.fileName
					)}`
				),

				// function enter
				createExpressionStmt(
					`const $$CI_fl = functionId => globalThis.$$CI_f($$CI_moduleId, functionId)`
				),
				...newSf.statements,
			]);
		};
	};
}
