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

const _ = require('lodash');

describe('Library', () => {
    var library;
    process.setMaxListeners(0);

    function alter(object, alteredKeys) {
        var alternate = _.clone(object);
        _.each(alteredKeys, function(value, index) {
            alternate[value] += ' Alt';
        });
        return alternate;
    }

    function testInsert(setter, getter, insertObject, setterExtraArgs, getterExtraArgs, cleanArgs) {
        var object = _.clone(insertObject);
        setterExtraArgs = setterExtraArgs || [];
        getterExtraArgs = getterExtraArgs || [];
        cleanArgs = cleanArgs || [];

        var fun = library[setter];
        setterExtraArgs.unshift(object);
        var id = fun.apply(null, setterExtraArgs);
        expect(id > 0).toBeTruthy();

        getterExtraArgs.push(object.slug);
        var result = library.getters[getter].apply(null, getterExtraArgs);
        expect(result).not.toEqual(null);
        expect(result.id).toEqual(id);
        delete result.id;

        // clean objects before comparison
        _.each(cleanArgs, function(value, index) {
            delete result[value];
        });
        _.each(cleanArgs, function(value, index) {
            delete object[value];
        });
        expect(result).toEqual(object);
    }

    function testUpdate(setter, getter, insertObject, updateObject, setterExtraArgs, getterExtraArgs, cleanArgs) {
        setterExtraArgs = setterExtraArgs || [];
        getterExtraArgs = getterExtraArgs || [];
        cleanArgs = cleanArgs || [];

        var fun = library[setter];
        setterExtraArgs.unshift(insertObject);
        var id = fun.apply(null, setterExtraArgs);
        expect(id > 0).toBeTruthy();

        // update
        setterExtraArgs.shift();
        setterExtraArgs.unshift(updateObject);
        fun.apply(null, setterExtraArgs);

        getterExtraArgs.push(insertObject.slug);
        var result = library.getters[getter].apply(null, getterExtraArgs);
        expect(result.id).toEqual(id);
        delete result.id;

        // clean objects before comparison
        _.each(cleanArgs, function(value, index) {
            delete result[value];
        });
        _.each(cleanArgs, function(value, index) {
            delete insertObject[value];
        });
        _.each(cleanArgs, function(value, index) {
            delete updateObject[value];
        });
        expect(result).toEqual(updateObject);
        expect(result).not.toEqual(insertObject);
        expect(result.slug).toEqual(insertObject.slug);
    }

    function testIncomplete(setter, object, setterExtraArgs) {
        setterExtraArgs = setterExtraArgs || [];

        var fun = library[setter];
        setterExtraArgs.unshift(object);
        var error = null;
        try {
            var id = fun.apply(null, setterExtraArgs);
            expect(id).toEqual(-1);
        } catch (e) {
            error = e;
        }
        expect(error).not.toEqual(null);
    }

    function testMissing(getter, getterArgs) {
        var result = library.getters[getter].apply(null, getterArgs);
        expect(result).toEqual(null);
    }


    describe('Languages', () => {
        beforeEach(() => {
            var rimraf = require('rimraf');
            rimraf.sync(config.dbPath);
            var Library = require('../lib/library');
            var SqliteHelper = require('../lib/sqlite-helper');
            library = new Library(new SqliteHelper(config.schemaPath, config.dbPath));
        });

        describe('SourceLanguage', () => {
            var language;
            var languageAlt;

            beforeEach(() => {
                language = {
                    slug: 'en',
                    name: 'English',
                    direction: 'ltr'
                };
                languageAlt = alter(language, ['name']);
            });

            it('should add a source language to the database', () => {
                testInsert('addSourceLanguage', 'getSourceLanguage', language);
            });

            it('should update a source language in the database', () => {
                testUpdate('addSourceLanguage', 'getSourceLanguage', language, languageAlt);
            });

            it('should not add incomplete source language to the database', () => {
                delete language.name;
                testIncomplete('addSourceLanguage', language);
            });

            it('it should return null for a missing source language', () => {
                testMissing('getSourceLanguage', ['missing-lang']);
            });
        });

        describe('TargetLanguage', () => {
            var language;
            var languageAlt;

            beforeEach(() => {
                language = {
                    slug: 'en',
                    name: 'English',
                    anglicized_name: 'English',
                    direction: 'ltr',
                    region: 'United States',
                    is_gateway_language: 1
                };
                languageAlt = alter(language, ['name', 'anglicized_name', 'region']);
            });

            it('should add a target language to the database', () => {
                testInsert('addTargetLanguage', 'getTargetLanguage', language);
            });

            it('should update a target language in the database', () => {
                testUpdate('addTargetLanguage', 'getTargetLanguage', language, languageAlt);
            });

            it('should not add incomplete target language to the database', () => {
                delete language.name;
                testIncomplete('addTargetLanguage', language);
            });

            it('it should return null for a missing target language', () => {
                testMissing('getTargetLanguage', ['missing-lang']);
            });
        });
    });

    describe('Projects', () => {
        var source_language;
        var project;
        var projectAlt;


        beforeEach(() => {
            var rimraf = require('rimraf');
            rimraf.sync(config.dbPath);
            var Library = require('../lib/library');
            var SqliteHelper = require('../lib/sqlite-helper');
            library = new Library(new SqliteHelper(config.schemaPath, config.dbPath));

            source_language = {
                slug: 'en',
                name: 'English',
                direction: 'ltr'
            };
            source_language.id = library.addSourceLanguage(source_language);
            project = {
                slug: 'gen',
                name: 'Genesis',
                desc: 'The book of Genesis',
                icon: '',
                sort: 1,
                chunks_url: 'https://api.unfoldingword.org/bible/txt/1/gen/chunks.json',
                categories: [{
                    name: 'Old Testament',
                    slug: 'bible-ot'
                }],
                source_language_slug: source_language.slug,
                source_language_id: source_language.id
            };
            projectAlt = alter(project, ['name', 'desc', 'icon', 'chunks_url']);
        });

        it('should add a project to the database', () => {
            testInsert('addProject', 'getProject', project,
                [source_language.id], [source_language.slug],
                ['id', 'category_id', 'categories']);
        });

        it('should update a project in the database', () => {
            testUpdate('addProject', 'getProject', project, projectAlt,
                [source_language.id], [source_language.slug],
                ['id', 'category_id', 'categories']);
        });

        it('should not add incomplete project to the database', () => {
            delete project.name;
            testIncomplete('addProject', project, [source_language.id]);
        });

        it('it should return null for a missing project', () => {
            testMissing('getProject', [source_language.slug, 'missing-proj']);
            testMissing('getProject', ['missing-lang', 'missing-proj']);
        });

    });
});