"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/uncrypto@0.1.3";
exports.ids = ["vendor-chunks/uncrypto@0.1.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/uncrypto@0.1.3/node_modules/uncrypto/dist/crypto.node.mjs":
/*!**************************************************************************************!*\
  !*** ./node_modules/.pnpm/uncrypto@0.1.3/node_modules/uncrypto/dist/crypto.node.mjs ***!
  \**************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   \"default\": () => (/* binding */ _crypto),\n/* harmony export */   getRandomValues: () => (/* binding */ getRandomValues),\n/* harmony export */   randomUUID: () => (/* binding */ randomUUID),\n/* harmony export */   subtle: () => (/* binding */ subtle)\n/* harmony export */ });\n/* harmony import */ var node_crypto__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! node:crypto */ \"node:crypto\");\n\n\nconst subtle = node_crypto__WEBPACK_IMPORTED_MODULE_0__.webcrypto?.subtle || {};\nconst randomUUID = () => {\n  return node_crypto__WEBPACK_IMPORTED_MODULE_0__.randomUUID();\n};\nconst getRandomValues = (array) => {\n  return node_crypto__WEBPACK_IMPORTED_MODULE_0__.webcrypto.getRandomValues(array);\n};\nconst _crypto = {\n  randomUUID,\n  getRandomValues,\n  subtle\n};\n\n\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vdW5jcnlwdG9AMC4xLjMvbm9kZV9tb2R1bGVzL3VuY3J5cHRvL2Rpc3QvY3J5cHRvLm5vZGUubWpzIiwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQXFDOztBQUVyQyxlQUFlLGtEQUFvQjtBQUNuQztBQUNBLFNBQVMsbURBQXFCO0FBQzlCO0FBQ0E7QUFDQSxTQUFTLGtEQUFvQjtBQUM3QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRW1FIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vZ29vZ2xlLXN0b2NrLW5mdC1mcm9udGVuZC8uL25vZGVfbW9kdWxlcy8ucG5wbS91bmNyeXB0b0AwLjEuMy9ub2RlX21vZHVsZXMvdW5jcnlwdG8vZGlzdC9jcnlwdG8ubm9kZS5tanM/MjEwYiJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgbm9kZUNyeXB0byBmcm9tICdub2RlOmNyeXB0byc7XG5cbmNvbnN0IHN1YnRsZSA9IG5vZGVDcnlwdG8ud2ViY3J5cHRvPy5zdWJ0bGUgfHwge307XG5jb25zdCByYW5kb21VVUlEID0gKCkgPT4ge1xuICByZXR1cm4gbm9kZUNyeXB0by5yYW5kb21VVUlEKCk7XG59O1xuY29uc3QgZ2V0UmFuZG9tVmFsdWVzID0gKGFycmF5KSA9PiB7XG4gIHJldHVybiBub2RlQ3J5cHRvLndlYmNyeXB0by5nZXRSYW5kb21WYWx1ZXMoYXJyYXkpO1xufTtcbmNvbnN0IF9jcnlwdG8gPSB7XG4gIHJhbmRvbVVVSUQsXG4gIGdldFJhbmRvbVZhbHVlcyxcbiAgc3VidGxlXG59O1xuXG5leHBvcnQgeyBfY3J5cHRvIGFzIGRlZmF1bHQsIGdldFJhbmRvbVZhbHVlcywgcmFuZG9tVVVJRCwgc3VidGxlIH07XG4iXSwibmFtZXMiOltdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/uncrypto@0.1.3/node_modules/uncrypto/dist/crypto.node.mjs\n");

/***/ })

};
;