const chalk = require('chalk');

var formatStringTraits = {
    color: function(col) {
        this.str = chalk.keyword(col)(this.str);
        return this;
    },
    underline: function() {
        this.str = chalk.underline(this.str);
        return this;
    },
    center: function(str) {
        var { lineLength, strOriginal } = this;
        var strlen = strOriginal.length
        if (strlen >= lineLength -1) {
            return str;
        }
        var indent = Math.floor((lineLength - strlen)/2);
        var strIndent = new Array(indent).fill(' ').join('');
        this.str = strIndent + this.str;
        return this;
    }
};

var formatTraits = {
    string: function(str) {
        var { lineLength } = this;
        var obj = Object.create(formatStringTraits);
        obj.lineLength = lineLength;
        obj.strOriginal = str;
        obj.str = str;
        // Prevent developer from accidentally mutating original string
        Object.freeze(obj.strOriginal);
        return obj;
    }
}

function format(params) {
    var obj = Object.create(formatTraits);
    obj.lineLength = params.lineLength;
    return obj;
}

module.exports = format;
