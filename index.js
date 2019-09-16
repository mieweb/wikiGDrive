'use strict';
const yargs = require('yargs');
const { listFileTree } = require('./controller');

var argv = yargs
    .usage('Usage: $0 <shared drive url> [options]')
    .example('$0 [shared drive url] --dest ~/Users', 'sync google shared drive into local file system')
    .alias('c', 'config')
    .nargs('c', 1)
    .describe('c', 'set up config file')
    .alias('u', 'user')
    .nargs('u', 1)
    .describe('u', 'Email address for Google Shared Drive')
    .alias('p', 'pass')
    .nargs('p', 1)
    .describe('p', 'Password for Google Account')
    .alias('d', 'dest')
    .nargs('d', 1)
    .describe('d', 'Destinaion Path on local file system')
    .alias('w', 'watch')
    .boolean('w')
    .describe('w', 'Watch changes on google shared drive')
    // .demandOption(['user', 'pass'])
    .help('h')
    .alias('h', 'help')
    .epilog('copyright 2019')
    .showHelpOnFail(false, "Specify --help for available options")
    .argv;

var config = (argv.config)?argv.config:'.wikigdrive';
var user = (argv.user)?argv.user:'sample@gmail.com';
var password = (argv.pass)?argv.pass:'password';
var dest = (argv.dest)?argv.dest:__dirname;
var watch = (argv.watch)?true:false;

listFileTree();

console.log('process array -- ', process.argv);
console.log('array -- ', argv);
console.log('config -- ', config);
console.log('user -- ', user);
console.log('password -- ', password);
console.log('dest -- ', dest);
console.log('watch -- ', watch);