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

// Parameters
const headerColor = chalk.white;

// Positions that are provided by the API but which the
// API itself is unable to process.
const unknownPositions = ['DE/DT'];

// The API does not give us a set of long descriptions for the various
// positions so we provide them here.
// Provided by http://stats.washingtonpost.com/fb/glossary.asp
const nflPositions = {
    QB: "Quarterback",
    RB: "Running Back",
    FB: "Fullback",
    WR: "Wide Receiver",
    TE: "Tight End",
    OL: "Offensive Lineman",
    C: "Center",
    G: "Guard",
    LG: "Left Guard",
    RG: "Right Guard",
    T: "Tackle",
    LT: "Left Tackle",
    RT: "Right Tackle",
    K: "Kicker",
    KR: "Kick Returner",
    DL: "Defensive Lineman",
    DE: "Defensive End",
    DT: "Defensive Tackle",
    NT: "Nose Tackle",
    LB: "Linebacker",
    ILB: "Inside Linebacker",
    OLB: "Outside Linebacker",
    MLB: "Middle Linebacker",
    DB: "Defensive Back",
    CB: "Cornerback",
    FS: "Free Safety",
    SS: "Strong Safety",
    S: "Safety",
    P: "Punter",
    PR: "Punt Returner",
};

function nflPosition(code) {
    return nflPositions[code] || code;
}

Object.freeze(nflPositions); // We can do this without performance concerns.

function fetchJson(uri) {
    return fetch(uri).then(res => res.json());
}

const print = console.log

var fmt = format(66);


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
                console.log(fmt.string(`Error fetching ${itemUri}`).color('purple').str);
                return Promise.resolve({
                    position: itemPosition.position,
                    totalArrests: itemPosition.arrest_count,
                    crime: "Unknown",
                    arrestsForCrime: "Unknown"
                });
            });
        }));
    });
}

function tableHeader(headerData) {
    return headerData.map(item => headerColor(item));
}

var intro = `
This application shows the user the most frequently commit crimes
committed by professional NFL players, sorted by the position they
play.

This example was chosen because an API for NFL data was freely
available and required multiple queries of the API in order to
retrieve these data.

Please see the code for comments about how the code was written.
`;

print("\n");
print(fmt.string("Correlation is not Causation").color('white').center().str);
print(fmt.string("by David Marrs").center().str);
print("\n");
print(intro);

retrieveData().then(data => {
    // Now format the data
    var tableData = [tableHeader(['NFL Position', 'Most frequent offence', 'Number of arrests'])].concat(data.map(line => {
        return [
            nflPosition(line.position), line.crime, [line.arrestsForCrime, line.totalArrests].join(' of ')
        ];
    }));

    var tableOutput = table(tableData);


    print(tableOutput);
}).catch(err => {
    // Log errors
    var tableData = [tableHeader(['NFL Position', 'Most frequent offence', 'Number of arrests'])];

    var tableOutput = table(tableData);
    print(tableOutput);
    print(fmt.string("NFL data could not be retrieved").center().color('purple').str);
    print('');
});
