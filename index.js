/*jshint esversion: 6 */
/*jshint node: true */

/**
 * A node.js client for talking to the Cloudflare challenge-bypass-server
 * Extension scripts included as submodule
 */

const net = require("net");
const utils = require("./utils.js");
const issUtils = require("./issue-utils.js");
const sjcl = require("./sjcl-local.js");
const rewire = require('rewire');
const src = rewire('./challenge-bypass-extension/addon/compiled/test_compiled.js');

const LOCALHOST = "127.0.0.1";
const PORT = 2416;
let tokens;
const HOST = "HOST";
const PATH = "PATH";
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
  if (shouldRedeem) {
    // define and set localStorage
    localStorage = utils.localStorage;
    localStorage.setItem = function(k, v) { localStorage[k] = v; if (k == 'bypass-tokens-1') { RedeemToken(); } };
    src.__set__('localStorage', localStorage);
  }
  clientIss.connect(PORT, LOCALHOST, function() {
    console.log("");
    console.log("Connected to " + LOCALHOST + ":" + PORT + " for signing.");
    let req;
    while (true) {
      try {
        req = issUtils.GenerateWrappedIssueRequest(N);
      } catch (e) {
        if (e instanceof TypeError) {
          continue;
        } else {
          console.error(e);
          return;
        }
      }
      break;
    }
    tokens = req.tokens;
    signReqLen = req.wrap.length;
    clientIss.end(req.wrap);
  });

  clientIss.on("data", function(data) {
    completeData += data;
  });

  clientIss.on("end", function() {
    signRespLen = completeData.length;
    issUtils.parseIssueResponse(completeData, tokens);
    clientIss.destroy();
  });

  clientIss.on("close", function() {
  });

  clientIss.on("error", function(err) {
    console.error(err);
    clientIss.destroy();
  });
}

// Redeem one of the tokens that we were given
function RedeemToken() {
  clientRed.connect(PORT, LOCALHOST, function() {
    console.log("Connected to " + LOCALHOST + ":" + PORT + " for redemption.");
    console.log("***CLI_START_REDEEM***");
    console.time("whole-redeem");
    const token = getTokenForSpend();
    console.time("redeem-req");
    const redStr = utils.funcs.BuildRedeemHeader(token, HOST, PATH);
    const wrappedRedReq = utils.funcs.GenerateWrappedRedemptionRequest(redStr, HOST, PATH);
    console.timeEnd("redeem-req");
    redReqLen = wrappedRedReq.length;
    clientRed.end(wrappedRedReq);
  });
  
  clientRed.on("data", function(data) {
    if (data) {
      const dataStr = sjcl.codec.utf8String.fromBits(sjcl.codec.bytes.toBits(data));
      if (dataStr !== "success") {
        console.error("An error occurred server-side, redemption failed");
        console.log(dataStr);
      } else {
        console.log("Successful redemption.");
      }
      console.timeEnd("whole-redeem");
    }
  });
  
  clientRed.on("end", function() {
    clientRed.destroy();
  });
  
  clientRed.on("close", function() {
    console.log("***CLI_END_REDEEM***");
    console.log("All good, connection closing.");
    console.log("***MESSAGE_SIZES***");
    console.log("Sign Request length: " + signReqLen);
    console.log("Sign Response length: " + signRespLen);
    if (shouldRedeem) {
      console.log("Redeem request length: " + redReqLen);
    }
  });
  
  clientRed.on("error", function(err) {
    console.error(err);
    clientRed.destroy();
  });
}
  
function getTokenForSpend() {
  let tokenStr = localStorage.getItem('bypass-tokens-1');
  let storedTokens = JSON.parse(tokenStr);
  const t = storedTokens[0];
  storedTokens = storedTokens.slice(1);
  let usablePoint = utils.funcs.decodeStorablePoint(t.point);
  let usableBlind = new sjcl.bn(t.blind);
  if (t.token == null) {
    console.error("Token is null");
    clientRed.destroy();
  }
  return {token: t.token, point: usablePoint, blind: usableBlind};
}

let shouldRedeem = false;
if (process.argv[3] === "redeem") {
  shouldRedeem = true;
}
GetSignedTokens(parseInt(process.argv[2]), shouldRedeem);
