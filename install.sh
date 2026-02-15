#!/bin/bash

# vClutter Developer Environment Setup Script

echo "Starting vClutter developer environment setup..."

# Check for Node.js
if ! [ -x "$(command -v node)" ]; then
  echo 'Error: Node.js is not installed. Please install Node.js to continue.' >&2
  exit 1
fi

# Check for npm
if ! [ -x "$(command -v npm)" ]; then
  echo 'Error: npm is not installed.' >&2
  exit 1
fi

# Install local dependencies
echo "Installing project dependencies..."
npm install

# Check for TypeScript compiler globally, install if missing
if ! [ -x "$(command -v tsc)" ]; then
  echo "TypeScript compiler not found. Installing globally..."
  sudo npm install -g typescript
fi

# Check for VSCE (VS Code Extension Manager) for packaging
if ! [ -x "$(command -v vsce)" ]; then
  echo "VSCE not found. Installing globally for packaging support..."
  sudo npm install -g @vscode/vsce
fi

# Compile the project
echo "Compiling the project..."
npm run compile

echo "--------------------------------------------------"
echo "Setup completed successfully."
echo "You can now press F5 in VS Code to start debugging."
echo "To package the extension, run: vsce package"
echo "--------------------------------------------------"