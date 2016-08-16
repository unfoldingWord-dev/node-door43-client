'use strict';

let fs = require('fs'),
    SQL = require('sql.js'),
    _ = require('lodash');

function helper (schemaPath, dbPath) {

    let sql;

    function parameterize (query, params) {
        if(params) {
            if (params.constructor === Array) {
                _.forEach(params, function(value, index) {
                    if(value === undefined) throw new Error('The sql parameter at position ' + index + ' is undefined');
                    query = _.replace(query, '?', value);
                });
            } else if (typeof params === 'object') {
                params = _.mapKeys(params, function (value, key) {
                    return ':' + _.trimStart(key, ':');
                });
                _.each(params, function (value, key) {
                    if(value === undefined) throw new Error('The sql parameter at position ' + key + ' is undefined');
                    query = _.replace(query, new RegExp(key, 'g'), (value === undefined ? 'NULL' : value));
                });
            }
        }
        return query;
    }

    function query (query, params) {
        return sql.exec.bind(sql)(parameterize(query, params));
    }

    function run(query, params) {
        return sql.run.bind(sql)(parameterize(query, params));
    }

    let schema = fs.readFileSync(schemaPath);

    sql = new SQL.Database();
    sql.run(schema);

    return {query: jest.fn(query), save: jest.fn(function(){}), run: jest.fn(run)};
}

module.exports = helper;
