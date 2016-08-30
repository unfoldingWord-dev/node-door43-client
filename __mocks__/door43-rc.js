'use strict';

const spec = {
    version: '7.0',
    file_ext: 'ts'
};

let responses = [];

module.exports = {
    set __queueResponse (response) {
        responses.push(response);
    },

    load: jest.fn(function(container_directory, opts) {
        return Promise.resolve(responses.shift());
    }),
    make: jest.fn(function(container_directory, opts) {
        return Promise.resolve(responses.shift());
    }),
    open: jest.fn(function(container_archive, container_directory, opts) {
        return Promise.resolve(responses.shift());
    }),
    close: jest.fn(function(container_directory, opts) {
        return Promise.resolve(container_directory + '.' +  spec.file_ext);
    }),
    tools: {
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
        mimeToType: jest.fn(function(mime_type) {
            return mime_type.split('+')[1];
        }),
        typeToMime: jest.fn(function(container_type) {
            return 'application/ts+' + container_type;
        }),
        spec: spec,
        inspect: jest.fn(function(path) {
            return Promise.resolve(responses.shift());
        })
    }
};