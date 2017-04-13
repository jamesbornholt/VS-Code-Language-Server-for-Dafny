import * as vscode from "vscode-languageserver";
import { getWordAtText, ensureValidWordDefinition } from './wordHelper';

export class DocumentDecorator {

    protected _lines: string[];

    constructor(private document: vscode.TextDocument) {

        this._lines = document.getText().split(/\r\n|\r|\n/);
    }

    public getText(_range: vscode.Range): string {
        let range = this.validateRange(_range);

        if (range.start.line === range.end.line) {
            return this._lines[range.start.line].substring(range.start.character, range.end.character);
        }

        const lineEnding = "\n";  //TODO: set this correctly
        const startLineIndex = range.start.line;
        const endLineIndex = range.end.line;
        const resultLines: string[] = [];

        resultLines.push(this._lines[startLineIndex].substring(range.start.character));
        for (let i = startLineIndex + 1; i < endLineIndex; i++) {
            resultLines.push(this._lines[i]);
        }
        resultLines.push(this._lines[endLineIndex].substring(0, range.end.character));

        return resultLines.join(lineEnding);
    }

    public lineAt(position: vscode.Position): string {

        let line: number;
        line = position.line;

        if (line < 0 || line >= this._lines.length) {
            throw new Error('Illegal value for `line`');
        }

        return this._lines[line];
    }

    public validateRange(range: vscode.Range): vscode.Range {

        let start = this.validatePosition(range.start);
        let end = this.validatePosition(range.end);

        if (start === range.start && end === range.end) {
            return range;
        }
        return vscode.Range.create(start.line, start.character, end.line, end.character);
    }

    public validatePosition(position: vscode.Position): vscode.Position {

        let { line, character } = position;
        let hasChanged = false;

        if (line < 0) {
            line = 0;
            character = 0;
            hasChanged = true;
        }
        else if (line >= this._lines.length) {
            line = this._lines.length - 1;
            character = this._lines[line].length;
            hasChanged = true;
        }
        else {
            let maxCharacter = this._lines[line].length;
            if (character < 0) {
                character = 0;
                hasChanged = true;
            }
            else if (character > maxCharacter) {
                character = maxCharacter;
                hasChanged = true;
            }
        }

        if (!hasChanged) {
            return position;
        }
        return vscode.Position.create(line, character);
    }

    public getWordRangeAtPosition(_position: vscode.Position, regexp?: RegExp): vscode.Range {
        const position = this.validatePosition(_position);
        /*if (!regexp || regExpLeadsToEndlessLoop(regexp)) {
            regexp = getWordDefinitionFor(this._languageId);
        }*/
        const wordAtText = getWordAtText(
            position.character + 1,
            ensureValidWordDefinition(regexp),
            this._lines[position.line],
            0
        );

        if (wordAtText) {
            return vscode.Range.create(position.line, wordAtText.startColumn - 1, position.line, wordAtText.endColumn - 1);
        }
        return undefined;
    }

}