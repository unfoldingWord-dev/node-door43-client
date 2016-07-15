'use strict';

jest.unmock('rimraf');
jest.unmock('lodash');
jest.unmock('sql.js');
jest.unmock('fs');
jest.unmock('mkdirp');
jest.unmock('path');
jest.unmock('../lib/sqlite-helper');
jest.unmock('../lib/library');

const config = {
    schemaPath: './lib/schema.sqlite',
    dbPath: './out/test.sqlite'
};

describe('Library', () => {
    var library;

    beforeEach(() => {
        var rimraf = require('rimraf');
        rimraf.sync(config.dbPath);
        var Library = require('../lib/library');
        var SqliteHelper = require('../lib/sqlite-helper');
        library = new Library(new SqliteHelper(config.schemaPath, config.dbPath));
    });

    it('should add a source language to the database', () => {
        var expectedLanguage = {
            slug: 'en',
            name: 'English',
            direction: 'ltr'
        };
        library.addSourceLanguage(expectedLanguage);

        var language = library.getters.getSourceLanguage(expectedLanguage.slug);

        delete language.id;
        expect(language).toEqual(expectedLanguage);
    });

    it('should update a source language in the database', () => {
        var expectedLanguage = {
            slug: 'en',
            name: 'English',
            direction: 'ltr'
        };
        var languageId = library.addSourceLanguage({
            slug: 'en',
            name: 'Original English',
            direction: 'rtl'
        });
        library.addSourceLanguage(expectedLanguage);

        var language = library.getters.getSourceLanguage(expectedLanguage.slug);
        expect(language.id).toEqual(languageId);

        delete language.id;
        expect(language).toEqual(expectedLanguage);
    });

    it('should not add incomplete source language to the database', () => {
        var language = {
            slug: 'en',
            // name: 'English',
            direction: 'ltr'
        };
        var error = null;
        try {
            library.addSourceLanguage(language);
        } catch (e) {
            error = e;
        }
        expect(error).not.toEqual(null);
    });

    it('should add a target language to the database', () => {
        var expectedLanguage = {
            slug: 'en',
            name: 'English',
            anglicized_name: 'English',
            direction: 'ltr',
            region: 'United States',
            is_gateway_language: 1
        };
        library.addTargetLanguage(expectedLanguage);

        var language = library.getters.getTargetLanguage('en');

        delete language.id;
        expect(language).toEqual(expectedLanguage);
    });

    it('should update a target language in the database', () => {
        var expectedLanguage = {
            slug: 'en',
            name: 'English',
            anglicized_name: 'English',
            direction: 'ltr',
            region: 'United States',
            is_gateway_language: 1
        };
        var languageId = library.addTargetLanguage({
            slug: 'en',
            name: 'Old English',
            anglicized_name: 'Some other English',
            direction: 'rtl',
            region: 'United States 1',
            is_gateway_language: 0
        });
        library.addTargetLanguage(expectedLanguage);

        var language = library.getters.getTargetLanguage('en');
        expect(language.id).toEqual(languageId);

        delete language.id;
        expect(language).toEqual(expectedLanguage);
    });

    it('should not add incomplete target language to the database', () => {
        var language = {
            slug: 'en',
            // name: 'English',
            anglicized_name: 'English',
            direction: 'ltr',
            region: 'United States',
            is_gateway_language: 1
        };
        var error = null;
        try {
            library.addTargetLanguage(language);
        } catch (e) {
            error = e;
        }
        expect(error).not.toEqual(null);
    });
});