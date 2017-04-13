import {Position, TextDocument, WorkspaceEdit} from "vscode-languageserver";
import { DafnyServer } from "./../dafnyServer";
import { SymbolType } from "./symbols";
import { Symbol, SymbolTable } from "./symbols";
import { DocumentDecorator } from "../../vscodeFunctions/documentfunctions";

export class DafnyRenameProvider {
    public constructor(public server: DafnyServer) {}
    public provideRenameEdits(
        document: TextDocument, position: Position,
        newName: string):
        Thenable<WorkspaceEdit> {
            return this.provideRenameInternal(newName, document, position).then((definitionInfo: WorkspaceEdit) => {
            if (definitionInfo != null) {
                return definitionInfo;
            }
            return null;
        }, (err) => {
            console.error(err);
            return null;
        });
    }

    private provideRenameInternal(newName: string, document: TextDocument, position: Position): Promise<WorkspaceEdit> {
        const documentDecorator: DocumentDecorator = new DocumentDecorator(document);
        const wordRange = documentDecorator.getWordRangeAtPosition(position);
        const word = wordRange ? documentDecorator.getText(wordRange) : "";
        return this.server.symbolService.getSymbols(document).then((tables: SymbolTable[]) => {
            const allSymbols = [].concat.apply([], tables.map((table: SymbolTable) => table.symbols));
            const definingClasses = allSymbols.filter((e: Symbol) => {
                return e && e.range && e.symbolType && e.range.contains(position) && e.symbolType === SymbolType.Class;
            });

            const results = new WorkspaceEdit();
            if(definingClasses && definingClasses.length && definingClasses[0]) {
                const relevantSymbols = allSymbols.filter((e: Symbol) => {
                    return (e.symbolType === SymbolType.Call || e.symbolType === SymbolType.Field) && e.name.includes(word);
                });
                console.log(relevantSymbols);
                for(const s of relevantSymbols) {
                    if(s.symbolType === SymbolType.Field) {
                        results.replace(s.fileName, s.range, newName);
                        for(const ref of s.References) {
                            results.replace(ref.fileName, ref.range, newName);

                        }
                    }
                    if(s.symbolType === SymbolType.Call) {
                        //for(const ref of s.References) {
                            //results.replace(Uri.file(document.fileName), ref.range, newName);

                        //}
                    }
                }
            }
            return results;

        }).catch((e: any) => {console.log(e); });
    }
}