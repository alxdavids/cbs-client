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
const HOST = 'HOST';
const PATH = 'PATH';
let tokens;
let storedTokens; 
let completeData = "";
let signReqLen = 0;
let signRespLen = 0;
let redReqLen = 0;

const clientIss = new net.Socket();
clientIss.setTimeout(3000);
const clientRed = new net.Socket();
clientRed.setTimeout(3000);

// Check that token signing functionality works
function GetSignedTokens(N, shouldRedeem) {
	clientIss.connect(PORT, LOCALHOST, function() {
		console.log('');
		console.log('Connected to ' + LOCALHOST + ":" + PORT + " for signing.");
		console.log("***CLI_START_SIGN*** (N = " + N + ")");
		console.time('whole-issue');
		const req = issUtils.GenerateWrappedIssueRequest(N);
		tokens = req.tokens;
		signReqLen = req.wrap.length;
		clientIss.write(req.wrap);
	});

	clientIss.on('data', function(data) {
		completeData += data;
	});

	clientIss.on('end', function() {
		signRespLen = completeData.length;
		let signatures = issUtils.parseIssueResponse(completeData, N, tokens);
		console.time('token-store');
		storedTokens = issUtils.StoreTokens(tokens, signatures);
		console.timeEnd('token-store');
		clientIss.destroy();
		console.timeEnd('whole-issue');
		// Do redeem phase
		if (shouldRedeem) {
			RedeemToken();
		}
	});

	clientIss.on('close', function() {
		console.log("***CLI_END_SIGN***");
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
		console.log('***CLI_START_REDEEM***');
		console.time('whole-redeem');
		const token = storedTokens[0];
		storedTokens = storedTokens.slice(1);
		if (token == null) {
			console.error("Token is null");
			clientRed.destroy();
		}
		console.time('redeem-req');
		const redStr = redUtils.BuildRedeemHeader(token, HOST, PATH);
		const wrappedRedReq = redUtils.GenerateWrappedRedemptionRequest(redStr, HOST, PATH);
		console.timeEnd('redeem-req');
		redReqLen = wrappedRedReq.length;
		clientRed.write(wrappedRedReq);
	});

	clientRed.on('data', function(data) {
		const dataStr = sjcl.codec.utf8String.fromBits(sjcl.codec.bytes.toBits(data));
		if (dataStr !== "success") {
			console.error("An error occurred server-side, redemption failed");
			console.log(dataStr);
		} else {
			console.log("Successful redemption.");
		}
		console.timeEnd('whole-redeem');
	});

	clientRed.on('end', function() {
		clientRed.destroy();
	});

	clientRed.on('close', function() {
		console.log('***CLI_END_REDEEM***');
		console.log("All good, connection closing.");
		console.log('***MESSAGE_SIZES***');
		console.log('Sign Request length: ' + signReqLen);
		console.log('Sign Response length: ' + signRespLen);
		if (shouldRedeem) {
			console.log('Redeem request length: ' + redReqLen);
		}
	});

	clientRed.on('error', function(err) {
		console.error(err);
		clientRed.destroy();
	});
}

let shouldRedeem = false;
if (process.argv[3] === "redeem") {
	shouldRedeem = true;
}
GetSignedTokens(parseInt(process.argv[2]), shouldRedeem);