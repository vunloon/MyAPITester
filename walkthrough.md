# MyAPITester Implementation Walkthrough

The **MyAPITester** Postman clone has been fully implemented using Electron, React, and Vite! Below is a summary of the accomplishments and the core features you can now use.

> [!NOTE]
> The app is built on Electron to securely bypass browser CORS limitations and to read/write settings (collections, environments) directly to your local file system, providing a true native desktop application experience.

## Features Implemented

### 1. Robust Core Layout & Networking
- **Vite & React** frontend with an ultra-responsive layout heavily inspired by modern VS Code / Postman aesthetics.
- Features dual-pane navigation (resizing constraints built-in), supporting `GET`, `POST`, `PUT`, `PATCH`, and `DELETE`.
- Monaco Editor integration for JSON formatting and syntax highlighting.
- Built-in request timer and response size metrics.

### 2. Local Persistence (Collections)
All your requested history and collections are persistently stored in your system's application data folder, mapping down to an internal `collections.json` file.
- Add new requests to folders directly from the sidebar.
- Switch seamlessly between saved requests, maintaining individual tabs (Pre-request scripts, Test scripts, Body).

### 3. Smart Variables Engine
Implemented `Environments` and `Globals`. You can seamlessly use Postman's standard templating engine:
- Insert variables like `{{baseUrl}}/api/v1/users` inside the URL bar or within your request body payload.
- The active environment is easily toggleable from a dropdown menu right beside the URL bar.

### 4. Sandbox Execution Engine (`pm` emulator)
MyAPITester securely mimics Postman's `pm` JavaScript namespace by running your scripts inside an isolated Node.js `vm` (Virtual Machine).
- **Pre-request Scripts**: Safely inject values into the `pm.environment` or `pm.globals` *before* the network call flies.
  ```javascript
  // Set an authorization token before request
  pm.environment.set("auth_token", "Bearer abc_123");
  ```
- **Test Scripts**: Validate your response outputs and test behaviors:
  ```javascript
  pm.test("Status code is 200", function () {
    if (pm.response.status !== 200) throw new Error("Expected 200");
  });
  ```
- All test results are captured and shown cleanly inside the new "Test Results" tab on the response pane.

### 5. Postman Import & Export
You can easily jumpstart MyAPITester by bringing over your existing setups.
> [!TIP]
> Use the **Upload** icon within the Collections sidebar to import standard Postman Collection `v2.1.0` JSON files. It will automatically parse your nested `pre-request` hooks, endpoints, payload formats, and tests!
- Press the **Download** icon to export your existing saved collections as JSON.

## Start the App

The development server should already be running and presenting the desktop window. If the window was closed, you can rerun the app by opening a terminal inside your `MyAPITester` folder and executing:
```sh
npm run dev
```

> [!IMPORTANT]
> The application uses Node.js `vm` for executing user-defined scripts. Under the hood, we pass sanitized contexts (excluding critical Node globals like `require` or `process`) to prevent arbitrary system commands from firing.
