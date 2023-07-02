/////// app.js

const express = require("express");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");
const moment = require("moment"); //moment.js library for saving the time of the posts

///////database stuff

const mongoDb = "mongodb+srv://chriscarter19822:aRZ3sh5fgnkwt5wf@gettingstarted.ogxgdib.mongodb.net/?retryWrites=true&w=majority";
mongoose.connect("mongodb://127.0.0.1:27017/membersOnly")


const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    membershipStatus: { type: Boolean, default:false },
  });

const User = mongoose.model("User", userSchema);


const dateNow = moment() //using moment.js library to get the date in a format that mongo recognizes

const Post = mongoose.model(
    "Post",
    new Schema({
      title: { type: String, required: true },
      content: { type: String, required: true },
      creator: userSchema,
      date: { type: Date, default:dateNow },
    })
);

const app = express();
app.set("view engine", "ejs");
app.use(express.static("public"));


///////////PASSPORT CONFIG

passport.use(
    new LocalStrategy(async(username, password, done) => {
      try {
        const user = await User.findOne({ username: username });
        //comparing usernames to see if they match
        if (!user) {
          return done(null, false, { message: "Incorrect username" });
        };
        //comparing passwords (hashed) to see if they match
        bcrypt.compare(password, user.password, (err, res) => {
            if (res) {
              // passwords match! log user in
              return done(null, user)
            } else {
              // passwords do not match!
              return done(null, false, { message: "Incorrect password" })
            }
          }) 
      } catch(err) {
        return done(err);
      };
    })
);

  passport.serializeUser(function(user, done) {
    done(null, user.id);
  });
  
  passport.deserializeUser(async function(id, done) {
    try {
      const user = await User.findById(id);
      done(null, user);
    } catch(err) {
      done(err);
    };
  });

///////////

app.use(session({ secret: "cats", resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());
app.use(express.urlencoded({ extended: false }));


//thanks to this, you will be able to tap into the currentUser variable everywhere! even in views!!
app.use(function(req, res, next) {
    res.locals.currentUser = req.user;
    next();
});

app.get("/", (req, res) => {

    Post.find({}).then(allPosts => {
  
        res.render("index", {
          user: req.user,
          allPosts: allPosts
          });
    });
      
});

app.get("/sign-up", (req, res) => res.render("sign-up-form"));

app.post("/sign-up", 

  //validation and sanitization, using express-validator
    body("firstName")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage("First name must be specified."),

    body("lastName")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage("Last name must be specified."),

    body("username")
    .trim()
    .isLength({ min: 1 })
    .escape()
    .withMessage("Username must be specified.")
    .isAlphanumeric()
    .withMessage("Username has non-alphanumeric characters."),


    //this is a custom validator from express-validatior
    //https://express-validator.github.io/docs/guides/customizing/
    body('passwordConfirmation').custom((value, { req }) => {
        return value === req.body.password;
    })
    .escape()
    .withMessage("Passwords don't match"),
    

    //after the validation, going forward with the route
    async (req, res, next) => {
        // Extract the validation errors from a request.
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values/errors messages.

            //we are defining the USER model here to give back the values to the form
            const user = new User({
                firstName: req.body.firstName,
                lastName: req.body.lastName,
                username: req.body.username,
                password: ""
            });

            res.render("sign-up-form", {
              user: user,
              errors: errors.array(),
            });
            return;

            //data from form passed all the validation checks.
          } else {
            // Data from form is valid.
                //encryipting password with bcrypt
                bcrypt.hash(req.body.password, 10, async (err, hashedPassword) => {
                    // if err, do something
                    if (err){
                        console.log(err)
                    }
                    // otherwise, store hashedPassword in DB
                    else{
                        //adding it to db
                        //using try catch etc, because async
                        try {
                            const user = new User({
                            firstName: req.body.firstName,
                            lastName: req.body.lastName,
                            username: req.body.username,
                            password: hashedPassword
                            });
                            await user.save();
                            res.redirect("/");
                        } catch(err) {
                            return next(err);
                        };
                    } 
                }); 
          }

});

app.get("/join-the-club", (req, res) => res.render("join-the-club"));


app.post("/join-the-club", 

    //validation and sanitization, using express-validator
    //this is a custom validator from express-validatior
    //https://express-validator.github.io/docs/guides/customizing/
    body('passcode').custom((value, { req }) => {
        return value === "666";
    })
    .escape()
    .withMessage("Wrong passcode"),



    //after the validation, going forward with the route
    async (req, res, next) => {
        // Extract the validation errors from a request.
        const errors = validationResult(req);

        if (!errors.isEmpty()) {
            // There are errors. Render form again with sanitized values/errors messages.
            res.render("join-the-club", {
              errors: errors.array(),
            });
            return;

        //data from form passed all the validation checks.
        } else {
            try {
                //we have to change the field "membershipStatus" in the current user model to "true"
                //we tap into current user with req.user
                req.user.membershipStatus = true
                await req.user.save();
                res.redirect("/");
            } catch(err) {
                return next(err);
            };

        } 
}); 


app.get("/login", (req, res) => res.render("login"));


app.post("/login", 
passport.authenticate("local", {
    successRedirect: "/",
    failureRedirect: "/"
  })
);

app.get("/log-out", (req, res, next) => {
    req.logout(function (err) {
      if (err) {
        return next(err);
      }
      res.redirect("/");
    });
});

app.get("/new-message", (req, res) => res.render("new-message"));



app.post("/new-message", async (req, res, next) => {
    try {
        const post = new Post({
        title: req.body.title,
        content: req.body.message,
        creator: req.user,
        });
        await post.save();
        res.redirect("/");
    } catch(err) {
        return next(err);
    };

});

app.listen(3000, () => console.log("app listening on port 3000!"));