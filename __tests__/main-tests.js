'use strict';

jest.unmock('fs');
jest.unmock('mkdirp');
jest.unmock('rimraf');
jest.unmock('../lib/utils/promises');
jest.unmock('../lib/utils/files');
jest.unmock('../lib/main');
jest.unmock('yamljs');
jest.unmock('lodash');

var rimraf = require('rimraf');

const config = {
    schemaPath: './lib/schema.sqlite',
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
        request.__queueResponse = '[{"chp": "01", "firstvs": "01"}, {"chp": "01", "firstvs": "05"}, {"chp": "01", "firstvs": "08"}]';
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
                expect(library.addChunkMarker.mock.calls.length).toEqual(3); // chunks
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
        library.__queueResponse = {
            id: 1,
            slug: 'obs',
            formats: [
                {
                    syntax_version: '1.0',
                    mime_type: 'application/ts+book',
                    modified_at: 0,
                    url: 'some/url',
                }
            ]
        };


        return client.downloadFutureCompatibleResourceContainer('en', 'obs', 'obs')
            .then(() => {
                expect(request.download.mock.calls.length).toEqual(1);
            })
            .catch(function(err) {
                throw err;
            });
    });


    it('should not download a missing resource container', () => {
        library.__queueResponse = null;

        return client.downloadFutureCompatibleResourceContainer('en', 'obs', 'obs')
            .then(() => {
                throw Error();
            })
            .catch(function(err) {
                expect(err.message).toEqual('Unknown resource');
                expect(request.download.mock.calls.length).toEqual(0);
            });
    });

    it('should not download a missing resource container format', () => {
        library.__queueResponse = {
            id: 1,
            slug: 'obs',
            formats: [
                {
                    syntax_version: '1.0',
                    mime_type: 'pdf',
                    modified_at: 0,
                    url: 'some/url',
                }
            ]
        };

        return client.downloadFutureCompatibleResourceContainer('en', 'obs', 'obs')
            .then(() => {
                throw Error();
            })
            .catch(function(err) {
                expect(err.message).toEqual('Missing resource container format');
                expect(request.download.mock.calls.length).toEqual(0);
            });
    });

    it('should not download a resource container with no formats', () => {
        library.__queueResponse = {
            id: 1,
            slug: 'obs',
            formats: []
        };

        return client.downloadFutureCompatibleResourceContainer('en', 'obs', 'obs')
            .then(() => {
                throw Error();
            })
            .catch(function(err) {
                expect(err.message).toEqual('Missing resource container format');
                expect(request.download.mock.calls.length).toEqual(0);
            });
    });

    it('should fail downloading a resource container', () => {
        library.__queueResponse = {
            id: 1,
            slug: 'obs',
            formats: [
                {
                    syntax_version: '1.0',
                    mime_type: 'application/ts+book',
                    modified_at: 0,
                    url: 'some/url',
                }
            ]
        };
        request.__setStatusCode = 400;

        return client.downloadFutureCompatibleResourceContainer('en', 'obs', 'obs')
            .then(() => {
                throw Error();
            })
            .catch(function(err) {
                expect(err.status).toEqual(400);
                expect(request.download.mock.calls.length).toEqual(1);
            });
    });

    it('should build a resource container', () => {
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
                mime_type: 'application/ts+book',
                modified_at: 20151222120130,
                url: 'https://api.unfoldingword.org/ts/txt/2/obs/en/obs/source.json'
            }],
            project_id: 1,
            project_slug: 'obs',
            source_language_slug: 'en'
        };

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

        return client.legacy_tools.convertResource('en', 'obs', 'book', 'obs', JSON.stringify(data))
            .then(function() {
                let rc = require('door43-rc');
                expect(rc.tools.makeSlug.mock.calls.length).toEqual(1);
                expect(library.public_getters.getSourceLanguage.mock.calls.length).toEqual(1);
                expect(library.public_getters.getProject.mock.calls.length).toEqual(1);
                expect(library.public_getters.getResource.mock.calls.length).toEqual(1);
                expect(rc.tools.convertResource.mock.calls.length).toEqual(1);
            });
    });
});

describe('Update check', () => {

    var client, request, library, fs, rc;

    beforeEach(() => {
        jest.mock('fs');

        fs = require('fs');
        rc = require('door43-rc');
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
});