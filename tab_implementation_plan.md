# Multi-Tab Architecture Implementation Plan

The current application uses scalar React state variables (`url`, `method`, `body`, `response`) which locks the UI into displaying only one active request at a time. To implement a robust Postman-like tabbed experience, we must transform the entire state architecture.

## Proposed Changes

### State Architecture Refactor
1. **Remove Scalar Global States**: Delete the individual states for `url`, `method`, `body`, `preRequestScript`, `testScript`, `loading`, and `response`.
2. **Introduce `OpenTab` Interface**: Create an interface that holds all the data needed for a single open tab, including its independent request data, loading status, response data, and local active editor tabs (e.g. keeping Tab A on the Headers view while Tab B is on the Tests view).
3. **Array-Based Tab Management**: Utilize `useState<OpenTab[]>` to hold all open tabs, and `activeTabId` to track the currently focused tab on the screen.

### UI Modifications
1. **Tab Bar Component**: Introduce a horizontal scrolling top-bar positioned above the URL input section natively mapping through your open requests. Each tab will display the Request Name, Request Method (color-coded), and an `x` button to close the tab.
2. **Data Binding**: Map the URL input, Monaco Editors, Method dropdown, and Response panels dynamically to the `currentTab` dynamically derived from `openTabs.find(t => t.id === activeTabId)`.
3. **Sidebar Logic**: Adjust 'Collections' folder clicks. Instead of overwriting global states directly, clicking a sidebar request will either push a *new* tab to the `openTabs` array or immediately focus it if it is already open.

### Request Execution Context
1. Modify `sendRequest` and `saveCurrentRequest` functions to read from and write to the isolated `currentTab` objects within the state array, ensuring tests, scripts, and network loading spinner states don't bleed across tabs.

## User Review Required
> [!IMPORTANT]
> The single-window state implementation will be heavily restructured. The core capabilities (VM testing, variables, Postman imports) will remain untouched, but they'll pull from the tab data instead of root state.

Please approve this architectural restructure so I can proceed with the execution.
