// Global stylesheets imported for their side effect (react-pdf's text and annotation layers). Next
// bundles them; TypeScript 6 checks side-effect imports, and Next declares only `*.module.css`.
declare module '*.css';
