"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/@solana+programs@5.5.1_typescript@5.9.3";
exports.ids = ["vendor-chunks/@solana+programs@5.5.1_typescript@5.9.3"];
exports.modules = {

/***/ "(ssr)/./node_modules/.pnpm/@solana+programs@5.5.1_typescript@5.9.3/node_modules/@solana/programs/dist/index.node.mjs":
/*!**********************************************************************************************************************!*\
  !*** ./node_modules/.pnpm/@solana+programs@5.5.1_typescript@5.9.3/node_modules/@solana/programs/dist/index.node.mjs ***!
  \**********************************************************************************************************************/
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   isProgramError: () => (/* binding */ isProgramError)\n/* harmony export */ });\n/* harmony import */ var _solana_errors__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @solana/errors */ \"(ssr)/./node_modules/.pnpm/@solana+errors@5.5.1_typescript@5.9.3/node_modules/@solana/errors/dist/index.node.mjs\");\n\n\n// src/program-error.ts\nfunction isProgramError(error, transactionMessage, programAddress, code) {\n  if (!(0,_solana_errors__WEBPACK_IMPORTED_MODULE_0__.isSolanaError)(error, _solana_errors__WEBPACK_IMPORTED_MODULE_0__.SOLANA_ERROR__INSTRUCTION_ERROR__CUSTOM)) {\n    return false;\n  }\n  const instructionProgramAddress = transactionMessage.instructions[error.context.index]?.programAddress;\n  if (!instructionProgramAddress || instructionProgramAddress !== programAddress) {\n    return false;\n  }\n  return typeof code === \"undefined\" || error.context.code === code;\n}\n\n\n//# sourceMappingURL=index.node.mjs.map\n//# sourceMappingURL=index.node.mjs.map//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHNzcikvLi9ub2RlX21vZHVsZXMvLnBucG0vQHNvbGFuYStwcm9ncmFtc0A1LjUuMV90eXBlc2NyaXB0QDUuOS4zL25vZGVfbW9kdWxlcy9Ac29sYW5hL3Byb2dyYW1zL2Rpc3QvaW5kZXgubm9kZS5tanMiLCJtYXBwaW5ncyI6Ijs7Ozs7QUFBd0Y7O0FBRXhGO0FBQ0E7QUFDQSxPQUFPLDZEQUFhLFFBQVEsbUZBQXVDO0FBQ25FO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7O0FBRTBCO0FBQzFCO0FBQ0EiLCJzb3VyY2VzIjpbIndlYnBhY2s6Ly9nb29nbGUtc3RvY2stbmZ0LWZyb250ZW5kLy4vbm9kZV9tb2R1bGVzLy5wbnBtL0Bzb2xhbmErcHJvZ3JhbXNANS41LjFfdHlwZXNjcmlwdEA1LjkuMy9ub2RlX21vZHVsZXMvQHNvbGFuYS9wcm9ncmFtcy9kaXN0L2luZGV4Lm5vZGUubWpzPzkwM2YiXSwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgaXNTb2xhbmFFcnJvciwgU09MQU5BX0VSUk9SX19JTlNUUlVDVElPTl9FUlJPUl9fQ1VTVE9NIH0gZnJvbSAnQHNvbGFuYS9lcnJvcnMnO1xuXG4vLyBzcmMvcHJvZ3JhbS1lcnJvci50c1xuZnVuY3Rpb24gaXNQcm9ncmFtRXJyb3IoZXJyb3IsIHRyYW5zYWN0aW9uTWVzc2FnZSwgcHJvZ3JhbUFkZHJlc3MsIGNvZGUpIHtcbiAgaWYgKCFpc1NvbGFuYUVycm9yKGVycm9yLCBTT0xBTkFfRVJST1JfX0lOU1RSVUNUSU9OX0VSUk9SX19DVVNUT00pKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIGNvbnN0IGluc3RydWN0aW9uUHJvZ3JhbUFkZHJlc3MgPSB0cmFuc2FjdGlvbk1lc3NhZ2UuaW5zdHJ1Y3Rpb25zW2Vycm9yLmNvbnRleHQuaW5kZXhdPy5wcm9ncmFtQWRkcmVzcztcbiAgaWYgKCFpbnN0cnVjdGlvblByb2dyYW1BZGRyZXNzIHx8IGluc3RydWN0aW9uUHJvZ3JhbUFkZHJlc3MgIT09IHByb2dyYW1BZGRyZXNzKSB7XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG4gIHJldHVybiB0eXBlb2YgY29kZSA9PT0gXCJ1bmRlZmluZWRcIiB8fCBlcnJvci5jb250ZXh0LmNvZGUgPT09IGNvZGU7XG59XG5cbmV4cG9ydCB7IGlzUHJvZ3JhbUVycm9yIH07XG4vLyMgc291cmNlTWFwcGluZ1VSTD1pbmRleC5ub2RlLm1qcy5tYXBcbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWluZGV4Lm5vZGUubWpzLm1hcCJdLCJuYW1lcyI6W10sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(ssr)/./node_modules/.pnpm/@solana+programs@5.5.1_typescript@5.9.3/node_modules/@solana/programs/dist/index.node.mjs\n");

/***/ })

};
;