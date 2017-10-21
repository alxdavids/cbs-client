/*jshint esversion: 6 */
/*jshint node: true */

/**
 * A node.js client for talking to the Cloudflare challenge-bypass-server
 * Extension scripts included as submodule
 */

const net = require('net');
const issUtils = require('./issue-utils.js');
const sjcl = require('./sjcl-local.js');
const atob = require('atob');

const LOCALHOST = '127.0.0.1';
const PORT = 2416;
const TOKENS_TO_SIGN = 5;
let tokens;
let signatures;
let completeData = "";

const client = new net.Socket();
client.setTimeout(3000);

// Check that token signing functionality works
function GetSignedTokens() {
	client.connect(PORT, LOCALHOST, function() {
		console.log('Connected to ' + LOCALHOST + ":" + PORT);
		const req = issUtils.GenerateWrappedIssueRequest(TOKENS_TO_SIGN);
		tokens = req.tokens;
		client.write(req.wrap);
	});

	client.on('data', function(data) {
		completeData += data;
	});

	client.on('end', function() {
		let signatures = issUtils.parseIssueResponse(completeData, TOKENS_TO_SIGN, tokens);
		client.destroy();
	});

	client.on('close', function() {
		console.log("All good, connection closing.");
	});

	client.on('error', function(err) {
		console.error(err);
		client.destroy();
	});
}

GetSignedTokens();