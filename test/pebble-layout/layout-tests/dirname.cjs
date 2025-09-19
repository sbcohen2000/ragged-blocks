// The purpose of this CJS module is just to get a path into this
// directory which can be imported from layout-test.ts. It needs
// to be a CJS module so that __dirname is defined.

module.exports = __dirname;