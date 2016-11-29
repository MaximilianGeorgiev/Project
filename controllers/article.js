const size = require('image-size');
const Article = require('mongoose').model('Article');
const Category = require('mongoose').model('Category');
const User = require('mongoose').model('User');

module.exports = {
    createGet: (req, res) => {
        if (!req.isAuthenticated()) {
            let returnUrl = '/article/create';
            req.session.returnUrl = returnUrl;

            res.redirect('/user/login');
        }

        Category.find({}).then(categories => {
            res.render('article/create', {categories: categories});
        })
    },

    createPost: (req, res) => {
        let articleArgs = req.body;

        let errorMsg = '';

        if (!req.isAuthenticated()) {
            errorMsg = 'You should be logged in to make articles!'
        } else if (!req.file) {
            errorMsg = 'Invalid file!'
        } else if (!articleArgs.tagNames) {
            errorMsg = 'Missing tags!'
        }

        if (errorMsg) {
            res.render('article/create', {error: errorMsg});
            return;
        }

        let file = req.file;
        articleArgs.imgName = file.filename;
        let dimensions = size(file.path);

        articleArgs.width = dimensions.width;
        articleArgs.height = dimensions.height;

        articleArgs.author = req.user.id;
        Article.create(articleArgs).then(article => {
            let tagNames = articleArgs.tagNames.split(/\s+|,/).filter(tag => {
                return tag;
            });

            article.tags = tagNames;
            article.save();

            article.prepareInsert();
            res.redirect('/');
        });
    },

    details: (req, res) => {
        let id = req.params.id;

        Article.findById(id).populate('author').then(article => {
            if(!article){
                res.redirect('/');
                return;
            }

            article.views += 1;
            article.save();

            if (!req.user) {
                res.render('article/details', {article: article, isUserAuthorized: false});
                return;
            }

            let isSaved = false;
            if (req.user.savedArticles.indexOf(id) !== -1) {
                isSaved = true;
            }
            req.user.isInRole('Admin').then(isAdmin => {
                let isUserAuthorized = isAdmin || req.user.isAuthor(article);

                res.render('article/details', {article: article, isUserAuthorized: isUserAuthorized, isSaved: isSaved});
            })
        })
    },

    editGet: (req, res) => {
        let id = req.params.id;

        if (!req.isAuthenticated()) {
            let returnUrl = `/article/edit/${id}`;
            req.session.returnUrl = returnUrl;

            res.redirect('/user/login');
            return;
        }
        Article.findById(id).then(article => {
            req.user.isInRole('Admin').then(isAdmin => {
                if (!isAdmin && !req.user.isAuthor(article)) {
                    res.redirect('/');
                }

                Category.find({}).then(categories => {
                    article.categories = categories;
                    article.tagNames = article.tags;
                    res.render('article/edit', article);
                });
            });
        });
    },

    editPost: (req, res) => {
        let id = req.params.id;
        let articleArgs = req.body;

        if (!req.isAuthenticated()) {
            let returnUrl = `/article/edit/${id}`;
            req.session.returnUrl = returnUrl;

            res.redirect('/user/login');
            return;
        }

        req.user.isInRole('Admin').then(isAdmin => {
            if (!isAdmin && !req.user.isAuthor(article)) {
                res.redirect('/');
            }
        });

        let errorMsg = '';

        if (!articleArgs.tags) {
            errorMsg = 'Missing tags!'
        }

        if (errorMsg) {
            res.render('article/edit', {error: errorMsg})
        } else {
            Article.findById(id).populate('category').then(article => {
                if (article.category.id !== articleArgs.category) {
                    article.category.articles.remove(article.id);
                    article.category.save();
                }

                article.category = articleArgs.category;
                article.title = articleArgs.title;
                article.content = articleArgs.content;

                let newTagNames = articleArgs.tags.split(/\s+|,/).filter(tag => {
                    return tag;
                });

                article.tags = newTagNames;

                article.save((err) => {
                    if (err) {
                        console.log(err.message);
                    }

                    Category.findById(article.category).then(category => {
                        if (category.articles.indexOf(article.id) === -1) {
                            category.articles.push(article.id);
                            category.save();
                        }

                        res.redirect(`/article/details/${id}`);
                    })
                })
            })
        }
    },

    deleteGet: (req, res) => {
        let id = req.params.id;

        if (!req.isAuthenticated()) {
            let returnUrl = `/article/edit/${id}`;
            req.session.returnUrl = returnUrl;

            res.redirect('/user/login');
            return;
        }

        Article.findById(id).populate('category').then(article => {
            req.user.isInRole('Admin').then(isAdmin => {
                if (!isAdmin && !req.user.isAuthor(article)) {
                    res.redirect('/');
                }

                article.tagNames = article.tags;

                res.render('article/delete', article)
            });
        })
    },

    deletePost: (req, res) => {
        let id = req.params.id;
        if (!req.isAuthenticated()) {
            let returnUrl = `/article/edit/${id}`;
            req.session.returnUrl = returnUrl;

            res.redirect('/user/login');
            return;
        }

        Article.findById(id).then(article => {
            if (!article){
                res.redirect('/');
                return;
            }
            req.user.isInRole('Admin').then(isAdmin => {
                if (!isAdmin && !req.user.isAuthor(article)) {
                    res.redirect('/');
                } else {
                    Article.findOneAndRemove({_id: id}).populate('author').then(article => {
                        article.prepareDelete();
                        res.redirect('/');
                    })
                }
            })
        })
    },

    saveArticle: (req, res) => {
        let user = req.user;
        let id = req.params.id;

        if (!user) {
            res.redirect('/user/login');
            return;
        }

        Article.findById(id).then(article => {
            if (!article) {
                res.redirect('/');
                return;
            }
            User.findById(user.id).then(currentUser=> {
                if (!currentUser) {
                    res.redirect('/user/login');
                    return;
                }
                if (currentUser.savedArticles.indexOf(article.id) === -1) {
                    currentUser.savedArticles.push(article.id);
                } else {
                    currentUser.savedArticles.remove(article.id);
                }
                currentUser.save();
                res.redirect('/article/details/' + article.id);
            })
        })
    }
};