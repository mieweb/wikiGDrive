const User = require('../../models/User');
const Activity = require('../../models/Activity');
const jwt = require('jsonwebtoken');
var Web3 = require('web3')
var web3 = new Web3(new Web3.providers.HttpProvider('https://infura.io/v3/d92bb372bbe0423a89aabbf883491237'));

function generateToken(user) {
    var u = {
        email: user[0].email,
        password: user[0].password,
        _id: "" + user[0]._id
    };

    return token = jwt.sign(u, 'auth', {
        expiresIn: 60 * 60 * 24
    });
}

module.exports = (app) => {
    app.post('/api/account/signup', (req, res, next) => {

        const { body } = req;
        const {
            password
        } = body;
        let {
            email
        } = body;
        const {
            username
        } = body;

        if (!email) {
            return res.send({
                success: false,
                message: 'Email cannot be blank'
            });
        }
        if (!password) {
            return res.send({
                success: false,
                message: 'Password cannot be blank.'
            });
        }

        if (!username) {
            return res.send({
                success: false,
                message: "Username can not be blank"
            })
        }

        email = email.toLowerCase();
        email = email.trim();

        User.find({
            username: username
        }, (err, previousUser) => {
            if (err) {
                return res.send({
                    success: false,
                    message: 'Server error'
                });
            }
            else if (previousUser.length > 0) {
                return res.send({
                    success: false,
                    message: 'Username already exist'
                });
            }

            User.find({ email: email }, (err, previousUser) => {
                if (err) {
                    return res.send({
                        success: false,
                        message: 'Server error'
                    });
                }
                else if (previousUser.length > 0) {
                    return res.send({
                        success: false,
                        message: 'Email address already exist'
                    });
                }
                const newUser = new User();

                var verify_code = Math.floor(Math.random() * 90000) + 10000;
                const sgMail = require('@sendgrid/mail');
                sgMail.setApiKey('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');
                const msg = {
                    to: email,
                    from: 'registration@incowallet.com',
                    subject: 'Verification Code from Incowallet',
                    html: 'Please verify your account with this verification Code <br/><strong>' + verify_code + '</strong>',
                };
                sgMail.send(msg);

                var account = web3.eth.accounts.create();

                newUser.username = username;
                newUser.email = email;
                newUser.address = account.address;
                newUser.privateKey = account.privateKey
                newUser.password = newUser.generateHash(password);
                newUser.save((err, user) => {
                    if (err) {
                        return res.send({
                            success: false,
                            message: 'Server error'
                        });
                    }
                    return res.send({
                        success: true,
                        message: 'Signed up',
                        code: verify_code,
                        privateKey: account.privateKey,
                        address: account.address,
                    });
                });
            })
        });
    });

    app.post('/api/account/send_code', (req, res, next) => {
        const {body} = req;
        const {username, email} = body;
        var verify_code = Math.floor(Math.random() * 90000) + 10000;
                const sgMail = require('@sendgrid/mail');
                sgMail.setApiKey('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');
                const msg = {
                    to: email,
                    from: 'registration@incowallet.com',
                    subject: 'Verification Code from Incowallet',
                    html: 'Please verify your account with this verification Code <br/><strong>' + verify_code + '</strong>',
                };
                sgMail.send(msg);
                console.log(msg);
        return res.send({
            success: true,
            code: verify_code
        });
    })

    app.post('/api/account/check_email', (req, res, next) => {
        const {body} = req;
        const {email} = body;
        User.find({email: email}, (err, user) => {
            if(err) {
                console.log(err)
                return res.send({
                    success: false,
                    message: "Internal Server Error"
                });
            }
            if(user.length > 0) {
                var verify_code = Math.floor(Math.random() * 90000) + 10000;
                const sgMail = require('@sendgrid/mail');
                sgMail.setApiKey('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');
                const msg = {
                    to: email,
                    from: 'registration@incowallet.com',
                    subject: 'Verification Code from Incowallet.com',
                    html: 'Please verify your account with this verification Code <br/><strong>' + verify_code + '</strong>',
                };
                sgMail.send(msg);
                return res.send({
                    success: true,
                    code: verify_code
                });
            }
            else {
                return res.send({
                    success: false,
                    message: "Invalid Email Address"
                })
            }
        })
    })

    app.post('/api/account/change_email', (req, res, next) => {
        const {body} = req;
        const {username, email} = body;
        User.find({username: username}, (err, user) => {
            if(err){
                return res.send({
                    success: false,
                    message: 'Server Error'
                });
            }
            user[0].email = email;
            user[0].save((err, user) => {
                return res.send({
                    success: true
                })
            })
        })
    })

    app.post('/api/account/verify_email', (req, res, next) => {
        const { body } = req;
        const { username, passphrase } = body;
        User.find({ username: username }, (err, user) => {
            if (err) {
                return res.send({
                    success: false,
                    message: "Error: Server error"
                });
            }
            user[0].verified = true;
            user[0].passphrase = passphrase;
            console.log(passphrase);

            user[0].save((err, user) => {
                if (err) {
                    console.log(err)
                    return res.send({
                        success: false,
                        message: err
                    })
                }
                return res.send({
                    success: true,
                    message: "successful"
                })
            })
        })
    });

    app.post('/api/account/change_password', (req, res, next) => {
        const { body } = req;
        const { email, password } = body;
        User.find({ email: email }, (err, user) => {
            if (err) {
                return res.send({
                    success: false,
                    message: "Error: Server error"
                });
            }
            user[0].password = user[0].generateHash(password);
            user[0].save((err, user) => {
                if (err) {
                    console.log(err)
                    return res.send({
                        success: false,
                        message: err
                    })
                }
                return res.send({
                    success: true,
                    message: "successful"
                })
            })
        })
    });

    app.post('/api/account/get_passphrases', (req, res, next) => {
        const { body } = req;
        const { username } = body;
        console.log(username)
        User.find({ username: username }, (err, user) => {
            if (err) {
                console.log(err)
                return res.send({
                    success: false,
                    message: "Error: Server Error"
                })
            }
            console.log(user)
            return res.send({
                success: true,
                message: "success",
                passphrases: user[0].passphrase
            })
        })
    })

    app.post('/api/account/signin', (req, res, next) => {
        const { body } = req;
        const {
            password
        } = body;
        let {
            email
        } = body;
        if (!email) {
            return res.send({
                success: false,
                message: 'Error: Email cannot be blank'
            });
        }
        if (!password) {
            return res.send({
                success: false,
                message: 'Error: Password cannot be blank.'
            });
        }

        email = email.toLowerCase();
        email = email.trim();
        new_user = new User();
        User.find({
            username: email
        }, (err, user) => {
            if (err) {
                return res.send({
                    success: false,
                    message: 'Error: Server error'
                });
            }
            else if (user.length == 1) {
                new_user.email = email;
                new_user.password = user[0].password;
                if (new_user.validPassword(password)) {
                    User.find({ 'username': email }, function (err, result) {
                        if (err) throw err;

                        var verify_code = Math.floor(Math.random() * 90000) + 10000;
                        const sgMail = require('@sendgrid/mail');
                        sgMail.setApiKey('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');
                        const msg = {
                            to: user[0].email,
                            from: 'registration@incowallet.com',
                            subject: 'Verification Code from Incowallet',
                            html: 'Please verify your account with this verification Code <br/><strong>' + verify_code + '</strong>',
                        };
                        console.log(msg);
                        sgMail.send(msg);
                        return res.send({
                            success: true,
                            message: 'Successfully',
                            username: result[0].username,
                            address: result[0].address,
                            privateKey: result[0].privateKey,
                            verify_code: verify_code
                        });
                    });
                }
                else {
                    return res.send({
                        success: false,
                        message: 'Error: Password is not correct.'
                    });
                }
            }
            else {
                return res.send({
                    success: false,
                    message: 'Error: Username is not valid'
                });
            }

        });
    });

    app.post('/api/account/generateToken', (req, res, next) => {
        const { body } = req;
        const { username } = body;
        User.find({ username: username }, (err, user) => {
            if (err) {
                console.log(err);
                return res.send({
                    success: false,
                    message: "Server Error"
                });
            }
            console.log(user)
            return res.send({
                success: true,
                message: "success",
                token: generateToken(user)
            });
        })
    })

    app.post('/api/account/logout', (req, res, next) => {
        const { body } = req;
        const { token } = body;
        let { email } = body;
        console.log('token - ', token);
        console.log('email - ', email);

        if (!email) {
            return res.send({
                message: "Error: Email can not be blank",
                success: false
            });
        }
        if (!token) {
            return res.send({
                success: false,
                message: "Error: Token can not be blank"
            });
        }

        jwt.verify(token, 'auth', function (err, user) {
            if (err) {
                return res.send({
                    success: false,
                    message: err,
                });
            };

            User.find({ 'email': user.email }, function (err, user) {
                if (err) {
                    return res.send({
                        success: false,
                        message: "Server Error",
                    });
                } else {
                    return res.send({
                        success: true,
                    });
                }
            });
        });
    });

    app.post('/api/account/verify', (req, res, next) => {
        const { body } = req;
        const { token } = body;
        console.log('token - ' + token)
        if (!token) {
            return res.send({
                success: false
            });
        }

        jwt.verify(token, 'auth', function (err, user) {
            if (err) {
                console.log("error-" + err)
                return res.send({
                    success: false,
                })
            };
            User.find({ 'email': user.email }, function (err, user) {
                if (err) {
                    console.log('error - ' + err)
                    return res.send({
                        success: false,
                    });
                } else {
                    return res.send({
                        success: true
                    });
                }
            });
        })
    });

    app.post('/api/account/getUserInfo', (req, res, next) => {
        const { body } = req;
        const { username } = body;
        User.find({ username: username }, (err, user) => {
            if (err) {
                return res.send({
                    success: false,
                    err: err
                })
            }
            return res.send({
                success: true,
                user: user[0]
            })
        })
    });

    app.post('/api/account/changePass', (req, res, next) => {
        const { body } = req;
        const { username, old_password, reset_password } = body;
        console.log(body);
        User.find({ username: username }, (err, user) => {
            if (err) {
                return res.send({
                    success: false,
                    err: err
                })
            }
            if( user[0].validPassword(old_password)){
                user[0].password = user[0].generateHash(reset_password);
                user[0].save((err, user) => {
                    return res.send({
                        success: true,
                    })
                });
            }
            else {
                return res.send({
                    success: false,
                    err: 'Old password is not correct'
                })
            }
        })
    });
}