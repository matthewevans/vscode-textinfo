import * as vscode from 'vscode';
import * as readability from 'text-readability';

interface CommentTag {
    tag: string;
    escapedTag: string;
    decoration: vscode.TextEditorDecorationType;
    ranges: Array<vscode.DecorationOptions>;
}

interface Contributions {
    multilineComments: boolean;
    useJSDocStyle: boolean;
    highlightPlainText: boolean;
    tags: string[];
}

export class CommentReadability implements vscode.CodeLensProvider {
    private expression: string = "";

    private delimiter: string = "";
    private blockCommentStart: string = "";
    private blockCommentEnd: string = "";

    private highlightSingleLineComments = true;
    private highlightMultilineComments = false;
    private highlightJSDoc = false;

    // * this will allow plaintext files to show comment highlighting if switched on
    private isPlainText = false;

    // * this is used to prevent the first line of the file (specifically python) from coloring like other comments
    private ignoreFirstLine = false;

    // * this is used to trigger the events when a supported language code is found
    public supportedLanguage = true;
    
    private rangeMatches: [number, vscode.Range][] = [];

    // Read from the package.json
    private contributions: Contributions = vscode.workspace.getConfiguration('textinfo') as any;

    private codeLenses: vscode.CodeLens[] = [];
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;

    public constructor() {
        vscode.languages.registerCodeLensProvider("*", this);
    }

    public provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): vscode.CodeLens[] | Thenable<vscode.CodeLens[]> {
        return this.codeLenses;
    }

    /**
     * Sets the regex to be used by the matcher based on the config specified in the package.json
     * @param languageCode The short code of the current language
     * https://code.visualstudio.com/docs/languages/identifiers
     */
    public SetRegex(languageCode: string) {
        this.setDelimiter(languageCode);

        // if the language isn't supported, we don't need to go any further
        if (!this.supportedLanguage) {
            return;
        }

        let characters: Array<string> = [];

        for (let item of this.contributions.tags) {
            let escapedSequence = item.replace(/([()[{*+.$^\\|?])/g, '\\$1');
            characters.push(escapedSequence.replace(/\//gi, "\\/"));
        }

        if (this.isPlainText && this.contributions.highlightPlainText) {
            // start by tying the regex to the first character in a line
            this.expression = "(^)+([ \\t]*[ \\t]*)";
        } else {
            // start by finding the delimiter (//, --, #, ') with optional spaces or tabs
            this.expression = "(" + this.delimiter.replace(/\//ig, "\\/") + ")+( |\t)*";
        }

        // Apply all configurable comment start tags
        this.expression += "(";
        this.expression += characters.join("|");
        this.expression += ")*(.*)";
    }

    /**
     * Finds all single line comments delimited by a given delimiter and matching tags specified in package.json
     * @param activeEditor The active text editor containing the code document
     */
    public FindSingleLineComments(activeEditor: vscode.TextEditor): void {

        // If highlight single line comments is off, single line comments are not supported for this language
        if (!this.highlightSingleLineComments) return;

        let text = activeEditor.document.getText();

        // if it's plain text, we have to do mutliline regex to catch the start of the line with ^
        let regexFlags = (this.isPlainText) ? "igm" : "ig";
        let regEx = new RegExp(this.expression, regexFlags);

        let match: any;
        while (match = regEx.exec(text)) {
            let startPos = activeEditor.document.positionAt(match.index);
            let endPos = activeEditor.document.positionAt(match.index + match[0].length);

            // Required to ignore the first line of .py files (#61)
            if (this.ignoreFirstLine && startPos.line === 0 && startPos.character === 0) {
                continue;
            }

            let line = startPos.line;

            // Adjust start pos
            startPos = activeEditor.document.positionAt(match.index + (match[0].length - match[4].length));

            this.rangeMatches.push([line, new vscode.Range(startPos, endPos)]);
        }
    }

    /**
     * Finds block comments as indicated by start and end delimiter
     * @param activeEditor The active text editor containing the code document
     */
    public FindBlockComments(activeEditor: vscode.TextEditor): void {

        // If highlight multiline is off in package.json or doesn't apply to his language, return
        if (!this.highlightMultilineComments) return;
        
        let text = activeEditor.document.getText();

        // Use start and end delimiters to find block comments
        let regexString = "(^|[ \\t])(";
        regexString += this.blockCommentStart;
        regexString += "[\\s])+([\\s\\S]*?)(";
        regexString += this.blockCommentEnd;
        regexString += ")";

        let regEx = new RegExp(regexString, "gm");

        // Find the multiline comment block
        let match: any;
        while (match = regEx.exec(text)) {
            let line = activeEditor.document.positionAt(match.index).line;

            let startPos = activeEditor.document.positionAt(match.index + match[2].length);
            let endPos = activeEditor.document.positionAt(match.index + match[0].length - match[4].length);

            this.rangeMatches.push([line, new vscode.Range(startPos, endPos)]);
        }
    }

    /**
     * Finds all multiline comments starting with "*"
     * @param activeEditor The active text editor containing the code document
     */
    public FindJSDocComments(activeEditor: vscode.TextEditor): void {

        // If highlight multiline is off in package.json or doesn't apply to his language, return
        if (!this.highlightMultilineComments && !this.highlightJSDoc) return;

        let text = activeEditor.document.getText();

        // Combine custom delimiters and the rest of the comment block matcher
        let regEx = /(^|[ \t])(\/\*\*)+([\s\S]*?)(\*\/)/gm; // Find rows of comments matching pattern /** */

        // Find the multiline comment block
        let match: any;
        while (match = regEx.exec(text)) {
            let line = activeEditor.document.positionAt(match.index).line;
            let startPos = activeEditor.document.positionAt(match.index + match[2].length);
            let endPos = activeEditor.document.positionAt(match.index + match[0].length - match[4].length);

            this.rangeMatches.push([line, new vscode.Range(startPos, endPos)]);
        }
    }

    private static getGradeSuffix (grade: number): string {
        grade = Math.floor(grade)

        // Assuming grade can't go > 100
        if (grade > 20) {
            grade = grade % 10;
        }
        
        // poor function fix this, gives { 22th and 23th grade }
        const gradeMap: { [key: number]: string } = { 
          1: 'st',
          2: 'nd',
          3: 'rd'
        }
        return gradeMap[grade] ? gradeMap[grade] : 'th'
      }

    /**
     * Apply decorations after finding all relevant comments
     * @param activeEditor The active text editor containing the code document
     */
    public UpdateCodeLens(activeEditor: vscode.TextEditor): void {
        if (!activeEditor) return;

        // * if lanugage isn't supported, return
        if (!this.supportedLanguage) return;

        this.FindSingleLineComments(activeEditor);
        this.FindBlockComments(activeEditor);
        this.FindJSDocComments(activeEditor);

        this.codeLenses = [];

        for (let [line, range] of this.rangeMatches) {

            let commentText = activeEditor.document.getText(range);

            // Skip invalid grades
            let grade = readability.textMedian(commentText);

            if (grade <= 0) {
                continue;
            }

            grade = Math.floor(grade);

            let display = CommentReadability.getGradeSuffix(grade);

            this.codeLenses.push(new vscode.CodeLens(activeEditor.document.lineAt(line).range, {
                title: `Predicted reading level of ${grade}${display} grade`,
                tooltip: `A grade median calculated from the following readability tests: Flesch Kincaid Grade, Flesch Reading Ease (interpreted as a grade), SMOG Index, Coleman Liau Index, Automated Readability Index, Dale Chall Readability Score, Linsear Write Formula, Gunning Fog Index`,
                command: '' // No command, makes this unclickable.
            }));
        }
        
        this.rangeMatches.length = 0;

        this._onDidChangeCodeLenses.fire();
    }

    /**
     * Sets the comment delimiter [//, #, --, '] of a given language
     * @param languageCode The short code of the current language
     * https://code.visualstudio.com/docs/languages/identifiers
     */
    private setDelimiter(languageCode: string): void {
        this.supportedLanguage = true;
        this.ignoreFirstLine = false;
        this.isPlainText = false;

        switch (languageCode) {

            case "asciidoc":
                this.setCommentFormat("//", "////", "////");
                break;

            case "apex":
            case "javascript":
            case "javascriptreact":
            case "typescript":
            case "typescriptreact":
                this.setCommentFormat("//", "/*", "*/");
                this.highlightJSDoc = true;
                break;

            case "al":
            case "c":
            case "cpp":
            case "csharp":
            case "dart":
            case "flax":
            case "fsharp":
            case "go":
            case "groovy":
            case "haxe":
            case "java":
            case "jsonc":
            case "kotlin":
            case "less":
            case "pascal":
            case "objectpascal":
            case "php":
            case "rust":
            case "scala":
            case "sass":
            case "scss":
            case "shaderlab":
            case "stylus":
            case "swift":
            case "verilog":
            case "vue":
                this.setCommentFormat("//", "/*", "*/");
                break;
            
            case "css":
                this.setCommentFormat("/*", "/*", "*/");
                break;

            case "coffeescript":
            case "dockerfile":
            case "gdscript":
            case "graphql":
            case "julia":
            case "makefile":
            case "perl":
            case "perl6":
            case "puppet":
            case "r":
            case "ruby":
            // case "shellscript":
            case "tcl":
            case "yaml":
                this.delimiter = "#";
                break;
            
            case "shellscript":
            case "tcl":
                this.delimiter = "#";
                this.ignoreFirstLine = true;
                break;

            case "elixir":
            case "python":
                this.setCommentFormat("#", '"""', '"""');
                this.ignoreFirstLine = true;
                break;
            
            case "nim":
                this.setCommentFormat("#", "#[", "]#");
                break;

            case "powershell":
                this.setCommentFormat("#", "<#", "#>");
                break;

            case "ada":
            case "hive-sql":
            case "pig":
            case "plsql":
            case "sql":
                this.delimiter = "--";
                break;
            
            case "lua":
                this.setCommentFormat("--", "--[[", "]]");
                break;

            case "elm":
            case "haskell":
                this.setCommentFormat("--", "{-", "-}");
                break;

            case "brightscript":
            case "diagram": // ? PlantUML is recognized as Diagram (diagram)
            case "vb":
                this.delimiter = "'";
                break;

            case "bibtex":
            case "erlang":
            case "latex":
            case "matlab":
                this.delimiter = "%";
                break;

            case "clojure":
            case "racket":
            case "lisp":
                this.delimiter = ";";
                break;

            case "terraform":
                this.setCommentFormat("#", "/*", "*/");
                break;

            case "COBOL":
                this.delimiter = this.escapeRegExp("*>");
                break;

            case "fortran-modern":
                this.delimiter = "c";
                break;
            
            case "SAS":
            case "stata":
                this.setCommentFormat("*", "/*", "*/");
                break;
            
            case "html":
            case "markdown":
            case "xml":
                this.setCommentFormat("<!--", "<!--", "-->");
                break;
            
            case "twig":
                this.setCommentFormat("{#", "{#", "#}");
                break;

            case "genstat":
                this.setCommentFormat("\\", '"', '"');
                break;
            
            case "cfml":
                this.setCommentFormat("<!---", "<!---", "--->");
                break;

            case "plaintext":
                this.isPlainText = true;

                // If highlight plaintext is enabeld, this is a supported language
                this.supportedLanguage = this.contributions.highlightPlainText;
                break;

            default:
                this.supportedLanguage = false;
                break;
        }
    }

    /**
     * Escapes a given string for use in a regular expression
     * @param input The input string to be escaped
     * @returns {string} The escaped string
     */
    private escapeRegExp(input: string): string {
        return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    /**
     * Set up the comment format for single and multiline highlighting
     * @param singleLine The single line comment delimiter. If NULL, single line is not supported
     * @param start The start delimiter for block comments
     * @param end The end delimiter for block comments
     */
    private setCommentFormat(singleLine: string | null, start: string, end: string): void {
        
        // If no single line comment delimiter is passed, single line comments are not supported
        if (singleLine) {
            this.delimiter = this.escapeRegExp(singleLine);
        } else {
            this.highlightSingleLineComments = false;
        }

        this.blockCommentStart = this.escapeRegExp(start);
        this.blockCommentEnd = this.escapeRegExp(end);
        this.highlightMultilineComments = this.contributions.multilineComments;
    }
}
