const mongoose = require('mongoose');
const express = require('express')
const bodyParser = require('body-parser')
const app = express()
const cors = require('cors')
require('dotenv').config()

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  useFindAndModify: false,
  useCreateIndex: true
});

app.use(cors())
app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const exerciseSchema = new mongoose.Schema({
  description: { type: String, required: false },
  duration: { type: Number, required: false },
  date: { type: Date, required: false }
});

const Exercise = mongoose.model('Exercise', exerciseSchema);

const userSchema = new mongoose.Schema({
  username: String,
  log: [exerciseSchema]
});

const User = mongoose.model('User', userSchema);

app.post('/api/exercise/new-user', (req, res) => {
  const username = req.body.username;
  const user = new User({ username });
  user.save((err, data) => {
    if (err) {
      console.log(err);
    } else if (data) {
      res.json({
        username: data.username,
        _id: data._id
      });
    }
  });
});

app.get('/api/exercise/users', (req, res) => {
  try {
    User.find({}, (err, data) => {
      if (err) {
        console.log(err);
      } else if (data) {
        res.json(data.map(user => {
          return {
            _id: user._id,
            username: user.username
          };
        }));
      }
    });
  } catch (e) {
    console.log(e);
  }
});

app.post('/api/exercise/add', async (req, res) => {
  const reqBody = req.body;

  try {
    if (reqBody.date == '' || !reqBody.hasOwnProperty('date')) {
      let date = new Date().toISOString().slice(0, 10);

      reqBody.date = date;
    }

    await User.findOneAndUpdate({
      _id: reqBody.userId
    }, {
        $push: {
          log: {
            description: reqBody.description,
            duration: reqBody.duration,
            date: reqBody.date
          }
        }
      }, (err) => {
        if (err) {
          console.log(err);
        }
      }).exec();

    await User.findOne({ _id: reqBody.userId }, (err, data) => {
      if (err) {
        console.log(err);
      } else if (data) {
        if (data.log.length == 0) {

        } else {
          res.json({
            _id: data._id,
            username: data.username,
            date: getDateFormat(data.log[data.log.length - 1].date),
            duration: data.log[data.log.length - 1].duration,
            description: data.log[data.log.length - 1].description
          });
        }

      }
    });
  } catch (e) {
    console.log(e);
  }
});

app.get('/api/exercise/log', async (req, res) => {
  const query = req.query;
  const id = query.userId;
  if(!id){
    return res.send(400, "Unknown userId");
  }
  const lims = {
    frm: query.from,
    to: query.to,
    limit: query.limit
  }

  const user = await User.findOne({_id: id});

  if(!user){
    res.json({
      error: "User not found"
    });
  } else {
    if (query.hasOwnProperty('from') || query.hasOwnProperty('to') || query.hasOwnProperty('limit')) {
      if(query.hasOwnProperty('limit') && !Number.isInteger(lims.limit)){
        return res.json({
          error: "limit should be a number"
        });
      }

      if(query.hasOwnProperty('from') && !lims.frm.match(/\d{4}-\d{2}-\d{2}/)){
        return res.json({
          error: "you should enter a correct date"
        });
      }

      if(query.hasOwnProperty('to') && !lims.to.match(/\d{4}-\d{2}-\d{2}/)){
        return res.json({
          error: "you should enter a correct date"
        });
      }

      if(lims.limit == NaN)
        lims.limit = undefined;
  
      if(lims.frm){
        user.log = user.log.filter(exercise => new Date(exercise.date) > new Date(lims.frm));
      }
  
      if(lims.to){
        user.log = user.log.filter(exercise => new Date(exercise.date) < new Date(lims.to));    
      }
  
      if(lims.limit){
        user.log = user.log.slice(0, lims.limit);
      }
      
      res.json({
        _id: user._id,
        username: user.username,
        count: user.log.length,
        log: user.log
          .map(exercise => {
            return {
              description: exercise.description,
              duration: exercise.duration,
              date: getDateFormat(exercise.date)
            };
          })
      });
  
    } else {
      res.json({
        _id: user._id,
        username: user.username,
        count: user.log.length,
        log: user.log
          .map(exercise => {
            return {
              description: exercise.description,
              duration: exercise.duration,
              date: getDateFormat(exercise.date)
            };
          })
      });
    }
  }
});

function getDateFormat(date) {
  let options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  let result;
  try{
    result = date.toLocaleString('en-US', options).replace(/\,/g, '').replace(/(\d)/, '0$1');
  } catch(e){
    console.log(e);
  }
  return result;
}



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
