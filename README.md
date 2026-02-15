# vClutter: Professional Source Code Refactoring & De-Cluttering Tool

![Project Status](https://img.shields.io/badge/Status-Stable-success)
![Platform](https://img.shields.io/badge/Platform-Visual%20Studio%20Code-blue)
![License](https://img.shields.io/badge/License-MIT-purple)

vClutter is a high-performance **Visual Studio Code extension** designed to clean up complex source code, remove non-documentation comments, and optimize code structural integrity (indentation). It supports a wide range of cleanup operations, from single selections to entire project directories, increasing developer productivity.

---

## 🛠 Features

### 🧹 Smart Comment Stripping (Context-Aware)

vClutter is more than a simple text cleaner; it understands code semantics:

- **Multi-Language Support:** Predefined syntax profiles for over 30 programming languages.
- **String Protection:** Characters inside quotes (`"`, `'`, `` ` ``) are treated as part of the code and never removed.
- **Hybrid Cleaning:** Successfully removes both single-line (`//`, `#`, `;`) and block comments (`/* */`, `""" """`, ```` `` ````).

### 🛡 Critical Note Protection (TODO/FIXME Preservation)

Important development notes are never lost:

- **Advanced Filtering:** Automatically detects and preserves comments containing `TODO`, `FIXME`, or `HACK`.
- **Configurable:** This protection mechanism can be disabled according to user preferences.

### 📏 Dynamic Indentation Optimization (Indent Fixer)

Organizes the visual hierarchy of code without the need for external formatters (Prettier/ESLint, etc.):

- **Bracket-Based Alignment:** Automatically aligns indentation based on bracket depth for C-style languages.
- **Zero-Dependency:** Ensures readability even if VS Code’s built-in formatter is not installed.

---

## 🚀 Usage Scenarios

1. **Partial Clean**  
   Right-click a selected code block in the editor or use the command palette to clean only that area.

2. **Global File Cleanup**  
   Click the `$(broom)` vClutter icon in the Status Bar to remove comments from the entire open file in seconds.

3. **Batch Folder Sweep**  
   Right-click a folder in the Explorer panel and run the `Sweep Folder` command to clean hundreds of files across a project in one operation.

---

## ⚙️ Settings

vClutter can be fully customized to match your workflow:

| Setting | Type | Default | Description |
|---------|------|---------|------------|
| `vclutter.keepTODOs` | Boolean | true | Preserves critical comments containing TODO and FIXME. |
| `vclutter.autoFormat` | Boolean | true | Automatically triggers the VS Code formatter after cleanup. |

---

## 📦 Installation

### Build from Source

```bash
git clone https://github.com/erogluyusuf/vClutter.git
cd vClutter
npm install
npm run compile
```
## ⚖️ Disclaimer

vClutter is designed for visual code cleanup. Make sure `keepTODOs` is enabled before removing important documentation comments. The developer is not responsible for any data loss resulting from the use of this software.

## 🤝 Contribution

Pull requests are welcome. For major changes, please open an **issue** first to discuss what you plan to modify.

## 📜 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Maintained by:** Yusuf Eroğlu  
_Code clarity, redefined._
