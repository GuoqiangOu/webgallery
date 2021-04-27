/*jshint esversion: 6 */
const path = require('path');

const express = require('express');
const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// upload pic
let multer  = require('multer');
let upload = multer({ dest: 'uploads/' });

app.use(express.static('frontend'));

// nedb
let Datastore = require('nedb');
let images = new Datastore({ filename: 'db/images.db', autoload: true, timestampData : true});
let comments = new Datastore({ filename: 'db/comments.db', autoload: true, timestampData : true});
let users = new Datastore({ filename: 'db/users.db', autoload: true, timestampData : true});

const cookie = require('cookie');

const session = require('express-session');
app.use(session({
    secret: 'secret is no secret',
    resave: false,
    saveUninitialized: true,
}));

app.use(function (req, res, next){
    req.username = ('user' in req.session)? req.session.user._id : null;
    console.log("HTTP request", req.username, req.method, req.url, req.body);
    next();
});

let isAuthenticated = function(req, res, next) {
    if (!req.username) return res.status(401).end("access denied");
    next();
};

const crypto = require('crypto');
function generateSalt (){
    return crypto.randomBytes(16).toString('base64');
}

function generateHash (password, salt){
    let hash = crypto.createHmac('sha512', salt);
    hash.update(password);
    return hash.digest('base64');
}

let Image = function(body, file){
    this.title = body.title;
    this.author = body.author;
    this.picture = file;
};

let Comment = function(comment){
    this.imageId = comment.imageId;
    this.author = comment.author;
    this.content = comment.content;
};

// Authentication
// curl -H "Content-Type: application/json" -X POST -d '{"username":"alice","password":"alice"}' -c cookie.txt localhost:3000/register/
app.post('/register/', function (req, res, next) {
    // extract data from HTTP request
    if (!('username' in req.body)) return res.status(400).end('username is missing');
    if (!('password' in req.body)) return res.status(400).end('password is missing');
    let username = req.body.username;
    let password = req.body.password;
    // check if user already exists in the database
    users.findOne({_id: username}, function(err, user){
        if (err) return res.status(500).end(err);
        if (user) return res.status(409).end("username " + username + " already exists");
        // generate a new salt and hash
        let salt = generateSalt();
        let hash = generateHash(password, salt);
        // insert new user into the database
        let data = {_id: username, hash: hash, salt: salt};
        users.update({_id: username}, data, {upsert: true}, function(err){
            if (err) return res.status(500).end(err);
                // start session
                req.session.user = data;
                // generate cookie
                res.setHeader('Set-Cookie', cookie.serialize('username', username, {
                        path : '/',
                        maxAge: 60 * 60 * 24 * 7  // 1 week in number of seconds
                }));
            return res.status(200).json(username);
        });
    });
});

// curl -H "Content-Type: application/json" -X POST -d '{"username":"alice","password":"alice"}' -c cookie.txt localhost:3000/login/
app.post('/login/', function (req, res, next) {
    // extract data from HTTP request
    if (!('username' in req.body)) return res.status(400).end('username is missing');
    if (!('password' in req.body)) return res.status(400).end('password is missing');
    let username = req.body.username;
    let password = req.body.password;
    // retrieve user from the database
    users.findOne({_id: username}, function(err, user){
        if (err) return res.status(500).end(err);
        if (!user) return res.status(401).end("No such user, access denied");
        if (user.hash !== generateHash(password, user.salt)) return res.status(401).end("access denied"); // invalid password
            // start session
            req.session.user = user;
            // generate cookie
            res.setHeader('Set-Cookie', cookie.serialize('username', username, {
                    path : '/',
                    maxAge: 60 * 60 * 24 * 7  // 1 week in number of seconds
            }));
        return res.status(200).json(username);
    });
});

// curl -b cookie.txt -c cookie.txt localhost:3000/logout/
app.get('/logout/', function (req, res, next) {
    req.session.user = "";
    res.setHeader('Set-Cookie', cookie.serialize('username', '', {
          path : '/', 
          maxAge: 60 * 60 * 24 * 7 // 1 week in number of seconds
    }));
    return res.status(200).json('');
});


// Create
app.post('/api/images/:author/', upload.single('picture'), isAuthenticated, function (req, res, next) {
    let newImage = new Image(req.body, req.file);
    if (req.params.author !== req.username) return res.status(401).end("access denied");
    images.insert(newImage, function (err, image) {
        if (err) return res.status(500).end(err);
        return res.status(200).json(image);
    });
});

app.post('/api/comments/', isAuthenticated, function (req, res, next) {
    let newComment = new Comment(req.body);
    comments.insert(newComment, function (err, comment) {
        if (err) return res.status(500).end(err);
        comments.find({ imageId:comment.imageId }).sort({createdAt:-1}).limit(10).exec(function(err, coms) {
            if (err) return res.status(500).end(err);
            return res.status(200).json(coms);
        });
    });
});


// Read
app.get('/api/images/:imageId/', isAuthenticated, function (req, res, next) {
    if (req.params.imageId == 0) {  // onload
        images.find({ author:req.username }).sort({ createdAt:-1 }).limit(1).exec(function(err, imgs) {
            if (err) return res.status(500).end(err);
            if (imgs.length) {  // if there is image in the author's gallary
                return res.status(200).json(imgs[0]);
            } else {
                return res.status(200).json(null);
            }
        });
    } else {
        images.findOne({ _id:req.params.imageId }).exec(function(err, image) {
            if (err) return res.status(500).end(err);
            if (!image) return res.status(404).end("Image with imageId " + req.params.imageId + " does not exist.");
            return res.status(200).json(image);
        });
    }
});

// upload pic
app.get('/api/images/:imageId/picture/', isAuthenticated, function (req, res, next) {
    images.findOne({ _id:req.params.imageId }, function(err, image) {
        if (err) return res.status(500).end(err);
        if (!image) return res.status(404).end("Image with imageId " + req.params.imageId + " does not exist.");
        res.setHeader('Content-Type', image.picture.mimetype);
        res.sendFile(image.picture.path, {"root": __dirname});
    });
});


app.get('/api/comments/:imageId/', isAuthenticated, function (req, res, next) {
    comments.find({ imageId:req.params.imageId }).sort({createdAt:-1}).limit(10).exec(function(err, coms) {
        if (err) return res.status(500).end(err);
        return res.status(200).json(coms);
    });
});

// Turn Author Page
app.get('/api/images/:author/:action/', isAuthenticated, function (req, res, next) {
    // find this author
    users.findOne({ _id:req.params.author }).exec(function(err, curAuthor) {
        if (err) return res.status(500).end(err);
        if (!curAuthor) return res.status(404).end("Author with author name " + req.params.author + " does not exist.");
        if (req.params.action === 'left') {
            // get previous author
            users.find({ createdAt:{ $gt:curAuthor.createdAt } }).sort({createdAt:1}).limit(1).exec(function(err, authors) {
                if (err) return res.status(500).end(err);
                if (authors[0]) {
                    images.find({ author:authors[0]._id }).sort({ createdAt:-1 }).limit(1).exec(function(err, imgs) {
                        if (err) return res.status(500).end(err);
                        return res.status(200).json([authors[0]._id, imgs[0]]);
                    });
                } else {
                    return res.status(200).json([null, null]);
                }
            });
        } else if (req.params.action === 'right') {
            // get next author
            users.find({ createdAt:{ $lt:curAuthor.createdAt } }).sort({createdAt:1}).limit(1).exec(function(err, authors) {
                if (err) return res.status(500).end(err);
                if (authors[0]) {
                    images.find({ author:authors[0]._id }).sort({ createdAt:-1 }).limit(1).exec(function(err, imgs) {
                        if (err) return res.status(500).end(err);
                        return res.status(200).json([authors[0]._id, imgs[0]]);
                    });
                } else {
                    return res.status(200).json([null, null]);
                }
            });
        } else {
            return res.status(400).end("Invalid Argument, the action has to be either left or right.");
        }
    });
});

// Turn Image Page
app.get('/api/images/:author/:imageId/:action/', isAuthenticated, function (req, res, next) {
    images.findOne({ _id:req.params.imageId }).exec(function(err, curImage) {
        if (err) return res.status(500).end(err);
        if (!curImage) return res.status(404).end("Image with imageId " + req.params.imageId + " does not exist.");
        if (req.params.action === 'left') {
            images.find({ author:req.params.author, createdAt:{ $gt:curImage.createdAt } }).sort({createdAt:1}).limit(1).exec(function(err, imgs) {
                if (err) return res.status(500).end(err);
                if (imgs.length) {
                    return res.status(200).json(imgs[0]);
                } else {  // the first image
                    return res.status(200).json(null);
                }
            });
        } else if (req.params.action === 'right') {
            images.find({ author:req.params.author, createdAt:{ $lt:curImage.createdAt } }).sort({createdAt:-1}).limit(1).exec(function(err, imgs) {
                if (err) return res.status(500).end(err);
                if (imgs.length) {
                    return res.status(200).json(imgs[0]);
                } else {  // the last image
                    return res.status(200).json(null);
                }
            });
        } else {
            return res.status(400).end("Invalid Argument, the action has to be either left or right.");
        }
    });
});


app.get('/api/comments/:imageId/:action/:page/', isAuthenticated, function (req, res, next) {
    let page = req.params.page;
    images.findOne({ _id:req.params.imageId }).exec(function(err, curImage) {
        if (err) return res.status(500).end(err);
        if (!curImage) return res.status(404).end("Image with imageId " + req.params.imageId + " does not exist.");
        if (req.params.action === 'right') {
            comments.find({ imageId:req.params.imageId }).sort({ createdAt:-1 }).skip(10 * page).limit(10).exec(function(err, coms) {
                if (err) return res.status(500).end(err);
                if (coms.length) {
                    return res.status(200).json(coms);
                } else {  // the last image
                    return res.status(200).json([]);
                }
            });
        } else if (req.params.action === 'left') {
            comments.find({ imageId:req.params.imageId }).sort({ createdAt:-1 }).skip(10 * page).limit(10).exec(function(err, coms) {
                if (err) return res.status(500).end(err);
                if (coms.length) {
                    return res.status(200).json(coms);
                } else {  // the first page
                    return res.status(200).json([]);
                }
            });
        } else {
            return res.status(400).end("Invalid Argument, the action has to be either left or right.");
        }
    });
});


// Delete
app.delete('/api/images/:imageId/', isAuthenticated, function(req, res, next) {
    // see if image exit
    images.findOne({ _id: req.params.imageId }, function(err, image){
        if (err)return res.status(500).end(err);
        if (!image) return res.status(404).end("Image with imageId " + req.params.imageId + " does not exsit.");
        if (req.username !== image.author) return res.status(401).end("access denied");
        // remove all comments
        comments.remove({ imageId: req.params.imageId }, { multi: true }, function (err, numRemoved){
            if (err) return res.status(500).end(err);
        });
        // remove the image
        images.remove({ _id: req.params.imageId }, {}, function(err, numRemoved){
            if (err) return res.status(500).end(err);
        });
        // need to change
        // send back latest image
        images.find({ author:req.username }).sort({createdAt:-1}).limit(1).exec(function(err, imgs) {
            if (err)return res.status(500).end(err);
            if (imgs.length) {
                return res.status(200).json(imgs[0]);
            } else {  // no more image
                return res.status(200).json(null);
            }
        });
    });
});


app.delete('/api/comments/:commentId/:page/', isAuthenticated, function(req, res, next) {
    let page = req.params.page;
    // check if comment exist
    comments.findOne({ _id: req.params.commentId }, function(err, comment){
        if (err)return res.status(500).end(err);
        if (!comment) return res.status(404).end("Comment with commentId " + req.params.commentId + " does not exsit.");

        images.findOne({ _id: comment.imageId }, function(err, image){
            if (err)return res.status(500).end(err);
            if (!image) return res.status(404).end("Image with imageId " + req.params.imageId + " does not exsit.");
            // only image author or comment author can delete a comment
            if (req.username !== image.author && req.username !== comment.author) return res.status(401).end("access denied");

            let imageId = comment.imageId;
            // remove comment
            comments.remove({ _id: req.params.commentId }, function (err, numRemoved){
                if (err) return res.status(500).end(err);
            });
            // send back comments
            comments.find({ imageId:imageId }).sort({createdAt:-1}).skip((page - 1) * 10).limit(10).exec(function(err, coms) {
                if (err) return res.status(500).end(err);
                return res.status(200).json(coms);
            });
        });
    });
});


const http = require('http');
const PORT = 3000;

http.createServer(app).listen(PORT, function (err) {
    if (err) console.log(err);
    else console.log("HTTP server on http://localhost:%s", PORT);
});
