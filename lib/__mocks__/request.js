'use strict';

var responses = [];
var statusCode = 200;

var request = {
    set __queueResponse (data) {
        responses.push(data);
    },

    set __setStatusCode(code) {
        statusCode = code;
    },

    read: jest.fn(function(uri) {
        return Promise.resolve({
            status: statusCode,
            data: responses.shift()
        });
    }),
    download: jest.fn(function(uri, dest) {
        return Promise.resolve({
            status: statusCode
        });
    })
};

module.exports = request;