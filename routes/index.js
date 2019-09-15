var express = require('express');
var router = express.Router();
var googleDrive = require('./controllers/googleDrive').googleDrive;

/* GET home page. */
router.get('/', async function(req, res, next) {
  var results = await googleDrive();
  console.log('files', results);
  res.render('index', { title: 'Express' });
});

module.exports = router;
