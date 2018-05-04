'use strict';

// From Douglas Crockford's remedial javascript
// (http://www.crockford.com/javascript/remedial.html)
String.prototype.supplant = function(o) {
  return this.replace(/{([^{}]*)}/g,function(a, b) {
    var r = o[b];
    return typeof r === 'string' || typeof r === 'number' ? r : a;
  });
};

// Display top crimes per player position
//
const uriPosition = 'http://nflarrest.com/api/v1/position'; // Offending frequency of positions
const uriCrimes = 'http://nflarrest.com/api/v1/crime'; // Crime categories
const uriTopCrimeForPosition = 'http://nflarrest.com/api/v1/position/topCrimes/{positionId}?limit=1'; 

const fetch = require('node-fetch');
const table = require('table').table;
const chalk = require('chalk');
const format = require('./format');

function nflPosition(code) {
    return nflPositions[code] || code;
}

function fetchJson(uri) {
    return fetch(uri).then(res => res.json());
}

function tableHeader(headerData) {
    return headerData.map(item => chalk[titleColor](item));
}

function printQA(question, answer) {
    print(fmt.string(question).color(titleColor).str);
    print(answer);
}

// Positions that are provided by the API but which the
// API itself is unable to process.
const unknownPositions = ['DE/DT'];

// titleColor needs to be set according to terminal background color.
const titleColor = 'cyan';
const errorColor = 'magenta';

// The API does not give us a set of long descriptions for the various
// positions so we provide them here.
// Provided by http://stats.washingtonpost.com/fb/glossary.asp
const nflPositions = {
    QB: 'Quarterback',
    RB: 'Running Back',
    FB: 'Fullback',
    WR: 'Wide Receiver',
    TE: 'Tight End',
    OL: 'Offensive Lineman',
    C: 'Center',
    G: 'Guard',
    LG: 'Left Guard',
    RG: 'Right Guard',
    T: 'Tackle',
    LT: 'Left Tackle',
    RT: 'Right Tackle',
    K: 'Kicker',
    KR: 'Kick Returner',
    DL: 'Defensive Lineman',
    DE: 'Defensive End',
    DT: 'Defensive Tackle',
    NT: 'Nose Tackle',
    LB: 'Linebacker',
    ILB: 'Inside Linebacker',
    OLB: 'Outside Linebacker',
    MLB: 'Middle Linebacker',
    DB: 'Defensive Back',
    CB: 'Cornerback',
    FS: 'Free Safety',
    SS: 'Strong Safety',
    S: 'Safety',
    P: 'Punter',
    PR: 'Punt Returner',
};

Object.freeze(nflPositions); // We can do this without performance concerns.

const print = console.log

var fmt = format({
    lineLength: 66
});


// Wrapping in a function to make it clear where the separation of concerns
// lies - i.e. between data retrieval and formatting.
function retrieveData() {
    return fetchJson(uriPosition)
    .then(dataPosition => {
        var dataPositionSanitised = dataPosition.filter(item => {
            var itemPosition = item.Position;
            // We use a for loop so that we can exit the function
            // as soon as a match is made.
            for (let i = 0; i < unknownPositions.length; ++i) {
                if (itemPosition === unknownPositions[i]) {
                    return false;
                }
            }
            return true;
        });
        // This is the most expensive part of the algorithm as the map
        // over the first set of data is an O(sq(n)) operation, with
        // the HTTP request/response cycle likely to be the most significant
        // part of the operation.
        //
        // We attempt to bring down the upper bound by fetching as much data
        // in parallel as we can and resolving once all requests have
        // been completed.
        //
        // The efficacy of this is entirely dependent on our IO stack and
        // the remote API's ability to receive multiple incoming requests
        // from the same IP.
        return Promise.all(dataPositionSanitised.map(itemPosition => {
            const itemUri = uriTopCrimeForPosition.supplant({
                positionId: itemPosition.Position
            });
            return fetchJson(itemUri) 
            .then(dataCrimeForPosition => {
                // No need to map result this time as we know
                // that we are only fetching the first record.
                var itemCrime = dataCrimeForPosition[0];
                return {
                    position: itemPosition.Position,
                    totalArrests: itemPosition.arrest_count,
                    crime: itemCrime.Category,
                    arrestsForCrime: itemCrime.arrest_count
                };
            }).catch(err => {
                console.log(fmt.string(`Error fetching ${itemUri}`).color(errorColor).str);
                return Promise.resolve({
                    position: itemPosition.position,
                    totalArrests: itemPosition.arrest_count,
                    crime: 'Unknown',
                    arrestsForCrime: 'Unknown'
                });
            });
        }));
    });
}


print('\n');
print(fmt.string('Correlation is not Causation').color(titleColor).underline().center().str);
print(fmt.string('by David Marrs').center().str);
print('\n');
print(`
This application shows the most frequently committed crimes by
professional NFL players, sorted by the position they play.

This example was chosen because an API for NFL crime data was freely
available, did not require an API key to use, and required multiple
queries of the API in order to retrieve these data.

Please see the code for comments about how the code was written.

Fetching...
`);

var displayTable = new Promise((resolve, reject) => {
    var header = tableHeader(['NFL Position', 'Most frequent offence', 'Number of arrests']);
    retrieveData()
    .then(data => {
        // Now format the data
        var tableData = [header].concat(data.map(line => {
            return [
                nflPosition(line.position), line.crime, [line.arrestsForCrime, line.totalArrests].join(' of ')
            ];
        }));

        print(table(tableData));
        return resolve();
    }).catch(err => {
        // Log errors
        var tableData = [header];

        print(table(tableData));
        print(fmt.string('NFL data could not be retrieved').center().color(errorColor).str);
        print('');
        return resolve();
    });
});

displayTable.then(() => {
    print(fmt.string('Questions Answered').underline().color(titleColor).center().str);
    print('\n');

    printQA('Give a few reasons why separating state is useful.', `
There are a number of useful effects of separating state:
  * the developer can continue to reason about the code as it
    grows by modularising or categorising it;
  * coding tasks can be split across domains and teams;
  * testing is more effective as code can be tested in units.
    `);

    printQA('Are there any benefits to using ES6 classes and, if so, what are they?', `
The benefit of using ES6 classes is largely that they provide a
syntactic sugar that makes classes much more accessible to those
who are new to Javascript, especially those coming from other
languages, to whom traditional Javascript classes (also known as
constructor functions) are quite confusing.

They also enable programmers to replace some boilerplate code
with keywords like 'extends' and 'super'.
    `);

    printQA('What is immutability? How can this be useful', `
Immutability is a language feature that prevents a variable from
being mutated.  For statically typed languages, this is usually
a compiler feature.  For Javascript the rules vary depending on
the method used.

For const, a variable is made immutability effectively at compile
time, when the variable is first declared.  Other variables can
be made immutable at some time after initialisation has taken
place using Object.freeze,

Immutability can help protect a developer from modifying state
that should be left alone. In a language like Javascript,
which enables variable shadowing, it is easy to accidentally
mutate a variable. If it is made immutable, the app will throw
an error, either during the compilation phase or during runtime
depening on the object.
    `);

    printQA('What is the spread operator for?', `
It is syntactic sugar for Object.assign, which is a function for
taking a set of properties from one object and assigning them
to another, using the same keys.
    `);
});
