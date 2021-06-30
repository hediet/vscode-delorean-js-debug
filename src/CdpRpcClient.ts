import { EventEmitter } from "@hediet/std/events";
import WebSocket = require("ws");
import Cdp from "./api";

export interface CdpAddress {
	host: string;
	port: number;
	path: string;
}

export class CdpClient {
	public static async connect(address: CdpAddress): Promise<CdpClient> {
		const client = await CdpRpcClient.connect(address);
		return new CdpClient(client);
	}

	public readonly api: Cdp.Api;
	private readonly callbacksPerEvent = new Map<
		string,
		Array<(args: unknown) => void>
	>();

	constructor(private readonly client: CdpRpcClient) {
		this.api = new Proxy({} as any, {
			get: (target, domain) => {
				if (typeof domain !== "string") {
					throw new Error("Invalid key type");
				}

				if (!(domain in target)) {
					target[domain] = this.createApiForDomain(domain);
				}
				return target[domain];
			},
		});

		this.client.onEvent.sub(({ method, params }) => {
			const c = this.callbacksPerEvent.get(method);
			if (!c) {
				return;
			}

			for (const cb of c) {
				cb(params);
			}
		});
	}

	public dispose(): void {
		this.client.dispose();
	}

	private createApiForDomain(domain: string): unknown {
		const api = new Proxy(
			{
				on: (event: string, callback: (args: unknown) => void) => {
					const key = `${domain}.${event}`;

					let callbacks = this.callbacksPerEvent.get(key);
					if (!callbacks) {
						callbacks = [];
						this.callbacksPerEvent.set(key, callbacks);
					}
					const initialzedCallbacks = callbacks;
					initialzedCallbacks.push(callback);

					return {
						dispose: () => {
							const index = initialzedCallbacks.indexOf(callback);
							if (index !== -1) {
								initialzedCallbacks.splice(index, 1);
							}
						},
					};
				},
			} as any,
			{
				get: (target, key) => {
					if (typeof key !== "string") {
						throw new Error("Invalid key type");
					}

					if (!(key in target)) {
						const m = (
							params: Record<string, unknown> | undefined
						): Promise<unknown> => {
							return this.client.request(domain, key, params);
						};
						target[key] = m;
					}

					return target[key];
				},
			}
		);
		return api;
	}
}

export class CdpRpcClient {
	public static async connect(address: CdpAddress): Promise<CdpRpcClient> {
		return new Promise((resolve) => {
			const webSocket = new WebSocket(
				`ws://${address.host}:${address.port}${address.path}`
			);
			const client = new CdpRpcClient(webSocket);
			webSocket.on("open", () => {
				resolve(client);
			});
		});
	}

	private lastMessageId: number = 0;
	private readonly pendingRequests: Map<
		string | number,
		{
			handleResult: (result: unknown) => void;
			handleError: (result: unknown) => void;
		}
	> = new Map();
	//private subscriptions: Map<Method, SubscriptionCallback[]> = new Map();

	private readonly onEventEmitter = new EventEmitter<{
		method: string;
		params: Record<string, unknown>;
	}>();
	public readonly onEvent = this.onEventEmitter.asEvent();

	private constructor(private readonly webSocket: WebSocket) {
		webSocket.on("message", (d) => {
			const message = d.toString();
			//console.log(message);
			const msg = JSON.parse(message) as
				| {
						id: string | number;
						result?: unknown;
						error?: unknown;
				  }
				| {
						method: string;
						params: Record<string, unknown>;
				  };

			if ("id" in msg) {
				const pendingRequest = this.pendingRequests.get(msg.id);
				if (pendingRequest) {
					if ("result" in msg) {
						pendingRequest.handleResult(msg.result);
					} else if ("error" in msg) {
						pendingRequest.handleError(msg.error);
					}
				}
			} else if ("method" in msg) {
				this.onEventEmitter.emit({
					method: msg.method,
					params: msg.params,
				});
			}
		});
	}

	public dispose(): void {
		this.webSocket.close();
	}

	public request(
		domain: string,
		method: string,
		params?: Record<string, unknown>
	): Promise<unknown> {
		return this.send(`${domain}.${method}`, params);
	}

	private async send(
		method: string,
		params?: Record<string, unknown>
	): Promise<unknown> {
		if (!this.webSocket) {
			throw new Error("WebSocket not initialized.");
		}

		const messageId = `${this.lastMessageId++}`;

		return new Promise((resolve, reject) => {
			this.pendingRequests.set(messageId, {
				handleResult: (response) => {
					resolve(response);
				},
				handleError: (error) => {
					reject(error);
				},
			});

			const message = {
				id: messageId,
				method,
				params,
			};
			const json = JSON.stringify(message);

			this.webSocket.send(json);
		});
	}
}
