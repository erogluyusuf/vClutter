import * as vscode from "vscode";
import { cleanCodeStack, fixIndentation } from "../utils/commentEngine";

export async function batchCleanCommand(uri: vscode.Uri) {
    // 1. Klasör altındaki hedef kod dosyalarını bul
    const files = await vscode.workspace.findFiles(
        new vscode.RelativePattern(uri, "**/*.{ts,js,py,cs,cpp,java,html,css,json,rs,go,swift,c,cpp,h}")
    );

    if (files.length === 0) {
        vscode.window.showInformationMessage("vClutter: Klasörde temizlenecek uygun dosya bulunamadı.");
        return;
    }

    const config = vscode.workspace.getConfiguration("vclutter");
    const keepTODOs = config.get<boolean>("keepTODOs", true);
    let count = 0;

    // 2. İlerleme çubuğunu (Progress Bar) göster
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: "vClutter: Klasör süpürülüyor...",
        cancellable: false
    }, async (progress) => {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const fullText = document.getText();
                const languageId = document.languageId;

                // A. Yorumları Temizle
                let processedText = cleanCodeStack(fullText, languageId, keepTODOs);

                // B. Girintileri Düzelt (Sadece parantezli diller için)
                const bracketLanguages = [
                    "javascript", "typescript", "javascriptreact", "typescriptreact", 
                    "csharp", "java", "c", "cpp", "css", "json", "rust", "go", "swift"
                ];

                if (bracketLanguages.includes(languageId)) {
                    // Toplu işlemde varsayılan tabSize 4 kullanıyoruz
                    processedText = fixIndentation(processedText, 4);
                }

                // C. Eğer değişiklik varsa dosyayı güncelle ve kaydet
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
                console.error(`Dosya temizlenirken hata oluştu: ${file.fsPath}`, error);
            }

            // İlerleme yüzdesini güncelle
            progress.report({ increment: (100 / files.length) });
        }
    });

    // 3. Sonuç mesajı
    if (count > 0) {
        vscode.window.showInformationMessage(`vClutter: Toplam ${count} dosya pırıl pırıl yapıldı!`);
    } else {
        vscode.window.showInformationMessage("vClutter: Tüm dosyalar zaten tertemiz.");
    }
}