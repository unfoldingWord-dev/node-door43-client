'use strict';

jest.unmock('fs');
jest.unmock('mkdirp');
jest.unmock('rimraf');
jest.unmock('../lib/utils/promises');
jest.unmock('../lib/utils/files');
jest.unmock('../lib/main');
jest.unmock('yamljs');
jest.unmock('lodash');
jest.unmock('path');

const path = require('path');
const rimraf = require('rimraf');
const mkdirp = require('mkdirp');
const fileUtils = require('../lib/utils/files');

const config = {
    schemaPath: path.normalize(path.join(__dirname, '../lib/schema.sqlite')),
    dbPath: './out/test.client.sqlite',
    resDir: './out/test.res.client/',
    catalogUrl: 'https://api.unfoldingword.org/ts/txt/2/catalog.json'
};

describe('Client', () => {
    var client, request, library;

    beforeEach(() => {
        rimraf.sync(config.dbPath);
        rimraf.sync(config.resDir);
        var Client = require('../');
        client = new Client(config.dbPath, config.resDir);
        var Library = require('../lib/library');
        library = new Library(null);
        request = require('../lib/request');
    });

    it('should index the questionnaires', () => {
        // TODO: write tests for indexing
    });

    it('should index the target languages', () => {
        // TODO: write tests for indexing
    });

    it('should index the temporary target languages', () => {
        // TODO: write tests for indexing
    });

    it('should index the approved temporary target languages', () => {
        // TODO: write tests for indexing
    });

    it('should index the Door43 catalog', () => {
        request.__setStatusCode = 200;
        request.__queueResponse = JSON.stringify([
            {
                date_modified: "20160620",
                lang_catalog: "https://api.unfoldingword.org/ts/txt/2/1ch/languages.json?date_modified=20160620",
                meta: [
                    "bible-ot"
                ],
                slug: "1ch",
                sort: "13"
            }
        ]);
        request.__queueResponse = JSON.stringify([
            {
                language: {
                    date_modified: "20160614",
                    direction: "ltr",
                    name: "English",
                    slug: "en"
                },
                project: {
                    desc: "",
                    meta: [
                        "Bible: OT"
                    ],
                    name: "1 Chronicles",
                    sort: "13"
                },
                res_catalog: "https://api.unfoldingword.org/ts/txt/2/1ch/en/resources.json?date_modified=20160614"
            }
        ]);
        // request.__queueResponse = '[{"chp": "01", "firstvs": "01"}, {"chp": "01", "firstvs": "05"}, {"chp": "01", "firstvs": "08"}]';
        request.__queueResponse = JSON.stringify([
            {
                checking_questions: "https://api.unfoldingword.org/ts/txt/2/1ch/en/questions.json?date_modified=20160504",
                date_modified: "20160614",
                name: "Unlocked Literal Bible",
                notes: "https://api.unfoldingword.org/ts/txt/2/1ch/en/notes.json?date_modified=20160504",
                slug: "ulb",
                source: "https://api.unfoldingword.org/ts/txt/2/1ch/en/ulb/source.json?date_modified=20160614",
                status: {
                    checking_entity: "Wycliffe Associates",
                    checking_level: "3",
                    comments: "Original source text",
                    contributors: "Wycliffe Associates",
                    publish_date: "20160614",
                    source_text: "en",
                    source_text_version: "5",
                    version: "5"
                },
                terms: "https://api.unfoldingword.org/ts/txt/2/bible/en/terms.json?date_modified=20160504",
                tw_cat: "https://api.unfoldingword.org/ts/txt/2/1ch/en/tw_cat.json?date_modified=20160504",
                usfm: "https://api.unfoldingword.org/ulb/txt/1/ulb-en/13-1CH.usfm?date_modified=20160614"
            }
        ]);
        library.__queueResponse = JSON.stringify({
            name: 'American English',
            slug: 'en-US',
            id: 1
        });

        return client.updatePrimaryIndex(config.catalogUrl)
            .then(() => {
                expect(library.addProject.mock.calls.length).toEqual(2); // project, words
                expect(library.addSourceLanguage.mock.calls.length).toEqual(1);
                expect(library.addVersification.mock.calls.length).toEqual(1); // versification
                // expect(library.addChunkMarker.mock.calls.length).toEqual(3); // chunks
                expect(library.addResource.mock.calls.length).toEqual(4); // content, notes, questions, words
            })
            .catch(function(err) {
                throw err;
            });
    });

    it('should fail to index the Door43 catalog', () => {
        request.__setStatusCode = 400;
        return client.updatePrimaryIndex(config.catalogUrl)
            .then(() => {
                throw new Error();
            })
            .catch(function(err) {
                expect(err.status).toEqual(400);
                expect(library.addProject.mock.calls.length).toEqual(0);
                expect(library.addSourceLanguage.mock.calls.length).toEqual(0);
                expect(library.addResource.mock.calls.length).toEqual(0);
            });
    });

    it('should download a global catalog', () => {
        library.__queueResponse = {
            slug: 'langnames',
            url: 'http://td.unfoldingword.org/exports/langnames.json',
            modified_at: 0,
            id: 1
        };
        request.__queueResponse = JSON.stringify([
            {
                ang: "Afar",
                pk: 6,
                lr: "Africa",
                ln: "Afaraf",
                cc: [
                    "DJ",
                    "ER",
                    "ET",
                    "US",
                    "CA"
                ],
                ld: "ltr",
                gw: false,
                lc: "aa",
                alt: [
                    "Afaraf",
                    "Danakil",
                    "Denkel",
                    "Adal",
                    "Afar Af",
                    "Qafar",
                    "Baadu (Ba'adu)"
                ]
            },
            {
                ang: "Ghotuo",
                pk: 7,
                lr: "Africa",
                ln: "Ghotuo",
                cc: [
                    "NG"
                ],
                ld: "ltr",
                gw: false,
                lc: "aaa",
                alt: [ ]
            }
        ]);
        return client.updateCatalogIndex('langnames')
            .then(() => {
                expect(library.addTargetLanguage.mock.calls.length).toEqual(2);
            })
            .catch(function(err) {
                throw err;
            });

    });

    it('should not download a missing global catalog', () => {
        library.__queueResponse = null;

        return client.updateCatalogIndex('langnames')
            .then(() => {
                expect(library.addTargetLanguage.mock.calls.length).toEqual(0);
            })
            .catch(function(err) {
                expect(err.message).toEqual('Unknown catalog');
            });

    });

    it('should fail to download a global catalog', () => {
        library.__queueResponse = {
            slug: 'langnames',
            url: 'http://td.unfoldingword.org/exports/langnames.json',
            modified_at: 0,
            id: 1
        };
        request.__setStatusCode = 400;

        return client.updateCatalogIndex('langnames')
            .then(() => {
                expect(library.addTargetLanguage.mock.calls.length).toEqual(0);
            })
            .catch(function(err) {
                expect(err.status).toEqual(400);
            });

    });

    it('should download a resource container', () => {
        let fs = require('fs');
        let archiveDir = path.join(config.resDir, 'en_obs_obs');
        let archiveFile = archiveDir + '.tsrc';
        fs.writeFileSync(archiveFile, 'some file');
        mkdirp(archiveDir);

        expect(fileUtils.fileExists(archiveFile)).toBeTruthy();
        expect(fileUtils.fileExists(archiveDir)).toBeTruthy();

        library.__queueResponse = {
            id: 1,
            slug: 'obs',
            formats: [
                {
                    syntax_version: '1.0',
                    mime_type: 'application/tsrc+book',
                    modified_at: 0,
                    url: 'some/url',
                }
            ]
        };


        return client.legacy_tools.downloadFutureCompatibleResourceContainer('en', 'obs', 'obs')
            .then(() => {
                expect(request.download.mock.calls.length).toEqual(1);
                expect(fileUtils.fileExists(archiveFile)).toBeTruthy();
                expect(fileUtils.fileExists(archiveDir)).not.toBeTruthy();
                expect(fileUtils.fileExists(path.join(config.resDir, 'en_obs_obs.tsrc'))).toBeTruthy();
                expect(fileUtils.fileExists(path.join(config.resDir, 'en_obs_obs'))).not.toBeTruthy();
            })
            .catch(function(err) {
                throw err;
            });
    });


    it('should not download a missing resource container', () => {
        library.__queueResponse = null;

        return client.legacy_tools.downloadFutureCompatibleResourceContainer('en', 'obs', 'obs')
            .then(() => {
                throw Error();
            })
            .catch(function(err) {
                expect(err.message).toEqual('Unknown resource');
                expect(request.download.mock.calls.length).toEqual(0);
                expect(fileUtils.fileExists(path.join(config.resDir, 'en_obs_obs.tsrc'))).not.toBeTruthy();
            });
    });

    it('should not download a missing resource container format', () => {
        library.__queueResponse = {
            id: 1,
            slug: 'obs',
            type: 'book',
            formats: [
                {
                    syntax_version: '1.0',
                    mime_type: 'pdf',
                    modified_at: 0,
                    url: 'some/url',
                }
            ]
        };

        return client.legacy_tools.downloadFutureCompatibleResourceContainer('en', 'obs', 'obs')
            .then(() => {
                throw Error();
            })
            .catch(function(err) {
                expect(err.message).toEqual('Missing resource container format');
                expect(request.download.mock.calls.length).toEqual(0);
                expect(fileUtils.fileExists(path.join(config.resDir, 'en_obs_obs.tsrc'))).not.toBeTruthy();
            });
    });

    it('should not download a resource container with no formats', () => {
        library.__queueResponse = {
            id: 1,
            slug: 'obs',
            formats: []
        };

        return client.legacy_tools.downloadFutureCompatibleResourceContainer('en', 'obs', 'obs')
            .then(() => {
                throw Error();
            })
            .catch(function(err) {
                expect(err.message).toEqual('Missing resource container format');
                expect(request.download.mock.calls.length).toEqual(0);
                expect(fileUtils.fileExists(path.join(config.resDir, 'en_obs_obs.tsrc'))).not.toBeTruthy();
            });
    });

    it('should fail downloading a resource container', () => {
        library.__queueResponse = {
            id: 1,
            slug: 'obs',
            formats: [
                {
                    syntax_version: '1.0',
                    mime_type: 'application/tsrc+book',
                    modified_at: 0,
                    url: 'some/url',
                }
            ]
        };
        request.__setStatusCode = 400;

        return client.legacy_tools.downloadFutureCompatibleResourceContainer('en', 'obs', 'obs')
            .then(() => {
                throw Error();
            })
            .catch(function(err) {
                expect(err.status).toEqual(400);
                expect(request.download.mock.calls.length).toEqual(1);
                expect(fileUtils.fileExists(path.join(config.resDir, 'en_obs_obs.tsrc'))).not.toBeTruthy();
            });
    });

    it('should build a resource container', () => {
        // TODO: this is deprecated and should be moved to the rc module.
        var fs = require('fs');

        library.__queueResponse = {
            id: 1,
            slug: 'en',
            name: 'English',
            direction: 'ltr'
        };
        library.__queueResponse = {
            id: 1,
            slug: 'obs',
            name: 'Open Bible Stories',
            desc: 'T',
            icon: '',
            sort: 0,
            chunks_url: '',
            categories: [],
            source_language_slug: 'en',
            source_language_id: 1
        };
        library.__queueResponse = {
            id: 1,
            slug: 'obs',
            name: 'Open Bible Stories',
            status: {
                translate_mode: 'all',
                checking_entity: [
                    'Wycliffe Associates'
                ],
                checking_level: '3',
                comments: 'this is a comment',
                contributors: [
                    'Wycliffe Associates'
                ],
                pub_date: '2015-12-17',
                license: 'CC BY-SA',
                checks_performed: [
                    'keyword',
                    'metaphor'
                ],
                source_translations: [
                    {
                        language_slug: 'en',
                        resource_slug: 'obs',
                        version: '3.0'
                    }
                ],
                version: '3.0'
            },
            formats: [{
                syntax_version: '1.0',
                mime_type: 'application/tsrc+book',
                modified_at: 20151222120130,
                url: 'https://api.unfoldingword.org/ts/txt/2/obs/en/obs/source.json'
            }],
            translation_words_assignments_url: 'https://api.unfoldingword.org/obs/txt/1/en/tw_cat-en.json?date_modified=20150924',
            project_id: 1,
            project_slug: 'obs',
            source_language_slug: 'en'
        };

        request.__queueResponse = JSON.stringify({"chapters": [{"frames": [{"id": "01", "items": [{"id": "god"}, {"id": "holyspirit"}]}, {"id": "02", "items": [{"id": "god"}, {"id": "good"}]}, {"id": "03", "items": [{"id": "god"}]}, {"id": "04", "items": [{"id": "god"}, {"id": "good"}]}, {"id": "05", "items": [{"id": "god"}, {"id": "good"}]}, {"id": "06", "items": [{"id": "god"}, {"id": "good"}]}, {"id": "07", "items": [{"id": "bless"}, {"id": "god"}, {"id": "good"}]}, {"id": "08", "items": [{"id": "god"}, {"id": "good"}]}, {"id": "09", "items": [{"id": "god"}]}, {"id": "10", "items": [{"id": "adam"}, {"id": "god"}, {"id": "life"}]}, {"id": "11", "items": [{"id": "adam"}, {"id": "death"}, {"id": "evil"}, {"id": "god"}, {"id": "good"}, {"id": "life"}]}, {"id": "12", "items": [{"id": "adam"}, {"id": "god"}, {"id": "good"}]}, {"id": "13", "items": [{"id": "adam"}, {"id": "god"}]}, {"id": "14", "items": [{"id": "adam"}]}, {"id": "15", "items": [{"id": "bless"}, {"id": "god"}, {"id": "good"}]}, {"id": "16", "items": [{"id": "bless"}, {"id": "god"}, {"id": "holy"}]}], "id": "01"}, {"frames": [{"id": "01", "items": [{"id": "adam"}, {"id": "god"}, {"id": "sin"}]}, {"id": "02", "items": [{"id": "god"}]}, {"id": "03", "items": [{"id": "death"}, {"id": "evil"}, {"id": "god"}, {"id": "good"}]}, {"id": "04", "items": [{"id": "death"}, {"id": "evil"}, {"id": "god"}, {"id": "good"}, {"id": "true"}]}, {"id": "05", "items": [{"id": "wise"}]}, {"id": "06", "items": []}, {"id": "07", "items": [{"id": "adam"}, {"id": "god"}]}, {"id": "08", "items": [{"id": "god"}]}, {"id": "09", "items": [{"id": "curse"}, {"id": "descendant"}, {"id": "god"}]}, {"id": "10", "items": [{"id": "god"}]}, {"id": "11", "items": [{"id": "adam"}, {"id": "curse"}, {"id": "death"}, {"id": "disobey"}, {"id": "eve"}, {"id": "god"}]}, {"id": "12", "items": [{"id": "adam"}, {"id": "angel"}, {"id": "eve"}, {"id": "evil"}, {"id": "god"}, {"id": "good"}, {"id": "life"}]}], "id": "02"}, {"frames": [{"id": "01", "items": [{"id": "god"}]}, {"id": "02", "items": [{"id": "god"}, {"id": "noah"}, {"id": "righteous"}]}, {"id": "03", "items": [{"id": "god"}, {"id": "noah"}]}, {"id": "04", "items": [{"id": "god"}, {"id": "noah"}, {"id": "obey"}]}, {"id": "05", "items": [{"id": "god"}, {"id": "noah"}]}, {"id": "06", "items": [{"id": "god"}, {"id": "noah"}, {"id": "sacrifice"}]}, {"id": "07", "items": []}, {"id": "08", "items": [{"id": "death"}]}, {"id": "09", "items": []}, {"id": "10", "items": [{"id": "noah"}]}, {"id": "11", "items": [{"id": "noah"}]}, {"id": "12", "items": [{"id": "noah"}]}, {"id": "13", "items": [{"id": "god"}, {"id": "noah"}]}, {"id": "14", "items": [{"id": "altar"}, {"id": "bless"}, {"id": "god"}, {"id": "noah"}, {"id": "sacrifice"}]}, {"id": "15", "items": [{"id": "curse"}, {"id": "evil"}, {"id": "god"}, {"id": "promise"}, {"id": "sin"}]}, {"id": "16", "items": [{"id": "god"}, {"id": "promise"}]}], "id": "03"}, {"frames": [{"id": "01", "items": [{"id": "god"}]}, {"id": "02", "items": [{"id": "evil"}, {"id": "god"}, {"id": "heaven"}, {"id": "proud"}, {"id": "sin"}]}, {"id": "03", "items": [{"id": "god"}]}, {"id": "04", "items": [{"id": "abraham"}, {"id": "bless"}, {"id": "curse"}, {"id": "god"}]}, {"id": "05", "items": [{"id": "abraham"}, {"id": "canaan"}, {"id": "god"}, {"id": "obey"}, {"id": "sarah"}, {"id": "servant"}]}, {"id": "06", "items": [{"id": "abraham"}, {"id": "canaan"}, {"id": "descendant"}, {"id": "god"}, {"id": "inherit"}]}, {"id": "07", "items": [{"id": "abraham"}, {"id": "bless"}, {"id": "god"}, {"id": "heaven"}, {"id": "priest"}]}, {"id": "08", "items": [{"id": "abraham"}, {"id": "believe"}, {"id": "descendant"}, {"id": "god"}, {"id": "promise"}, {"id": "righteous"}, {"id": "sarah"}, {"id": "son"}]}, {"id": "09", "items": [{"id": "abraham"}, {"id": "canaan"}, {"id": "covenant"}, {"id": "descendant"}, {"id": "god"}, {"id": "son"}]}], "id": "04"}, {"frames": [{"id": "01", "items": [{"id": "abraham"}, {"id": "canaan"}, {"id": "god"}, {"id": "hagar"}, {"id": "sarah"}, {"id": "servant"}]}, {"id": "02", "items": [{"id": "abraham"}, {"id": "god"}, {"id": "hagar"}, {"id": "ishmael"}, {"id": "sarah"}]}, {"id": "03", "items": [{"id": "abraham"}, {"id": "canaan"}, {"id": "circumcise"}, {"id": "covenant"}, {"id": "descendant"}, {"id": "god"}]}, {"id": "04", "items": [{"id": "abraham"}, {"id": "covenant"}, {"id": "god"}, {"id": "isaac"}, {"id": "ishmael"}, {"id": "promise"}, {"id": "sarah"}, {"id": "sarah"}, {"id": "son"}]}, {"id": "05", "items": [{"id": "abraham"}, {"id": "circumcise"}, {"id": "god"}, {"id": "isaac"}, {"id": "sarah"}, {"id": "son"}]}, {"id": "06", "items": [{"id": "abraham"}, {"id": "faith"}, {"id": "god"}, {"id": "isaac"}, {"id": "obey"}, {"id": "sacrifice"}, {"id": "son"}]}, {"id": "07", "items": [{"id": "abraham"}, {"id": "god"}, {"id": "isaac"}, {"id": "lamb"}, {"id": "sacrifice"}]}, {"id": "08", "items": [{"id": "abraham"}, {"id": "altar"}, {"id": "god"}, {"id": "isaac"}, {"id": "sacrifice"}, {"id": "son"}]}, {"id": "09", "items": [{"id": "abraham"}, {"id": "god"}, {"id": "isaac"}, {"id": "sacrifice"}]}, {"id": "10", "items": [{"id": "abraham"}, {"id": "bless"}, {"id": "descendant"}, {"id": "god"}, {"id": "obey"}, {"id": "promise"}, {"id": "son"}]}], "id": "05"}, {"frames": [{"id": "01", "items": [{"id": "abraham"}, {"id": "isaac"}, {"id": "servant"}, {"id": "son"}]}, {"id": "02", "items": [{"id": "abraham"}, {"id": "god"}, {"id": "rebekah"}, {"id": "servant"}]}, {"id": "03", "items": [{"id": "isaac"}, {"id": "rebekah"}, {"id": "servant"}]}, {"id": "04", "items": [{"id": "abraham"}, {"id": "covenant"}, {"id": "descendant"}, {"id": "god"}, {"id": "isaac"}, {"id": "promise"}, {"id": "rebekah"}]}, {"id": "05", "items": [{"id": "god"}, {"id": "isaac"}, {"id": "rebekah"}]}, {"id": "06", "items": [{"id": "god"}, {"id": "rebekah"}, {"id": "son"}]}, {"id": "07", "items": [{"id": "esau"}, {"id": "jacob"}, {"id": "rebekah"}, {"id": "son"}]}], "id": "06"}, {"frames": [{"id": "01", "items": [{"id": "esau"}, {"id": "isaac"}, {"id": "jacob"}, {"id": "rebekah"}]}, {"id": "02", "items": [{"id": "esau"}, {"id": "jacob"}]}, {"id": "03", "items": [{"id": "bless"}, {"id": "esau"}, {"id": "isaac"}, {"id": "jacob"}, {"id": "rebekah"}]}, {"id": "04", "items": [{"id": "bless"}, {"id": "esau"}, {"id": "isaac"}, {"id": "jacob"}]}, {"id": "05", "items": [{"id": "bless"}, {"id": "esau"}, {"id": "jacob"}]}, {"id": "06", "items": [{"id": "esau"}, {"id": "isaac"}, {"id": "jacob"}, {"id": "rebekah"}]}, {"id": "07", "items": [{"id": "god"}, {"id": "jacob"}, {"id": "rebekah"}]}, {"id": "08", "items": [{"id": "canaan"}, {"id": "jacob"}, {"id": "servant"}]}, {"id": "09", "items": [{"id": "esau"}, {"id": "jacob"}, {"id": "servant"}]}, {"id": "10", "items": [{"id": "abraham"}, {"id": "canaan"}, {"id": "covenant"}, {"id": "esau"}, {"id": "forgive"}, {"id": "god"}, {"id": "isaac"}, {"id": "jacob"}, {"id": "peace"}, {"id": "promise"}]}], "id": "07"}, {"frames": [{"id": "01", "items": [{"id": "jacob"}, {"id": "josephot"}]}, {"id": "02", "items": [{"id": "dream"}, {"id": "josephot"}, {"id": "servant"}]}, {"id": "03", "items": [{"id": "jacob"}, {"id": "josephot"}]}, {"id": "04", "items": [{"id": "bless"}, {"id": "egypt"}, {"id": "god"}, {"id": "josephot"}, {"id": "nileriver"}, {"id": "servant"}]}, {"id": "05", "items": [{"id": "bless"}, {"id": "faithful"}, {"id": "god"}, {"id": "josephot"}, {"id": "sin"}]}, {"id": "06", "items": [{"id": "dream"}, {"id": "egypt"}, {"id": "innocent"}, {"id": "josephot"}, {"id": "king"}, {"id": "pharaoh"}]}, {"id": "07", "items": [{"id": "dream"}, {"id": "god"}, {"id": "josephot"}, {"id": "pharaoh"}]}, {"id": "08", "items": [{"id": "egypt"}, {"id": "josephot"}, {"id": "pharaoh"}]}, {"id": "09", "items": [{"id": "josephot"}]}, {"id": "10", "items": [{"id": "canaan"}, {"id": "egypt"}, {"id": "jacob"}]}, {"id": "11", "items": [{"id": "egypt"}, {"id": "jacob"}, {"id": "josephot"}]}, {"id": "12", "items": [{"id": "egypt"}, {"id": "evil"}, {"id": "god"}, {"id": "good"}, {"id": "josephot"}, {"id": "servant"}]}, {"id": "13", "items": [{"id": "jacob"}, {"id": "josephot"}]}, {"id": "14", "items": [{"id": "bless"}, {"id": "egypt"}, {"id": "jacob"}]}, {"id": "15", "items": [{"id": "abraham"}, {"id": "covenant"}, {"id": "descendant"}, {"id": "god"}, {"id": "isaac"}, {"id": "israel"}, {"id": "jacob"}, {"id": "promise"}]}], "id": "08"}, {"frames": [{"id": "01", "items": [{"id": "descendant"}, {"id": "egypt"}, {"id": "israel"}, {"id": "josephot"}]}, {"id": "02", "items": [{"id": "egypt"}, {"id": "israel"}, {"id": "josephot"}, {"id": "pharaoh"}, {"id": "servant"}]}, {"id": "03", "items": [{"id": "bless"}, {"id": "egypt"}, {"id": "god"}, {"id": "israel"}]}, {"id": "04", "items": [{"id": "israel"}, {"id": "nileriver"}, {"id": "pharaoh"}]}, {"id": "05", "items": [{"id": "israel"}]}, {"id": "06", "items": [{"id": "nileriver"}]}, {"id": "07", "items": [{"id": "israel"}, {"id": "moses"}, {"id": "pharaoh"}, {"id": "son"}]}, {"id": "08", "items": [{"id": "egypt"}, {"id": "israel"}, {"id": "moses"}, {"id": "save"}, {"id": "servant"}]}, {"id": "09", "items": [{"id": "egypt"}, {"id": "moses"}]}, {"id": "10", "items": [{"id": "egypt"}, {"id": "moses"}, {"id": "pharaoh"}]}, {"id": "11", "items": [{"id": "egypt"}, {"id": "moses"}, {"id": "shepherd"}]}, {"id": "12", "items": [{"id": "god"}, {"id": "holy"}, {"id": "moses"}, {"id": "sheep"}]}, {"id": "13", "items": [{"id": "abraham"}, {"id": "canaan"}, {"id": "egypt"}, {"id": "god"}, {"id": "isaac"}, {"id": "israel"}, {"id": "jacob"}, {"id": "pharaoh"}, {"id": "promise"}, {"id": "servant"}, {"id": "suffer"}]}, {"id": "14", "items": [{"id": "abraham"}, {"id": "god"}, {"id": "isaac"}, {"id": "jacob"}, {"id": "moses"}, {"id": "yahweh"}]}, {"id": "15", "items": [{"id": "aaron"}, {"id": "god"}, {"id": "moses"}, {"id": "pharaoh"}]}], "id": "09"}, {"frames": [{"id": "01", "items": [{"id": "aaron"}, {"id": "god"}, {"id": "israel"}, {"id": "israel"}, {"id": "moses"}, {"id": "pharaoh"}]}, {"id": "02", "items": [{"id": "egypt"}, {"id": "falsegod"}, {"id": "god"}, {"id": "pharaoh"}]}, {"id": "03", "items": [{"id": "god"}, {"id": "israel"}, {"id": "nileriver"}, {"id": "pharaoh"}]}, {"id": "04", "items": [{"id": "beg"}, {"id": "egypt"}, {"id": "god"}, {"id": "israel"}, {"id": "moses"}, {"id": "pharaoh"}]}, {"id": "05", "items": [{"id": "aaron"}, {"id": "egypt"}, {"id": "god"}, {"id": "israel"}, {"id": "moses"}, {"id": "pharaoh"}]}, {"id": "06", "items": [{"id": "egypt"}, {"id": "god"}, {"id": "israel"}, {"id": "pharaoh"}]}, {"id": "07", "items": [{"id": "egypt"}, {"id": "god"}, {"id": "israel"}, {"id": "moses"}, {"id": "pharaoh"}]}, {"id": "08", "items": [{"id": "aaron"}, {"id": "egypt"}, {"id": "god"}, {"id": "moses"}, {"id": "pharaoh"}, {"id": "pray"}, {"id": "sin"}]}, {"id": "09", "items": [{"id": "israel"}, {"id": "pharaoh"}, {"id": "sin"}]}, {"id": "10", "items": [{"id": "egypt"}, {"id": "god"}]}, {"id": "11", "items": [{"id": "egypt"}, {"id": "god"}, {"id": "israel"}]}, {"id": "12", "items": [{"id": "god"}, {"id": "israel"}, {"id": "pharaoh"}]}], "id": "10"}, {"frames": [{"id": "01", "items": [{"id": "believe"}, {"id": "god"}, {"id": "israel"}, {"id": "obey"}, {"id": "pharaoh"}]}, {"id": "02", "items": [{"id": "believe"}, {"id": "god"}, {"id": "lamb"}, {"id": "save"}, {"id": "son"}]}, {"id": "03", "items": [{"id": "blood"}, {"id": "egypt"}, {"id": "god"}, {"id": "israel"}, {"id": "lamb"}]}, {"id": "04", "items": [{"id": "egypt"}, {"id": "god"}, {"id": "israel"}]}, {"id": "05", "items": [{"id": "blood"}, {"id": "god"}, {"id": "israel"}, {"id": "lamb"}, {"id": "save"}]}, {"id": "06", "items": [{"id": "believe"}, {"id": "egypt"}, {"id": "god"}]}, {"id": "07", "items": [{"id": "egypt"}, {"id": "egypt"}, {"id": "pharaoh"}]}, {"id": "08", "items": [{"id": "aaron"}, {"id": "egypt"}, {"id": "israel"}, {"id": "moses"}, {"id": "pharaoh"}]}], "id": "11"}, {"frames": [{"id": "01", "items": [{"id": "believe"}, {"id": "egypt"}, {"id": "egypt"}, {"id": "god"}, {"id": "israel"}, {"id": "promisedland"}, {"id": "servant"}]}, {"id": "02", "items": [{"id": "god"}]}, {"id": "03", "items": [{"id": "falsegod"}, {"id": "god"}, {"id": "israel"}, {"id": "pharaoh"}, {"id": "servant"}]}, {"id": "04", "items": [{"id": "egypt"}, {"id": "egypt"}, {"id": "israel"}, {"id": "pharaoh"}, {"id": "redsea"}, {"id": "servant"}]}, {"id": "05", "items": [{"id": "god"}, {"id": "israel"}, {"id": "moses"}, {"id": "redsea"}, {"id": "save"}]}, {"id": "06", "items": [{"id": "egypt"}, {"id": "god"}, {"id": "israel"}]}, {"id": "07", "items": [{"id": "god"}, {"id": "moses"}]}, {"id": "08", "items": [{"id": "israel"}]}, {"id": "09", "items": [{"id": "egypt"}, {"id": "god"}, {"id": "israel"}]}, {"id": "10", "items": [{"id": "chariot"}, {"id": "egypt"}, {"id": "god"}, {"id": "israel"}]}, {"id": "11", "items": [{"id": "egypt"}, {"id": "god"}, {"id": "israel"}, {"id": "moses"}]}, {"id": "12", "items": [{"id": "believe"}, {"id": "egypt"}, {"id": "god"}, {"id": "israel"}, {"id": "moses"}, {"id": "prophet"}]}, {"id": "13", "items": [{"id": "egypt"}, {"id": "god"}, {"id": "israel"}, {"id": "praise"}, {"id": "save"}, {"id": "servant"}]}, {"id": "14", "items": [{"id": "egypt"}, {"id": "god"}, {"id": "israel"}, {"id": "lamb"}, {"id": "passover"}, {"id": "servant"}]}], "id": "12"}, {"frames": [{"id": "01", "items": [{"id": "god"}, {"id": "israel"}, {"id": "moses"}, {"id": "redsea"}, {"id": "sinai"}]}, {"id": "02", "items": [{"id": "covenant"}, {"id": "god"}, {"id": "holy"}, {"id": "israel"}, {"id": "kingdom"}, {"id": "moses"}, {"id": "obey"}, {"id": "priest"}]}, {"id": "03", "items": [{"id": "god"}, {"id": "moses"}, {"id": "sinai"}]}, {"id": "04", "items": [{"id": "covenant"}, {"id": "egypt"}, {"id": "falsegod"}, {"id": "god"}, {"id": "save"}, {"id": "servant"}, {"id": "worship"}, {"id": "yahweh"}]}, {"id": "05", "items": [{"id": "god"}, {"id": "holy"}, {"id": "idol"}, {"id": "sabbath"}, {"id": "sabbath"}, {"id": "worship"}, {"id": "yahweh"}]}, {"id": "06", "items": [{"id": "adultery"}]}, {"id": "07", "items": [{"id": "bless"}, {"id": "disobey"}, {"id": "god"}, {"id": "lawofmoses"}, {"id": "moses"}, {"id": "obey"}, {"id": "promise"}, {"id": "punish"}, {"id": "tencommandments"}]}, {"id": "08", "items": [{"id": "god"}, {"id": "highpriest"}, {"id": "israel"}, {"id": "tentofmeeting"}]}, {"id": "09", "items": [{"id": "aaron"}, {"id": "altar"}, {"id": "blood"}, {"id": "descendant"}, {"id": "disobey"}, {"id": "god"}, {"id": "lawofmoses"}, {"id": "moses"}, {"id": "priest"}, {"id": "sacrifice"}, {"id": "sin"}, {"id": "tentofmeeting"}]}, {"id": "10", "items": [{"id": "god"}, {"id": "obey"}, {"id": "promise"}, {"id": "sin"}, {"id": "worship"}]}, {"id": "11", "items": [{"id": "aaron"}, {"id": "god"}, {"id": "idol"}, {"id": "moses"}, {"id": "sinai"}]}, {"id": "12", "items": [{"id": "aaron"}, {"id": "god"}, {"id": "idol"}, {"id": "moses"}, {"id": "pray"}, {"id": "sacrifice"}, {"id": "sin"}, {"id": "worship"}]}, {"id": "13", "items": [{"id": "god"}, {"id": "idol"}, {"id": "moses"}, {"id": "tencommandments"}]}, {"id": "14", "items": [{"id": "god"}, {"id": "idol"}, {"id": "moses"}]}, {"id": "15", "items": [{"id": "forgive"}, {"id": "god"}, {"id": "israel"}, {"id": "moses"}, {"id": "pray"}, {"id": "promisedland"}, {"id": "sinai"}, {"id": "tencommandments"}]}], "id": "13"}, {"frames": [{"id": "01", "items": [{"id": "canaan"}, {"id": "covenant"}, {"id": "god"}, {"id": "israel"}, {"id": "promisedland"}, {"id": "sinai"}]}, {"id": "02", "items": [{"id": "abraham"}, {"id": "canaan"}, {"id": "descendant"}, {"id": "evil"}, {"id": "falsegod"}, {"id": "god"}, {"id": "isaac"}, {"id": "jacob"}, {"id": "obey"}, {"id": "peoplegroup"}, {"id": "promise"}, {"id": "promisedland"}, {"id": "worship"}]}, {"id": "03", "items": [{"id": "canaan"}, {"id": "god"}, {"id": "idol"}, {"id": "israel"}, {"id": "obey"}, {"id": "peace"}, {"id": "promisedland"}, {"id": "worship"}]}, {"id": "04", "items": [{"id": "canaan"}, {"id": "canaan"}, {"id": "israel"}, {"id": "israel"}, {"id": "moses"}]}, {"id": "05", "items": [{"id": "canaan"}]}, {"id": "06", "items": [{"id": "caleb"}, {"id": "canaan"}, {"id": "god"}, {"id": "joshua"}]}, {"id": "07", "items": [{"id": "aaron"}, {"id": "caleb"}, {"id": "egypt"}, {"id": "joshua"}, {"id": "moses"}, {"id": "servant"}]}, {"id": "08", "items": [{"id": "caleb"}, {"id": "god"}, {"id": "god"}, {"id": "joshua"}, {"id": "promisedland"}, {"id": "tentofmeeting"}]}, {"id": "09", "items": [{"id": "canaan"}, {"id": "god"}, {"id": "moses"}, {"id": "sin"}]}, {"id": "10", "items": [{"id": "canaan"}, {"id": "god"}, {"id": "israel"}]}, {"id": "11", "items": [{"id": "god"}, {"id": "israel"}]}, {"id": "12", "items": [{"id": "abraham"}, {"id": "faithful"}, {"id": "god"}, {"id": "isaac"}, {"id": "israel"}, {"id": "jacob"}, {"id": "moses"}, {"id": "promise"}]}, {"id": "13", "items": [{"id": "god"}, {"id": "moses"}, {"id": "promisedland"}]}, {"id": "14", "items": [{"id": "god"}, {"id": "israel"}, {"id": "joshua"}, {"id": "moses"}, {"id": "promise"}, {"id": "promisedland"}, {"id": "prophet"}, {"id": "rebel"}]}, {"id": "15", "items": [{"id": "god"}, {"id": "israel"}, {"id": "joshua"}, {"id": "moses"}, {"id": "obey"}, {"id": "promisedland"}, {"id": "trust"}]}], "id": "14"}, {"frames": [{"id": "01", "items": [{"id": "believe"}, {"id": "canaan"}, {"id": "canaan"}, {"id": "god"}, {"id": "israel"}, {"id": "jericho"}, {"id": "joshua"}, {"id": "promise"}, {"id": "promisedland"}, {"id": "rahab"}]}, {"id": "02", "items": [{"id": "god"}, {"id": "israel"}, {"id": "jordanriver"}, {"id": "joshua"}, {"id": "priest"}, {"id": "promisedland"}]}, {"id": "03", "items": [{"id": "god"}, {"id": "jericho"}, {"id": "jordanriver"}, {"id": "joshua"}, {"id": "obey"}, {"id": "priest"}]}, {"id": "04", "items": [{"id": "israel"}, {"id": "priest"}]}, {"id": "05", "items": [{"id": "canaan"}, {"id": "god"}, {"id": "israel"}, {"id": "jericho"}, {"id": "rahab"}]}, {"id": "06", "items": [{"id": "canaan"}, {"id": "gibeon"}, {"id": "god"}, {"id": "israel"}, {"id": "joshua"}, {"id": "peace"}]}, {"id": "07", "items": [{"id": "amorite"}, {"id": "canaan"}, {"id": "gibeon"}, {"id": "gibeon"}, {"id": "god"}, {"id": "israel"}, {"id": "joshua"}, {"id": "king"}, {"id": "peace"}, {"id": "promise"}]}, {"id": "08", "items": [{"id": "amorite"}, {"id": "gibeon"}, {"id": "israel"}, {"id": "joshua"}]}, {"id": "09", "items": [{"id": "amorite"}, {"id": "god"}, {"id": "israel"}]}, {"id": "10", "items": [{"id": "amorite"}, {"id": "god"}, {"id": "israel"}]}, {"id": "11", "items": [{"id": "canaan"}, {"id": "israel"}, {"id": "joshua"}]}, {"id": "12", "items": [{"id": "god"}, {"id": "israel"}, {"id": "peace"}, {"id": "promisedland"}]}, {"id": "13", "items": [{"id": "covenant"}, {"id": "faithful"}, {"id": "god"}, {"id": "israel"}, {"id": "israel"}, {"id": "joshua"}, {"id": "lawofmoses"}, {"id": "obey"}, {"id": "promise"}, {"id": "sinai"}]}], "id": "15"}, {"frames": [{"id": "01", "items": [{"id": "canaan"}, {"id": "disobey"}, {"id": "falsegod"}, {"id": "god"}, {"id": "israel"}, {"id": "joshua"}, {"id": "king"}, {"id": "lawofmoses"}, {"id": "obey"}, {"id": "true"}, {"id": "worship"}, {"id": "yahweh"}]}, {"id": "02", "items": [{"id": "disobey"}, {"id": "god"}, {"id": "israel"}, {"id": "punish"}, {"id": "repent"}]}, {"id": "03", "items": [{"id": "deliverer"}, {"id": "god"}, {"id": "idol"}, {"id": "midian"}, {"id": "peace"}, {"id": "worship"}]}, {"id": "04", "items": [{"id": "god"}, {"id": "israel"}, {"id": "midian"}, {"id": "save"}]}, {"id": "05", "items": [{"id": "angel"}, {"id": "gideon"}, {"id": "god"}, {"id": "israel"}, {"id": "midian"}, {"id": "yahweh"}]}, {"id": "06", "items": [{"id": "altar"}, {"id": "gideon"}, {"id": "god"}, {"id": "idol"}, {"id": "sacrifice"}]}, {"id": "07", "items": [{"id": "altar"}, {"id": "falsegod"}, {"id": "gideon"}]}, {"id": "08", "items": [{"id": "gideon"}, {"id": "god"}, {"id": "israel"}, {"id": "israel"}, {"id": "midian"}, {"id": "save"}]}, {"id": "09", "items": [{"id": "gideon"}, {"id": "god"}, {"id": "israel"}, {"id": "midian"}, {"id": "save"}, {"id": "sheep"}]}, {"id": "10", "items": [{"id": "gideon"}, {"id": "god"}, {"id": "israel"}]}, {"id": "11", "items": [{"id": "dream"}, {"id": "gideon"}, {"id": "god"}, {"id": "midian"}, {"id": "worship"}]}, {"id": "12", "items": [{"id": "gideon"}, {"id": "midian"}]}, {"id": "13", "items": [{"id": "gideon"}, {"id": "yahweh"}]}, {"id": "14", "items": [{"id": "god"}, {"id": "israel"}, {"id": "israel"}, {"id": "midian"}, {"id": "save"}]}, {"id": "15", "items": [{"id": "gideon"}, {"id": "king"}, {"id": "midian"}]}, {"id": "16", "items": [{"id": "deliverer"}, {"id": "gideon"}, {"id": "god"}, {"id": "highpriest"}, {"id": "idol"}, {"id": "israel"}, {"id": "punish"}, {"id": "worship"}]}, {"id": "17", "items": [{"id": "deliverer"}, {"id": "god"}, {"id": "israel"}, {"id": "punish"}, {"id": "repent"}, {"id": "save"}, {"id": "sin"}]}, {"id": "18", "items": [{"id": "god"}, {"id": "king"}]}], "id": "16"}, {"frames": [{"id": "01", "items": [{"id": "god"}, {"id": "israel"}, {"id": "king"}, {"id": "obey"}, {"id": "saul"}]}, {"id": "02", "items": [{"id": "bethlehem"}, {"id": "david"}, {"id": "god"}, {"id": "humble"}, {"id": "israel"}, {"id": "king"}, {"id": "obey"}, {"id": "righteous"}, {"id": "saul"}, {"id": "sheep"}, {"id": "shepherd"}, {"id": "trust"}]}, {"id": "03", "items": [{"id": "david"}, {"id": "god"}, {"id": "israel"}, {"id": "praise"}]}, {"id": "04", "items": [{"id": "david"}, {"id": "king"}, {"id": "love"}, {"id": "saul"}]}, {"id": "05", "items": [{"id": "bless"}, {"id": "david"}, {"id": "god"}, {"id": "israel"}, {"id": "jerusalem"}, {"id": "king"}, {"id": "love"}, {"id": "saul"}]}, {"id": "06", "items": [{"id": "david"}, {"id": "god"}, {"id": "israel"}, {"id": "moses"}, {"id": "sacrifice"}, {"id": "temple"}, {"id": "tentofmeeting"}, {"id": "worship"}]}, {"id": "07", "items": [{"id": "bless"}, {"id": "christ"}, {"id": "david"}, {"id": "descendant"}, {"id": "god"}, {"id": "israel"}, {"id": "king"}, {"id": "nathan"}, {"id": "prophet"}, {"id": "sin"}, {"id": "son"}, {"id": "temple"}]}, {"id": "08", "items": [{"id": "bless"}, {"id": "christ"}, {"id": "david"}, {"id": "god"}, {"id": "israel"}, {"id": "praise"}, {"id": "promise"}]}, {"id": "09", "items": [{"id": "bless"}, {"id": "david"}, {"id": "faithful"}, {"id": "god"}, {"id": "justice"}, {"id": "sin"}]}, {"id": "10", "items": [{"id": "bathsheba"}, {"id": "david"}]}, {"id": "11", "items": [{"id": "bathsheba"}, {"id": "david"}]}, {"id": "12", "items": [{"id": "bathsheba"}, {"id": "david"}, {"id": "uriah"}]}, {"id": "13", "items": [{"id": "bathsheba"}, {"id": "david"}, {"id": "evil"}, {"id": "forgive"}, {"id": "god"}, {"id": "nathan"}, {"id": "obey"}, {"id": "prophet"}, {"id": "repent"}, {"id": "sin"}, {"id": "uriah"}]}, {"id": "14", "items": [{"id": "bathsheba"}, {"id": "david"}, {"id": "faithful"}, {"id": "god"}, {"id": "promise"}, {"id": "punish"}, {"id": "sin"}, {"id": "solomon"}]}], "id": "17"}, {"frames": [{"id": "01", "items": [{"id": "david"}, {"id": "god"}, {"id": "israel"}, {"id": "judge"}, {"id": "solomon"}, {"id": "wise"}]}, {"id": "02", "items": [{"id": "david"}, {"id": "god"}, {"id": "jerusalem"}, {"id": "sacrifice"}, {"id": "solomon"}, {"id": "temple"}, {"id": "tentofmeeting"}, {"id": "worship"}]}, {"id": "03", "items": [{"id": "disobey"}, {"id": "falsegod"}, {"id": "god"}, {"id": "solomon"}, {"id": "worship"}]}, {"id": "04", "items": [{"id": "god"}, {"id": "israel"}, {"id": "kingdom"}, {"id": "promise"}, {"id": "punish"}, {"id": "solomon"}]}, {"id": "05", "items": [{"id": "israel"}, {"id": "king"}, {"id": "rehoboam"}, {"id": "solomon"}]}, {"id": "06", "items": [{"id": "punish"}, {"id": "rehoboam"}, {"id": "solomon"}]}, {"id": "07", "items": [{"id": "faithful"}, {"id": "israel"}, {"id": "kingdom-of-judah"}, {"id": "rebel"}, {"id": "rehoboam"}]}, {"id": "08", "items": [{"id": "israel"}, {"id": "jeroboam"}, {"id": "king"}, {"id": "kingdom"}, {"id": "kingdom-of-israel"}, {"id": "rehoboam"}]}, {"id": "09", "items": [{"id": "god"}, {"id": "idol"}, {"id": "jeroboam"}, {"id": "kingdom-of-judah"}, {"id": "rebel"}, {"id": "sin"}, {"id": "temple"}, {"id": "worship"}]}, {"id": "10", "items": [{"id": "kingdom"}, {"id": "kingdom-of-israel"}, {"id": "kingdom-of-judah"}]}, {"id": "11", "items": [{"id": "evil"}, {"id": "israel"}, {"id": "israel"}, {"id": "king"}, {"id": "kingdom"}]}, {"id": "12", "items": [{"id": "idol"}, {"id": "king"}, {"id": "kingdom-of-israel"}, {"id": "sacrifice"}, {"id": "worship"}]}, {"id": "13", "items": [{"id": "david"}, {"id": "descendant"}, {"id": "evil"}, {"id": "falsegod"}, {"id": "god"}, {"id": "good"}, {"id": "idol"}, {"id": "justice"}, {"id": "king"}, {"id": "kingdom-of-judah"}, {"id": "rebel"}, {"id": "sacrifice"}, {"id": "worship"}]}], "id": "18"}, {"frames": [{"id": "01", "items": [{"id": "god"}, {"id": "israel"}, {"id": "prophet"}]}, {"id": "02", "items": [{"id": "ahab"}, {"id": "baal"}, {"id": "elijah"}, {"id": "evil"}, {"id": "falsegod"}, {"id": "king"}, {"id": "kingdom-of-israel"}, {"id": "prophet"}, {"id": "worship"}]}, {"id": "03", "items": [{"id": "ahab"}, {"id": "elijah"}, {"id": "god"}]}, {"id": "04", "items": [{"id": "elijah"}, {"id": "god"}]}, {"id": "05", "items": [{"id": "ahab"}, {"id": "baal"}, {"id": "elijah"}, {"id": "god"}, {"id": "kingdom-of-israel"}, {"id": "worship"}, {"id": "yahweh"}]}, {"id": "06", "items": [{"id": "baal"}, {"id": "elijah"}, {"id": "god"}, {"id": "kingdom-of-israel"}, {"id": "prophet"}, {"id": "yahweh"}]}, {"id": "07", "items": [{"id": "baal"}, {"id": "elijah"}, {"id": "god"}, {"id": "priest"}, {"id": "prophet"}, {"id": "sacrifice"}]}, {"id": "08", "items": [{"id": "baal"}, {"id": "pray"}, {"id": "prophet"}]}, {"id": "09", "items": [{"id": "altar"}, {"id": "elijah"}, {"id": "god"}, {"id": "sacrifice"}]}, {"id": "10", "items": [{"id": "abraham"}, {"id": "elijah"}, {"id": "god"}, {"id": "isaac"}, {"id": "israel"}, {"id": "jacob"}, {"id": "pray"}, {"id": "servant"}, {"id": "true"}, {"id": "yahweh"}]}, {"id": "11", "items": [{"id": "altar"}, {"id": "god"}, {"id": "yahweh"}]}, {"id": "12", "items": [{"id": "baal"}, {"id": "elijah"}, {"id": "prophet"}]}, {"id": "13", "items": [{"id": "ahab"}, {"id": "elijah"}, {"id": "god"}, {"id": "king"}, {"id": "yahweh"}]}, {"id": "14", "items": [{"id": "elijah"}, {"id": "god"}, {"id": "heal"}, {"id": "jordanriver"}, {"id": "miracle"}, {"id": "naaman"}, {"id": "prophet"}]}, {"id": "15", "items": [{"id": "god"}, {"id": "heal"}, {"id": "jordanriver"}, {"id": "naaman"}]}, {"id": "16", "items": [{"id": "evil"}, {"id": "god"}, {"id": "guilt"}, {"id": "idol"}, {"id": "judge"}, {"id": "justice"}, {"id": "mercy"}, {"id": "obey"}, {"id": "prophet"}, {"id": "punish"}, {"id": "worship"}]}, {"id": "17", "items": [{"id": "god"}, {"id": "jeremiah"}, {"id": "king"}, {"id": "mercy"}, {"id": "obey"}, {"id": "prophet"}]}, {"id": "18", "items": [{"id": "christ"}, {"id": "god"}, {"id": "promise"}, {"id": "prophet"}, {"id": "repent"}]}], "id": "19"}, {"frames": [{"id": "01", "items": [{"id": "covenant"}, {"id": "god"}, {"id": "kingdom-of-israel"}, {"id": "kingdom-of-judah"}, {"id": "obey"}, {"id": "prophet"}, {"id": "repent"}, {"id": "sin"}, {"id": "sinai"}, {"id": "worship"}]}, {"id": "02", "items": [{"id": "assyria"}, {"id": "god"}, {"id": "kingdomofisrael"}, {"id": "punish"}]}, {"id": "03", "items": [{"id": "assyria"}, {"id": "israel"}, {"id": "kingdom-of-israel"}]}, {"id": "04", "items": [{"id": "assyria"}, {"id": "descendant"}, {"id": "israel"}, {"id": "kingdom-of-israel"}, {"id": "samaria"}]}, {"id": "05", "items": [{"id": "believe"}, {"id": "canaan"}, {"id": "falsegod"}, {"id": "god"}, {"id": "idol"}, {"id": "kingdomofisrael"}, {"id": "kingdomofjudah"}, {"id": "obey"}, {"id": "prophet"}, {"id": "punish"}, {"id": "worship"}]}, {"id": "06", "items": [{"id": "assyria"}, {"id": "babylon"}, {"id": "babylon"}, {"id": "god"}, {"id": "king"}, {"id": "kingdom-of-israel"}, {"id": "kingdom-of-judah"}, {"id": "nebuchadnezzar"}, {"id": "servant"}]}, {"id": "07", "items": [{"id": "babylon"}, {"id": "jerusalem"}, {"id": "kingdom-of-judah"}, {"id": "rebel"}, {"id": "temple"}]}, {"id": "08", "items": [{"id": "babylon"}, {"id": "king"}, {"id": "kingdom-of-judah"}, {"id": "nebuchadnezzar"}, {"id": "punish"}, {"id": "son"}]}, {"id": "09", "items": [{"id": "babylon"}, {"id": "god"}, {"id": "kingdom-of-judah"}, {"id": "nebuchadnezzar"}, {"id": "promisedland"}]}, {"id": "10", "items": [{"id": "god"}, {"id": "promise"}, {"id": "promisedland"}, {"id": "prophet"}, {"id": "punish"}, {"id": "sin"}]}, {"id": "11", "items": [{"id": "babylon"}, {"id": "israel"}, {"id": "jew"}, {"id": "king"}]}, {"id": "12", "items": [{"id": "jerusalem"}, {"id": "jew"}, {"id": "mercy"}, {"id": "temple"}]}, {"id": "13", "items": [{"id": "jerusalem"}, {"id": "promisedland"}, {"id": "temple"}, {"id": "worship"}]}], "id": "20"}, {"frames": [{"id": "01", "items": [{"id": "adam"}, {"id": "christ"}, {"id": "descendant"}, {"id": "eve"}, {"id": "god"}, {"id": "promise"}, {"id": "satan"}]}, {"id": "02", "items": [{"id": "abraham"}, {"id": "bless"}, {"id": "christ"}, {"id": "fulfill"}, {"id": "god"}, {"id": "peoplegroup"}, {"id": "save"}]}, {"id": "03", "items": [{"id": "christ"}, {"id": "god"}, {"id": "moses"}, {"id": "promise"}, {"id": "prophet"}]}, {"id": "04", "items": [{"id": "christ"}, {"id": "david"}, {"id": "descendant"}, {"id": "god"}, {"id": "promise"}]}, {"id": "05", "items": [{"id": "christ"}, {"id": "covenant"}, {"id": "forgive"}, {"id": "god"}, {"id": "israel"}, {"id": "jeremiah"}, {"id": "newcovenant"}, {"id": "promise"}, {"id": "prophet"}, {"id": "sin"}, {"id": "sinai"}]}, {"id": "06", "items": [{"id": "christ"}, {"id": "god"}, {"id": "king"}, {"id": "priest"}, {"id": "prophet"}]}, {"id": "07", "items": [{"id": "christ"}, {"id": "god"}, {"id": "highpriest"}, {"id": "israel"}, {"id": "pray"}, {"id": "priest"}, {"id": "punish"}, {"id": "sacrifice"}, {"id": "sin"}]}, {"id": "08", "items": [{"id": "christ"}, {"id": "david"}, {"id": "judge"}, {"id": "king"}, {"id": "kingdom"}]}, {"id": "09", "items": [{"id": "bethlehem"}, {"id": "christ"}, {"id": "god"}, {"id": "isaiah"}, {"id": "prophet"}, {"id": "prophet"}, {"id": "virgin"}]}, {"id": "10", "items": [{"id": "christ"}, {"id": "galilee"}, {"id": "heal"}, {"id": "isaiah"}, {"id": "prophet"}]}, {"id": "11", "items": [{"id": "betray"}, {"id": "christ"}, {"id": "isaiah"}, {"id": "prophet"}, {"id": "prophet"}]}, {"id": "12", "items": [{"id": "christ"}, {"id": "death"}, {"id": "isaiah"}, {"id": "prophet"}, {"id": "prophet"}]}, {"id": "13", "items": [{"id": "christ"}, {"id": "death"}, {"id": "god"}, {"id": "peace"}, {"id": "prophet"}, {"id": "punish"}, {"id": "receive"}, {"id": "sin"}]}, {"id": "14", "items": [{"id": "christ"}, {"id": "death"}, {"id": "god"}, {"id": "newcovenant"}, {"id": "prophet"}, {"id": "raise"}, {"id": "resurrection"}, {"id": "save"}, {"id": "sin"}]}, {"id": "15", "items": [{"id": "christ"}, {"id": "god"}, {"id": "prophet"}]}], "id": "21"}, {"frames": [{"id": "01", "items": [{"id": "angel"}, {"id": "god"}, {"id": "priest"}, {"id": "prophet"}, {"id": "zechariahnt"}]}, {"id": "02", "items": [{"id": "angel"}, {"id": "christ"}, {"id": "holyspirit"}, {"id": "johnthebaptist"}, {"id": "zechariahnt"}]}, {"id": "03", "items": [{"id": "angel"}, {"id": "believe"}, {"id": "god"}, {"id": "zechariahnt"}]}, {"id": "04", "items": [{"id": "angel"}, {"id": "godthefather"}, {"id": "jesus"}, {"id": "josephnt"}, {"id": "mary"}, {"id": "sonofgod"}, {"id": "virgin"}]}, {"id": "05", "items": [{"id": "angel"}, {"id": "believe"}, {"id": "god"}, {"id": "holy"}, {"id": "holyspirit"}, {"id": "mary"}, {"id": "power"}, {"id": "sonofgod"}, {"id": "virgin"}]}, {"id": "06", "items": [{"id": "angel"}, {"id": "god"}, {"id": "mary"}]}, {"id": "07", "items": [{"id": "angel"}, {"id": "forgive"}, {"id": "god"}, {"id": "johnthebaptist"}, {"id": "praise"}, {"id": "prophet"}, {"id": "sin"}, {"id": "zechariahnt"}, {"id": "zechariahnt"}]}], "id": "22"}, {"frames": [{"id": "01", "items": [{"id": "angel"}, {"id": "dream"}, {"id": "josephnt"}, {"id": "mary"}, {"id": "righteous"}]}, {"id": "02", "items": [{"id": "angel"}, {"id": "holyspirit"}, {"id": "jesus"}, {"id": "josephnt"}, {"id": "mary"}, {"id": "save"}, {"id": "sin"}, {"id": "son"}, {"id": "yahweh"}]}, {"id": "03", "items": [{"id": "josephnt"}, {"id": "mary"}]}, {"id": "04", "items": [{"id": "bethlehem"}, {"id": "david"}, {"id": "josephnt"}, {"id": "mary"}, {"id": "nazareth"}, {"id": "rome"}]}, {"id": "05", "items": [{"id": "bethlehem"}, {"id": "jesus"}]}, {"id": "06", "items": [{"id": "angel"}, {"id": "bethlehem"}, {"id": "christ"}, {"id": "lord"}, {"id": "shepherd"}]}, {"id": "07", "items": [{"id": "angel"}, {"id": "glory"}, {"id": "god"}, {"id": "heaven"}, {"id": "peace"}]}, {"id": "08", "items": [{"id": "angel"}, {"id": "god"}, {"id": "jesus"}, {"id": "mary"}, {"id": "praise"}, {"id": "shepherd"}]}, {"id": "09", "items": [{"id": "bethlehem"}, {"id": "jesus"}, {"id": "kingofthejews"}, {"id": "wise"}]}, {"id": "10", "items": [{"id": "jesus"}, {"id": "worship"}]}], "id": "23"}, {"frames": [{"id": "01", "items": [{"id": "johnthebaptist"}, {"id": "prophet"}, {"id": "zechariahnt"}]}, {"id": "02", "items": [{"id": "johnthebaptist"}, {"id": "kingdomofgod"}, {"id": "preach"}, {"id": "repent"}]}, {"id": "03", "items": [{"id": "baptize"}, {"id": "jewishleaders"}, {"id": "johnthebaptist"}, {"id": "repent"}, {"id": "sin"}]}, {"id": "04", "items": [{"id": "fulfill"}, {"id": "jewishleaders"}, {"id": "johnthebaptist"}, {"id": "prophet"}, {"id": "repent"}]}, {"id": "05", "items": [{"id": "christ"}, {"id": "jew"}, {"id": "johnthebaptist"}]}, {"id": "06", "items": [{"id": "baptize"}, {"id": "god"}, {"id": "jesus"}, {"id": "johnthebaptist"}, {"id": "lamb"}, {"id": "sin"}]}, {"id": "07", "items": [{"id": "baptize"}, {"id": "jesus"}, {"id": "johnthebaptist"}, {"id": "sin"}]}, {"id": "08", "items": [{"id": "baptize"}, {"id": "heaven"}, {"id": "holyspirit"}, {"id": "jesus"}, {"id": "love"}, {"id": "sonofgod"}]}, {"id": "09", "items": [{"id": "baptize"}, {"id": "god"}, {"id": "godthefather"}, {"id": "holyspirit"}, {"id": "jesus"}, {"id": "johnthebaptist"}, {"id": "sonofgod"}, {"id": "sonofgod"}]}], "id": "24"}, {"frames": [{"id": "01", "items": [{"id": "baptize"}, {"id": "fast"}, {"id": "holyspirit"}, {"id": "jesus"}, {"id": "satan"}, {"id": "sin"}, {"id": "tempt"}]}, {"id": "02", "items": [{"id": "jesus"}, {"id": "satan"}, {"id": "sonofgod"}, {"id": "tempt"}]}, {"id": "03", "items": [{"id": "god"}, {"id": "jesus"}, {"id": "wordofgod"}]}, {"id": "04", "items": [{"id": "angel"}, {"id": "god"}, {"id": "jesus"}, {"id": "satan"}, {"id": "sonofgod"}, {"id": "temple"}]}, {"id": "05", "items": [{"id": "god"}, {"id": "jesus"}, {"id": "lord"}, {"id": "satan"}, {"id": "wordofgod"}]}, {"id": "06", "items": [{"id": "glory"}, {"id": "jesus"}, {"id": "kingdom"}, {"id": "satan"}, {"id": "worship"}]}, {"id": "07", "items": [{"id": "god"}, {"id": "jesus"}, {"id": "lord"}, {"id": "satan"}, {"id": "wordofgod"}, {"id": "worship"}]}, {"id": "08", "items": [{"id": "angel"}, {"id": "jesus"}, {"id": "satan"}, {"id": "tempt"}]}], "id": "25"}, {"frames": [{"id": "01", "items": [{"id": "galilee"}, {"id": "holyspirit"}, {"id": "jesus"}, {"id": "power"}, {"id": "satan"}, {"id": "tempt"}]}, {"id": "02", "items": [{"id": "isaiah"}, {"id": "jesus"}, {"id": "nazareth"}, {"id": "prophet"}, {"id": "sabbath"}, {"id": "worship"}]}, {"id": "03", "items": [{"id": "god"}, {"id": "goodnews"}, {"id": "holyspirit"}, {"id": "lord"}]}, {"id": "04", "items": [{"id": "christ"}, {"id": "jesus"}, {"id": "josephnt"}, {"id": "wordofgod"}]}, {"id": "05", "items": [{"id": "elijah"}, {"id": "god"}, {"id": "israel"}, {"id": "jesus"}, {"id": "prophet"}, {"id": "true"}]}, {"id": "06", "items": [{"id": "heal"}, {"id": "israel"}, {"id": "jesus"}, {"id": "jew"}, {"id": "naaman"}, {"id": "prophet"}]}, {"id": "07", "items": [{"id": "jesus"}, {"id": "nazareth"}, {"id": "worship"}]}, {"id": "08", "items": [{"id": "galilee"}, {"id": "heal"}, {"id": "jesus"}]}, {"id": "09", "items": [{"id": "demon"}, {"id": "demon"}, {"id": "god"}, {"id": "jesus"}, {"id": "sonofgod"}, {"id": "worship"}]}, {"id": "10", "items": [{"id": "apostle"}, {"id": "jesus"}]}], "id": "26"}, {"frames": [{"id": "01", "items": [{"id": "eternity"}, {"id": "inherit"}, {"id": "jesus"}, {"id": "lawofmoses"}, {"id": "teacher"}]}, {"id": "02", "items": [{"id": "god"}, {"id": "jesus"}, {"id": "lawofmoses"}, {"id": "life"}, {"id": "lord"}, {"id": "love"}]}, {"id": "03", "items": [{"id": "righteous"}]}, {"id": "04", "items": [{"id": "jericho"}, {"id": "jerusalem"}, {"id": "jesus"}, {"id": "jew"}]}, {"id": "05", "items": []}, {"id": "06", "items": [{"id": "jew"}, {"id": "jewishleaders"}, {"id": "priest"}]}, {"id": "07", "items": [{"id": "jew"}, {"id": "priest"}, {"id": "temple"}]}, {"id": "08", "items": [{"id": "jew"}, {"id": "samaria"}]}, {"id": "09", "items": [{"id": "samaria"}]}, {"id": "10", "items": [{"id": "samaria"}]}, {"id": "11", "items": [{"id": "jesus"}, {"id": "mercy"}]}], "id": "27"}, {"frames": [{"id": "01", "items": [{"id": "eternity"}, {"id": "god"}, {"id": "good"}, {"id": "jesus"}, {"id": "lawofmoses"}, {"id": "obey"}, {"id": "teacher"}]}, {"id": "02", "items": [{"id": "adultery"}, {"id": "jesus"}, {"id": "love"}]}, {"id": "03", "items": [{"id": "jesus"}, {"id": "lawofmoses"}, {"id": "love"}, {"id": "obey"}]}, {"id": "04", "items": [{"id": "heaven"}, {"id": "jesus"}]}, {"id": "05", "items": [{"id": "jesus"}]}, {"id": "06", "items": [{"id": "disciple"}, {"id": "jesus"}, {"id": "kingdomofgod"}]}, {"id": "07", "items": [{"id": "disciple"}, {"id": "save"}]}, {"id": "08", "items": [{"id": "disciple"}, {"id": "god"}, {"id": "jesus"}]}, {"id": "09", "items": [{"id": "jesus"}, {"id": "peter"}]}, {"id": "10", "items": [{"id": "eternity"}, {"id": "jesus"}]}], "id": "28"}, {"frames": [{"id": "01", "items": [{"id": "forgive"}, {"id": "jesus"}, {"id": "lord"}, {"id": "peter"}, {"id": "sin"}]}, {"id": "02", "items": [{"id": "king"}, {"id": "kingdomofgod"}, {"id": "servant"}]}, {"id": "03", "items": [{"id": "king"}, {"id": "servant"}, {"id": "servant"}]}, {"id": "04", "items": [{"id": "king"}, {"id": "servant"}]}, {"id": "05", "items": [{"id": "servant"}]}, {"id": "06", "items": [{"id": "servant"}]}, {"id": "07", "items": [{"id": "king"}, {"id": "servant"}]}, {"id": "08", "items": [{"id": "beg"}, {"id": "evil"}, {"id": "forgive"}, {"id": "king"}, {"id": "servant"}]}, {"id": "09", "items": [{"id": "forgive"}, {"id": "godthefather"}, {"id": "jesus"}]}], "id": "29"}, {"frames": [{"id": "01", "items": [{"id": "apostle"}, {"id": "jesus"}, {"id": "preach"}]}, {"id": "02", "items": [{"id": "disciple"}, {"id": "jesus"}]}, {"id": "03", "items": [{"id": "heal"}, {"id": "jesus"}, {"id": "sheep"}, {"id": "shepherd"}]}, {"id": "04", "items": [{"id": "disciple"}, {"id": "jesus"}]}, {"id": "05", "items": [{"id": "disciple"}, {"id": "jesus"}]}, {"id": "06", "items": [{"id": "disciple"}, {"id": "jesus"}]}, {"id": "07", "items": [{"id": "god"}, {"id": "heaven"}, {"id": "jesus"}]}, {"id": "08", "items": [{"id": "disciple"}, {"id": "jesus"}]}, {"id": "09", "items": [{"id": "disciple"}]}], "id": "30"}, {"frames": [{"id": "01", "items": [{"id": "disciple"}, {"id": "jesus"}, {"id": "pray"}]}, {"id": "02", "items": [{"id": "disciple"}, {"id": "disciple"}, {"id": "pray"}]}, {"id": "03", "items": [{"id": "disciple"}, {"id": "jesus"}, {"id": "pray"}]}, {"id": "04", "items": [{"id": "disciple"}, {"id": "jesus"}]}, {"id": "05", "items": [{"id": "jesus"}, {"id": "lord"}, {"id": "peter"}]}, {"id": "06", "items": [{"id": "jesus"}, {"id": "peter"}]}, {"id": "07", "items": [{"id": "faith"}, {"id": "jesus"}, {"id": "lord"}, {"id": "peter"}, {"id": "save"}]}, {"id": "08", "items": [{"id": "disciple"}, {"id": "jesus"}, {"id": "peter"}, {"id": "sonofgod"}, {"id": "true"}, {"id": "worship"}]}], "id": "31"}, {"frames": [{"id": "01", "items": [{"id": "disciple"}, {"id": "jesus"}]}, {"id": "02", "items": [{"id": "demonpossessed"}, {"id": "jesus"}]}, {"id": "03", "items": []}, {"id": "04", "items": [{"id": "tomb"}]}, {"id": "05", "items": [{"id": "demon"}, {"id": "jesus"}]}, {"id": "06", "items": [{"id": "demonpossessed"}, {"id": "god"}, {"id": "jesus"}, {"id": "sonofgod"}]}, {"id": "07", "items": [{"id": "beg"}, {"id": "demon"}, {"id": "jesus"}]}, {"id": "08", "items": [{"id": "demon"}]}, {"id": "09", "items": [{"id": "demon"}, {"id": "jesus"}]}, {"id": "10", "items": [{"id": "beg"}, {"id": "jesus"}]}, {"id": "11", "items": [{"id": "god"}, {"id": "jesus"}, {"id": "mercy"}]}, {"id": "12", "items": [{"id": "jesus"}]}, {"id": "13", "items": [{"id": "heal"}, {"id": "jesus"}]}, {"id": "14", "items": [{"id": "heal"}, {"id": "jesus"}]}, {"id": "15", "items": [{"id": "disciple"}, {"id": "jesus"}, {"id": "power"}]}, {"id": "16", "items": [{"id": "faith"}, {"id": "heal"}, {"id": "jesus"}, {"id": "peace"}]}], "id": "32"}, {"frames": [{"id": "01", "items": [{"id": "jesus"}]}, {"id": "02", "items": [{"id": "jesus"}]}, {"id": "03", "items": []}, {"id": "04", "items": []}, {"id": "05", "items": [{"id": "good"}]}, {"id": "06", "items": [{"id": "disciple"}, {"id": "jesus"}, {"id": "satan"}, {"id": "wordofgod"}]}, {"id": "07", "items": [{"id": "joy"}, {"id": "persecute"}, {"id": "wordofgod"}]}, {"id": "08", "items": [{"id": "god"}, {"id": "love"}, {"id": "wordofgod"}]}, {"id": "09", "items": [{"id": "believe"}, {"id": "good"}, {"id": "wordofgod"}]}], "id": "33"}, {"frames": [{"id": "01", "items": [{"id": "jesus"}, {"id": "kingdomofgod"}]}, {"id": "02", "items": []}, {"id": "03", "items": [{"id": "jesus"}, {"id": "kingdomofgod"}]}, {"id": "04", "items": [{"id": "joy"}, {"id": "kingdomofgod"}]}, {"id": "05", "items": [{"id": "kingdomofgod"}]}, {"id": "06", "items": [{"id": "jesus"}, {"id": "jewishleaders"}, {"id": "pray"}, {"id": "taxcollector"}, {"id": "temple"}, {"id": "trust"}]}, {"id": "07", "items": [{"id": "adultery"}, {"id": "god"}, {"id": "jewishleaders"}, {"id": "sin"}, {"id": "taxcollector"}]}, {"id": "08", "items": [{"id": "fast"}]}, {"id": "09", "items": [{"id": "god"}, {"id": "heaven"}, {"id": "jewishleaders"}, {"id": "mercy"}, {"id": "pray"}, {"id": "sin"}, {"id": "taxcollector"}]}, {"id": "10", "items": [{"id": "god"}, {"id": "humble"}, {"id": "jesus"}, {"id": "jewishleaders"}, {"id": "pray"}, {"id": "proud"}, {"id": "righteous"}, {"id": "taxcollector"}, {"id": "true"}]}], "id": "34"}, {"frames": [{"id": "01", "items": [{"id": "jesus"}, {"id": "sin"}, {"id": "taxcollector"}]}, {"id": "02", "items": [{"id": "jesus"}, {"id": "jewishleaders"}, {"id": "sin"}]}, {"id": "03", "items": [{"id": "inherit"}, {"id": "son"}]}, {"id": "04", "items": [{"id": "sin"}]}, {"id": "05", "items": []}, {"id": "06", "items": [{"id": "servant"}]}, {"id": "07", "items": [{"id": "son"}]}, {"id": "08", "items": [{"id": "god"}, {"id": "sin"}, {"id": "son"}]}, {"id": "09", "items": [{"id": "death"}, {"id": "life"}, {"id": "servant"}, {"id": "son"}]}, {"id": "10", "items": []}, {"id": "11", "items": [{"id": "beg"}, {"id": "son"}]}, {"id": "12", "items": [{"id": "disobey"}, {"id": "faithful"}, {"id": "sin"}]}, {"id": "13", "items": [{"id": "death"}, {"id": "life"}, {"id": "son"}]}], "id": "35"}, {"frames": [{"id": "01", "items": [{"id": "baptize"}, {"id": "disciple"}, {"id": "jesus"}, {"id": "johntheapostle"}, {"id": "peter"}]}, {"id": "02", "items": [{"id": "jesus"}, {"id": "pray"}]}, {"id": "03", "items": [{"id": "[prophet"}, {"id": "death"}, {"id": "elijah"}, {"id": "jerusalem"}, {"id": "jesus"}, {"id": "moses"}]}, {"id": "04", "items": [{"id": "elijah"}, {"id": "good"}, {"id": "jesus"}, {"id": "moses"}, {"id": "peter"}]}, {"id": "05", "items": [{"id": "disciple"}, {"id": "love"}, {"id": "peter"}, {"id": "sonofgod"}]}, {"id": "06", "items": [{"id": "jesus"}]}, {"id": "07", "items": [{"id": "death"}, {"id": "disciple"}, {"id": "jesus"}, {"id": "life"}]}], "id": "36"}, {"frames": [{"id": "01", "items": [{"id": "death"}, {"id": "glory"}, {"id": "god"}, {"id": "jesus"}, {"id": "lazarus"}, {"id": "love"}]}, {"id": "02", "items": [{"id": "disciple"}, {"id": "jesus"}, {"id": "lazarus"}, {"id": "teacher"}]}, {"id": "03", "items": [{"id": "believe"}, {"id": "death"}, {"id": "disciple"}, {"id": "jesus"}, {"id": "lazarus"}, {"id": "lord"}]}, {"id": "04", "items": [{"id": "believe"}, {"id": "death"}, {"id": "god"}, {"id": "jesus"}, {"id": "lazarus"}, {"id": "lord"}]}, {"id": "05", "items": [{"id": "believe"}, {"id": "christ"}, {"id": "death"}, {"id": "jesus"}, {"id": "life"}, {"id": "lord"}, {"id": "resurrection"}, {"id": "sonofgod"}]}, {"id": "06", "items": [{"id": "death"}, {"id": "jesus"}, {"id": "lazarus"}, {"id": "lord"}, {"id": "tomb"}]}, {"id": "07", "items": [{"id": "death"}, {"id": "jesus"}, {"id": "tomb"}]}, {"id": "08", "items": [{"id": "believe"}, {"id": "glory"}, {"id": "god"}, {"id": "jesus"}]}, {"id": "09", "items": [{"id": "believe"}, {"id": "godthefather"}, {"id": "heaven"}, {"id": "jesus"}, {"id": "lazarus"}]}, {"id": "10", "items": [{"id": "believe"}, {"id": "jesus"}, {"id": "jew"}, {"id": "lazarus"}, {"id": "miracle"}]}, {"id": "11", "items": [{"id": "jesus"}, {"id": "jew"}, {"id": "jewishleaders"}, {"id": "lazarus"}]}], "id": "37"}, {"frames": [{"id": "01", "items": [{"id": "disciple"}, {"id": "egypt"}, {"id": "god"}, {"id": "jerusalem"}, {"id": "jesus"}, {"id": "jew"}, {"id": "passover"}, {"id": "preach"}, {"id": "save"}, {"id": "servant"}]}, {"id": "02", "items": [{"id": "apostle"}, {"id": "betray"}, {"id": "christ"}, {"id": "disciple"}, {"id": "jerusalem"}, {"id": "jesus"}, {"id": "jewishleaders"}, {"id": "judasiscariot"}]}, {"id": "03", "items": [{"id": "betray"}, {"id": "highpriest"}, {"id": "jesus"}, {"id": "jewishleaders"}, {"id": "judasiscariot"}, {"id": "prophet"}]}, {"id": "04", "items": [{"id": "disciple"}, {"id": "jerusalem"}, {"id": "jesus"}, {"id": "passover"}, {"id": "sacrifice"}]}, {"id": "05", "items": [{"id": "blood"}, {"id": "forgive"}, {"id": "jesus"}, {"id": "newcovenant"}, {"id": "sin"}]}, {"id": "06", "items": [{"id": "betray"}, {"id": "disciple"}, {"id": "jesus"}, {"id": "judasiscariot"}]}, {"id": "07", "items": [{"id": "jew"}, {"id": "judasiscariot"}, {"id": "satan"}]}, {"id": "08", "items": [{"id": "disciple"}, {"id": "jesus"}, {"id": "sheep"}, {"id": "shepherd"}]}, {"id": "09", "items": [{"id": "faith"}, {"id": "jesus"}, {"id": "peter"}, {"id": "pray"}, {"id": "satan"}]}, {"id": "10", "items": [{"id": "death"}, {"id": "disciple"}, {"id": "jesus"}, {"id": "peter"}]}, {"id": "11", "items": [{"id": "disciple"}, {"id": "jesus"}, {"id": "pray"}, {"id": "tempt"}]}, {"id": "12", "items": [{"id": "angel"}, {"id": "blood"}, {"id": "forgive"}, {"id": "god"}, {"id": "godthefather"}, {"id": "jesus"}, {"id": "pray"}, {"id": "sin"}, {"id": "suffer"}]}, {"id": "13", "items": [{"id": "betray"}, {"id": "disciple"}, {"id": "jesus"}, {"id": "pray"}]}, {"id": "14", "items": [{"id": "betray"}, {"id": "jesus"}, {"id": "jewishleaders"}, {"id": "judasiscariot"}, {"id": "teacher"}]}, {"id": "15", "items": [{"id": "angel"}, {"id": "disciple"}, {"id": "godthefather"}, {"id": "heal"}, {"id": "highpriest"}, {"id": "jesus"}, {"id": "obey"}, {"id": "peter"}, {"id": "servant"}]}], "id": "38"}, {"frames": [{"id": "01", "items": [{"id": "highpriest"}, {"id": "jesus"}, {"id": "peter"}]}, {"id": "02", "items": [{"id": "guilt"}, {"id": "jesus"}, {"id": "jewishleaders"}, {"id": "witness"}]}, {"id": "03", "items": [{"id": "christ"}, {"id": "highpriest"}, {"id": "jesus"}, {"id": "sonofgod"}]}, {"id": "04", "items": [{"id": "god"}, {"id": "heaven"}, {"id": "highpriest"}, {"id": "jesus"}, {"id": "jewishleaders"}, {"id": "judge"}, {"id": "sonofgod"}, {"id": "witness"}]}, {"id": "05", "items": [{"id": "death"}, {"id": "highpriest"}, {"id": "jesus"}, {"id": "jewishleaders"}, {"id": "mock"}]}, {"id": "06", "items": [{"id": "galilee"}, {"id": "jesus"}, {"id": "peter"}, {"id": "servant"}]}, {"id": "07", "items": [{"id": "curse"}, {"id": "god"}, {"id": "jesus"}, {"id": "peter"}]}, {"id": "08", "items": [{"id": "betray"}, {"id": "jesus"}, {"id": "jewishleaders"}, {"id": "judasiscariot"}, {"id": "peter"}]}, {"id": "09", "items": [{"id": "jesus"}, {"id": "jewishleaders"}, {"id": "kingofthejews"}, {"id": "pilate"}, {"id": "rome"}]}, {"id": "10", "items": [{"id": "god"}, {"id": "jesus"}, {"id": "kingdom"}, {"id": "kingdomofgod"}, {"id": "love"}, {"id": "pilate"}, {"id": "servant"}, {"id": "true"}]}, {"id": "11", "items": [{"id": "crucify"}, {"id": "guilt"}, {"id": "jesus"}, {"id": "jewishleaders"}, {"id": "pilate"}]}, {"id": "12", "items": [{"id": "crucify"}, {"id": "jesus"}, {"id": "kingofthejews"}, {"id": "mock"}, {"id": "pilate"}, {"id": "rome"}]}], "id": "39"}, {"frames": [{"id": "01", "items": [{"id": "cross"}, {"id": "crucify"}, {"id": "jesus"}, {"id": "mock"}]}, {"id": "02", "items": [{"id": "cross"}, {"id": "forgive"}, {"id": "godthefather"}, {"id": "jesus"}, {"id": "kingofthejews"}, {"id": "pilate"}]}, {"id": "03", "items": [{"id": "fulfill"}, {"id": "jesus"}, {"id": "prophet"}]}, {"id": "04", "items": [{"id": "crucify"}, {"id": "god"}, {"id": "guilt"}, {"id": "innocent"}, {"id": "jesus"}, {"id": "kingdomofgod"}, {"id": "mock"}]}, {"id": "05", "items": [{"id": "believe"}, {"id": "cross"}, {"id": "jesus"}, {"id": "jewishleaders"}, {"id": "mock"}, {"id": "save"}, {"id": "sonofgod"}]}, {"id": "06", "items": []}, {"id": "07", "items": [{"id": "death"}, {"id": "god"}, {"id": "godthefather"}, {"id": "jesus"}, {"id": "spirit"}, {"id": "temple"}]}, {"id": "08", "items": [{"id": "death"}, {"id": "god"}, {"id": "innocent"}, {"id": "jesus"}, {"id": "sonofgod"}]}, {"id": "09", "items": [{"id": "believe"}, {"id": "christ"}, {"id": "jesus"}, {"id": "jewishleaders"}, {"id": "pilate"}, {"id": "tomb"}]}], "id": "40"}, {"frames": [{"id": "01", "items": [{"id": "crucify"}, {"id": "death"}, {"id": "disciple"}, {"id": "jesus"}, {"id": "jewishleaders"}, {"id": "pilate"}, {"id": "raise"}, {"id": "tomb"}]}, {"id": "02", "items": [{"id": "pilate"}, {"id": "tomb"}]}, {"id": "03", "items": [{"id": "jesus"}, {"id": "jew"}, {"id": "sabbath"}, {"id": "tomb"}, {"id": "tomb"}]}, {"id": "04", "items": [{"id": "angel"}, {"id": "death"}, {"id": "heaven"}, {"id": "tomb"}]}, {"id": "05", "items": [{"id": "angel"}, {"id": "death"}, {"id": "jesus"}, {"id": "raise"}, {"id": "tomb"}]}, {"id": "06", "items": [{"id": "angel"}, {"id": "death"}, {"id": "disciple"}, {"id": "galilee"}, {"id": "jesus"}, {"id": "raise"}]}, {"id": "07", "items": [{"id": "disciple"}, {"id": "joy"}]}, {"id": "08", "items": [{"id": "disciple"}, {"id": "galilee"}, {"id": "jesus"}, {"id": "worship"}]}], "id": "41"}, {"frames": [{"id": "01", "items": [{"id": "believe"}, {"id": "christ"}, {"id": "disciple"}, {"id": "jesus"}, {"id": "life"}, {"id": "raise"}]}, {"id": "02", "items": [{"id": "jerusalem"}, {"id": "jesus"}]}, {"id": "03", "items": [{"id": "christ"}, {"id": "jesus"}, {"id": "prophet"}, {"id": "raise"}, {"id": "suffer"}, {"id": "wordofgod"}]}, {"id": "04", "items": [{"id": "god"}, {"id": "jesus"}]}, {"id": "05", "items": [{"id": "disciple"}, {"id": "jerusalem"}, {"id": "jesus"}, {"id": "life"}, {"id": "wordofgod"}]}, {"id": "06", "items": [{"id": "disciple"}, {"id": "disciple"}, {"id": "jesus"}, {"id": "peace"}]}, {"id": "07", "items": [{"id": "christ"}, {"id": "death"}, {"id": "fulfill"}, {"id": "jesus"}, {"id": "raise"}, {"id": "suffer"}, {"id": "wordofgod"}]}, {"id": "08", "items": [{"id": "disciple"}, {"id": "forgive"}, {"id": "jerusalem"}, {"id": "peoplegroup"}, {"id": "receive"}, {"id": "repent"}, {"id": "sin"}, {"id": "witness"}, {"id": "wordofgod"}]}, {"id": "09", "items": [{"id": "disciple"}, {"id": "jesus"}, {"id": "kingdomofgod"}, {"id": "life"}]}, {"id": "10", "items": [{"id": "baptize"}, {"id": "disciple"}, {"id": "godthefather"}, {"id": "heaven"}, {"id": "holyspirit"}, {"id": "jesus"}, {"id": "obey"}, {"id": "peoplegroup"}, {"id": "sonofgod"}]}, {"id": "11", "items": [{"id": "disciple"}, {"id": "god"}, {"id": "godthefather"}, {"id": "heaven"}, {"id": "holyspirit"}, {"id": "jerusalem"}, {"id": "jesus"}, {"id": "power"}]}], "id": "42"}, {"frames": [{"id": "01", "items": [{"id": "believer"}, {"id": "disciple"}, {"id": "heaven"}, {"id": "jerusalem"}, {"id": "jesus"}, {"id": "pray"}]}, {"id": "02", "items": [{"id": "heaven"}, {"id": "jerusalem"}, {"id": "jesus"}, {"id": "jew"}, {"id": "passover"}]}, {"id": "03", "items": [{"id": "believer"}, {"id": "holyspirit"}]}, {"id": "04", "items": [{"id": "believer"}, {"id": "god"}, {"id": "jerusalem"}]}, {"id": "05", "items": [{"id": "disciple"}, {"id": "fulfill"}, {"id": "holyspirit"}, {"id": "peter"}, {"id": "prophet"}]}, {"id": "06", "items": [{"id": "crucify"}, {"id": "god"}, {"id": "israel"}, {"id": "jesus"}, {"id": "miracle"}, {"id": "power"}]}, {"id": "07", "items": [{"id": "christ"}, {"id": "death"}, {"id": "fulfill"}, {"id": "god"}, {"id": "jesus"}, {"id": "life"}, {"id": "prophet"}, {"id": "raise"}, {"id": "witness"}]}, {"id": "08", "items": [{"id": "godthefather"}, {"id": "holyspirit"}, {"id": "jesus"}, {"id": "promise"}]}, {"id": "09", "items": [{"id": "christ"}, {"id": "crucify"}, {"id": "god"}, {"id": "jesus"}, {"id": "lord"}]}, {"id": "10", "items": [{"id": "disciple"}, {"id": "peter"}]}, {"id": "11", "items": [{"id": "baptize"}, {"id": "forgive"}, {"id": "god"}, {"id": "holyspirit"}, {"id": "jesus"}, {"id": "peter"}, {"id": "repent"}, {"id": "sin"}]}, {"id": "12", "items": [{"id": "baptize"}, {"id": "believe"}, {"id": "church"}, {"id": "disciple"}, {"id": "jerusalem"}, {"id": "jesus"}, {"id": "peter"}]}, {"id": "13", "items": [{"id": "apostle"}, {"id": "believer"}, {"id": "disciple"}, {"id": "god"}, {"id": "praise"}, {"id": "pray"}]}], "id": "43"}, {"frames": [{"id": "01", "items": [{"id": "beg"}, {"id": "johntheapostle"}, {"id": "peter"}, {"id": "temple"}]}, {"id": "02", "items": [{"id": "jesus"}, {"id": "peter"}]}, {"id": "03", "items": [{"id": "god"}, {"id": "heal"}, {"id": "praise"}, {"id": "temple"}]}, {"id": "04", "items": [{"id": "faith"}, {"id": "heal"}, {"id": "jesus"}, {"id": "peter"}, {"id": "power"}]}, {"id": "05", "items": [{"id": "christ"}, {"id": "death"}, {"id": "fulfill"}, {"id": "god"}, {"id": "jesus"}, {"id": "life"}, {"id": "prophet"}, {"id": "raise"}, {"id": "repent"}, {"id": "rome"}, {"id": "sin"}, {"id": "suffer"}]}, {"id": "06", "items": [{"id": "believe"}, {"id": "johntheapostle"}, {"id": "peter"}, {"id": "temple"}]}, {"id": "07", "items": [{"id": "highpriest"}, {"id": "jewishleaders"}, {"id": "johntheapostle"}, {"id": "peter"}, {"id": "power"}]}, {"id": "08", "items": [{"id": "christ"}, {"id": "crucify"}, {"id": "god"}, {"id": "heal"}, {"id": "jesus"}, {"id": "life"}, {"id": "peter"}, {"id": "power"}, {"id": "raise"}, {"id": "save"}]}, {"id": "09", "items": [{"id": "jesus"}, {"id": "jewishleaders"}, {"id": "johntheapostle"}, {"id": "peter"}]}], "id": "44"}, {"frames": [{"id": "01", "items": [{"id": "believe"}, {"id": "church"}, {"id": "holyspirit"}, {"id": "jesus"}, {"id": "miracle"}, {"id": "wise"}]}, {"id": "02", "items": [{"id": "evil"}, {"id": "god"}, {"id": "highpriest"}, {"id": "jesus"}, {"id": "jew"}, {"id": "jewishleaders"}, {"id": "moses"}, {"id": "witness"}]}, {"id": "03", "items": [{"id": "abraham"}, {"id": "christ"}, {"id": "disobey"}, {"id": "god"}, {"id": "highpriest"}, {"id": "holyspirit"}, {"id": "jesus"}, {"id": "prophet"}, {"id": "rebel"}, {"id": "true"}]}, {"id": "04", "items": [{"id": "jewishleaders"}]}, {"id": "05", "items": [{"id": "death"}, {"id": "jesus"}, {"id": "lord"}, {"id": "receive"}, {"id": "sin"}, {"id": "spirit"}]}, {"id": "06", "items": [{"id": "believer"}, {"id": "jerusalem"}, {"id": "jesus"}, {"id": "paul"}, {"id": "persecute"}, {"id": "preach"}]}, {"id": "07", "items": [{"id": "angel"}, {"id": "believer"}, {"id": "chariot"}, {"id": "disciple"}, {"id": "god"}, {"id": "holyspirit"}, {"id": "jerusalem"}, {"id": "jesus"}, {"id": "persecute"}, {"id": "preach"}, {"id": "samaria"}, {"id": "save"}]}, {"id": "08", "items": [{"id": "chariot"}, {"id": "isaiah"}, {"id": "lamb"}, {"id": "life"}]}, {"id": "09", "items": [{"id": "isaiah"}]}, {"id": "10", "items": [{"id": "goodnews"}, {"id": "isaiah"}, {"id": "jesus"}, {"id": "wordofgod"}]}, {"id": "11", "items": [{"id": "baptize"}, {"id": "chariot"}]}, {"id": "12", "items": [{"id": "baptize"}, {"id": "holyspirit"}, {"id": "jesus"}]}, {"id": "13", "items": [{"id": "jesus"}]}], "id": "45"}, {"frames": [{"id": "01", "items": [{"id": "believe"}, {"id": "believer"}, {"id": "highpriest"}, {"id": "jerusalem"}, {"id": "jesus"}, {"id": "paul"}, {"id": "persecute"}]}, {"id": "02", "items": [{"id": "lord"}, {"id": "paul"}, {"id": "persecute"}]}, {"id": "03", "items": [{"id": "paul"}]}, {"id": "04", "items": [{"id": "disciple"}, {"id": "god"}, {"id": "lord"}, {"id": "paul"}, {"id": "persecute"}, {"id": "suffer"}]}, {"id": "05", "items": [{"id": "baptize"}, {"id": "holyspirit"}, {"id": "jesus"}, {"id": "paul"}]}, {"id": "06", "items": [{"id": "believer"}, {"id": "christ"}, {"id": "jesus"}, {"id": "jew"}, {"id": "paul"}, {"id": "preach"}, {"id": "sonofgod"}]}, {"id": "07", "items": [{"id": "jesus"}, {"id": "jew"}, {"id": "paul"}, {"id": "preach"}]}, {"id": "08", "items": [{"id": "apostle"}, {"id": "barnabas"}, {"id": "believer"}, {"id": "disciple"}, {"id": "jerusalem"}, {"id": "paul"}, {"id": "preach"}]}, {"id": "09", "items": [{"id": "barnabas"}, {"id": "christian"}, {"id": "church"}, {"id": "jerusalem"}, {"id": "jesus"}, {"id": "jew"}, {"id": "paul"}, {"id": "persecute"}]}, {"id": "10", "items": [{"id": "barnabas"}, {"id": "believe"}, {"id": "church"}, {"id": "fast"}, {"id": "goodnews"}, {"id": "holyspirit"}, {"id": "jesus"}, {"id": "paul"}, {"id": "pray"}, {"id": "pray"}, {"id": "preach"}]}], "id": "46"}, {"frames": [{"id": "01", "items": [{"id": "god"}, {"id": "goodnews"}, {"id": "jesus"}, {"id": "love"}, {"id": "paul"}, {"id": "philippi"}, {"id": "rome"}, {"id": "silas"}, {"id": "worship"}]}, {"id": "02", "items": [{"id": "baptize"}, {"id": "believe"}, {"id": "god"}, {"id": "jesus"}, {"id": "paul"}, {"id": "silas"}]}, {"id": "03", "items": [{"id": "demon"}, {"id": "demonpossessed"}, {"id": "lord"}, {"id": "paul"}, {"id": "pray"}, {"id": "servant"}, {"id": "silas"}]}, {"id": "04", "items": [{"id": "god"}, {"id": "paul"}, {"id": "save"}, {"id": "servant"}, {"id": "servant"}]}, {"id": "05", "items": [{"id": "demon"}, {"id": "jesus"}, {"id": "paul"}, {"id": "servant"}]}, {"id": "06", "items": [{"id": "servant"}]}, {"id": "07", "items": [{"id": "paul"}, {"id": "rome"}, {"id": "servant"}, {"id": "silas"}]}, {"id": "08", "items": [{"id": "god"}, {"id": "paul"}, {"id": "praise"}, {"id": "silas"}]}, {"id": "09", "items": []}, {"id": "10", "items": [{"id": "paul"}, {"id": "rome"}]}, {"id": "11", "items": [{"id": "believe"}, {"id": "goodnews"}, {"id": "jesus"}, {"id": "lord"}, {"id": "paul"}, {"id": "paul"}, {"id": "preach"}, {"id": "save"}, {"id": "save"}, {"id": "silas"}]}, {"id": "12", "items": [{"id": "baptize"}, {"id": "believe"}, {"id": "jesus"}, {"id": "joy"}, {"id": "paul"}, {"id": "silas"}]}, {"id": "13", "items": [{"id": "church"}, {"id": "goodnews"}, {"id": "jesus"}, {"id": "paul"}, {"id": "philippi"}, {"id": "silas"}]}, {"id": "14", "items": [{"id": "believer"}, {"id": "christian"}, {"id": "church"}, {"id": "goodnews"}, {"id": "jesus"}, {"id": "paul"}, {"id": "preach"}]}], "id": "47"}, {"frames": [{"id": "01", "items": [{"id": "adam"}, {"id": "death"}, {"id": "eve"}, {"id": "god"}, {"id": "love"}, {"id": "sin"}]}, {"id": "02", "items": [{"id": "adam"}, {"id": "death"}, {"id": "eve"}, {"id": "god"}, {"id": "satan"}, {"id": "sin"}]}, {"id": "03", "items": [{"id": "adam"}, {"id": "eve"}, {"id": "god"}, {"id": "sin"}]}, {"id": "04", "items": [{"id": "christ"}, {"id": "descendant"}, {"id": "eve"}, {"id": "god"}, {"id": "jesus"}, {"id": "life"}, {"id": "promise"}, {"id": "raise"}, {"id": "satan"}]}, {"id": "05", "items": [{"id": "believe"}, {"id": "god"}, {"id": "jesus"}, {"id": "save"}, {"id": "sin"}]}, {"id": "06", "items": [{"id": "god"}, {"id": "highpriest"}, {"id": "jesus"}, {"id": "priest"}, {"id": "punish"}, {"id": "sacrifice"}, {"id": "sin"}]}, {"id": "07", "items": [{"id": "abraham"}, {"id": "believe"}, {"id": "bless"}, {"id": "descendant"}, {"id": "god"}, {"id": "jesus"}, {"id": "peoplegroup"}, {"id": "save"}, {"id": "spirit"}]}, {"id": "08", "items": [{"id": "abraham"}, {"id": "death"}, {"id": "god"}, {"id": "isaac"}, {"id": "jesus"}, {"id": "lamb"}, {"id": "lamb"}, {"id": "sacrifice"}, {"id": "sin"}, {"id": "son"}]}, {"id": "09", "items": [{"id": "blood"}, {"id": "egypt"}, {"id": "god"}, {"id": "israel"}, {"id": "lamb"}, {"id": "passover"}]}, {"id": "10", "items": [{"id": "believe"}, {"id": "blood"}, {"id": "god"}, {"id": "jesus"}, {"id": "lamb"}, {"id": "passover"}, {"id": "punish"}, {"id": "sin"}]}, {"id": "11", "items": [{"id": "believe"}, {"id": "covenant"}, {"id": "god"}, {"id": "israel"}, {"id": "newcovenant"}, {"id": "peoplegroup"}]}, {"id": "12", "items": [{"id": "god"}, {"id": "jesus"}, {"id": "moses"}, {"id": "prophet"}, {"id": "wordofgod"}]}, {"id": "13", "items": [{"id": "christ"}, {"id": "david"}, {"id": "descendant"}, {"id": "god"}, {"id": "jesus"}, {"id": "promise"}, {"id": "sonofgod"}]}, {"id": "14", "items": [{"id": "david"}, {"id": "israel"}, {"id": "jesus"}, {"id": "justice"}, {"id": "king"}, {"id": "kingdomofgod"}, {"id": "peace"}]}], "id": "48"}, {"frames": [{"id": "01", "items": [{"id": "jesus"}, {"id": "mary"}, {"id": "sonofgod"}, {"id": "virgin"}]}, {"id": "02", "items": [{"id": "death"}, {"id": "demon"}, {"id": "god"}, {"id": "heal"}, {"id": "jesus"}, {"id": "miracle"}, {"id": "raise"}]}, {"id": "03", "items": [{"id": "jesus"}, {"id": "love"}, {"id": "sonofgod"}]}, {"id": "04", "items": [{"id": "god"}, {"id": "love"}]}, {"id": "05", "items": [{"id": "jesus"}, {"id": "kingdomofgod"}, {"id": "save"}, {"id": "sin"}]}, {"id": "06", "items": [{"id": "goodnews"}, {"id": "jesus"}, {"id": "kingdomofgod"}, {"id": "receive"}, {"id": "save"}, {"id": "wordofgod"}]}, {"id": "07", "items": [{"id": "forgive"}, {"id": "god"}, {"id": "jesus"}, {"id": "love"}, {"id": "sin"}]}, {"id": "08", "items": [{"id": "adam"}, {"id": "descendant"}, {"id": "eve"}, {"id": "god"}, {"id": "jesus"}, {"id": "sin"}, {"id": "sin"}]}, {"id": "09", "items": [{"id": "believe"}, {"id": "god"}, {"id": "jesus"}, {"id": "life"}, {"id": "love"}, {"id": "punish"}, {"id": "sin"}, {"id": "sonofgod"}]}, {"id": "10", "items": [{"id": "cross"}, {"id": "death"}, {"id": "god"}, {"id": "guilt"}, {"id": "jesus"}, {"id": "punish"}, {"id": "receive"}, {"id": "sin"}]}, {"id": "11", "items": [{"id": "death"}, {"id": "forgive"}, {"id": "god"}, {"id": "jesus"}, {"id": "punish"}, {"id": "sacrifice"}, {"id": "sin"}]}, {"id": "12", "items": [{"id": "believe"}, {"id": "cross"}, {"id": "death"}, {"id": "god"}, {"id": "jesus"}, {"id": "life"}, {"id": "raise"}, {"id": "save"}, {"id": "sin"}, {"id": "sonofgod"}]}, {"id": "13", "items": [{"id": "believe"}, {"id": "god"}, {"id": "jesus"}, {"id": "lord"}, {"id": "love"}, {"id": "receive"}, {"id": "save"}]}, {"id": "14", "items": [{"id": "baptize"}, {"id": "believe"}, {"id": "christ"}, {"id": "cross"}, {"id": "death"}, {"id": "god"}, {"id": "jesus"}, {"id": "punish"}, {"id": "sin"}, {"id": "sonofgod"}]}, {"id": "15", "items": [{"id": "believe"}, {"id": "christian"}, {"id": "god"}, {"id": "jesus"}, {"id": "kingdom"}, {"id": "kingdomofgod"}, {"id": "satan"}]}, {"id": "16", "items": [{"id": "christian"}, {"id": "forgive"}, {"id": "god"}, {"id": "jesus"}, {"id": "sin"}]}, {"id": "17", "items": [{"id": "christian"}, {"id": "faithful"}, {"id": "forgive"}, {"id": "god"}, {"id": "jesus"}, {"id": "lord"}, {"id": "obey"}, {"id": "servant"}, {"id": "sin"}, {"id": "tempt"}]}, {"id": "18", "items": [{"id": "christian"}, {"id": "god"}, {"id": "pray"}, {"id": "wordofgod"}, {"id": "worship"}]}], "id": "49"}, {"frames": [{"id": "01", "items": [{"id": "christ"}, {"id": "church"}, {"id": "goodnews"}, {"id": "jesus"}, {"id": "promise"}]}, {"id": "02", "items": [{"id": "disciple"}, {"id": "god"}, {"id": "goodnews"}, {"id": "holy"}, {"id": "jesus"}, {"id": "kingdomofgod"}, {"id": "preach"}]}, {"id": "03", "items": [{"id": "christian"}, {"id": "disciple"}, {"id": "goodnews"}, {"id": "heaven"}, {"id": "jesus"}, {"id": "peoplegroup"}]}, {"id": "04", "items": [{"id": "faithful"}, {"id": "jesus"}, {"id": "lord"}, {"id": "satan"}, {"id": "save"}, {"id": "servant"}, {"id": "suffer"}]}, {"id": "05", "items": [{"id": "disciple"}, {"id": "good"}, {"id": "jesus"}]}, {"id": "06", "items": [{"id": "good"}, {"id": "lord"}, {"id": "servant"}]}, {"id": "07", "items": [{"id": "lord"}, {"id": "servant"}]}, {"id": "08", "items": [{"id": "christ"}, {"id": "disciple"}, {"id": "good"}, {"id": "jesus"}, {"id": "kingdomofgod"}]}, {"id": "09", "items": [{"id": "angel"}, {"id": "evil"}, {"id": "god"}, {"id": "satan"}]}, {"id": "10", "items": [{"id": "angel"}, {"id": "godthefather"}, {"id": "kingdom-of-god"}, {"id": "righteous"}, {"id": "satan"}, {"id": "suffer"}]}, {"id": "11", "items": [{"id": "christian"}, {"id": "death"}, {"id": "jesus"}, {"id": "raise"}]}, {"id": "12", "items": [{"id": "christian"}, {"id": "death"}, {"id": "jesus"}, {"id": "life"}, {"id": "raise"}]}, {"id": "13", "items": [{"id": "believe"}, {"id": "god"}, {"id": "jesus"}, {"id": "life"}, {"id": "peace"}, {"id": "promise"}]}, {"id": "14", "items": [{"id": "believe"}, {"id": "god"}, {"id": "hell"}, {"id": "jesus"}, {"id": "judge"}]}, {"id": "15", "items": [{"id": "god"}, {"id": "hell"}, {"id": "jesus"}, {"id": "kingdom"}, {"id": "obey"}, {"id": "satan"}]}, {"id": "16", "items": [{"id": "adam"}, {"id": "curse"}, {"id": "disobey"}, {"id": "eve"}, {"id": "god"}, {"id": "heaven"}, {"id": "sin"}]}, {"id": "17", "items": [{"id": "death"}, {"id": "evil"}, {"id": "jesus"}, {"id": "justice"}, {"id": "kingdomofgod"}, {"id": "peace"}, {"id": "suffer"}]}], "id": "50"}], "date_modified": "20150924"});

        var data = {
            chapters: [
                {
                    frames: [
                        {
                            id: "01-01",
                            img: "https://api.unfoldingword.org/obs/jpg/1/en/360px/obs-en-01-01.jpg",
                            text: "This is how the beginning of everything happened. God created the universe and everything in it in six days. After God created the earth it was dark and empty, and nothing had been formed in it. But God’s Spirit was there over the water."
                        },
                        {
                            id: "01-02",
                            img: "https://api.unfoldingword.org/obs/jpg/1/en/360px/obs-en-01-02.jpg",
                            text: "Then God said, “Let there be light!” And there was light. God saw that the light was good and called it “day.” He separated it from the darkness, which he called “night.” God created the light on the first day of creation."
                        }
                    ],
                    number: "01",
                    ref: "A Bible story from: Genesis 1-2",
                    title: "1. The Creation"
                },
                {
                    frames: [
                        {
                            id: "02-01",
                            img: "https://api.unfoldingword.org/obs/jpg/1/en/360px/obs-en-02-01.jpg",
                            text: "Adam and his wife were very happy living in the beautiful garden God had made for them. Neither of them wore clothes, but this did not cause them to feel any shame, because there was no sin in the world. They often walked in the garden and talked with God."
                        },
                        {
                            id: "02-02",
                            img: "https://api.unfoldingword.org/obs/jpg/1/en/360px/obs-en-02-02.jpg",
                            text: "But there was a crafty snake in the garden. He asked the woman, “Did God really tell you not to eat the fruit from any of the trees in the garden?”"
                        }
                    ],
                    number: "02",
                    ref: "A Bible story from: Genesis 3",
                    title: "2. Sin Enters the World"
                }
            ]
        };

        return client.legacy_tools.convertResource('en', 'obs', 'obs', JSON.stringify(data))
            .then(function(container) {
                let rc = require('resource-container');
                expect(rc.tools.makeSlug.mock.calls.length).toEqual(1);
                expect(library.public_getters.getSourceLanguage.mock.calls.length).toEqual(1);
                expect(library.public_getters.getProject.mock.calls.length).toEqual(1);
                expect(library.public_getters.getResource.mock.calls.length).toEqual(1);
                expect(rc.tools.convertResource.mock.calls.length).toEqual(1);
                expect(container).not.toBeNull();
            });
    });
});

describe('Update check', () => {

    var client, request, library, fs, rc;

    beforeEach(() => {
        jest.mock('fs');

        fs = require('fs');
        rc = require('resource-container');
        var Client = require('../');

        fs.writeFileSync(config.schemaPath, '');
        fs.writeFileSync(config.dbPath, '');

        client = new Client(config.dbPath, config.resDir);
        var Library = require('../lib/library');
        library = new Library(null);
        request = require('../lib/request');
    });

    it('should display a list of available language updates', () => {
        // downloaded containers
        fs.writeFileSync(config.resDir + '1en-container.ts', '');
        fs.writeFileSync(config.resDir + '2de-container.ts', '');
        fs.writeFileSync(config.resDir + 'de-container', '');
        fs.writeFileSync(config.resDir + '3ru-container.ts', '');
        // indexed projects
        library.__queueResponse = [
            {
                slug: 'fr',
                modified_at: 100
            },
            {
                slug: 'es',
                modified_at: 0
            },
            {
                slug: 'en',
                modified_at: 100
            },
            {
                slug: 'de',
                modified_at: 0
            },
            {
                slug: 'ru',
                modified_at: 1
            }
        ];
        // downloaded container info
        rc.__queueResponse = {
            package_version: '1.0',
            type: 'book',
            modified_at: 0,
            content_mime_type: 'text/usfm',
            language: {
                slug: 'en'
            }
        };
        rc.__queueResponse = {
            package_version: '1.0',
            type: 'book',
            modified_at: 100,
            content_mime_type: 'text/usfm',
            language: {
                slug: 'de'
            }
        };
        rc.__queueResponse = {
            package_version: '1.0',
            type: 'book',
            modified_at: 1,
            content_mime_type: 'text/usfm',
            language: {
                slug: 'ru'
            }
        };
        let expected = ['en'];
        return client.findUpdates.sourceLanguages()
            .then(function(languages) {
                expect(languages.sort()).toEqual(expected.sort());
            });
    });

    it('should display a list of available project updates', () => {
        // downloaded containers
        fs.writeFileSync(config.resDir + '1gen-container.ts', '');
        fs.writeFileSync(config.resDir + '2ex-container.ts', '');
        fs.writeFileSync(config.resDir + 'ex-container', '');
        fs.writeFileSync(config.resDir + '3num-container.ts', '');
        // indexed projects
        library.__queueResponse = [
            {
                slug: 'obs',
                modified_at: 100
            },
            {
                slug: 'lev',
                modified_at: 0
            },
            {
                slug: 'gen',
                modified_at: 100
            },
            {
                slug: 'ex',
                modified_at: 0
            },
            {
                slug: 'num',
                modified_at: 1
            }
        ];
        // downloaded container info
        rc.__queueResponse = {
            package_version: '1.0',
            type: 'book',
            modified_at: 0,
            content_mime_type: 'text/usfm',
            project: {
                slug: 'gen'
            }
        };
        rc.__queueResponse = {
            package_version: '1.0',
            type: 'book',
            modified_at: 100,
            content_mime_type: 'text/usfm',
            project: {
                slug: 'ex'
            }
        };
        rc.__queueResponse = {
            package_version: '1.0',
            type: 'book',
            modified_at: 1,
            content_mime_type: 'text/usfm',
            project: {
                slug: 'num'
            }
        };
        let expected = ['gen'];
        return client.findUpdates.projects()
            .then(function(projects) {
                expect(projects.sort()).toEqual(expected.sort());
            });
    });

    it('should display a list of available project updates within a single source language', () => {
        let langSlug = 'en';
        // downloaded containers
        fs.writeFileSync(config.resDir + '1gen-container.ts', '');
        fs.writeFileSync(config.resDir + '2ex-container.ts', '');
        fs.writeFileSync(config.resDir + '3ex-container', '');
        fs.writeFileSync(config.resDir + '4num-container.ts', '');
        fs.writeFileSync(config.resDir + '5dut-container.ts', '');
        // indexed projects
        library.__queueResponse = [
            {
                slug: 'obs',
                modified_at: 100
            },
            {
                slug: 'lev',
                modified_at: 0
            },
            {
                slug: 'gen',
                modified_at: 100
            },
            {
                slug: 'ex',
                modified_at: 0
            },
            {
                slug: 'num',
                modified_at: 1
            },
            {
                slug: 'dut',
                modified_at: 100
            }
        ];
        // downloaded container info
        rc.__queueResponse = {
            package_version: '1.0',
            type: 'book',
            modified_at: 0,
            content_mime_type: 'text/usfm',
            project: {
                slug: 'gen'
            },
            language: {
                slug: 'es'
            }
        };
        rc.__queueResponse = {
            package_version: '1.0',
            type: 'book',
            modified_at: 100,
            content_mime_type: 'text/usfm',
            project: {
                slug: 'ex'
            },
            language: {
                slug: langSlug
            }
        };
        rc.__queueResponse = {
            package_version: '1.0',
            type: 'book',
            modified_at: 1,
            content_mime_type: 'text/usfm',
            project: {
                slug: 'num'
            },
            language: {
                slug: langSlug
            }
        };
        rc.__queueResponse = {
            package_version: '1.0',
            type: 'book',
            modified_at: 0,
            content_mime_type: 'text/usfm',
            project: {
                slug: 'dut'
            },
            language: {
                slug: langSlug
            }
        };
        let expected = ['dut'];
        return client.findUpdates.projects(langSlug)
            .then(function(projects) {
                expect(projects.sort()).toEqual(expected.sort());
            });
    });

    it('should download and index tA', function() {
        request.__queueStatusCode = 200;
        request.__queueResponse = JSON.stringify({
            articles: [
                {
                    depend: [
                        "ta_intro",
                        "translation_guidelines",
                        "finding_answers"
                    ],
                    id: "translate_manual",
                    question: "What is the Translation Manual?",
                    recommend: [
                        "translate_why",
                        "guidelines_intro",
                        "translate_process",
                        "translation_difficulty"
                    ],
                    ref: "vol1/translate/translate_manual",
                    text: "### What Does the Translation Manual Teach? This manual teaches translation theory and how to make a good translation for Other Languages (OLs). Some of the principles of translation in this manual also apply to Gateway Language translation. For specific instruction on how to translate the set of translation tools for Gateway Languages, however, please see the Gateway Language Manual. It will be very helpful to study many of these modules before starting any type of translation project. Other modules, such as the ones about grammar, are only needed for \"just-in-time\" learning. Some highlights in the Translation Manual: * [The Qualities of a Good Translation](https://git.door43.org/Door43/en-ta-translate-vol1/src/master/content/guidelines_intro.md) - defining a good translation * [The Translation Process](https://git.door43.org/Door43/en-ta-translate-vol1/src/master/content/translate_process.md) - how to achieve a good translation * [Choosing a Translation Team](https://git.door43.org/Door43/en-ta-translate-vol1/src/master/content/choose_team.md) - some items to consider before starting a translation project * [Choosing What to Translate](https://git.door43.org/Door43/en-ta-translate-vol1/src/master/content/translation_difficulty.md) - what to start translating ",
                    title: "Introduction to Translation Manual"
                }
            ],
            meta: {
                language: {
                    anglicized_name: "English",
                    direction: "ltr",
                    lc: "en",
                    name: "English"
                },
                manual: "translate",
                manual_title: "Translation Manual Volume 1",
                mod: 1467416351,
                status: {
                    checking_entity: "Wycliffe Associates",
                    checking_level: "3",
                    comments: "",
                    contributors: "unfoldingWord; Wycliffe Associates",
                    license: "CC BY-SA 4.0",
                    publish_date: "2016-07-01",
                    source_text: "en",
                    source_text_version: "5",
                    version: "5"
                },
                volume: "1"
            }
        });
        request.__setStatusCode = 400;

        return client.updateTA()
            .then(() => {
                expect(library.addSourceLanguage.mock.calls.length).toEqual(1);
                expect(library.addProject.mock.calls.length).toEqual(1);
                expect(library.addResource.mock.calls.length).toEqual(1);
                // TODO: test adding ta
            })
            .catch((err) => {
                expect(err.status).toEqual(400);
            });
    });

    it('should download and index chunks', function() {
        library.__queueResponse = [{
            slug: 'gen'
        }];
        library.__queueResponse = {
            name: 'American English',
            slug: 'en-US',
            id: 1
        };
        request.__queueStatusCode = 200;
        request.__queueResponse = JSON.stringify([
            {
                chp: "01",
                firstvs: "01"
            },
            {
                chp: "01",
                firstvs: "03"
            },
            {
                chp: "01",
                firstvs: "06"
            },
            {
                chp: "01",
                firstvs: "09"
            }
        ]);
        request.__setStatusCode = 400;

        return client.updateChunks()
            .then(() => {
                expect(library.addChunkMarker.mock.calls.length).toEqual(4);
            })
            .catch((err) => {
                expect(err.status).toEqual(400);
            });
    });
});