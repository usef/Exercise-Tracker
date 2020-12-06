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

app.get('/api/exercise/users', async (req, res) => {
  try {
    await User.find({}, (err, data) => {
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

    const user = await User.findOne({_id: reqBody.userId});
    user.log.push({
      description: reqBody.description,
      duration: reqBody.duration,
      date: reqBody.date
    });

    const result = await user.save();

    return res.json({
      _id: result._id,
      username: result.username,
      date: getDateFormat(result.log[result.log.length - 1].date),
      duration: result.log[result.log.length - 1].duration,
      description: result.log[result.log.length - 1].description
    });

  } catch (e) {
    console.log(e);
  }
});

app.get('/api/exercise/log', async (req, res) => {
  const query = req.query;
  const id = query.userId;
  if(!id){
    return res.status(400, "Unknown userId");
  }
  const lims = {
    frm: query.from,
    to: query.to,
    limit: query.limit
  }

  try{
    const user = await User.findOne({_id: id});

    if(!user)
      return res.json({error: "User not found"});
    
    //Sort the logs
    user.log = user.log.sort((a, b) => {
      let comparison = 0;
      if(a.date > b.date){
        comparison = 1;
      } else if(a.date < b.date){
        comparison = -1;
      }
      return comparison * -1;
    });
    
    if(query.hasOwnProperty('from')){
      if(!lims.frm.match(/\d{4}-\d{2}-\d{2}/))
        return res.json({error: "you should enter a correct date"});
      else
        user.log = user.log.filter(exercise => new Date(exercise.date) >= new Date(lims.frm));
    } 

    if(query.hasOwnProperty('to')){
      if(!lims.to.match(/\d{4}-\d{2}-\d{2}/))
        return res.json({error: "enter a correct date"});
      else
        user.log = user.log.filter(exercise => new Date(exercise.date) <= new Date(lims.to));    
    }

    if(query.hasOwnProperty('limit')){
      if(!Number.isInteger(parseInt(lims.limit)))
        return res.json({
          error: "limit should be a number"
        });
      else
        user.log = user.log.slice(0, lims.limit);
    }
    
    return returnLogs(user, res);

  } catch(e){
    console.log(e);
  }

});

function returnLogs(user, res){
  return res.json({
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

function getDateFormat(date) {
  let options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
  let result;
  try{
    result = date.toLocaleString('en-US', options).replace(/\,/g, '').replace(/ (\d){1} /g, ' 0$1 ');
  } catch(e){
    console.log(e);
  }
  return result;
}



const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})
