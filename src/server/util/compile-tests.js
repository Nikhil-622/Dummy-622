const path = require('path');
const fs = require('fs');
const fsExtra = require('fs-extra');
const browserify = require('browserify');
const envify = require('envify/custom');
const recursive = require('recursive-readdir');

const logger = require('./logger');

const BUNDLE_NAME = 'viz-tests';

module.exports = async function compileTests({
    testFilePath,
    testFilePattern,
    tmpDir,
}) {
    logger.info('Compiling tests...');

    const testFilePaths = await recursive(testFilePath, [
        (file, stats) => !(stats.isDirectory() || filenameMatchesPattern(file, testFilePattern)),
    ]);
    const bundleOutfilePath = path.join(tmpDir, `${BUNDLE_NAME}.js`);

    await fsExtra.ensureDir(tmpDir);

    logger.debug(`Building test script at ${bundleOutfilePath}`);
    logger.debug('Found test files at:', testFilePaths);

    await new Promise((resolve, reject) => {
        const writeablePipeline = browserify(testFilePaths, {
            standalone: BUNDLE_NAME,
        })
            .transform('babelify', {
                presets: [
                    '@babel/preset-env',
                    '@babel/preset-react',
                    '@babel/preset-typescript',
                ]
            })
            .transform(envify({NODE_ENV: process.env.NODE_ENV || 'development'}))
            .bundle()
            .pipe(fs.createWriteStream(bundleOutfilePath));

        writeablePipeline.on('error', (e) => {
            writeablePipeline.end();
            logger.error('Couldn\'t create test bundle', e);
            reject();
        });

        writeablePipeline.on('finish', () => {
            writeablePipeline.end();
            logger.info('Test bundle created');
            resolve();
        });
    });

    logger.info('Compilation complete');
};

function filenameMatchesPattern(filename, testFilePattern) {
    return Array.isArray(testFilePattern)
        ? testFilePattern.some(pattern => filename.endsWith(pattern))
        : filename.endsWith(testFilePattern)
}
