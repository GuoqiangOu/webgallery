/*jshint esversion: 6 */
let api = (function(){
    "use strict";

    function send(method, url, data, callback){
        let xhr = new XMLHttpRequest();
        xhr.onload = function() {
            if (xhr.status !== 200) callback("[" + xhr.status + "]" + xhr.responseText, null);
            else callback(null, JSON.parse(xhr.responseText));
        };
        xhr.open(method, url, true);
        if (!data) xhr.send();
        else{
            xhr.setRequestHeader('Content-Type', 'application/json');
            xhr.send(JSON.stringify(data));
        }
    }

    function sendFiles(method, url, data, callback){
        let formdata = new FormData();
        Object.keys(data).forEach(function(key){
            let value = data[key];
            formdata.append(key, value);
        });
        let xhr = new XMLHttpRequest();
        xhr.onload = function() {
            if (xhr.status !== 200) callback("[" + xhr.status + "]" + xhr.responseText, null);
            else callback(null, JSON.parse(xhr.responseText));
        };
        xhr.open(method, url, true);
        xhr.send(formdata);
    }

    // function to update window.history.state
    function updateState(imageId, imagePage, commentPage, currentAuthor) {
        let state = window.history.state;
        state.imageId = imageId;
        state.imagePage = imagePage;
        state.commentPage = commentPage;
        state.currentAuthor = currentAuthor;
        window.history.replaceState(state, "", window.location.href);
    }

    let module = {};
    
    /*  ******* Data types *******
        image objects must have at least the following attributes:
            - (String) _id
            - (String) title
            - (String) author
            - (Date) date
    
        comment objects must have the following attributes
            - (String) _id
            - (String) imageId
            - (String) author
            - (String) content
            - (Date) date
    
    ****************************** */ 
    
    // add an image to the gallery
    module.addImage = function(title, picture){
        sendFiles("POST", "/api/images/" + window.history.state.currentAuthor + "/", {title: title, author: getUsername(), picture: picture}, function(err, res){
            if (err) return notifyErrorListeners(err);
            updateState(res._id, 1, 1, window.history.state.currentAuthor);
            notifyImageListeners(res);
            notifyCommentListeners([]);
       });
    };
    
    // delete an image from the gallery given its imageId
    module.deleteImage = function(imageId){
        send("DELETE", "/api/images/" + imageId + "/", null, function(err, res){
            if(err) return  notifyErrorListeners(err);
            // let state = window.history.state;
            if (res) {  // got next image
                updateState(res._id, 1, 1, window.history.state.currentAuthor);
                getComments(res._id, function(err, comments){
                    notifyImageListeners(res);
                    notifyCommentListeners(comments);
                });
            } else {  // removed all images
                updateState(0, 1, 1, window.history.state.currentAuthor);
                notifyImageListeners(null);
                notifyCommentListeners([]);
            }
        });
    };
    
    // add a comment to an image
    module.addComment = function(imageId, content){
        if (imageId) {
            send("POST", "/api/comments/", {imageId: imageId, author: getUsername(), content: content}, function(err, res){
                if (err) return notifyErrorListeners(err);
                
                let state = window.history.state;
                updateState(state.imageId, state.imagePage, 1, state.currentAuthor);
                notifyCommentListeners(res);
           });
        } else {
            alert("Oops...There is no image yet, Please add an image first.");
        }
    };
    
    // delete a comment to an image
    module.deleteComment = function(commentId){
        let state = window.history.state;
        let commentPage = state.commentPage;
        let url = "/api/comments/" + commentId + "/" + commentPage + "/";
        send("DELETE", url, null, function(err, comments){
            if(err) return notifyErrorListeners(err);
            // deleted last comment on a page which is not the first page
            if (commentPage !== 1 && comments.length == 0) {
                updateState(state.imageId, state.imagePage, 1, state.currentAuthor);
                getComments(state.imageId, function(err, newComments){
                    notifyCommentListeners(newComments);
                });
            } else {
                notifyCommentListeners(comments);
            }
        });
    };

    // turn image page
    module.imagePageLeft = function(imageId){
        let state = window.history.state;
        send("GET", "/api/images/" + state.currentAuthor + "/" + imageId + "/left/", null, function(err, nextImage){
            if(err) return notifyErrorListeners(err);
            if (nextImage) {
                updateState(state.imageId, state.imagePage - 1, 1, state.currentAuthor);
                notifyImageListeners(nextImage);
                getComments(nextImage._id, function(err, comments){
                    notifyCommentListeners(comments);
                });
            } else {
                alert("Oops...This is the first image.");
            }
        });
    };

    module.imagePageRight = function(imageId){
        let state = window.history.state;
        send("GET", "/api/images/" + state.currentAuthor + "/" + imageId + "/right/", null, function(err, nextImage){
            if(err) return  notifyErrorListeners(err);
            if (nextImage) {
                updateState(state.imageId, state.imagePage + 1, 1, state.currentAuthor);
                notifyImageListeners(nextImage);
                getComments(nextImage._id, function(err, comments){
                    notifyCommentListeners(comments);
                });
            } else {
                alert("Oops...This is the last image.");
            }
        });
    };
    
    // turn author page
    module.authorPageLeft = function(imageId){
        let state = window.history.state;
        send("GET", "/api/images/" + state.currentAuthor + "/left/", null, function(err, resList){
            if(err) return notifyErrorListeners(err);
            let nextAuthor = resList[0];
            let nextImage = resList[1];
            if (nextAuthor) {
                if (nextImage) {
                    updateState(nextImage._id, 1, 1, nextAuthor);
                    notifyImageListeners(nextImage);
                    getComments(nextImage._id, function(err, comments){
                        notifyCommentListeners(comments);
                    });
                } else {  // change gallery but not image
                    updateState(state.imageId, state.imagePage, state.commentPage, nextAuthor);
                    notifyImageListeners(null);
                    notifyCommentListeners([]);
                }
            }
            // no next author found
        });
    };

    module.authorPageRight = function(imageId){
        let state = window.history.state;
        send("GET", "/api/images/" + state.currentAuthor + "/right/", null, function(err, resList){
            if(err) return notifyErrorListeners(err);
            let nextAuthor = resList[0];
            let nextImage = resList[1];
            if (nextAuthor) {
                if (nextImage) {
                    updateState(nextImage._id, 1, 1, nextAuthor);
                    notifyImageListeners(nextImage);
                    getComments(nextImage._id, function(err, comments){
                        notifyCommentListeners(comments);
                    });
                } else {  // change gallery but no image
                    updateState(state.imageId, state.imagePage, state.commentPage, nextAuthor);
                    notifyImageListeners(null);
                    notifyCommentListeners([]);
                }
            }
            // no next author found
        });
    };

    
    // turn comment page
    module.commentPageLeft = function(imageId){
        let state = window.history.state;
        let commentPage = state.commentPage;
        if (commentPage == 1) {
            alert("Oops...This is the first comment page.");
        } else {
            let url = "/api/comments/" + imageId + "/left/" + (state.commentPage - 2) + "/";
            send("GET", url, null, function(err, comments){
                if(err) return notifyErrorListeners(err);
                if (comments.length) {
                    updateState(state.imageId, state.imagePage, state.commentPage - 1, state.currentAuthor);
                    notifyCommentListeners(comments);
                }
            });
        }
    };

    module.commentPageRight = function(imageId){
        let state = window.history.state;
        let url = "/api/comments/" + imageId + "/right/" + state.commentPage + "/";
        send("GET", url, null, function(err, comments){
            if(err) return notifyErrorListeners(err);
            if (comments.length) {
                updateState(state.imageId, state.imagePage, state.commentPage + 1, state.currentAuthor);
                notifyCommentListeners(comments);
            } else {
                alert("Oops...This is the last comment page.");
            }
        });
    };


    let getImage = function(imageId, callback){
        send("GET", "/api/images/" + imageId + "/", null, callback);
    };

    let getComments = function(imageId, callback){
        send("GET", "/api/comments/" + imageId + "/", null, callback);
    };

    let imageListeners = [];

    // register an image listener
    // to be notified when an image is added or deleted from the gallery
    function notifyImageListeners(image){
        let state = window.history.state;
        if (image) {
            updateState(image._id, state.imagePage, state.commentPage, state.currentAuthor);
        } else {  // no image
            updateState(0, 1, 1, state.currentAuthor);
        }
        imageListeners.forEach(function(listener){
            listener(image);
        });
    }

    module.onImageUpdate = function(listener){
        imageListeners.push(listener);
        if (getUsername()) {
            getImage(0, function(err, image){
                if (err) return notifyErrorListeners(err);
                if (image) {
                    let state = window.history.state;
                    updateState(image._id, state.imagePage, state.commentPage, state.currentAuthor);
                    listener(image);
                    getComments(image._id, function(err, comments){
                        notifyCommentListeners(comments);
                    });
                } else {
                    listener(null);
                    notifyCommentListeners([]);
                }
            });
        }
    };

    let commentListeners = [];

    // register an comment listener
    // to be notified when a comment is added or deleted to an comments
    function notifyCommentListeners(comments){
        commentListeners.forEach(function(listener){
            listener(comments);
        });
    }

    module.onCommentUpdate = function(listener){
        commentListeners.push(listener);
        if (getUsername()) {
            let state = window.history.state;
            if (state) {
                getComments(state.imageId, function(err, comments){
                    if (err) return notifyErrorListeners(err);
                    listener(comments);
                });
            } else {  // no image in the gallery
                listener(null);
            }
        }
    };

    let errorListeners = [];

    function notifyErrorListeners(err){
        errorListeners.forEach(function(listener){
            listener(err);
        });
    }

    module.onError = function(listener){
        errorListeners.push(listener);
    };

    let userListeners = [];
    
    let getUsername = function(){
        return document.cookie.replace(/(?:(?:^|.*;\s*)username\s*\=\s*([^;]*).*$)|^.*$/, "$1");
    };
    
    module.isLoginUserGallery = function () {
        return getUsername() == window.history.state.currentAuthor;
    };

    function notifyUserListeners(username){
        userListeners.forEach(function(listener){
            listener(username);
        });
    }
    
    module.onUserUpdate = function(listener){
        userListeners.push(listener);
        listener(getUsername());
    };

    module.login = function(username, password){
        send("POST", "/login/", {username, password}, function(err, res){
            if (err) return notifyErrorListeners(err);
            let currentAuthor = getUsername();
            notifyUserListeners(currentAuthor);
            getImage(0, function(err, image){
                if (err) return notifyErrorListeners(err);
                if (image) {
                    let state = window.history.state;
                    updateState(image._id, state.imagePage, state.commentPage, currentAuthor);
                    notifyImageListeners(image);
                    getComments(image._id, function(err, comments){
                    notifyCommentListeners(comments);
                    });
                } else {
                    updateState(0, 1, 1, currentAuthor);
                    notifyImageListeners(null);
                    notifyCommentListeners([]);
                }
            });
        });
    };
    
    module.register = function(username, password){
        send("POST", "/register/", {username, password}, function(err, res){
            if (err) return notifyErrorListeners(err);
            let currentAuthor = getUsername();
            notifyUserListeners(currentAuthor);
            getImage(0, function(err, image){
                if (err) return notifyErrorListeners(err);
                if (image) {
                    let state = window.history.state;
                    updateState(image._id, state.imagePage, state.commentPage, currentAuthor);
                    notifyImageListeners(image);
                    getComments(image._id, function(err, comments){
                        notifyCommentListeners(comments);
                    });
                } else {
                    updateState(0, 1, 1, currentAuthor);
                    notifyImageListeners(null);
                    notifyCommentListeners([]);
                }
            });
        });
    };

    module.logout = function(){
        send("GET", "/logout/", null, function(err, res){
            if (err) return notifyErrorListeners(err);
            updateState(0, 1, 1, '');
            notifyImageListeners(null);
            notifyCommentListeners([]);
            notifyUserListeners(getUsername());
        });
    };

    (function refresh(){
        setTimeout(function(e){
            let state = window.history.state;
            // try to get an image
            if (state.imageId) {
                getImage(state.imageId, function(err, image){
                    if (err) {  //
                        getImage(0, function(err, firstImage){
                            if (err) return notifyErrorListeners(err);
                            if (firstImage) {
                                updateState(firstImage._id, state.imagePage, state.commentPage, state.currentAuthor);
                                notifyImageListeners(firstImage);
                                getComments(firstImage._id, function(err, comments){
                                    notifyCommentListeners(comments);
                                });
                            } else {
                                notifyImageListeners(null);
                                notifyCommentListeners([]);
                            }
                        });
                    }
                    if (image) {
                        notifyImageListeners(image);
                        getComments(image._id, function(err, comments){
                            notifyCommentListeners(comments);
                        });
                    } else {
                        notifyImageListeners(null);
                        notifyCommentListeners([]);
                    }
                });
            }
            refresh();
        }, 2000);
    }());

    return module;
})();