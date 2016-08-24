'use strict';

let fs = require('fs'),
    SQL = require('sql.js'),
    _ = require('lodash');

function helper (schemaPath, dbPath) {

    let sql;

    function normalizeParams(params) {
        if (params && params.constructor !== Array && typeof params === 'object') {
            params = _.mapKeys(params, function (value, key) {
                return ':' + _.trimStart(key, ':');
            });
        }
        return params;
    }

    function query (query, params) {
        let rows = [];
        let stmt = sql.prepare(query);
        params = normalizeParams(params);
        stmt.bind(params);
        while(stmt.step()) {
            rows.push(stmt.getAsObject());
        }
        stmt.free();
        return rows;
    }

    function run(query, params) {
        let stmt = sql.prepare(query);
        params = normalizeParams(params);
        stmt.bind(params);
        stmt.step();
        stmt.reset();
        // stmt.run(params);
        stmt.free();
    }

    let schema = fs.readFileSync(schemaPath);

    sql = new SQL.Database();
    sql.run(schema);

    return {query: jest.fn(query), save: jest.fn(function(){}), run: jest.fn(run)};
}

module.exports = helper;
