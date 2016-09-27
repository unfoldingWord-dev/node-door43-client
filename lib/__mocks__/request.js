'use strict';

var responses = [];
var statusCode = 200;
var statusCodes = [];

var request = {
    set __queueResponse (data) {
        responses.push(data);
    },

    set __setStatusCode(code) {
        statusCode = code;
    },

    set __queueStatusCode(code) {
        statusCodes.push(code);
    },

    read: jest.fn(function(uri) {
        return Promise.resolve({
            status: statusCodes.length ? statusCodes.shift() : statusCode,
            data: responses.shift()
        });
    }),
    download: jest.fn(function(uri, dest) {
        return Promise.resolve({
            status: statusCodes.length ? statusCodes.shift() : statusCode
        });
    })
};

module.exports = request;