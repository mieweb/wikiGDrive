var express = require('express');
var router = express.Router();
var getFile = require('./controllers/googleDrive').getFile;
var googleDrive = require('./controllers/googleDrive').googleDrive;

/* GET home page. */
router.get('/', async function(req, res, next) {
  var results = await getFile();
  console.log('files', results);
  // var files = await googleDrive();
  res.render('index', { title: 'Express' });
});

module.exports = router;
