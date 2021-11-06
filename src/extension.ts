// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { CommentReadability } from './commentreadability';
import { EstimatedReadingTime } from './estimatedreadingtime';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	let activeEditor: vscode.TextEditor;
	let commentReadability = new CommentReadability();
	let estimatedReadingTime = new EstimatedReadingTime();

	let updateDocument = () => {
		if (!activeEditor) {
			return;
		}

		refreshReadingTime();
		commentReadability.UpdateCodeLens(activeEditor);
	};

	// Instantiate status bar item
	let estimatedReadingTimeBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
	estimatedReadingTimeBarItem.command = 'textinfo.estimatedReadingTime';
	context.subscriptions.push(estimatedReadingTimeBarItem);

	// Subscribe to desired events & add to auto-cleanup
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(handleEditorChanged));
	context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(handleSelectionChanged));
	context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(handleDocumentTextChanged));

	// Do initial editor assign & start timer immediately for first render.
	if (vscode.window.activeTextEditor) {
		handleEditorChanged(vscode.window.activeTextEditor);
	}

	// -- Event handling start
	function handleEditorChanged(editor: vscode.TextEditor | undefined): void {
		if (editor) {
            activeEditor = editor;

			// Assign new language ID to regen regex
			commentReadability.SetRegex(editor.document.languageId);

			triggerDocumentUpdate();
		} else {
			estimatedReadingTimeBarItem.hide();
		}
	}

	function handleSelectionChanged(event: vscode.TextEditorSelectionChangeEvent): void {
		if (activeEditor && event.textEditor.document === activeEditor.document) {
			triggerDocumentUpdate();
		}
	}
	
	function handleDocumentTextChanged(event: vscode.TextDocumentChangeEvent): void {
		if (activeEditor && event.document === activeEditor.document) {
			triggerDocumentUpdate();
		}
	}

	// -- Event handling end

	function refreshReadingTime(): void {	
		estimatedReadingTimeBarItem.hide();

		if (!activeEditor) {
			return;
		}
	
		// Cursor changing also triggers this event. If the anchor & active position are equal
		// then only a cursor change occurred.
		if (activeEditor.selection.anchor.isEqual(activeEditor.selection.active)) {
			let estimate = estimatedReadingTime.calculateEstimatedReadingTime(activeEditor);

			estimatedReadingTimeBarItem.text = `$(book) Est ${estimate} min`;
			estimatedReadingTimeBarItem.show();
		}
	}
	
	// * IMPORTANT:
    // To avoid calling update too often,
    // set a timer for 200ms to wait before updating decorations
    var timeout: NodeJS.Timer;
    function triggerDocumentUpdate() {
        if (timeout) {
            clearTimeout(timeout);
        }
        timeout = setTimeout(updateDocument, 200);
    }
}

// this method is called when your extension is deactivated
export function deactivate() {}
