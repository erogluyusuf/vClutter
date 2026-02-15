import * as vscode from "vscode";
import { cleanCodeCommand } from "./commands/cleanCode";
import { batchCleanCommand } from "./commands/batchClean"; 

let myStatusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {

    const cleanCommand = vscode.commands.registerCommand('vclutter.clean', () => {
        cleanCodeCommand(context);
    });

    const batchCommand = vscode.commands.registerCommand('vclutter.batchClean', (uri: vscode.Uri) => {

        if (uri) {
            batchCleanCommand(uri);
        } else {
            vscode.window.showErrorMessage("Please select a folder from the Explorer.");
        }
    });

    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    myStatusBarItem.command = 'vclutter.clean';
    myStatusBarItem.text = '$(broom) vClutter'; 
    myStatusBarItem.tooltip = '';
    myStatusBarItem.show();

    context.subscriptions.push(cleanCommand, batchCommand, myStatusBarItem);
}

export function deactivate() {}