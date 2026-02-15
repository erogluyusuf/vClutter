import * as vscode from "vscode";
import { cleanCodeCommand } from "./commands/cleanCode";
import { batchCleanCommand } from "./commands/batchClean"; // Yeni import

let myStatusBarItem: vscode.StatusBarItem;

export function activate(context: vscode.ExtensionContext) {

    // 1. Normal Temizleme Komutu (Dosya içi veya Seçili alan)
    const cleanCommand = vscode.commands.registerCommand('vclutter.clean', () => {
        cleanCodeCommand(context);
    });

    // 2. Klasör Temizleme Komutu (Batch Clean)
    const batchCommand = vscode.commands.registerCommand('vclutter.batchClean', (uri: vscode.Uri) => {
        // Eğer sağ tık ile bir klasör seçilmişse uri dolu gelir
        if (uri) {
            batchCleanCommand(uri);
        } else {
            vscode.window.showErrorMessage("Lütfen Explorer üzerinden bir klasör seçin.");
        }
    });

    // 3. StatusBar Oluştur (Sol altta süpürge ikonu)
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    myStatusBarItem.command = 'vclutter.clean';
    myStatusBarItem.text = '$(broom) vClutter'; 
    myStatusBarItem.tooltip = 'Yorumları Temizle ve Formatla';
    myStatusBarItem.show();

    // Tüm abonelikleri (subscriptions) ekle
    context.subscriptions.push(cleanCommand, batchCommand, myStatusBarItem);
}

export function deactivate() {}