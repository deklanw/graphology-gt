// don't conflict with microbundle's babel config when building
module.exports = process.env.NODE_ENV == 'test' ? {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    "@babel/preset-typescript",
  ],
} : {};
