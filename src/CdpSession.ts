import Cdp from "./api";
import { CdpClient } from "./CdpRpcClient";

export class CdpSession {
	public static async create(client: CdpClient): Promise<CdpSession> {
		const session = new CdpSession(client);
		await session.init();
		return session;
	}

	private _lastPausedEvent: Cdp.Debugger.PausedEvent | undefined;
	public get lastPausedEvent() {
		return this._lastPausedEvent;
	}

	public readonly api = this.client.api;

	private constructor(private readonly client: CdpClient) {}

	private async init(): Promise<void> {
		this.api.Debugger.on("paused", (event) => {
			this._lastPausedEvent = event;
		});
		this.api.Debugger.on("resumed", (event) => {
			this._lastPausedEvent = undefined;
		});
		await this.api.JsDebug.subscribe({
			events: ["Debugger.*", "Runtime.*"],
		});
		await this.api.Debugger.enable({});
		await this.api.Runtime.enable({});
	}
}
