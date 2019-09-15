const mongoose = require('mongoose');

const History = mongoose.Schema({
    address: {
        type: String,
        default: ''
    },
    hash: {
        type: String,
        default: ''
    },
    time: {
        type: Date,
        default: Date.now()
    }
});

module.exports = mongoose.model('History', History);