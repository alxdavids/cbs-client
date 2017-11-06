/*jshint esversion: 6 */
/*jshint node: true */

/**
 * A node.js client for talking to the Cloudflare challenge-bypass-server
 * Extension scripts included as submodule
 */

const net = require('net');
const issUtils = require('./issue-utils.js');
const redUtils = require('./redeem-utils.js');
const sjcl = require('./sjcl-local.js');
const atob = require('atob');

const LOCALHOST = '127.0.0.1';
const PORT = 2416;
const TOKENS_TO_SIGN = 5;
const HOST = 'HOST';
const PATH = 'PATH';
let tokens;
let storedTokens; 
let completeData = "";
let tokensRetrieved = false;

const clientIss = new net.Socket();
clientIss.setTimeout(3000);
const clientRed = new net.Socket();
clientRed.setTimeout(3000);

// Check that token signing functionality works
function GetSignedTokens() {
	clientIss.connect(PORT, LOCALHOST, function() {
		console.log('Connected to ' + LOCALHOST + ":" + PORT + " for signing.");
		const req = issUtils.GenerateWrappedIssueRequest(TOKENS_TO_SIGN);
		tokens = req.tokens;
		clientIss.write(req.wrap);
	});

	clientIss.on('data', function(data) {
		completeData += data;
	});

	clientIss.on('end', function() {
		let signatures = issUtils.parseIssueResponse(completeData, TOKENS_TO_SIGN, tokens);
		storedTokens = issUtils.StoreTokens(tokens, signatures);
		tokensRetrieved = true;
		clientIss.destroy();
		RedeemToken();
	});

	clientIss.on('close', function() {
		console.log("All good, connection closing.");
	});

	clientIss.on('error', function(err) {
		console.error(err);
		clientIss.destroy();
	});
}

// Redeem one of the tokens that we were given
function RedeemToken() {
	clientRed.connect(PORT, LOCALHOST, function() {
		console.log('Connected to ' + LOCALHOST + ":" + PORT + " for redemption.");
		const token = storedTokens[0];
		storedTokens = storedTokens.slice(1);
		if (token == null) {
			console.error("Token is null");
			clientRed.destroy();
		}
		const redStr = redUtils.BuildRedeemHeader(token, HOST, PATH);
		const wrappedRedReq = redUtils.GenerateWrappedRedemptionRequest(redStr, HOST, PATH);
		clientRed.write(wrappedRedReq);
	});

	clientRed.on('data', function(data) {
		const dataStr = sjcl.codec.utf8String.fromBits(sjcl.codec.bytes.toBits(data));
		if (dataStr !== "success") {
			console.error("An error occurred server-side, redemption failed");
			console.log(dataStr);
		} else {
			console.log("Successful redemption.")
		}
	});

	clientRed.on('end', function() {
		clientRed.destroy();
	});

	clientRed.on('close', function() {
		console.log("All good, connection closing.");
	});

	clientRed.on('error', function(err) {
		console.error(err);
		clientRed.destroy();
	});
}

GetSignedTokens();