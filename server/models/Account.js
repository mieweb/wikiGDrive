const mongoose = require('mongoose');

const AccountSchema = mongoose.Schema({
    email: {
        type: String,
        default: '',
    },
    address: {
        type: String,
        default: '',
    },
    register_date: {
        type: Date,
        default: Date.now()
    }
});

module.exports = mongoose.model('account', AccountSchema);