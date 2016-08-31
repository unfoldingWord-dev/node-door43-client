const readline = require('readline');

var lastProgressId;

/**
 * Displays a progress indicator in the console.
 * @param id
 * @param total
 * @param completed
 */
function writeProgress(id, total, completed) {
    var percent = Math.round(10 * (100 * completed) / total) / 10;
    if(id == lastProgressId) {
        readline.cursorTo(process.stdout, 0);
        readline.clearLine(process.stdout, 0);
    } else {
        lastProgressId = id;
        process.stdout.write('\n');
    }
    var progressTitles = {
        projects: 'Indexing Projects',
        chunks: 'Indexing Chunks',
        resources: 'Indexing Resources',
        container: 'Downloading Containers',
        catalog: 'Indexing Catalogs',
        langnames: 'Indexing Target Languages',
        'temp-langnames': 'Indexing Temporary Target Languages',
        'approved-temp-langnames': 'Indexing Approved Temporary Target Languages',
        'new-language-questions': 'Indexing Questionnaire'
    };
    process.stdout.write((progressTitles[id] || id) + ' ' + percent + '%');
}

module.exports.logProgress = writeProgress;