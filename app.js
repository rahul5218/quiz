const request = require("request");
require('dotenv').config();
const http=require("http");
const socketio = require("socket.io");
const express = require("express");
const bodyParser=require("body-parser");
const ejs=require("ejs");
const mongoose=require("mongoose");
const findOrCreate=require("mongoose-findorcreate");
const session=require("express-session");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const passport=require("passport");
const {generateMessage}=require("./utils/messages");

//------database connection and schema
mongoose.connect(process.env.DB, {useNewUrlParser: true,useUnifiedTopology: true})
.then(() => console.log('DB connection successful!'));

const userSchema=new mongoose.Schema({
  name:String,
  photo:String,
  googleId:String,
  facebookId:String,
  score:{type:Number,default:0},
  answers:[String]
});
userSchema.plugin(findOrCreate);
const User=new mongoose.model("User",userSchema);

//--------google authentication
passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/auth/google/quiz",
    userProfileURL:"https://www.googleapis.com/oauth2/v3/userinfo"
    }, function(accessToken, refreshToken, profile, cb) {
            //console.log(profile);
            User.findOrCreate({ googleId: profile.id,name:profile.displayName,photo:profile._json.picture}, function (err, user) {
              return cb(err, user);
            });
          }));
//----------passport authentication
passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
    User.findById(id, function(err, user) {
      done(err, user);
    });
});
//--------facebook authenticaton
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: "http://localhost:3000/auth/facebook/quiz",
  profileFields : ['id', 'photos', 'name', 'displayName', 'gender', 'profileUrl', 'email']
  },function(accessToken, refreshToken, profile, done) {
      //check user table for anyone with a facebook ID of profile.id
      User.findOne({facebookId: profile.id},function(err, user) {
        if (err) {
          return done(err);
        }
        //No user was found... so create a new user with values from Facebook (all the profile. stuff)
        if (!user) {
          user = new User({
            facebookId:profile.id,
            name: profile.displayName,
            photo:profile.photos[0].value
          });
          user.save(function(err) {
            if(err) console.log(err);
              return done(err, user);
          });
        } 
        else {
          //found user. Return
          return done(err, user);
        }
      });
    }
));

//--------express and socket.io setup
const app=express();
const server=http.createServer(app);
const io=socketio(server);

//--------middleware
app.use(express.static("public"));
app.set("view engine","ejs");
app.use(bodyParser.urlencoded({
  extended:true
}));

app.use(session({
  secret:"Our little secret.",
  resave:false,
  saveUninitialized:false
}));

app.use(passport.initialize());
app.use(passport.session());


//----------Routes
app.get("/",(req,res) => {
  res.render("login");
});

app.get("/auth/google",
  passport.authenticate('google', { scope: ['profile'] })
);

app.get('/auth/google/quiz',
  passport.authenticate('google', { failureRedirect: '/' }),
    function(req, res) {
      // Successful authentication, redirect home.
      res.redirect("/home");
});

app.get("/auth/facebook",passport.authenticate('facebook'));

app.get('/auth/facebook/quiz',
  passport.authenticate('facebook', { failureRedirect: '/' }),
    function(req, res) {
      // Successful authentication, redirect home.
      res.redirect("/home");
});



app.get("/home",(req,res) => {
  if(req.isAuthenticated()){     
    User.findById(req.user.id,(err,found) => {
      const score=found.score;
      User.find((err,docs)=>{
        const len=docs.length>10?10:docs.length;
        for(var i=0;i<len;i++){
          for(var j=1;j<len;j++){
            if(docs[j-1].score<docs[j].score){
              temp=docs[j];
              docs[j]=docs[j-1];
              docs[j-1]=temp;
            }
          }
        }
        res.render("home",{user:found,docs:docs});
      });
    });
  }
  else{
    res.redirect("/");
  }
});

app.post("/home",(req,res) => {
  //console.log(req.body);
  let category=req.body.trivia_category;
  let difficulty=req.body.trivia_difficulty;
  if(category=="any"){
    category="";
  }
  if(difficulty=="any"){
    difficulty="";
  }
  const url=`https://opentdb.com/api.php?amount=6&category=${category}&difficulty=${difficulty}&type=multiple&encode=url3986`;
  request({url:url,json:true},(err,response) => {
    if(err){
      console.log('unable to connect to server');
    }else{
      const apiResponse=response.body.results;
      User.findById(req.user.id,(err,found) => {
        if(!found){
          console.log("not found");
        }else{
            apiResponse.forEach((q) =>{
            found.answers.push(decodeURIComponent(q.correct_answer));
              var ran=Math.floor(Math.random()*3);
              var temp=q.correct_answer;
              q.correct_answer=q.incorrect_answers[ran];
              q.incorrect_answers[ran]=temp;
          });
          found.save();
          console.log(apiResponse);
          res.render("quiz",{ques:apiResponse});
        }
      });
    }
  });
});

app.post("/result",(req,res) => {
  let score=0;
  User.findById(req.user.id,(err,found) => {
    for(var i=0;i<6;i++){
      if(req.body[i]==found.answers[i]){
        score++;
      }
    }
    console.log(score);
    found.score=found.score+score;
    found.answers=[];
    found.save();
    res.redirect("/home");
  });
});

app.get("/logout",(req,res) => {
  req.logout();
  res.redirect("/");
});

app.get("/contact",(req,res) => {
  res.render("contact");
});

app.get("*",(req,res) => {
  res.render("error");
});

//----------Socket.io
io.on('connection',(socket)=>{

  //user joined
  socket.emit('welcome',"Welcome");

  //new user joined
  socket.on('welcome',(message)=>{
    socket.broadcast.emit('welcome',message+" joined");
  });

  //new message
  socket.on('sendMessage',(message,callback)=>{
    socket.broadcast.emit('message',{text:generateMessage(message.text),user:message.user});
    socket.emit('my-message',{text:generateMessage(message.text),user:message.user});
    callback('Delivered');
  });

  // user disconnected
  // socket.on('disconnect',()=>{
  //   io.emit('message',generateMessage("user disconnect"));
  // });
});

//------------server listening
const port=process.env.PORT
server.listen(port,() => {
  console.log(`server started at port ${port}`);
});
