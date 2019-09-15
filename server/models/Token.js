const mongoose = require('mongoose');

const Token = mongoose.Schema({
    address: {
        type: String,
        default: "",
    },
    contract_address: {
        type: String,
        default: "",
    },
    symbol: {
        type: String,
        default: "",
    },
    decimal: {
        type: String,
        default: ""
    },
    balance: {
        type: String,
        default: ''
    }
});

module.exports = mongoose.model('Token', Token);