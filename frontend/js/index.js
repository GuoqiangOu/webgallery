/*jshint esversion: 6 */
(function(){
    "use strict";
    window.onload = function(){
        window.history.replaceState({ imageId:0, imagePage:1, commentPage:1, currentAuthor:'' }, "Default", window.location.href);
        function submit(){
            if (document.querySelector("#login_form").checkValidity()){
                let username = document.querySelector("#login_form [name=username]").value;
                let password =document.querySelector("#login_form [name=password]").value;
                let action =document.querySelector("#login_form [name=action]").value;
                api[action](username, password, function(err){
                    if (err) document.querySelector('.error_box').innerHTML = err;
                });
            }
        }

        function toggleForm(elmtID){
            let elmt = document.getElementById(elmtID);
            if (elmt.style.display == "none") {
                elmt.style.display = "flex";
            } else {
                elmt.style.display = "none";
            }

        }
        
        function toggleBtn(username){
            document.querySelector("#logout_button").style.visibility = (username)? 'visible' : 'hidden';
            document.querySelector("#toggle_image_btn").style.visibility = (username)? 'visible' : 'hidden';
            document.querySelector("#toggle_comment_btn").style.visibility = (username)? 'visible' : 'hidden';
            document.querySelector("#toggle_login_form").style.display = (username)? 'none' : 'flex';
            document.querySelector(".author_pagination").style.display = (username)? 'flex' : 'none';
            document.querySelector('#greetings').innerHTML = (username)? `<h1>Current User: ${username}</h1>`: '';
        }

        api.onError(function(err){
            console.error("[error]", err);
        });
    
        api.onError(function(err){
            let error_box = document.querySelector('#error_box');
            error_box.innerHTML = err;
            error_box.style.visibility = "visible";
        });

        api.onUserUpdate(function(username){
            toggleBtn(username);
            document.querySelector("#images").innerHTML ="";
            if (username) {
                // gallery pagination
                document.querySelector(".author_pagination .left_icon").addEventListener('click', function(e){
                    e.preventDefault();
                    api.authorPageLeft();
                });

                document.querySelector(".author_pagination .right_icon").addEventListener('click', function(e){
                    e.preventDefault();
                    api.authorPageRight();
                });
            }
        });

        api.onImageUpdate(function(image){
            document.querySelector('#images').innerHTML = "";
            let currentAuthor = window.history.state.currentAuthor;
            document.querySelector(".gallery_author").innerHTML = `<h1>${currentAuthor}'s Gallery</p>`;
            document.querySelector("#toggle_image_btn").style.visibility = (api.isLoginUserGallery())? 'visible' : 'hidden';
            if (image){
                // get elements
                let imageId = image._id;
                let title = image.title;
                let imagePage = window.history.state.imagePage;
                // create a new image element
                let elmt = document.createElement('div');
                elmt.className = "image";
                elmt.innerHTML=`
                    <div class="titles image_info">
                        <div class="image_title">Title: ${title}</div>
                    </div>
                    <div class="image_display">
                        <img class="the_image" src="/api/images/${imageId}/picture/" alt="${title}">
                    </div>
                    <div class="image_icons">
                        <div class="pagination image_pagination">
                            <div class="left_icon icon"></div>
                            <div class="page_num"><p>${imagePage}</p></div>
                            <div class="right_icon icon"></div>
                        </div>
                        <div class="delete_icon icon"></div>
                    </div>
                `;
                elmt.querySelector(".image_icons .left_icon").addEventListener('click', function(e){
                    api.imagePageLeft(imageId);
                });

                elmt.querySelector(".image_icons .right_icon").addEventListener('click', function(e){
                    api.imagePageRight(imageId);
                });

                elmt.querySelector(".image_icons .delete_icon").addEventListener('click', function(e){
                    api.deleteImage(imageId);
                });
                // add this element to the document
                document.querySelector('#images').prepend(elmt);
                document.querySelector("#images .delete_icon").style.visibility = (api.isLoginUserGallery())? 'visible' : 'hidden';
            } else {
                document.querySelector("#images").innerHTML =`
                    <div class="image" id="default_gallery_msg">
                        <div class="titles image_info">
                            <div class="image_title">Title: N/A</div>
                        </div>
                        <div class="image_display">
                            <div class="empty_msg"><p>Opps, no image in this gallery yet.</p></div>
                        </div>
                    </div>
                `;
            }
        });

        api.onCommentUpdate(function(comments){
            let state = window.history.state;
            if (!comments.length) {
                document.querySelector('#comments').innerHTML = "";
            }

            if (comments && comments.length !== 0 && state) {
                document.querySelector('#comments').innerHTML = "";
                let commentPage = state.commentPage;
                let imageId = state.imageId;
                // create a title element
                let titleElmt = document.createElement('div');
                titleElmt.className = "titles comment_title";
                titleElmt.innerHTML=`Comments For This Image`;
                // add this title to the document
                document.querySelector('#comments').prepend(titleElmt);

                comments.forEach(function(comment){
                    let commentId = comment._id;
                    
                    let author = comment.author;
                    let content = comment.content;
                    let date = comment.createdAt;

                    // create a new comment element
                    let elmt = document.createElement('div');
                    elmt.className = "comment_box";
                    elmt.innerHTML=`
                        <div class="comment">
                            <div class="comment_info">
                                <div class="comment_author">Author: ${author}</div>
                                <div class="comment_date">Date: ${date}</div>
                            </div>

                            <div class="comment_content">
                                <div class="display_content"><p>${content}</p></div>
                                <div class="delete_icon icon" id="delete_num${commentId}"></div>
                            </div>
                        </div>

                        <div class="comment_border"></div>
                    `;
                    let deleteId = "#delete_num" + String(commentId);

                    elmt.querySelector(deleteId).addEventListener('click', function(e){
                        api.deleteComment(commentId);
                    });
                    // add this element to the document
                    document.querySelector('#comments').append(elmt);
                });
                // create a pagination element
                let pageElmt = document.createElement('div');
                pageElmt.className = "pagination comment_pagination";
                pageElmt.innerHTML=`
                    <div class="left_icon icon"></div>
                    <div class="page_num">${commentPage}</div>
                    <div class="right_icon icon"></div>
                `;

                pageElmt.querySelector(".comment_pagination .left_icon").addEventListener('click', function(e){
                    api.commentPageLeft(imageId);
                });

                pageElmt.querySelector(".comment_pagination .right_icon").addEventListener('click', function(e){
                    api.commentPageRight(imageId);
                });

                // add this pagination to the document
                document.querySelector('#comments').append(pageElmt);
            }
        });


        // toggle image form button
        document.getElementById('toggle_image_btn').addEventListener('click', function(e){
            // prevent from refreshing the page on onclick
            e.preventDefault();
            toggleForm("toggle_image_form");
        });

        // toggle comment form button
        document.getElementById('toggle_comment_btn').addEventListener('click', function(e){
            // prevent from refreshing the page on onclick
            e.preventDefault();
            toggleForm("toggle_comment_form");
        });

        // add image form
        document.getElementById('add_image_form').addEventListener('submit', function(e){
            // prevent from refreshing the page on submit
            e.preventDefault();
            let title = document.querySelector('#post_image_title').value;
            let picture = document.querySelector('#picture').files[0];
            document.getElementById('add_image_form').reset();
            toggleForm("toggle_image_form");
            api.addImage(title, picture);
        });

        // add comment form
        document.getElementById('add_comment_form').addEventListener('submit', function(e){
            // prevent from refreshing the page on submit
            e.preventDefault();
            let content = document.querySelector('#post_comment_content').value;
            let curImageId = window.history.state.imageId;
            document.getElementById('add_comment_form').reset();
            toggleForm("toggle_comment_form");
            api.addComment(curImageId, content);
        });

        // login
        document.querySelector('#login').addEventListener('click', function(e){
            e.preventDefault();
            document.querySelector("form [name=action]").value = 'login';
            submit();
            document.getElementById('login_form').reset();
        });

        // register
        document.querySelector('#register').addEventListener('click', function(e){
            e.preventDefault();
            document.querySelector("form [name=action]").value = 'register';
            submit();
            document.getElementById('login_form').reset();
        });

        // logout
        document.querySelector('#logout_button').addEventListener('click', function(e){
            document.querySelector("#toggle_image_form").style.display = 'none';
            document.querySelector("#toggle_comment_form").style.display = 'none';
            api.logout();
        });
    };
}());
