import * as vscode from "vscode";
import { cleanCodeStack, fixIndentation } from "../utils/commentEngine";

export async function batchCleanCommand(uri: vscode.Uri) {

    const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(uri, "**/*.{ts,js,py,cs,cpp,java,html,css,json,rs,go,swift,c,cpp,h}")
    );

    if (files.length === 0) {
        vscode.window.showInformationMessage("vClutter: No eligible source files found in the directory.");
        return;
    }

    const config = vscode.workspace.getConfiguration("vclutter");
    const keepTODOs = config.get<boolean>("keepTODOs", true);
    let count = 0;


    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "vClutter: Analyzing and optimizing directory content...",
        cancellable: false
    }, async (progress) => {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const fullText = document.getText();
                const languageId = document.languageId;


                let processedText = cleanCodeStack(fullText, languageId, keepTODOs);


                const bracketLanguages = [
                    "javascript", "typescript", "javascriptreact", "typescriptreact", 
                    "csharp", "java", "c", "cpp", "css", "json", "rust", "go", "swift"
                ];

                if (bracketLanguages.includes(languageId)) {

                    processedText = fixIndentation(processedText, 4);
                }


                if (processedText !== fullText) {
                    const edit = new vscode.WorkspaceEdit();
                    const fullRange = new vscode.Range(
                        document.positionAt(0),
                        document.positionAt(fullText.length)
                    );

                    edit.replace(file, fullRange, processedText);
                    const success = await vscode.workspace.applyEdit(edit);
                    
                    if (success) {
                        await document.save();
                        count++;
                    }
                }
            } catch (error) {
                console.error(`An error occurred while processing the file: ${file.fsPath}`, error);
            }


            progress.report({ increment: (100 / files.length) });
        }
    });


    if (count > 0) {
        vscode.window.showInformationMessage(`vClutter: Successfully processed ${count} files.`);
    } else {
        vscode.window.showInformationMessage("Analysis complete: All files are already optimized.");
    }
}