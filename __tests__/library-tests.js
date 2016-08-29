'use strict';

jest.unmock('lodash');
jest.unmock('sql.js');
jest.unmock('../lib/library');

const config = {
    schemaPath: './lib/schema.sqlite',
    dbPath: null
};

const _ = require('lodash');

describe('Library', () => {
    var library;
    process.setMaxListeners(0);

    function setUpContext() {
        var Library = require('../lib/library');
        var realfs = require.requireActual('fs');
        var schema = realfs.readFileSync(config.schemaPath);
        var fs = require('fs');
        fs.writeFileSync(config.schemaPath, schema);
        var SqliteHelper = require('../lib/sqlite-helper');
        library = new Library(new SqliteHelper(config.schemaPath, config.dbPath));
    }

    function alter(object, alteredKeys) {
        var alternate = _.clone(object);
        _.each(alteredKeys, function(value, index) {
            alternate[value] += '-alt';
        });
        return alternate;
    }

    /**
     *
     * @param setter
     * @param getter
     * @param insertObject
     * @param setterExtraArgs
     * @param getterExtraArgs
     * @param cleanArgs
     */
    function testInsert(setter, getter, insertObject, setterExtraArgs, getterExtraArgs, cleanArgs) {
        var object = _.clone(insertObject);
        setterExtraArgs = setterExtraArgs || [];
        getterExtraArgs = getterExtraArgs || [];
        cleanArgs = cleanArgs || [];

        var fun = library[setter];
        setterExtraArgs.unshift(object);
        var id = fun.apply(null, setterExtraArgs);
        expect(id).toBeTruthy();

        getterExtraArgs.push(object.slug);
        var result = library.public_getters[getter].apply(null, getterExtraArgs);
        expect(result).not.toEqual(null);
        if(result.id) {
            expect(result.id).toEqual(id);
            delete result.id;
        }

        // clean objects before comparison
        _.each(cleanArgs, function(value, index) {
            delete result[value];
        });
        _.each(cleanArgs, function(value, index) {
            delete object[value];
        });
        expect(result).toEqual(object);
    }

    /**
     *
     * @param setter
     * @param getter
     * @param insertObject
     * @param updateObject
     * @param setterExtraArgs
     * @param getterExtraArgs
     * @param cleanArgs
     */
    function testUpdate(setter, getter, insertObject, updateObject, setterExtraArgs, getterExtraArgs, cleanArgs) {
        setterExtraArgs = setterExtraArgs || [];
        getterExtraArgs = getterExtraArgs || [];
        cleanArgs = cleanArgs || [];

        var fun = library[setter];
        setterExtraArgs.unshift(insertObject);
        var id = fun.apply(null, setterExtraArgs);
        expect(id).toBeTruthy();

        // update
        setterExtraArgs.shift();
        setterExtraArgs.unshift(updateObject);
        var updatedId = fun.apply(null, setterExtraArgs);
        expect(updatedId).toEqual(id);

        getterExtraArgs.push(insertObject.slug);
        var result = library.public_getters[getter].apply(null, getterExtraArgs);
        if(result.id) {
            expect(result.id).toEqual(id);
            delete result.id;
        }

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
            expect(id).not.toBeTruthy();
        } catch (e) {
            error = e;
        }
        expect(error).not.toEqual(null);
    }

    function testMissing(getter, getterArgs) {
        var result = library.public_getters[getter].apply(null, getterArgs);
        expect(result).toEqual(null);
    }

    function testMultiple(setter, getterMultiple, object, setterExtraArgs, getterArgs) {
        var objectAlt = alter(object, ['slug']);
        setterExtraArgs = setterExtraArgs || [];

        var fun = library[setter];

        // add first
        setterExtraArgs.unshift(object);
        var firstId = fun.apply(null, setterExtraArgs);
        expect(firstId > 0).toBeTruthy();

        // add second
        setterExtraArgs.shift();
        setterExtraArgs.unshift(objectAlt);
        var secondId = fun.apply(null, setterExtraArgs);
        expect(secondId).toBeTruthy();

        if(typeof secondId !== 'boolean') {
            expect(secondId).not.toEqual(firstId);
        }

        var result = library.public_getters[getterMultiple].apply(null, getterArgs);
        expect(result.length).toBeTruthy();
    }

    describe('SourceLanguage', () => {
        var language;
        var languageAlt;

        beforeEach(() => {
            setUpContext();
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

        it('should return null for a missing source language', () => {
            testMissing('getSourceLanguage', ['missing-lang']);
        });

        it('should return multiple source languages', () => {
           testMultiple('addSourceLanguage', 'getSourceLanguages', language);
        });
    });

    describe('TargetLanguage', () => {
        var language;
        var languageAlt;

        beforeEach(() => {
            setUpContext();
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

        it('should return multiple target languages', () => {
            testMultiple('addTargetLanguage', 'getTargetLanguages', language);
        });
    });

    describe('Temporary TargetLanguage', () => {
        var language;
        var languageAlt;

        beforeEach(() => {
            setUpContext();
            language = {
                slug: 'en',
                name: 'English',
                anglicized_name: 'American English',
                direction: 'ltr',
                region: 'United States',
                is_gateway_language: 0
            };
            languageAlt = alter(language, ['name', 'region']);
        });

        it('should add a temporary target language to the database', () => {
            testInsert('addTempTargetLanguage', 'getTargetLanguage', language);
        });

        it('should update a temporary target language in the database', () => {
            testUpdate('addTempTargetLanguage', 'getTargetLanguage', language, languageAlt);
        });

        it('should not add incomplete temporary target language to the database', () => {
            delete language.name;
            testIncomplete('addTempTargetLanguage', language);
        });

        // tested in target language tests
        // it('it should return null for a missing temporary target language', () => {
        //     testMissing('getTargetLanguage', ['missing-lang']);
        // });

        it('should return multiple temporary target languages', () => {
            testMultiple('addTempTargetLanguage', 'getTargetLanguages', language);
        });
    });

    describe('Approved Temporary TargetLanguage', () => {
        var language;
        var tempLanguage;

        beforeEach(() => {
            setUpContext();
            language = {
                slug: 'en',
                name: 'English',
                anglicized_name: 'American English',
                direction: 'ltr',
                region: 'United States',
                is_gateway_language: 0
            };
            tempLanguage = {
                slug: 'temp-en',
                name: 'Temp English',
                anglicized_name: 'American English',
                direction: 'ltr',
                region: 'United States',
                is_gateway_language: 0
            };
            if(!library.addTargetLanguage(language)) throw new Error('Failed to setup target language');
            if(!library.addTempTargetLanguage(tempLanguage)) throw new Error('Failed to setup temp target language');
        });

        it('should assign the approved target language to a temporary target language', () => {
            var success = library.setApprovedTargetLanguage(tempLanguage.slug, language.slug);
            expect(success).toBeTruthy();
            var result = library.public_getters.getApprovedTargetLanguage(tempLanguage.slug);
            delete result.id;
            expect(result).toEqual(language);
        });
    });

    describe('Projects', () => {
        var source_language;
        var project;
        var projectAlt;


        beforeEach(() => {
            setUpContext();

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

        it('should return multiple projects', () => {
            testMultiple('addProject', 'getProjects', project,
                [source_language.id], [source_language.slug]);
        });
    });

    describe('Resources', () => {
        var source_language;
        var project;
        var resource;
        var resourceAlt;

        beforeEach(() => {
            setUpContext();

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
            project.id = library.addProject(project, source_language.id);
            resource = {
                slug: 'ulb',
                name: 'Unlocked Literal Bible',
                status: {
                    translate_mode: 'gl',
                    checking_level: '3',
                    comments: 'this is a comment',
                    pub_date: '2015-12-17',
                    license: 'CC BY-SA',
                    version: '3.0'
                },
                formats: [{
                    package_version: '1.0',
                    mime_type: 'application/ts+book',
                    modified_at: 20151222120130,
                    url: 'https://api.unfoldingword.org/ts/txt/2/gen/en/ulb/source.json'
                }],
                project_id: project.id,
                project_slug: project.slug,
                source_language_slug: source_language.slug
            };
            resourceAlt = alter(resource, ['name']);
        });

        it('should add a resource to the database', () => {
            testInsert('addResource', 'getResource', resource,
                [project.id], [source_language.slug, project.slug],
                ['id']);
        });

        it('should update a resource in the database', () => {
            testUpdate('addResource', 'getResource', resource, resourceAlt,
                [source_language.id, project.id], [source_language.slug, project.slug],
                ['id']);
        });

        it('should not add incomplete resource to the database', () => {
            delete resource.name;
            testIncomplete('addResource', resource, [source_language.id, project.id]);
        });

        it('it should return null for a missing resource', () => {
            testMissing('getResource', [source_language.slug, project.slug, 'missing-res']);
            testMissing('getResource', [source_language.slug, 'missing-proj', 'missing-res']);
            testMissing('getResource', ['missing-lang', 'missing-proj', 'missing-res']);
        });

        it('should return multiple resources', () => {
            testMultiple('addResource', 'getResources', resource,
                [project.id], [source_language.slug, project.slug]);
        });
    });

    describe('Catalogs', () => {
        var catalog;
        var catalogAlt;

        beforeEach(() => {
            setUpContext();

            catalog = {
                slug: 'langnames',
                url: 'td.unfoldingword.org/exports/langnames.json',
                modified_at: 20141222120130
            };
            catalogAlt = alter(catalog, ['url']);
        });

        it('should add a catalog to the database', () => {
            testInsert('addCatalog', 'getCatalog', catalog);
        });

        it('should update a catalog in the database', () => {
            testUpdate('addCatalog', 'getCatalog', catalog, catalogAlt);
        });

        it('should not add incomplete catalog to the database', () => {
            delete catalog.url;
            testIncomplete('addCatalog', catalog);
        });

        it('should return null for a missing catalog', () => {
            testMissing('getCatalog', ['missing-cat']);
        });

        it('should return multiple catalogs', () => {
            testMultiple('addCatalog', 'getCatalogs', catalog);
        });
    });

    describe('Versification', () => {
        var versification;
        var versificationAlt;
        var enLang;
        var deLang;

        beforeEach(() => {
            setUpContext();
            versification = {
                slug: 'en-US',
                name: 'American English'
            };
            versificationAlt = alter(versification, ['name']);
            enLang = {
                slug: 'en',
                name: 'English',
                direction: 'ltr'
            };
            deLang = {
                slug: 'de',
                name: 'Deutsch',
                direction: 'ltr'
            };
            enLang.id = library.addSourceLanguage(enLang);
            deLang.id = library.addSourceLanguage(deLang);
        });

        it('should add a versification to the database', () => {
            testInsert('addVersification', 'getVersification', versification, [enLang.id], [enLang.slug]);
        });

        it('should update a versification in the database', () => {
            testUpdate('addVersification', 'getVersification', versification, versificationAlt, [enLang.id], [enLang.slug])
        });

        it('should not add incomplete versification to the database', () => {
            delete versification.name;
            testIncomplete('addVersification', versification, [enLang.id]);
        });

        it('should return null for a missing versification', () => {
            testMissing('getVersification', ['missing-lang', 'missing-ver']);
        });

        it('should return multiple versifications', () => {
            testMultiple('addVersification', 'getVersifications', versification, [enLang.id], [enLang.slug]);
        });
    });

    describe('ChunkMarker', () => {
        var chunk;
        var chunkAlt;
        var versification;
        var project;

        beforeEach(() => {
            setUpContext();
            project = {
                slug: 'gen',
                name: 'Genesis',
                sort: 1
            };
            chunk = {
                chapter: '01',
                verse: '01',
                project_slug: project.slug
            };
            chunkAlt = alter(chunk, ['verse']);
            versification = {
                slug: 'en-US',
                name: 'American English'
            };
            var langId = library.addSourceLanguage({
                slug: 'en',
                name: 'English',
                direction: 'ltr'
            });
            project.id = library.addProject(project, langId);
            versification.id = library.addVersification(versification, langId);

            /**
             * TRICKY: there is no sensible way to retrieve a single chunk marker
             * so it's not part of the library but we add this utility just for testing
             *
             */
            library.public_getters.getChunkMarker = function(projectSlug, versificationSlug) {
                var chunks = library.public_getters.getChunkMarkers(projectSlug, versificationSlug);
                if(chunks.length > 0) {
                    return chunks[0];
                }
                return null;
            }
        });

        it('should add a chunk marker to the database', () => {
            testInsert('addChunkMarker', 'getChunkMarker', chunk, [project.slug, versification.id],
                [project.slug, versification.slug], ['versification_id', 'project_id']);
        });

        it('should not add incomplete chunk marker to the database', () => {
            delete chunk.chapter;
            testIncomplete('addChunkMarker', chunk, [project.slug, versification.id]);
        });

        it('should return null for a missing chunk marker', () => {
            testMissing('getChunkMarker', ['missing-ver', 'missing-proj']);
        });

        it('should return multiple chunk markers', () => {
            let firstId = library.addChunkMarker(chunk, project.slug, versification.id);
            expect(firstId > 0).toBeTruthy();
            let secondId = library.addChunkMarker(chunkAlt, project.slug, versification.id);
            expect(secondId > 0).toBeTruthy();

            expect(secondId).not.toEqual(firstId);
            let result = library.public_getters.getChunkMarkers(project.slug, versification.slug);
            expect(result.length).toEqual(2);
        });
    });

    describe('Questionnaire', () => {
        var questionnaire;
        var questionnaireAlt;

        beforeEach(() => {
            setUpContext();
            questionnaire = {
                language_slug: 'en',
                language_name: 'English',
                language_direction: 'ltr',
                td_id: 1
            };
            questionnaireAlt = alter(questionnaire, ['language_slug', 'language_name']);
            questionnaireAlt.td_id = 2;
        });

        it('should add a questionnaire to the database', () => {
            testInsert('addResource', 'getResource', resource,
                [project.id], [source_language.slug, project.slug],
                ['id']);
        });

        it('should update a questionnaire in the database', () => {
            testUpdate('addResource', 'getResource', resource, resourceAlt,
                [source_language.id, project.id], [source_language.slug, project.slug],
                ['id']);
        });

        it('should not add incomplete questionnaire to the database', () => {
            delete resource.name;
            testIncomplete('addResource', resource, [source_language.id, project.id]);
        });

        it('it should return null for a missing questionnaire', () => {
            testMissing('getResource', [source_language.slug, project.slug, 'missing-res']);
            testMissing('getResource', [source_language.slug, 'missing-proj', 'missing-res']);
            testMissing('getResource', ['missing-lang', 'missing-proj', 'missing-res']);
        });

        it('should return multiple questionnaires', () => {
            testMultiple('addResource', 'getResources', resource,
                [project.id], [source_language.slug, project.slug]);
        });
    });
});