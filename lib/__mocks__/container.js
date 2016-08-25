'use strict';

const spec = {
    version: '7.0',
    file_ext: 'ts'
};

module.exports = {
    load: jest.fn(function(container_directory, opts) {
        return Promise.resolve({});
    }),
    make: jest.fn(function(container_directory, opts) {
        return Promise.resolve({});
    }),
    open: jest.fn(function(container_archive, container_directory, opts) {
        return Promise.resolve({});
    }),
    close: jest.fn(function(container_directory, opts) {
        return Promise.resolve(container_directory + spec.file_ext);
    }),
    legacy_tools: {
        convertResource: jest.fn(function(data, dir, opts) {
            return Promise.resolve({});
        }),
        makeSlug: jest.fn(function(language_slug, project_slug, container_type, resource_slug) {
            if(!language_slug || !project_slug || !container_type || !resource_slug) throw new Error('Invalid resource container slug parameters');
            return language_slug
                + '_' + project_slug
                + '_' + container_type
                + '_' + resource_slug;
        }),
        spec: spec
    }
};