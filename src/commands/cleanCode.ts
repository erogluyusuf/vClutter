import * as vscode from "vscode";
import { cleanCodeStack, fixIndentation } from "../utils/commentEngine";
export async function cleanCodeCommand(context: vscode.ExtensionContext) {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showWarningMessage("Önce bir dosya açmalısın!");
        return;
    }

    const document = editor.document;
    const selection = editor.selection;
    const languageId = document.languageId;
    const config = vscode.workspace.getConfiguration("vclutter");


    const keepTODOs = config.get<boolean>("keepTODOs", true);
    const autoFormat = config.get<boolean>("autoFormat", true);


    const isSelection = !selection.isEmpty;
    const rawText = isSelection ? document.getText(selection) : document.getText();


    let processedText = cleanCodeStack(rawText, languageId, keepTODOs);


    const bracketLanguages = [
        "javascript", "typescript", "javascriptreact", "typescriptreact", 
        "csharp", "java", "c", "cpp", "css", "json", "rust", "go", "swift"
    ];

    if (bracketLanguages.includes(languageId)) {
        const tabSize = editor.options.tabSize as number || 4;
        processedText = fixIndentation(processedText, tabSize);
    }


    if (processedText === rawText) {
        vscode.window.showInformationMessage("Seçilen alanda temizlenecek bir şey bulunamadı!");
        return;
    }


    const edit = new vscode.WorkspaceEdit();
    const range = isSelection 
        ? new vscode.Range(selection.start, selection.end)
        : new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));

    edit.replace(document.uri, range, processedText);
    const success = await vscode.workspace.applyEdit(edit);

    if (success) {
        if (autoFormat) {
            try {

                await vscode.commands.executeCommand("editor.action.formatDocument");
                vscode.window.setStatusBarMessage("vClutter: Temizlendi ve Formatlandı!", 3000);
            } catch (e) {
                vscode.window.setStatusBarMessage("vClutter: Temizlendi (Formatlayıcı bulunamadı).", 3000);
            }
        } else {
            vscode.window.setStatusBarMessage("vClutter: Sadece yorumlar temizlendi.", 3000);
        }
    } else {
        vscode.window.showErrorMessage("Hata: Kod güncellenemedi.");
    }
}