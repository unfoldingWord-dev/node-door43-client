'use strict';

const fs = require('fs');
const path = require('path');
const fileUtils = require('./utils/files');
const compressionUtils = require('./utils/compression');
const YAML = require('yamljs');
const rimraf = require('rimraf');

const package_version = '7.0';

/**
 * Represents an instance of a resource container
 * @param container_directory
 * @param package_json
 * @constructor
 */
function Container(container_directory, package_json) {

    return {
        /**
         * Returns the path to the resource container directory
         * @returns {*}
         */
        get path () {
            return container_directory;
        },

        /**
         * Returns the slug of the resource container
         */
        get slug () {
            return '';
        },

        /**
         * Returns the type of the resource container
         * @returns {string}
         */
        get type() {
            return '';
        }

        // TODO: add more methods
    };
}

/**
 * Loads a resource container from the disk
 * @param container_directory
 * @param opts
 * @throws errors if the container has problems
 * @returns {Promise<Container>}
 */
function loadContainer(container_directory, opts) {
    return new Promise(function(resolve, reject) {
        let package_json;
        try {
            package_json = JSON.parse(fs.readFileSync(path.join(container_directory, 'package.json'), {encoding: 'utf8'}));
        } catch (err) {}
        if(package_json == null) {
            reject(new Error('Not a resource container', 'some id'));
        }
        if (package_json.package_version > package_version) {
            reject(new Error('Unsupported container version'));
        }
        if(package_json.package_version < package_version) {
            reject(new Error('Outdated container version'));
        }

        resolve(new Container(container_directory, package_json));
    });
}

/**
 * Creates a new resource container
 * @param container_directory
 * @param opts
 * @throws error if the directory already exists
 * @returns {Promise<Container>}
 */
function makeContainer(container_directory, opts) {
    return new Promise(function(resolve, reject) {
        if(fileUtils.fileExists(container_directory)) {
            reject(new Error('Container already exists'));
        }

        let package_json = {};
        // TODO: build the container

        resolve(new Container(container_directory, package_json));
    });
}

/**
 * Opens an archived resource container.
 * If the container is already opened it will be loaded
 * @param container_archive
 * @param container_directory
 * @param opts
 * @returns {Promise<Container>}
 */
function openContainer(container_archive, container_directory, opts) {
    opts = opts || { compression_method : 'tar' };
    if(!fileUtils.fileExists(container_archive)) return Promise.reject(new Error('Missing resource container'));
    if(fileUtils.fileExists(container_archive)) {
        return loadContainer(container_directory, opts);
    }
    if(opts.compression_method === 'zip') {
        return compressionUtils.unzip(container_archive, container_directory)
            .then(function(dir) {
                return loadContainer(dir, opts);
            });
    } else {
        return compressionUtils.untar(container_archive, container_directory)
            .then(function(dir) {
                return loadContainer(dir, opts);
            });
    }
}

/**
 * Closes (archives) a resource container
 * @param container_directory
 * @param opts
 * @returns {Promise<String>} the path to the container archive
 */
function closeContainer(container_directory, opts) {
    opts = opts || { compression_method : 'tar' };
    if(!fileUtils.fileExists(container_directory)) return Promise.reject(new Error('Missing resource container'));
    var container_archive = container_directory + (opts.compression_method === 'zip' ? '.tstudio' : '.ts');
    var closePromise = new Promise.resolve(container_archive);

    // create archive if it's missing
    if(!fileUtils.fileExists(container_archive)) {
        if(opts.compression_method === 'zip') {
            closePromise = compressionUtils.zip(container_directory, container_archive);
        } else {
            closePromise = compressionUtils.tar(container_directory, container_archive);
        }
    }
    return closePromise.then(function(path) {
        rimraf.sync(container_directory);
        return path;
    });
}

module.exports = {
    load: loadContainer,
    make: makeContainer,
    open: openContainer,
    close: closeContainer
};