'use strict';

jest.unmock('../lib/utils');
jest.unmock('rimraf');
jest.unmock('../lib/main');

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
            .then((success) => {
                expect(success).toBeTruthy();
                expect(library.addProject.mock.calls.length).toEqual(1);
                expect(library.addSourceLanguage.mock.calls.length).toEqual(1);
                expect(library.addResource.mock.calls.length).toEqual(1);
            })
            .catch(function(err) {
                throw err;
            });
    });

    // TODO: test parts of update failing.
    // TODO: pass parameter to index update that will allow it to be lazy (not fail if an item fails).

    it('should download a global catalog', () => {
        library.__setResponse = {
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

    // TODO: test catalog download failing

    it('should download a resource container', () => {
        library.__setResponse = {
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

        return client.downloadResourceContainer('en', 'obs', 'obs')
            .then((success) => {
                expect(success).toBeTruthy();
                expect(request.download.mock.calls.length).toEqual(1);
            })
            .catch(function(err) {
                throw err;
            });
    });

    // TODO: test resource container download failing


});