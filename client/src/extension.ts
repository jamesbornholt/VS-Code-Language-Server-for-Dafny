"use strict";

import * as path from "path";
import * as vscode from "vscode";
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from "vscode-languageclient";
import { handlerApplyTextEdits } from "./commands";
import { Context } from "./context";
import { DafnyClientProvider } from "./dafnyProvider";
import { DafnyRunner } from "./dafnyRunner";
import { CompilerResult } from "./serverHelper/compilerResult";
import { Config, EnvironmentConfig } from "./stringRessources";
import { Answer, Commands, ErrorMsg, InfoMsg, LanguageServerNotification, LanguageServerRequest, WarningMsg } from "./stringRessources";

let languageServer: LanguageClient = null;
let provider: DafnyClientProvider;
const runner: DafnyRunner = new DafnyRunner();

export function activate(context: vscode.ExtensionContext) {
    const serverModule = context.asAbsolutePath(path.join("server", "server.js"));
    const debugOptions = { execArgv: ["--nolazy", "--debug=6009"] };

    const serverOptions: ServerOptions = {
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions },
        run: { module: serverModule, transport: TransportKind.ipc }
    };

    const clientOptions: LanguageClientOptions = {
        documentSelector: ["dafny"],
        synchronize: {
            configurationSection: "dafny"
        }
    };

    checkOpenInWorkspace();

    languageServer = new LanguageClient("dafny-vscode", "Dafny Language Server", serverOptions, clientOptions);
    languageServer.onReady().then(() => {

        provider = new DafnyClientProvider(context, languageServer);

        languageServer.onNotification(LanguageServerNotification.Error, (message: string) => {
            vscode.window.showErrorMessage(message);
        });

        languageServer.onNotification(LanguageServerNotification.Warning, (message: string) => {
            vscode.window.showWarningMessage(message);
        });

        languageServer.onNotification(LanguageServerNotification.Info, (message: string) => {
            vscode.window.showInformationMessage(message);
        });

        languageServer.onNotification(LanguageServerNotification.DafnyMissing, (message: string) => {
            askToInstall(message);
        });

        languageServer.onNotification(LanguageServerNotification.Ready, () => {
            if (Context.unitTest) { Context.unitTest.backendStarted(); };
            provider.activate(context.subscriptions);
        });
    });

    const disposable = languageServer.start();
    context.subscriptions.push(disposable);

    vscode.commands.registerCommand(Commands.ShowReferences, (uri: vscode.Uri, position, locations) => {
        function parsePosition(p: any): vscode.Position {
            return new vscode.Position(p.line, p.character);
        }
        function parseRange(r: any): vscode.Range {
            return new vscode.Range(parsePosition(r.start), parsePosition(r.end));
        }
        function parseLocation(l: any): vscode.Location {
            return new vscode.Location(parseUri(l.uri), parseRange(l.range));
        }
        function parseUri(u: any): vscode.Uri {
            return vscode.Uri.file(u);
        }

        const parsedUri = vscode.Uri.file(uri.fsPath);
        const parsedPosition = parsePosition(position);
        const parsedLocations = [];
        for (const location of locations) {
            parsedLocations.push(parseLocation(location));
        }

        vscode.commands.executeCommand("editor.action.showReferences", parsedUri, parsedPosition, parsedLocations);
    });

    const restartServerCommand: vscode.Disposable = vscode.commands.registerCommand(Commands.RestartServer, () => {
        languageServer.sendRequest(LanguageServerRequest.Reset).then(() => {
            return true;
        }, () => {
            vscode.window.showErrorMessage("Can't restart dafny");
        });
    });
    context.subscriptions.push(restartServerCommand);

    const editTextCommand: vscode.Disposable = vscode.commands.registerCommand(Commands.EditText, handlerApplyTextEdits(languageServer));
    context.subscriptions.push(editTextCommand);
    const installDafnyCommand: vscode.Disposable = vscode.commands.registerCommand(Commands.InstallDafny, () => {
        install();
    });
    context.subscriptions.push(installDafnyCommand);

    const uninstallDafnyCommand: vscode.Disposable = vscode.commands.registerCommand(Commands.UninstallDafny, () => {
        languageServer.sendRequest(LanguageServerRequest.Uninstall).then(() => {
            vscode.window.showInformationMessage("Uninstall complete");
            provider.dafnyStatusbar.hideProgress();
            provider.dafnyStatusbar.hide();
        }, (e) => {
            vscode.window.showErrorMessage("Can't uninstall dafny:" + e);
            provider.dafnyStatusbar.hideProgress();
            provider.dafnyStatusbar.hide();
        });

    });
    context.subscriptions.push(uninstallDafnyCommand);

    const compileFile: vscode.Disposable = vscode.commands.registerCommand(Commands.Compile, () => {
        compile(vscode.window.activeTextEditor.document.uri);
    });
    context.subscriptions.push(compileFile);

    const compileAndRun: vscode.Disposable = vscode.commands.registerCommand(Commands.CompileAndRun, () => {
        compile(vscode.window.activeTextEditor.document.uri, true);
    });
    context.subscriptions.push(compileAndRun);

    function compile(uri: vscode.Uri, run: boolean = false) {
        vscode.window.activeTextEditor.document.save();
        vscode.window.showInformationMessage(InfoMsg.CompilationStarted);
        languageServer.sendRequest(LanguageServerRequest.Compile, uri).then((result: CompilerResult) => {
            vscode.window.showInformationMessage(InfoMsg.CompilationFinished);
            if (run && result.executable) {
                runner.run(vscode.window.activeTextEditor.document.fileName);
            } else if (run) {
                vscode.window.showErrorMessage(ErrorMsg.NoMainMethod);
            }
            return true;
        }, (error: any) => {
            vscode.window.showErrorMessage("Can't compile: " + error.message);
        });
    }

    function askToInstall(text: string) {
        vscode.window.showInformationMessage(text, Answer.Yes, Answer.No).then((value: string) => {
            if (Answer.Yes === value) {
                install();
            }
        });

    }

    function install() {
        provider.dafnyStatusbar.hideProgress();
        provider.dafnyStatusbar.hide();
        languageServer.sendRequest(LanguageServerRequest.Install).then((basePath) => {
            console.log("BasePath: " + basePath);
            const config: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration(EnvironmentConfig.Dafny);
            config.update(Config.DafnyBasePath, basePath, true).then(() => {
                vscode.window.showInformationMessage("Installation finished");
                provider.dafnyStatusbar.hideProgress();
            });
        }, (e) => {
            vscode.window.showErrorMessage("Installing error: " + e);
            provider.dafnyStatusbar.hideProgress();
        });
    }

    function checkOpenInWorkspace() {
        if (vscode.workspace.rootPath === undefined) {
            vscode.window.showWarningMessage(WarningMsg.NoWorkspace);
        }
    }
}
