const User = require('mongoose').model('User');
const Role = require('mongoose').model('Role');
const Article = require('mongoose').model('Article');
const encryption = require('./../../utilities/encryption');
var fs = require("fs");

module.exports = {
    all: (req, res) => {
        User.find({}).then(users => {

            for (let user of users) {
                user.isInRole('Admin').then(isAdmin => {
                    user.isAdmin = isAdmin;
                });
            }

            res.render('admin/user/all', {users: users})
        });
    },

    editGet: (req, res) => {
        let id = req.params.id;

        User.findOne({_id: id}).then(user => {
            if (!user) {
                res.redirect("/");
                return;
            }
            Role.find({}).then(roles => {
                for (let role of roles) {
                    if (user.roles.indexOf(role.id) !== -1) {
                        role.isChecked = true;
                    }
                }
                res.render('admin/user/edit', {user: user, roles: roles})
            })
        })
    },

    editPost: (req, res) => {
        let id = req.params.id;
        let userArgs = req.body;
        let errorMsg = '';

        User.findOne({nickname: userArgs.nickname, _id: {$ne: id}}).then(userNickname => {
            if (userNickname) {
                errorMsg = 'User with the same nickname exists!';
            }
        });

        User.findOne({email: userArgs.email, _id: {$ne: id}}).then(user => {
            if (user) {
                errorMsg = 'User with the same email exists!';
            } else if (!userArgs.email) {
                errorMsg = 'Email cannot be null';
            } else if (userArgs.password !== userArgs.confirmedPassword) {
                errorMsg = 'Passwords do not match!';
            }

            if (errorMsg) {
                User.findOne({_id: id}).then(user => {
                    Role.find({}).then(roles => {
                        for (let role of roles) {
                            if (user.roles.indexOf(role.id) !== -1) {
                                role.isChecked = true;
                            }
                        }
                        res.render('admin/user/edit', {user: user, roles: roles, error: errorMsg});
                        return;
                    })
                })
            } else {
                Role.find({}).then(roles => {
                    let newRoles = roles.filter(role => {
                        return userArgs.roles.indexOf(role.name) !== -1;
                    }).map(role => {
                        return role.id;
                    });

                    User.findOne({_id: id}).then(user => {
                        user.email = userArgs.email;

                        let passwordHash = user.passwordHash;
                        if (userArgs.password) {
                            passwordHash = encryption.hashPassword(userArgs.password, user.salt);
                        }

                        user.passwordHash = passwordHash;
                        user.roles = newRoles;
                        user.nickname = userArgs.nickname;

                        user.save((err) => {
                            if (err) {
                                res.redirect('/');
                            } else {
                                res.redirect('/admin/user/all')
                            }
                        })
                    });
                })
            }
        });
    },

    deleteGet: (req, res) => {
        let id = req.params.id;
        User.findById(id).then(user => {
            res.render('admin/user/delete', {userToDelete: user})
        });
    },

    deletePost: (req, res) => {
        let id = req.params.id;

        User.findById(id).then(user => {
            user.prepareDelete();

            if (user.avatar !== 'default.png') {
                fs.unlink(__dirname + '\\..\\..\\public\\uploads\\' + user.avatar);
            }
            user.remove();
        });
        res.redirect('/admin/user/all');
    }
};