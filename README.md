# MyAPITester

A modern, fast, and lightweight desktop API testing client built with Electron, React, TypeScript, and Vite. Designed with a sleek glassmorphism interface and robust features to streamline your API testing and development workflow.

## Features

- 🎨 **Modern Interface**: Beautiful glassmorphism UI with multiple built-in themes (Dark, Light, Dracula, Nord, Hacker) and customizable layouts, including a resizable collections sidebar.
- 🗂 **Multi-Tabbed Workflow**: Work on multiple API requests simultaneously. Tab state is persisted automatically across application restarts.
- 📂 **Collections & Organization**: Organize your API requests into collections with full drag-and-drop support for reordering and moving requests.
- 🔄 **Extensive Import Support**: 
  - **Postman Collections (v2.1)**: Easily migrate your existing Postman collections.
  - **IntelliJ HTTP Client**: Full support for `.http` and `.rest` files, automatically parsing requests, headers, bodies, and embedded scripts.
- 🌍 **Environment Management**: Create distinct environments (e.g., Development, Production), define global variables, and seamlessly inject them into URLs, headers, and request bodies using `{{variable}}` syntax. Import `http-client.env.json` files directly.
- 🛠 **Powerful Scripting Engine**: Write pre-request scripts and test assertions. The execution sandbox supports both:
  - **Postman API**: `pm.test`, `pm.environment.set`, `pm.globals.set`, etc.
  - **IntelliJ API**: `client.test`, `client.assert`, `client.global.set`, etc.
- 💻 **Advanced Request Tools**: Key-value editors for Headers and URL Parameters, Monaco-based code editor for JSON bodies, and instant "Copy as cURL" functionality.
- 💾 **Local First**: All your data (collections, environments, globals, and tabs) is persisted securely on your local machine using Electron's `userData` store.

## Tech Stack

- **Framework**: React 19 + TypeScript
- **Desktop Runtime**: Electron
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + Vanilla CSS (for layout and variables)
- **Editor**: `@monaco-editor/react`
- **Icons**: `lucide-react`

## Getting Started

### Prerequisites

Ensure you have [Node.js](https://nodejs.org/) installed on your system.

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/vunloon/MyAPITester.git
   cd MyAPITester
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development

Start the development server and Electron app simultaneously with hot-module replacement (HMR):

```bash
npm run dev
```

### Building for Production

MyAPITester uses `electron-builder` to package the application. You can build installers for your platform of choice:

- **macOS (DMG)**: `npm run build:mac`
- **Windows (NSIS)**: `npm run build:win`
- **Linux (AppImage)**: `npm run build:linux`
- **All Platforms**: `npm run build:all`

The resulting installers will be located in the `release/` directory.

## File Imports

### Postman Collections
To import a Postman collection, export it from Postman in the **Collection v2.1 (JSON)** format. Click the Import button (Upload icon) in the Collections sidebar and select your file.

### IntelliJ HTTP Files
You can import `.http` or `.rest` files directly. The parser will split requests using the `###` separator and accurately identify URLs, headers, payload bodies, and `> {% ... %}` script blocks.

To import environment variables, select your `http-client.env.json` or `http-client.private.env.json` file. The environment structures will be merged into the Environment Manager.

## License

This project is private and maintained by vunloon.
