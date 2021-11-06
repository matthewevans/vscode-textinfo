import * as vscode from 'vscode';

export class EstimatedReadingTime {
	
	public constructor() {

	}

	/**
	 * Calculates the estimated time remaining to read the document. Does not distinguish between
	 * code files and traditional docs (like .md, .docx, etc)
	 */
	public calculateEstimatedReadingTime(activeEditor: vscode.TextEditor): string {
		// Get content from current cursor position to end of document.
		let lastLine = activeEditor.document.lineAt(activeEditor.document.lineCount - 1);
		let content = activeEditor.document.getText(new vscode.Range(activeEditor.selection.anchor, lastLine.range.end));
		let wordCount = EstimatedReadingTime.getDocumentWordCount(content);

		// Estimates are 200-250 WPM for average reading. Select 233ish and round to 2 decimal places.
		let estimate = (Math.round((wordCount / 233) * 100) / 100).toFixed(2);

		return estimate;
	}

	/**
	 * Derived from Microsoft Word Count Sample Extension:
	 *   https://github.com/microsoft/vscode-wordcount/blob/main/extension.ts
	 * 
	 * @param document 
	 * @returns 
	 */
	private static getDocumentWordCount(docContent: string): number {
		// Parse out unwanted whitespace so the split is accurate
		docContent = docContent.replace(/(< ([^>]+)<)/g, '').replace(/\s+/g, ' ');
		docContent = docContent.replace(/^\s\s*/, '').replace(/\s\s*$/, '');

		let wordCount = 0;

		if (docContent !== "") {
			wordCount = docContent.split(" ").length;
		}

		return wordCount;
	}
}
