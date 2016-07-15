'use strict';

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
        const fs = require('fs');
        if(fs.exists(config.dbPath)) {
            fs.unlink(config.dbPath);
        }
        var Library = require('../lib/library');
        var SqliteHelper = require('../lib/sqlite-helper');
        library = new Library(new SqliteHelper(config.schemaPath, config.dbPath));
    });

    it('should add a source language to the database', () => {
        var expectedLanguage = {
            slug: 'en',
            name: 'English',
            dir: 'ltr'
        };
        library.addSourceLanguage(expectedLanguage);

        var language = library.getters.getSourceLanguage('slug');

        expect(language.name).toEqual(expectedLanguage.name);
        expect(language.slug).toEqual(expectedLanguage.slug);
        expect(language.direction).toEqual(expectedLanguage.dir);
    });

    it('should update a source language in the database', () => {
        var expectedLanguage = {
            slug: 'en',
            name: 'English',
            dir: 'ltr'
        };
        library.addSourceLanguage({
            slug: 'en',
            name: 'Original English',
            dir: 'rtl'
        });
        library.addSourceLanguage(expectedLanguage);

        var language = library.getters.getSourceLanguage('slug');

        expect(language.name).toEqual(expectedLanguage.name);
        expect(language.slug).toEqual(expectedLanguage.slug);
        expect(language.direction).toEqual(expectedLanguage.dir);
    });
});