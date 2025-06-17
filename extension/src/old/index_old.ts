import { Disposable } from "@hediet/std/disposable";
import * as vscode from "vscode";
import { CdpClient } from "./CdpRpcClient";
import { CdpSession } from "./CdpSession";
import { StepBackFeature } from "./StepBackFeature";
import { SemanticVersion } from "@hediet/semver";

class Extension {
	public readonly dispose = Disposable.fn();

	private readonly sessions = new Map<vscode.DebugSession, EnhancedSession>();
	private readonly stepBackFeatures = new Map<
		EnhancedSession,
		StepBackFeature
	>();

	private getEnhancedSession(session: vscode.DebugSession): EnhancedSession {
		let enhancedSession = this.sessions.get(session);
		if (enhancedSession === undefined) {
			enhancedSession = new EnhancedSession(session);
			this.sessions.set(session, enhancedSession);
		}
		return enhancedSession;
	}

	constructor(context: vscode.ExtensionContext) {
		vscode.debug.onDidTerminateDebugSession((s) => {
			const enhancedSession = this.sessions.get(s);
			if (enhancedSession) {
				this.sessions.delete(s);
				enhancedSession.dispose();
			}
		});

		vscode.commands.registerCommand(
			"delorean-js-debug.step-backwards",
			async () => {
				try {
					const session = vscode.debug.activeDebugSession;
					if (!session) {
						throw new Error("No active debug session!");
					}

					const enhancedSession = this.getEnhancedSession(session);
					const cdp = await enhancedSession.cdpSession;

					let stepBackFeature =
						this.stepBackFeatures.get(enhancedSession);
					if (!stepBackFeature) {
						stepBackFeature = new StepBackFeature(cdp);
						this.stepBackFeatures.set(
							enhancedSession,
							stepBackFeature
						);
					}
					await stepBackFeature.stepBack();
				} catch (e) {
					vscode.window.showErrorMessage(e.message);
				}
			}
		);
	}
}

class EnhancedSession {
	public readonly dispose = Disposable.fn();
	public readonly cdpSession: Promise<CdpSession>;

	constructor(public readonly session: vscode.DebugSession) {
		this.cdpSession = this.init();
	}

	private async init(): Promise<CdpSession> {
		try {
			const result = (await vscode.commands.executeCommand(
				"extension.js-debug.requestCDPProxy",
				this.session.id
			)) as { host: string; port: number; path: string } | undefined;

			if (!result) {
				throw new Error("CDP proxy could not be started");
			}

			const client = await CdpClient.connect({
				host: result.host,
				port: result.port,
				path: result.path,
			});
			this.dispose.track(client);
			const session = await CdpSession.create(client);

			return session;
		} catch (e) {
			console.error(e);
			return e;
		}
	}
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(new Extension(context));
}
