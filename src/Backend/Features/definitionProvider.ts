import * as vscode from "vscode";
import {DafnyServer} from "../dafnyServer";
import { dafnyKeywords } from "./../../LanguageDefinition/keywords";
import { EnvironmentConfig } from "./../../Strings/stringRessources";
import { isPositionInString } from "./../../Strings/StringUtils";

export const DAFNYMODE: vscode.DocumentFilter = { language: EnvironmentConfig.Dafny, scheme: "file" };
export class DafnyDefinitionInformtation {
    public file: string;
    public position: vscode.Position;
    public doc: string;
    public declarationlines: string[];
    public name: string;
    public toolUsed: string;
    public isValid(): boolean {
        return this.position.character > 0 && this.file !== "" && this.position.line > 0 && this.name !== "";
    }
    constructor(symbol: any, filePath: string) {
         if(symbol) {

            const line = parseInt(symbol.Line, 10) - 1; // 1 based
            const column = Math.max(0, parseInt(symbol.Column, 10) - 1); // ditto, but 0 can appear in some cases
            this.position = new vscode.Position(line, column);
            this.declarationlines = symbol.Name;
            this.doc = symbol.Name;
            this.file = filePath;
            this.name = symbol.Name;
            this.toolUsed = "DafnyServer";
        }
    }
}

export class DafnyDefinitionProvider implements vscode.DefinitionProvider {

    public constructor(public server: DafnyServer) {}

    public provideDefinition(document: vscode.TextDocument, position: vscode.Position):
    Thenable<vscode.Location> {
        return this.provideDefinitionInternal(document, position).then((definitionInfo: DafnyDefinitionInformtation) => {
            if (definitionInfo == null || definitionInfo.file == null) {
                return Promise.resolve(null);
            }
            const definitionResource = vscode.Uri.file(definitionInfo.file);
            return new vscode.Location(definitionResource, definitionInfo.position);
        }, (err) => {
            console.error(err);
            return Promise.resolve(null);
        });
    }

    public provideDefinitionInternal(
        document: vscode.TextDocument, position: vscode.Position): Promise<DafnyDefinitionInformtation> {
            return new Promise<DafnyDefinitionInformtation>((resolve, reject) => {
                const wordRange = document.getWordRangeAtPosition(position);
                const lineText = document.lineAt(position.line).text;
                const word = wordRange ? document.getText(wordRange) : "";
                if (!wordRange || lineText.startsWith("//") || isPositionInString(document, position)
                    || word.match(/^\d+.?\d+$/) || dafnyKeywords.indexOf(word) > 0) {
                    return Promise.reject(null);
                }
                return this.askDafnyDef(resolve, reject, document, word);
        });
    }
    public provideDefinitionInternalDirectly(document: vscode.TextDocument, symbol: string) {
        return new Promise<DafnyDefinitionInformtation>((resolve, reject) => {
                return this.askDafnyDef(resolve, reject, document, symbol);
        });
    }

    private askDafnyDef(resolve: any, reject: any, document: vscode.TextDocument, symbol: any) {
        this.server.symbolService.getSymbols(document).then((symbols: any) => {
            let found = false;
            for(const symb of symbols) {
                if(symb.Name === symbol) {
                    found = true;
                    resolve(new DafnyDefinitionInformtation(symb, document.fileName));
                    break;
                }
            }
            if(!found) {
                resolve(null);
            }
        }).catch((err: any) => reject(err));
    }
}
