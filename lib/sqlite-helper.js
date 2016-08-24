'use strict';

let path = require('path'),
    fs = require('fs'),
    mkdirp = require('mkdirp'),
    SQL = require('sql.js'),
    _ = require('lodash');

/**
 * A SQLite database helper
 * @param schemaPath
 * @param dbPath
 * @returns {{query: query, save: (function(this:null)), run: run}}
 */
function SQLiteHelper (schemaPath, dbPath) {

    let dbFilePath = dbPath,
        dbDirPath = path.dirname(dbFilePath),
        sql;
    
    function saveDB (sql) {
        let data = sql.export();
        let buffer = new Buffer(data);

        mkdirp.sync(dbDirPath, '0755');
        fs.writeFileSync(dbFilePath, buffer);
    }

    /**
     * Prefixes object params with ':'
     * @param params
     * @returns {Array|Object}
     */
    function normalizeParams(params) {
        if (params && params.constructor !== Array && typeof params === 'object') {
            params = _.mapKeys(params, function (value, key) {
                return ':' + _.trimStart(key, ':');
            });
        }
        return params;
    }

    /**
     * Executes a command returning the results
     * @param query
     * @param params {Array|Object}
     * @returns {Array}
     */
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

    /**
     * Executes a command ignoring the results
     * @param query
     * @param params {Array|Object}
     */
    function run(query, params) {
        let stmt = sql.prepare(query);
        params = normalizeParams(params);
        stmt.run(params);
        stmt.free();
    }

    if (!fs.existsSync(dbFilePath)) {
        let schema = fs.readFileSync(schemaPath);

        sql = new SQL.Database();
        sql.run(schema);

        saveDB(sql);
    } else {
        let buffer = fs.readFileSync(dbFilePath);

        sql = new SQL.Database(buffer);
    }
    
    return {query: query, save: saveDB.bind(null, sql), run: run};
}

module.exports = SQLiteHelper;
