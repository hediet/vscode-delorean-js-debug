import * as vscode from "vscode";
import { Disposable } from "./utils/disposables";
import { IObservable, autorun, constObservable, derived, disposableObservableValue, waitForState } from "./utils/observables/observable";
import { RecordingSession } from "./RecordingSession";
import { createContextKey } from "./utils/vscodeObservables";
import { SourceLocation } from "@hediet/code-insight-recording/dist/ModuleInfo";

class Extension extends Disposable {
	private readonly _recordingSession = this._register(disposableObservableValue<RecordingSession | undefined>(this, undefined));

	constructor() {
		super();

		this._register(vscode.commands.registerCommand("delorean-js-debug.loadRecording", async (fileUri?: vscode.Uri) => {
			if (!fileUri) {
				return;
			}
			this._loadRecording(fileUri);
		}));

		this._register(vscode.commands.registerCommand("delorean-js-debug.step-forwards", () => {
			const session = this._recordingSession.get();
			if (session) {
				session.forwards();
			}
		}));

		this._register(vscode.commands.registerCommand("delorean-js-debug.step-backwards", () => {
			const session = this._recordingSession.get();
			if (session) {
				session.backwards();
			}
		}));

		this._register(vscode.commands.registerCommand("delorean-js-debug.open-location", (location: SourceLocation) => {
			vscode.window.showTextDocument(vscode.Uri.file(location.sourcePath), {
				selection: rangeFromPosition(new vscode.Position(location.pos.lineIdx, location.pos.charIdx)),
				viewColumn: vscode.ViewColumn.One
			});
		}));

		function rangeFromPosition(position: vscode.Position): vscode.Range {
			return new vscode.Range(position, position);
		}

		this._register(createContextKey("delorean-js-debug.hasRecording", this._recordingSession.map(s => !!s)));

		this._loadRecording(vscode.Uri.file("D:\\dev\\2024\\vscode-delorean-js-debug\\demo\\out.exec-rec"));

		const view = this._register(vscode.window.createTreeView("delorean-js-debug.recording", {
			treeDataProvider: new TreeDataProviderImpl(derived(this, reader => {
				const session = this._recordingSession.read(reader);
				if (!session) { return []; }
				const stack = session.stack.read(reader);
				return [new ObservableTreeItem(
					constObservable(new vscode.TreeItem("Stack " + session.currentInstructionIdx.read(reader), vscode.TreeItemCollapsibleState.Expanded)),
					stack.frames.map(frame => {
						return new ObservableTreeItem(
							constObservable({
								label: frame.location?.toString(),
								command: {
									command: 'delorean-js-debug.open-location',
									title: 'Open',
									arguments: [frame.location],
								}
							}),
							constObservable([])
						);
					})
				)];
			}))
		}));
	}

	private async _loadRecording(fileUri: vscode.Uri) {
		const session = await vscode.window.withProgress({
			location: vscode.ProgressLocation.Notification,
			title: "Loading recording",
			cancellable: false
		}, () => RecordingSession.load(fileUri));

		this._recordingSession.set(session, undefined);
	}
}

class ObservableTreeItem implements IObservableTreeItem {
	public readonly treeItem: IObservable<vscode.TreeItem | 'loading'>;
	public readonly children: IObservable<IObservableTreeItem[] | 'loading'>;

	constructor(
		treeItem: vscode.TreeItem | IObservable<vscode.TreeItem | 'loading'>,
		children?: IObservable<IObservableTreeItem[] | 'loading'> | IObservableTreeItem[]
	) {
		this.treeItem = ('reportChanges' in treeItem) ? treeItem : constObservable(treeItem);
		this.children = children ? (('reportChanges' in children) ? children : constObservable(children)) : constObservable([]);
	}
}

interface IObservableTreeItem {
	get treeItem(): IObservable<vscode.TreeItem | 'loading'>;
	get children(): IObservable<IObservableTreeItem[] | 'loading'>;
}

class TreeDataProviderImpl extends Disposable implements vscode.TreeDataProvider<IObservableTreeItem> {
	private readonly _onDidChangeTreeData = this._register(new vscode.EventEmitter<IObservableTreeItem | void | null>());
	public readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

	constructor(
		private readonly _children: IObservable<IObservableTreeItem[] | 'loading'>,
	) {
		super();

		autorun(reader => {
			const watch = (items: IObservable<IObservableTreeItem[] | 'loading'>) => {
				const v = items.read(reader);
				if (v === 'loading') { return; }
				for (const item of v) {
					watch(item.children);
				}
			};
			watch(this._children);
			this._onDidChangeTreeData.fire();
		});
	}

	getTreeItem(element: IObservableTreeItem): vscode.TreeItem | Thenable<vscode.TreeItem> {
		const value = element.treeItem.get();
		if (value !== 'loading') { return value; }
		return waitForState(element.treeItem, v => v !== 'loading').then(v => {
			return v as any;
		});
	}

	async getChildren(element?: IObservableTreeItem): Promise<IObservableTreeItem[]> {
		const target = element?.children ?? this._children;
		const value = target.get();
		if (value !== 'loading') { return value; }
		return waitForState(target, v => v !== 'loading').then(v => {
			return v as any;
		});
	}
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(new Extension());
}
