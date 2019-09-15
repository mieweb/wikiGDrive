const mongo = require('mongoose');

const ActivitySchema = new mongo.Schema({
    email: {
        type: String,
        default: ''
    },
    token: {
        type: String,
        default: '',
    },
    login_time: {
        type: Date,
        default: Date.now()
    },
    logout_time: {
        type: Date,
        default: null
    }
});

module.exports = mongo.model('Activity', ActivitySchema);