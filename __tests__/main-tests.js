'use strict';

jest.unmock('fs');
jest.unmock('mkdirp');
jest.unmock('rimraf');
jest.unmock('../lib/utils/promises');
jest.unmock('../lib/main');
jest.unmock('yamljs');

var rimraf = require('rimraf');

const config = {
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
                date_modified: "20160728",
                lang_catalog: "https://api.unfoldingword.org/ts/txt/2/obs/languages.json?date_modified=20160728",
                meta: [ ],
                slug: "obs",
                sort: "01"
            }
        ]);
        request.__queueResponse = JSON.stringify([
            {
                language: {
                    date_modified: "20150826",
                    direction: "ltr",
                    name: "English",
                    slug: "en"
                },
                project: {
                    desc: "unfoldingWord | Open Bible Stories",
                    meta: [ ],
                    name: "Open Bible Stories"
                },
                res_catalog: "https://api.unfoldingword.org/ts/txt/2/obs/en/resources.json?date_modified=20150924"
            }
        ]);
        request.__queueResponse = JSON.stringify([
            {
                checking_questions: "https://api.unfoldingword.org/obs/txt/1/en/CQ-en.json?date_modified=20150924",
                date_modified: "20150924",
                name: "Open Bible Stories",
                notes: "https://api.unfoldingword.org/obs/txt/1/en/tN-en.json?date_modified=20150924",
                slug: "obs",
                source: "https://api.unfoldingword.org/obs/txt/1/en/obs-en.json?date_modified=20150826",
                status: {
                    checking_entity: "Distant Shores Media; Wycliffe Associates",
                    checking_level: "3",
                    comments: "Original source text.",
                    contributors: "Distant Shores Media",
                    publish_date: "2015-08-26",
                    source_text: "en",
                    source_text_version: "4",
                    version: "4"
                },
                terms: "https://api.unfoldingword.org/obs/txt/1/en/kt-en.json?date_modified=20150924",
                tw_cat: "https://api.unfoldingword.org/obs/txt/1/en/tw_cat-en.json?date_modified=20150924"
            }
        ]);
        return client.updateIndex(config.catalogUrl)
            .then(() => {
                expect(library.addProject.mock.calls.length).toEqual(1);
                expect(library.addSourceLanguage.mock.calls.length).toEqual(1);
                expect(library.addResource.mock.calls.length).toEqual(1);
            })
            .catch(function(err) {
                throw err;
            });
    });

    it('should fail to index the Door43 catalog', () => {
        request.__setStatusCode = 400;
        return client.updateIndex(config.catalogUrl)
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
        return client.downloadCatalog('langnames')
            .then(() => {
                expect(library.addTargetLanguage.mock.calls.length).toEqual(2);
            })
            .catch(function(err) {
                throw err;
            });

    });

    it('should not download a missing global catalog', () => {
        library.__queueResponse = null;

        return client.downloadCatalog('langnames')
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

        return client.downloadCatalog('langnames')
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

        return client.makeResourceContainer('en', 'obs', 'book', 'obs', JSON.stringify(data))
            .then(function() {
                // TODO: test
                expect(true).toBeTruthy();
            });
    });
});