/**
 * Copyright IBM Corp. 2018, 2023
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 */

'use strict';

const { babel } = require('@rollup/plugin-babel');
const fs = require('fs-extra');
const path = require('path');
const { rollup } = require('rollup');
const virtual = require('../plugins/virtual');

const BANNER = `/**
 * Copyright IBM Corp. 2019, 2023
 *
 * This source code is licensed under the Apache-2.0 license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * Code generated by @carbon/icon-build-helpers. DO NOT EDIT.
 */`;
const external = ['@carbon/icon-helpers', 'vue'];
const babelConfig = {
  babelrc: false,
  exclude: /node_modules/,
  presets: [
    [
      '@babel/preset-env',
      {
        targets: {
          browsers: ['extends browserslist-config-carbon'],
        },
      },
    ],
  ],
  babelHelpers: 'bundled',
};

async function builder(metadata, { output }) {
  const modules = metadata.icons.flatMap((icon) => {
    return icon.output.map((size) => {
      const source = createIconComponent(size.moduleName, size.descriptor);
      return {
        source,
        filepath: size.filepath,
        moduleName: size.moduleName,
      };
    });
  });

  const files = {
    'index.js': `${BANNER}\n\n
      export const CarbonIconsVue = {
        install(Vue, options) {
          const { components } = options;
          Object.keys(components).forEach(key => {
            Vue.component(key, components[key]);
          });
        },
      };
    `,
    './utils.js': await fs.readFile(
      path.resolve(__dirname, './utils.js'),
      'utf8'
    ),
  };
  const input = {
    'index.js': 'index.js',
  };

  for (const m of modules) {
    files[m.filepath] = m.source;
    input[m.filepath] = m.filepath;
    files['index.js'] +=
      `\nexport { default as ${m.moduleName} } from '${m.filepath}';`;
  }

  const bundle = await rollup({
    input,
    external,
    plugins: [virtual(files), babel(babelConfig)],
  });

  const bundles = [
    {
      directory: path.join(output, 'es'),
      format: 'esm',
    },
    {
      directory: path.join(output, 'lib'),
      format: 'commonjs',
    },
  ];

  for (const { directory, format } of bundles) {
    const outputOptions = {
      dir: directory,
      format,
      entryFileNames: '[name]',
      banner: BANNER,
      exports: 'auto',
    };

    await bundle.write(outputOptions);
  }

  const umd = await rollup({
    input: 'index.js',
    external,
    plugins: [virtual(files), babel(babelConfig)],
  });

  await umd.write({
    file: path.join(output, 'umd/index.js'),
    format: 'umd',
    name: 'CarbonIconsVue',
    globals: {
      '@carbon/icon-helpers': 'CarbonIconHelpers',
      vue: 'Vue',
    },
  });
}

/**
 * Generate an icon component, which in our case is the string representation
 * of the component, from a given moduleName and icon descriptor.
 * @param {string} moduleName
 * @param {object} descriptor
 * @param {object} descriptor.attrs
 * @param {object} descriptor.content
 * @returns {object}
 */
function createIconComponent(moduleName, { attrs, content }) {
  return `import createSVGComponent from './utils.js';

const attrs = ${JSON.stringify(attrs)};
const content = ${JSON.stringify(content)};
const ${moduleName} = createSVGComponent('${moduleName}', ${JSON.stringify(
    attrs
  )}, ${JSON.stringify(content)});

export default ${moduleName};
`;
}

module.exports = builder;
