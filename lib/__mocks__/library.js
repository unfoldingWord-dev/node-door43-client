'use strict';

var __sourceLanguageMarker = 0;
var __targetLanguageMarker = 0;
var __projectMarker = 0;
var __catalogMarker = 0;
var __resourceMarker = 0;

var response;

var library = {
    set __setResponse (data) {
        response = data;
    },

    addSourceLanguage: jest.fn(function(language) {
        __sourceLanguageMarker ++;
        return __sourceLanguageMarker;
    }),
    addTargetLanguage: jest.fn(function(language) {
        __targetLanguageMarker ++;
        return __targetLanguageMarker;
    }),
    addProject: jest.fn(function(project, source_language_id) {
        __projectMarker ++;
        return __projectMarker;
    }),
    addCatalog: jest.fn(function(catalog) {
        __catalogMarker ++;
        return __catalogMarker;
    }),
    addResource: jest.fn(function(resource, project_id) {
        __resourceMarker ++;
        return __resourceMarker;
    }),
    getters: {
        getSourceLanguage: jest.fn(function(slug) {
            return response;
        }),
        getSourceLanguages: jest.fn(function() {
            return response;
        }),
        getTargetLanguage: jest.fn(function(slug) {
            return response;
        }),
        getTargetLanguages: jest.fn(function() {
            return response;
        }),
        getProject: jest.fn(function(languageSlug, projectSlug) {
            return response;
        }),
        getProjects: jest.fn(function(languageSlug) {
            return response;
        }),
        getResource: jest.fn(function(languageSlug, projectSlug, resourceSlug) {
            return response;
        }),
        getResources: jest.fn(function(languageSlug, projectSlug) {
            return response;
        }),
        getCatalog: jest.fn(function(slug) {
            return response;
        }),
        getCatalogs: jest.fn(function() {
            return response;
        })
    }
};

module.exports = function(sqliteHelper) {
    return library;
};