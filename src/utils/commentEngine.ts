import * as vscode from 'vscode';

export type BlockRule = { start: string; end: string };

export interface LangProfile {
    line: string[];
    block: BlockRule[];
    string: boolean;
}

const FALLBACK_MAP: Record<string, LangProfile> = {
    javascript:      { line: ["//"], block: [{ start: "/*", end: "*/" }], string: true },
    typescript:      { line: ["//"], block: [{ start: "/*", end: "*/" }], string: true },
    javascriptreact: { line: ["//"], block: [{ start: "/*", end: "*/" }], string: true },
    typescriptreact: { line: ["//"], block: [{ start: "/*", end: "*/" }], string: true },
    python:          { line: ["#"], block: [{ start: '"""', end: '"""' }, { start: "'''", end: "'''" }], string: true },
    html:            { line: [], block: [{
        start: "<!--",
        end: "-->"
    }], string: false }, 
    xml:             { line: [], block: [{
        start: "<!--",
        end: "-->"
    }], string: false }, 
    css:             { line: ["/*"], block: [{ start: "/*", end: "*/" }], string: true },
    csharp:          { line: ["//"], block: [{ start: "/*", end: "*/" }], string: true },
    php:             { line: ["//", "#"], block: [{ start: "/*", end: "*/" }], string: true },
    c:               { line: ["//"], block: [{ start: "/*", end: "*/" }], string: true },
    cpp:             { line: ["//"], block: [{ start: "/*", end: "*/" }], string: true },
    shellscript:     { line: ["#"], block: [], string: true }, 
    powershell:      { line: ["#"], block: [{ start: "<#", end: "#>" }], string: true },
    batch:           { line: ["REM", "::"], block: [], string: false }, 
    java:            { line: ["//"], block: [{ start: "/*", end: "*/" }], string: true },
    rust:            { line: ["//", "///"], block: [{ start: "/*", end: "*/" }], string: true },
    go:              { line: ["//"], block: [{ start: "/*", end: "*/" }], string: true },
    swift:           { line: ["//"], block: [{ start: "/*", end: "*/" }], string: true },
    ruby:            { line: ["#"], block: [{ start: "=begin", end: "=end" }], string: true },
    asm:             { line: [";"], block: [], string: true },
    nasm:            { line: [";"], block: [], string: true },
    yaml:            { line: ["#"], block: [], string: true },
    toml:            { line: ["#"], block: [], string: true },
    json:            { line: [], block: [], string: true }, 
    sql:             { line: ["--"], block: [{ start: "/*", end: "*/" }], string: true },
    dockerfile:      { line: ["#"], block: [], string: true },
    makefile:        { line: ["#"], block: [], string: false },
    markdown:        { line: [], block: [{
        start: "<!--",
        end: "-->"
    }], string: false },
    plaintext:       { line: ["#"], block: [], string: false },
    latex:           { line: ["%"], block: [], string: false }
};

// Aktif harita başlangıçta yedeklerle dolar
let ACTIVE_LANGUAGE_MAP: Record<string, LangProfile> = FALLBACK_MAP;

const GITHUB_CONFIG_URL = "https://raw.githubusercontent.com/erogluyusuf/vClutter/main/languages.json";

/**
 * GitHub'dan güncel dil haritasını çeker ve yerel belleğe (cache) kaydeder.
 */
export async function syncLanguageMap(context: vscode.ExtensionContext) {
    try {
        // Önce daha önce kaydedilmiş bir cache varsa onu yükle (Hızlı başlatma için)
        const cachedMap = context.globalState.get<Record<string, LangProfile>>('vclutter_remote_map');
        if (cachedMap) {
            ACTIVE_LANGUAGE_MAP = { ...FALLBACK_MAP, ...cachedMap };
        }

        // GitHub'dan yeni veriyi çek
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 saniye timeout

        const response = await fetch(GITHUB_CONFIG_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const remoteData = await response.json() as Record<string, LangProfile>;
            ACTIVE_LANGUAGE_MAP = { ...FALLBACK_MAP, ...remoteData };
            
            // Gelecek sefer için cache'e yaz
            await context.globalState.update('vclutter_remote_map', remoteData);
            console.log("vClutter: Dil haritası GitHub'dan güncellendi.");
        }
    } catch (error) {
        console.warn("vClutter: Güncelleme sunucusuna ulaşılamadı, yerel/cache veriler kullanılıyor.");
    }
}

/**
 * Kodu yorum satırlarından arındıran ana fonksiyon
 */
export function cleanCodeStack(code: string, languageId: string, keepTODOs: boolean = false): string {
    const profile = ACTIVE_LANGUAGE_MAP[languageId] || FALLBACK_MAP["javascript"];
    const input = code.split("");
    const output: string[] = [];
    let i = 0;
    
    let inString = false; 
    let quoteChar = "";
    let activeBlock: BlockRule | null = null;

    while (i < input.length) {
        // 1. BLOK YORUM KONTROLÜ
        if (activeBlock) {
            let matchEnd = true;
            for (let k = 0; k < activeBlock.end.length; k++) {
                if (i + k >= input.length || input[i + k] !== activeBlock.end[k]) {
                    matchEnd = false;
                    break;
                }
            }
            if (matchEnd) {
                i += activeBlock.end.length;
                activeBlock = null;
            } else {
                i++;
            }
            continue;
        }

        if (!inString) {
            // 2. BLOK BAŞLANGIÇ KONTROLÜ
            let foundBlock = false;
            for (const marker of profile.block) {
                let matchStart = true;
                for (let k = 0; k < marker.start.length; k++) {
                    if (i + k >= input.length || input[i + k] !== marker.start[k]) {
                        matchStart = false;
                        break;
                    }
                }

                if (matchStart) {
                    if (keepTODOs) {
                        let blockEndIndex = -1;
                        for (let j = i + marker.start.length; j < input.length; j++) {
                            let endMatch = true;
                            for (let k = 0; k < marker.end.length; k++) {
                                if (input[j + k] !== marker.end[k]) {
                                    endMatch = false;
                                    break;
                                }
                            }
                            if (endMatch) {
                                blockEndIndex = j + marker.end.length;
                                break;
                            }
                        }
                        if (blockEndIndex !== -1) {
                            const blockContent = input.slice(i, blockEndIndex).join("");
                            const lowerContent = blockContent.toLowerCase();
                            if (lowerContent.includes("todo") || lowerContent.includes("fixme") || lowerContent.includes("hack")) {
                                foundBlock = false; 
                                break; 
                            }
                        }
                    }
                    activeBlock = marker;
                    i += marker.start.length;
                    foundBlock = true;
                    break;
                }
            }
            if (foundBlock) continue;

            // 3. SATIR YORUM KONTROLÜ
            let foundLine = false;
            for (const marker of profile.line) {
                let match = true;
                for (let k = 0; k < marker.length; k++) {
                    if (i + k >= input.length || input[i + k] !== marker[k]) {
                        match = false;
                        break;
                    }
                }

                if (match) {
                    if (keepTODOs) {
                        let lineEnd = i;
                        while (lineEnd < input.length && input[lineEnd] !== "\n") lineEnd++;
                        const lineText = input.slice(i, lineEnd).join("").toLowerCase();
                        if (lineText.includes("todo") || lineText.includes("fixme")) {
                            match = false; 
                            break; 
                        }
                    }
                    while (i < input.length && input[i] !== "\n") i++;
                    foundLine = true;
                    break;
                }
            }
            if (foundLine) continue;
        }

        // 4. STRING (METİN) KORUMASI
        const char = input[i];
        if (profile.string) {
            if (!inString) {
                if (char === '"' || char === "'" || char === "`") { 
                    inString = true;
                    quoteChar = char;
                    output.push(char);
                    i++;
                    continue;
                }
            } else {
                if (char === "\\") { 
                    output.push(char);
                    if (i + 1 < input.length) output.push(input[++i]);
                    i++;
                    continue;
                }
                if (char === quoteChar) inString = false;
                output.push(char);
                i++;
                continue;
            }
        }

        output.push(char);
        i++;
    }

    return normalizeEmptyLines(output.join(""));
}

function normalizeEmptyLines(text: string): string {
    const lines = text.split("\n");
    const result: string[] = [];
    let prevEmpty = false;

    for (const line of lines) {
        const trimmed = line.trimEnd();
        if (trimmed.trim().length === 0) {
            if (!prevEmpty) {
                result.push("");
                prevEmpty = true;
            }
        } else {
            result.push(trimmed);
            prevEmpty = false;
        }
    }
    return result.join("\n").trim() + "\n";
}

/**
 * Kodu doğru hizaya sokar (Kendi yazdığın orijinal fonksiyon)
 */
export function fixIndentation(code: string, tabSize: number = 4): string {
    const lines = code.split("\n");
    let indentLevel = 0;
    const result: string[] = [];

    for (let line of lines) {
        let trimmedLine = line.trim();

        if (trimmedLine.startsWith("}") || trimmedLine.startsWith("]") || trimmedLine.startsWith(")")) {
            indentLevel = Math.max(0, indentLevel - 1);
        }

        const currentIndent = " ".repeat(indentLevel * tabSize);
        result.push(trimmedLine.length > 0 ? currentIndent + trimmedLine : "");

        const openBraces = (trimmedLine.match(/[\{\[\(]/g) || []).length;
        const closeBraces = (trimmedLine.match(/[\}\]\)]/g) || []).length;

        if (!trimmedLine.startsWith("}") && !trimmedLine.startsWith("]") && !trimmedLine.startsWith(")")) {
             indentLevel += (openBraces - closeBraces);
        }
        
        indentLevel = Math.max(0, indentLevel);
    }

    return result.join("\n");
}