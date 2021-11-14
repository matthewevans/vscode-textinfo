import * as vscode from "vscode";
import { CommentReadability, CommentInstance } from './CommentReadability';

export class ReadabilityCodeLensProvider implements vscode.CodeLensProvider {
    // * this is used to trigger the events when a supported language code is found
    public supportedLanguage = true;

    private codeLenses: vscode.CodeLens[] = [];
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> =
        new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> =
        this._onDidChangeCodeLenses.event;

    public constructor() {
        vscode.languages.registerCodeLensProvider("*", this);
    }

    public provideCodeLenses(
        document: vscode.TextDocument,
        token: vscode.CancellationToken
    ): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        return this.codeLenses;
    }

    /**
     * Apply decorations after finding all relevant comments
     * @param activeEditor The active text editor containing the code document
     */
    public UpdateCodeLens(activeEditor: vscode.TextEditor, comments: CommentInstance[]): void {
        if (!activeEditor) return;

        // * if lanugage isn't supported, return
        if (!this.supportedLanguage) return;

        this.codeLenses = [];

        for (let comment of comments) {

            // Skip invalid grades
            let grade = comment.stats.scores.get("textMedian") || 0;

            if (grade <= 0) {
                continue;
            }

            grade = Math.floor(grade);

            let display = CommentReadability.getGradeSuffix(grade);

            this.codeLenses.push(
                new vscode.CodeLens(activeEditor.document.lineAt(comment.line).range, {
                    title: `Predicted reading level of ${grade}${display} grade`,
                    tooltip: `A grade median calculated from the following readability tests: Flesch Kincaid Grade, Flesch Reading Ease (interpreted as a grade), SMOG Index, Coleman Liau Index, Automated Readability Index, Dale Chall Readability Score, Linsear Write Formula, Gunning Fog Index`,
                    command: "", // No command, makes this unclickable.
                })
            );
        }

        this._onDidChangeCodeLenses.fire();
    }
}
